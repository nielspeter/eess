import {
  type Node,
  type ClassDeclaration,
  type Decorator,
  type SourceFile,
  type ParameterDeclaration,
  type MethodDeclaration,
  type ConstructorDeclaration,
  type GetAccessorDeclaration,
  type SetAccessorDeclaration,
  Node as NodeUtils,
  SyntaxKind,
} from 'ts-morph'
import type { ExpressionMatcher } from './matchers.js'
import type { ArchFunction } from '../models/arch-function.js'
import { allDescendants, descendantsOfKind } from '../core/descendant-cache.js'

/**
 * Options for module body analysis.
 */
export interface ModuleBodyOptions {
  /**
   * When true, only traverse top-level (module-scope) statements.
   * Skips class bodies, function bodies, and arrow function bodies.
   * Default: false (full file traversal).
   */
  scopeToModule?: boolean
}

/**
 * Result of searching a body for matcher hits.
 */
interface MatchResult {
  /** Whether at least one match was found */
  found: boolean
  /** The matching nodes (for violation reporting: file, line, text) */
  matchingNodes: Node[]
  /**
   * Parallel to {@link matchingNodes}: which comment each match is about, for
   * trivia matchers. `undefined` entries mean the node itself is the match.
   *
   * Bug 0034. One node can carry several matching comments, so the node alone
   * cannot identify a finding — four stacked `// TODO` lines lead one
   * statement and are four findings, not one.
   */
  triviaPositions: (number | undefined)[]
}

/** One match: the node to report on, and which comment it is about. */
interface Match {
  readonly node: Node
  readonly triviaPos?: number
}

/** Split matches into the parallel arrays `MatchResult` carries. */
function toResult(matches: readonly Match[]): MatchResult {
  return {
    found: matches.length > 0,
    matchingNodes: matches.map((m) => m.node),
    triviaPositions: matches.map((m) => m.triviaPos),
  }
}

/**
 * Targeted traversal: only check nodes of the specified syntax kinds.
 */
function findMatchesByKind(node: Node, matcher: ExpressionMatcher): Match[] {
  const matches: Match[] = []
  for (const kind of matcher.syntaxKinds ?? []) {
    // Cached: the walk is a function of (node, kind) and only the matcher's
    // filter differs, so N matchers over one body did N identical traversals.
    // `agentGuardrails` emits one rule per banned API and paid exactly that.
    for (const descendant of descendantsOfKind(node, kind)) {
      if (matcher.matches(descendant)) {
        matches.push({ node: descendant })
      }
    }
  }
  return matches
}

/**
 * The line a finding about `node` should name.
 *
 * For a trivia matcher that is the **comment's** line, not the node's — the
 * position comes from `MatchResult.triviaPositions`, alongside the node. One
 * accessor rather than ten open-coded `node.getStartLineNumber()` calls,
 * because the `notContain` family computes the line twice per finding (the
 * `line` field and the message text) and the two must not disagree.
 */
export function reportedLine(node: Node, triviaPos: number | undefined): number {
  if (triviaPos === undefined) return node.getStartLineNumber()
  return node.getSourceFile().getLineAndColumnAtPos(triviaPos).line
}

/**
 * Broad traversal: check every descendant, then deduplicate.
 *
 * Parent nodes' getText() includes children's text, so regex-based
 * matchers (expression()) match at multiple ancestor levels.
 * Keep only the deepest (most specific) matching nodes.
 *
 * Several nodes can share one span — a statement without a semicolon and its
 * expression, a shorthand property and its name, a call's only argument and
 * the `SyntaxList` holding it. Each lies inside the others, so a filter that
 * drops a match with another inside it dropped all of them and reported
 * nothing (bug 0322). Of a tie, the last in walk order is kept: the walk is
 * pre-order, so that is the deepest. `getAncestors()` cannot break the tie —
 * it follows `getParent()`, which skips the `SyntaxList` the walk yields.
 */
function findMatchesBroad(node: Node, matcher: ExpressionMatcher): Match[] {
  const matches: Node[] = []
  // Cached: the walk is kind-independent and identical across matchers, and
  // measured it is ~three quarters of a broad matcher's cost. Only the filter
  // below is per-matcher.
  for (const descendant of allDescendants(node)) {
    if (matcher.matches(descendant)) {
      matches.push(descendant)
    }
  }
  return matches
    .filter(
      (m, i) =>
        !matches.some((other, j) => {
          if (other === m) return false
          if (other.getStart() < m.getStart() || other.getEnd() > m.getEnd()) return false
          const sameSpan = other.getStart() === m.getStart() && other.getEnd() === m.getEnd()
          return !sameSpan || j > i
        }),
    )
    .map((n) => ({ node: n }))
}

/**
 * Find all nodes in a subtree that match the given matcher.
 *
 * Uses getDescendantsOfKind when the matcher specifies syntaxKinds
 * (efficient — only walks nodes of that kind). Falls back to
 * getDescendants() for matchers without syntaxKinds (expression()).
 */
function findMatchesInNode(node: Node, matcher: ExpressionMatcher): Match[] {
  // TRIVIA first, and at the dispatcher rather than inside the broad walk.
  // A trivia matcher may also narrow by `syntaxKinds` for speed — plan 0047's
  // `tsDirective()` wants exactly that — and with the branch one level down it
  // took the by-kind path and got no expansion at all.
  if (matcher.matchedTriviaPositions !== undefined) {
    return triviaMatches(node, matcher)
  }
  if (matcher.syntaxKinds && matcher.syntaxKinds.length > 0) {
    return findMatchesByKind(node, matcher)
  }
  return findMatchesBroad(node, matcher)
}

/**
 * One match per distinct COMMENT, not per node.
 *
 * The deepest-node filter is skipped deliberately: it exists because
 * `expression()` matches at every ancestor level, and a comment's node is where
 * it is **attached** rather than something containing it. Applying it made two
 * nodes with identical spans each remove the other — measured at zero findings
 * for three comments.
 *
 * The same comment is trivia of several nested nodes, so positions are
 * deduplicated globally and the first node to name one wins.
 */
function triviaMatches(node: Node, matcher: ExpressionMatcher): Match[] {
  const seen = new Set<number>()
  const out: Match[] = []
  const candidates =
    matcher.syntaxKinds && matcher.syntaxKinds.length > 0
      ? matcher.syntaxKinds.flatMap((kind) => [...descendantsOfKind(node, kind)])
      : allDescendants(node)
  for (const descendant of [node, ...candidates]) {
    for (const pos of matcher.matchedTriviaPositions?.(descendant) ?? []) {
      if (seen.has(pos)) continue
      seen.add(pos)
      out.push({ node: descendant, triviaPos: pos })
    }
  }
  // Source order. Pre-order visits an enclosing node's TRAILING range before
  // the statements it spans, so raw order is not the reader's.
  return out.sort((a, b) => (a.triviaPos ?? 0) - (b.triviaPos ?? 0))
}

/**
 * How much of a class a body search reads (bug 0307).
 *
 * - `'member-code'` — the code the class's members run: method, constructor and accessor bodies,
 *   parameter defaults — each default and computed key inside a destructured parameter included
 *   (bug 0309) — property initializers and static blocks.
 * - `'all-code'` — that, and the code the class runs outside its members when it is defined: every
 *   decorator expression (on the class, its members, accessors and parameters), computed member
 *   names and the `extends` expression.
 *
 * A search for what a class must NOT contain reads all of it: there, reading more fails closed. A
 * search for what it MUST contain reads member code only: there, reading less fails closed, and a decorator, a
 * computed name or the `extends` expression is wiring that must not satisfy a rule like
 * `classMustCall` — a DI token passed to a decorator included. The line is drawn by position: a
 * call in member code still satisfies it, a DI lookup in a field initializer included.
 *
 * A computed key inside a destructured parameter is member code, unlike a computed member name: the
 * key runs at each call, as a default does, and the member name runs once, when the class is
 * defined. So a call in the key satisfies a must-contain rule, and a call in the member name does not.
 *
 * A rule that forbids something may still read member code only, when the other positions hold
 * nothing it should report: `noMagicNumbers` does, because a number in a decorator argument such as
 * `@Max(150)` is named by the decorator that takes it (bug 0306).
 */
type ClassBodyReach = 'member-code' | 'all-code'

/**
 * Search the code a class runs (bugs 0300, 0307), as far as `reach` says.
 *
 * In four passes, for baselines. A match's identity is numbered within its enclosing declaration
 * (`match-identity.ts`), and a declaration is known by its name, so a getter and its setter, or a
 * static and an instance member of one name, share one. What the walk read before bug 0300 comes
 * first for every member, then what 0300 added, then what 0307 added, then what 0309 added, so a
 * finding a baseline accepted keeps its ordinal and a new one is numbered after it however the
 * members interleave:
 *
 * 1. every method, constructor and accessor body;
 * 2. every parameter default, property initializer (which covers an arrow-function property) and
 *    static block;
 * 3. for `'all-code'`: every parameter, member and property decorator, computed member name, class
 *    decorator and the `extends` expression;
 * 4. under either reach, the code every destructured parameter runs at each call, at any depth
 *    (`bindingPatternMatches`).
 *
 * Overload signatures have no body, defaults or decorators, so walking every constructor is the
 * same as walking the implementation. `implements` is type-only and docstrings are not code, so
 * neither is read, and a `comment()` rule reads code, not documentation.
 */
export function searchClassBody(
  cls: ClassDeclaration,
  matcher: ExpressionMatcher,
  reach: ClassBodyReach,
): MatchResult {
  const matchingNodes: Match[] = []
  const searchBody = (node: Node | undefined): void => {
    if (node !== undefined) matchingNodes.push(...findMatchesInNode(node, matcher))
  }
  const searchExpression = (node: Node | undefined): void => {
    if (node !== undefined) matchingNodes.push(...findMatchesInExpression(node, matcher))
  }
  const searchDecorators = (decorators: readonly Decorator[]): void => {
    for (const decorator of decorators) searchExpression(decorator.getExpression())
  }
  const searchComputedName = (name: Node): void => {
    if (NodeUtils.isComputedPropertyName(name)) searchExpression(name.getExpression())
  }

  const runnable = [
    ...cls.getMethods(),
    ...cls.getConstructors(),
    ...cls.getGetAccessors(),
    ...cls.getSetAccessors(),
  ]
  const properties = cls.getProperties()

  for (const member of runnable) searchBody(member.getBody())

  for (const member of runnable) {
    for (const parameter of member.getParameters()) searchExpression(parameter.getInitializer())
  }
  for (const property of properties) searchExpression(property.getInitializer())
  for (const block of cls.getStaticBlocks()) searchBody(block.getBody())

  if (reach === 'all-code') {
    for (const member of runnable) {
      for (const parameter of member.getParameters()) searchDecorators(parameter.getDecorators())
      if (!NodeUtils.isConstructorDeclaration(member)) {
        searchDecorators(member.getDecorators())
        searchComputedName(member.getNameNode())
      }
    }
    for (const property of properties) {
      searchDecorators(property.getDecorators())
      searchComputedName(property.getNameNode())
    }
    searchDecorators(cls.getDecorators())
    searchExpression(cls.getExtends()?.getExpression())
  }

  for (const member of runnable) {
    for (const parameter of member.getParameters()) {
      matchingNodes.push(...bindingPatternMatches(parameter.getNameNode(), matcher))
    }
  }

  matchingNodes.push(...parameterComments(runnable, matcher, reach, matchingNodes))

  return toResult(matchingNodes)
}

/**
 * The comments in a member's parameter list that the passes above have not already found (bug 0325).
 *
 * The class search reads a parameter as CODE — its default, and a destructured parameter's defaults
 * and computed keys — so a comment matcher searching those expressions misses a comment written on
 * the parameter itself, and one written inline between `=` and the default, which TypeScript counts
 * as leading trivia of neither. Measured before this fix: `m(g = /* TODO *\/ 1)` and a `// TODO` on its own
 * line before a parameter were 0 for the class rules and 1 for the function rules, on the same
 * member. A comment in a parameter list is the function search's for free — it starts a trivia
 * matcher at the declaration — and a class rule that cannot see a TODO marker there is a false green.
 *
 * **A member's own docstring is still not read** (bug 0307): it is trivia of the member, and this
 * pass starts at each parameter. Measured — the class search reports 0 for `/** TODO *\/` above a
 * method, before this pass and after it.
 *
 * Under `'member-code'` reach a comment inside a parameter's DECORATOR is left out, for the same
 * reason the decorator's code is (bug 0307): a must-contain rule must not be satisfied by wiring.
 * Its span covers the decorator's own leading trivia, so a comment written above `@Inject()` counts
 * as the decorator's, as a docstring counts as the member's.
 *
 * Deduplicated by comment position against everything already found, and pushed LAST, so a comment
 * inside a default keeps the ordinal a baseline accepted and a newly read one is numbered after it.
 */
function parameterComments(
  members: readonly (
    | MethodDeclaration
    | ConstructorDeclaration
    | GetAccessorDeclaration
    | SetAccessorDeclaration
  )[],
  matcher: ExpressionMatcher,
  reach: ClassBodyReach,
  found: readonly Match[],
): Match[] {
  if (matcher.matchedTriviaPositions === undefined) return []
  const seen = new Set(found.map((match) => match.triviaPos))
  const out: Match[] = []
  for (const member of members) {
    for (const parameter of member.getParameters()) {
      const wiring =
        reach === 'all-code'
          ? []
          : parameter
              .getDecorators()
              .map((decorator): readonly [number, number] => [
                decorator.getFullStart(),
                decorator.getEnd(),
              ])
      for (const match of findMatchesInNode(parameter, matcher)) {
        const pos = match.triviaPos
        if (seen.has(pos)) continue
        if (pos !== undefined && wiring.some(([start, end]) => pos >= start && pos < end)) continue
        seen.add(pos)
        out.push(match)
      }
    }
  }
  return out
}

/**
 * The code a destructured binding runs (bug 0309): for each binding element, at any depth, its computed
 * key, then its default, then the pattern it destructures into — the order they run. A name that is not
 * a pattern runs nothing, and a hole in an array pattern is not an element.
 *
 * One walk for both searches: the class search reads a member's parameters with it through
 * `bindingPatternMatches`, and the function search a function's through `codeOfParameters` (bug 0314).
 */
function codeOfBindingPattern(name: Node): Node[] {
  if (!NodeUtils.isObjectBindingPattern(name) && !NodeUtils.isArrayBindingPattern(name)) return []
  const code: Node[] = []
  for (const element of name.getElements()) {
    if (!NodeUtils.isBindingElement(element)) continue
    const key = element.getPropertyNameNode()
    if (NodeUtils.isComputedPropertyName(key)) code.push(key.getExpression())
    const initializer = element.getInitializer()
    if (initializer !== undefined) code.push(initializer)
    code.push(...codeOfBindingPattern(element.getNameNode()))
  }
  return code
}

/** Matches in the code a destructured parameter of a class member runs (bug 0309). */
function bindingPatternMatches(name: Node, matcher: ExpressionMatcher): Match[] {
  return codeOfBindingPattern(name).flatMap((code) => findMatchesInExpression(code, matcher))
}

/**
 * The code a function's parameters run (bug 0314): for each parameter, its default, then the code of
 * its destructured binding, if it has one. A default runs whenever its argument is omitted — like a
 * class member's parameter default, it is read as the function's code. A parameter without a default
 * or a pattern runs nothing.
 */
export function codeOfParameters(parameters: readonly ParameterDeclaration[]): Node[] {
  const code: Node[] = []
  for (const parameter of parameters) {
    const initializer = parameter.getInitializer()
    if (initializer !== undefined) code.push(initializer)
    code.push(...codeOfBindingPattern(parameter.getNameNode()))
  }
  return code
}

/**
 * Matches in an expression that is code in its own right — a property initializer or a
 * parameter default — including the expression itself (bug 0300).
 *
 * `findMatchesInNode` tests a subtree's descendants, not its root. That never mattered for a
 * body, a block: no shipped by-kind matcher names a block, and a broad matcher keeps the
 * deepest match, which lies inside it. An initializer can BE the match — `field = eval('1')`
 * — so its root has to be tested too. A trivia matcher already
 * includes the root. A broad matcher keeps only the deepest match, so the root counts only
 * when nothing inside it matched.
 */
function findMatchesInExpression(node: Node, matcher: ExpressionMatcher): Match[] {
  const inner = findMatchesInNode(node, matcher)
  if (matcher.matchedTriviaPositions !== undefined) return inner
  const kinds = matcher.syntaxKinds ?? []
  const broad = kinds.length === 0
  if (!broad && !kinds.includes(node.getKind())) return inner
  if (!matcher.matches(node)) return inner
  if (broad && inner.length > 0) return inner
  return [{ node }, ...inner]
}

/**
 * Matches in what a call condition searches — an argument, or a callback's body — including the
 * node itself unless it is a block (bug 0323).
 *
 * An argument can BE the match — `use(legacy(1))` — and so can a concise callback's body, which is
 * the expression itself: `use(() => legacy(1))`. With
 * `findMatchesInNode` alone neither was tested, under `call()` as under `expression()`. A block is
 * searched below its root, as `searchFunctionBody` searches a function's own: tested itself, a
 * block would match a broad pattern against the whole body.
 */
export function findMatchesInCode(node: Node, matcher: ExpressionMatcher): Match[] {
  return NodeUtils.isBlock(node)
    ? findMatchesInNode(node, matcher)
    : findMatchesInExpression(node, matcher)
}

/**
 * `findMatchesInCode` over several roots, numbered so a baseline keeps its identities (bug 0323):
 * every match below a root first, in order, then the roots that are matches themselves.
 *
 * 0.5.1 never tested a root, so each root match is new. Numbered in place, one would take the
 * ordinal of a match a baseline already accepted, and the new finding would be the one hidden —
 * as `searchClassBody` numbers the code bug 0300 made it read after the code it read before. A
 * trivia match was found on a root before too, so it keeps its place.
 */
export function findMatchesInEach(roots: readonly Node[], matcher: ExpressionMatcher): Match[] {
  const found = roots.map((root) => ({ root, matches: findMatchesInCode(root, matcher) }))
  const isNewRoot = (root: Node, match: Match): boolean =>
    match.node === root && match.triviaPos === undefined
  return [
    ...found.flatMap(({ root, matches }) => matches.filter((m) => !isNewRoot(root, m))),
    ...found.flatMap(({ root, matches }) => matches.filter((m) => isNewRoot(root, m))),
  ]
}

/**
 * The node a function's own docstring is attached to.
 *
 * For a `function` declaration that is the declaration itself. For an arrow or
 * function expression assigned to a `const`, `ArchFunction.getNode()` returns the
 * **VariableDeclaration**, and the comment attaches two levels up on the
 * `VariableStatement` — measured: `nodeLeading: 0`, `parentLeading: 0`,
 * `grandparentLeading: 1`. So the first version of bug 0052's fix repaired
 * `function f()` and left `const f = () => …` broken, which is half the codebases
 * that would use the rule.
 *
 * `getFirstAncestorByKind` finds the NEAREST enclosing statement, so a nested
 * arrow inside a function does not reach out to the outer function's docstring —
 * pinned by a control, because that over-reach is the obvious way to fix this
 * wrongly.
 */
function triviaRoot(node: Node): Node {
  if (!NodeUtils.isVariableDeclaration(node)) return node
  return node.getFirstAncestorByKind(SyntaxKind.VariableStatement) ?? node
}

/**
 * Search a function body for matches.
 *
 * Uses ArchFunction.getBody() which returns the function/arrow body.
 * For expression-bodied arrows (`() => expr`), getDescendantsOfKind
 * still works — it walks the expression subtree.
 */
export function searchFunctionBody(fn: ArchFunction, matcher: ExpressionMatcher): MatchResult {
  // A TRIVIA matcher searches from the DECLARATION; everything else from the body.
  //
  // [ts-archunit Bug 0052](https://github.com/nielspeter/ts-archunit/blob/main/bugs/fixed/0052-nostubcomments-cannot-see-a-functions-own-docstring.md):
  // a function's own leading comment attaches to the declaration, not to anything
  // inside the body — so `noStubComments()` saw a `TODO` inside a body and trailing
  // a function, and missed both `// TODO` and `/** TODO */` **above** it, which are
  // the two placements anyone actually writes. Measured 1/1/0/0 across those four.
  // `comment()` reads leading ranges perfectly well; the traversal never offered it
  // the declaration.
  //
  // Searching from the declaration rather than *also* searching it: `triviaMatches`
  // visits `[node, ...allDescendants(node)]` and deduplicates by comment position,
  // so the body is still covered and no comment can be reported twice. Testing the
  // declaration separately would have needed its own dedup against the body's.
  //
  // Only for trivia matchers, and that discrimination is the point rather than a
  // shortcut: `functionNotContain` is general-purpose, and handing the declaration
  // node to `expression(/…/)` would match the function's entire source text —
  // turning every body-analysis rule into a whole-declaration one. A matcher that
  // reads trivia is exactly the set that needs the attachment point.
  if (matcher.matchedTriviaPositions !== undefined) {
    return toResult(findMatchesInNode(triviaRoot(fn.getNode()), matcher))
  }

  const body = fn.getBody()
  if (!body) {
    return toResult([])
  }

  const matchingNodes = findMatchesInNode(body, matcher)

  // A CONCISE arrow body IS the expression — `() => eval(x)` has no Block, so
  // `getBody()` returns the CallExpression itself and both traversals walk only
  // its DESCENDANTS. The node that matters is therefore never tested, and bug
  // 0224 measured the consequence: `eval` in a concise arrow passed the
  // `recommended` floor every adopter installs.
  //
  // Only when the body is not a Block. Testing a Block root is the over-match
  // the comment above warns about — `expression(/…/)` against a Block matches
  // the function's whole body text, turning every body-analysis rule into a
  // whole-declaration one.
  //
  // Nor when a broad matcher already matched inside the body. The body is then an
  // ancestor of that match, which the broad search exists to leave out, and adding
  // it reported one match twice — `() => use(legacy(1))` under
  // `expression(/legacy\(1\)/)` (bug 0322). A by-kind matcher never tests the root
  // it searches, so for it the body is a different node and still counts.
  const broadHit = (matcher.syntaxKinds ?? []).length === 0 && matchingNodes.length > 0
  if (!NodeUtils.isBlock(body) && !broadHit && matcher.matches(body)) {
    matchingNodes.push({ node: body })
  }

  // What the parameters run — a default, and a destructured or rest parameter's defaults and computed
  // keys — is the function's code too (bug 0314). Read after the body, so within one function a finding a
  // baseline accepted in the body keeps its identity and a new one is numbered after it.
  for (const code of codeOfParameters(fn.getParameters())) {
    matchingNodes.push(...findMatchesInExpression(code, matcher))
  }
  return toResult(matchingNodes)
}

/**
 * Search a module (SourceFile) for matches.
 *
 * Default: walks the entire file (all descendants), including inside
 * class methods and function bodies. This makes `modules().notContain()`
 * a file-level policy check.
 *
 * With `scopeToModule: true`: walks only top-level statements,
 * skipping class bodies, function declaration bodies, and arrow/function
 * expression bodies. Use when you already have class/function rules and
 * want to avoid duplicate violations.
 */
/**
 * Collect matches from top-level variable statement initializers,
 * skipping arrow/function expressions (covered by function rules).
 */
function collectVariableStatementMatches(statement: Node, matcher: ExpressionMatcher): Match[] {
  if (!NodeUtils.isVariableStatement(statement)) return []
  const matches: Match[] = []
  for (const decl of statement.getDeclarationList().getDeclarations()) {
    const initializer = decl.getInitializer()
    if (!initializer) continue
    // Skip arrow/function expressions entirely — function rules cover them
    if (NodeUtils.isArrowFunction(initializer) || NodeUtils.isFunctionExpression(initializer)) {
      continue
    }
    // The initializer can BE the match — `const x = legacy(1)` (bug 0323).
    matches.push(...findMatchesInEach([initializer], matcher))
  }
  return matches
}

export function searchModuleBody(
  sourceFile: SourceFile,
  matcher: ExpressionMatcher,
  options?: ModuleBodyOptions,
): MatchResult {
  if (!options?.scopeToModule) {
    // Full file traversal — walk all descendants
    const matchingNodes = findMatchesInNode(sourceFile, matcher)
    return toResult(matchingNodes)
  }

  // Module-scope only — walk each top-level statement but skip class/function internals
  const matchingNodes: Match[] = []
  for (const statement of sourceFile.getStatements()) {
    // Skip class declarations entirely (their bodies are covered by class rules)
    if (NodeUtils.isClassDeclaration(statement)) continue

    // Skip function declarations entirely (their bodies are covered by function rules)
    if (NodeUtils.isFunctionDeclaration(statement)) continue

    // For variable statements (const/let/var), check the initializer but skip
    // arrow function and function expression bodies within it
    if (NodeUtils.isVariableStatement(statement)) {
      matchingNodes.push(...collectVariableStatementMatches(statement, matcher))
      continue
    }

    // All other statements: walk their descendants
    matchingNodes.push(...findMatchesInNode(statement, matcher))
  }

  return toResult(matchingNodes)
}
