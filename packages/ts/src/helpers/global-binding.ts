import { Node, SyntaxKind } from 'ts-morph'
import type { Identifier } from 'ts-morph'
import { throughWrappers } from '../core/through-wrappers.js'

/**
 * Reading a global through the bindings a file spells out (bug 0305).
 *
 * The security rules read a name at the site of use — `eval(…)`, `console.log(…)`,
 * `process.env.A` — which misleads them both ways. A global bound to a local name first
 * (`const ev = eval`, `const { log } = console`, `import { env } from 'node:process'`) is missed:
 * a false GREEN on an ordinary refactor. A local declaration that keeps a global's name
 * (`function Function(…) {}`, `const console = {…}`, a parameter called `process`) is reported as
 * the global: a false RED on code that touches no global at all.
 *
 * **The ruling this implements.** A name is read through its binding, as far as the file spells it:
 *
 * - **no declaration, or an ambient one** — `declare function eval`, a `.d.ts`, the lib — the name
 *   IS the global. That is the common case, and the one that must not change.
 * - **a local bound to a global expression** — `const ev = eval`, `const { log } = console`,
 *   `import { env } from 'node:process'` — reads as what it is bound to, through as many hops as
 *   the file spells out (`const ev = eval; const ev2 = ev`).
 * - **anything else local** — a function, a class, a parameter, a variable holding something else —
 *   is NOT the global, and nothing is reported for it.
 * - **a binding that cannot be resolved** falls back to the name as written. A missing type
 *   definition must never turn a rule off (ADR-009): an unresolvable name errs toward reporting.
 *
 * A `let` is read through its initializer like a `const`. It can be reassigned later, so the answer
 * is not certain — and for a prohibition the uncertain direction to take is the one that reports.
 */

/** The modules whose exports are the `process` global's members (`import { env } from …`). */
const PROCESS_MODULES: ReadonlySet<string> = new Set(['process', 'node:process'])

/** What an alias declaration is bound to: a node to resolve in turn, plus the path taken from it. */
interface AliasSource {
  readonly node: Node
  readonly suffix: readonly string[]
}

/**
 * The dotted global chain an expression denotes, following bindings, or `undefined` when it denotes
 * a local that is not a global.
 *
 * `chainOf` — the caller's reader for a dotted name — is passed in rather than imported, so this
 * module owns the binding question while `security.ts` keeps the one definition of what a name
 * chain is (bug 0308's matchers).
 */
export function globalChainOf(
  node: Node,
  chainOf: (node: Node) => string | undefined,
): string | undefined {
  const resolved = resolve(node, chainOf, new Set())
  if (resolved.kind === 'chain') return resolved.chain
  if (resolved.kind === 'not-a-global') return undefined
  // UNKNOWN: the name as written. A binding this reader cannot follow must never turn a rule off
  // (ADR-009), so it errs toward the reading that reports.
  return chainOf(node)
}

/**
 * Three answers, and the difference between the last two is the whole of ADR-009 here:
 *
 * - `chain` — this expression denotes that dotted global name.
 * - `not-a-global` — it provably denotes something else: a local function, class, parameter or
 *   enum, or a value that could not be a global (a literal, an object, a function, a `new`).
 * - `unknown` — this reader cannot follow it: a declaration kind it has no rule for, an import from
 *   a module it knows nothing about, an opaque initializer such as `require('node:process')`.
 *
 * The first version of this module answered `not-a-global` for both of the last two, and the
 * enforcement review measured what that cost on real code with real `@types/node`:
 * `const process = require('node:process'); process.env.A` reported nothing where 0.6.0 reported
 * it, against the sentence this module ships about itself.
 */
type Resolution =
  | { readonly kind: 'chain'; readonly chain: string }
  | { readonly kind: 'not-a-global' }
  | { readonly kind: 'unknown' }

const UNKNOWN: Resolution = { kind: 'unknown' }
const NOT_A_GLOBAL: Resolution = { kind: 'not-a-global' }

function resolve(
  node: Node,
  chainOf: (node: Node) => string | undefined,
  seen: ReadonlySet<Node>,
): Resolution {
  const chain = chainOf(node)
  // Not a name chain at all: a literal or an object cannot be a global; a call might be.
  if (chain === undefined) return isProvablyNotAGlobal(node) ? NOT_A_GLOBAL : UNKNOWN
  const root = rootIdentifierOf(node)
  if (root === undefined) return UNKNOWN

  const declarations = root.getSymbol()?.getDeclarations() ?? []
  // Unresolvable, declared nowhere, or ambient: the global itself. `declare function eval(…)`,
  // `lib.dom.d.ts` and `@types/node` all land here, which is why the ordinary case is unchanged.
  if (declarations.length === 0 || declarations.every(isAmbient)) return { kind: 'chain', chain }

  const rest = chain.split('.').slice(1)
  for (const declaration of declarations) {
    if (seen.has(declaration)) continue
    const imported = importedProcessMember(declaration)
    if (imported !== undefined) return { kind: 'chain', chain: [imported, ...rest].join('.') }
    const source = aliasSourceOf(declaration)
    if (source === undefined) continue
    const base = resolve(source.node, chainOf, new Set([...seen, declaration]))
    if (base.kind !== 'chain') return base
    return { kind: 'chain', chain: [base.chain, ...source.suffix, ...rest].join('.') }
  }
  // Only a declaration that POSITIVELY names a local value says "not the global". Everything else
  // reaching here is an unknown: a variable or binding element whose source could not be read, and
  // every import this reader has no rule for — an explicit branch for those was removed because it
  // could not be made to fail, which is this line answering them already.
  return declarations.every(isLocalValueDeclaration) ? NOT_A_GLOBAL : UNKNOWN
}

/**
 * Whether an expression could not possibly be a global: a literal, an object or array, a function,
 * a class, a `new`. Anything else — a call, an `await`, a conditional, a member of something opaque
 * — is an unknown, and an unknown reports (ADR-009).
 *
 * The distinction is the one the enforcement review measured this module conflating: "I followed
 * this and it is not a global" and "I could not follow this" were both answered `undefined`, so
 * `const process = require('node:process'); process.env.A` reported nothing where 0.6.0 reported it.
 */
function isProvablyNotAGlobal(node: Node): boolean {
  return (
    Node.isObjectLiteralExpression(node) ||
    Node.isArrayLiteralExpression(node) ||
    Node.isStringLiteral(node) ||
    Node.isNumericLiteral(node) ||
    Node.isNoSubstitutionTemplateLiteral(node) ||
    Node.isTemplateExpression(node) ||
    Node.isArrowFunction(node) ||
    Node.isFunctionExpression(node) ||
    Node.isClassExpression(node) ||
    Node.isNewExpression(node) ||
    Node.isTrueLiteral(node) ||
    Node.isFalseLiteral(node) ||
    Node.isNullLiteral(node)
  )
}

/**
 * Whether a declaration positively names a local value that cannot be a global — the shadow case.
 *
 * A variable or a binding element is absent on purpose: reaching here with one means its source
 * could not be read (a variable with no initializer, a parameter's destructuring), and an unread
 * source is an unknown, not a local.
 */
function isLocalValueDeclaration(declaration: Node): boolean {
  return (
    Node.isFunctionDeclaration(declaration) ||
    Node.isClassDeclaration(declaration) ||
    Node.isClassExpression(declaration) ||
    Node.isParameterDeclaration(declaration) ||
    Node.isEnumDeclaration(declaration) ||
    Node.isMethodDeclaration(declaration) ||
    Node.isPropertyDeclaration(declaration) ||
    Node.isFunctionExpression(declaration) ||
    Node.isArrowFunction(declaration)
  )
}

/**
 * Whether a declaration is ambient — in a `.d.ts`, or under a `declare` in a source file.
 *
 * The `declare` keyword sits on the STATEMENT, not on the declaration inside it: for
 * `declare const process: {…}` the `VariableDeclaration` has no keyword and its `VariableStatement`
 * has. Asking the declaration alone read the global `process` as a local and took the
 * `process.env` control to 0 — measured, before this walk replaced it.
 */
function isAmbient(declaration: Node): boolean {
  if (declaration.getSourceFile().isDeclarationFile()) return true
  for (const node of [declaration, ...declaration.getAncestors()]) {
    if (Node.isAmbientable(node) && node.hasDeclareKeyword()) return true
  }
  return false
}

/**
 * `process.<name>` when a declaration imports a member of the `process` module — the one binding
 * whose source is not in this file, and the reason `import { env } from 'node:process'` reaches the
 * environment under a name that was never `process`.
 */
function importedProcessMember(declaration: Node): string | undefined {
  if (Node.isImportSpecifier(declaration)) {
    const module = declaration.getImportDeclaration().getModuleSpecifierValue()
    return PROCESS_MODULES.has(module) ? `process.${declaration.getName()}` : undefined
  }
  // `import process from 'node:process'` — the form Node's ESM documentation recommends — and
  // `import * as process from 'node:process'`: the whole module IS the global.
  if (Node.isImportClause(declaration) || Node.isNamespaceImport(declaration)) {
    const importDeclaration = declaration.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)
    const module = importDeclaration?.getModuleSpecifierValue()
    return module !== undefined && PROCESS_MODULES.has(module) ? 'process' : undefined
  }
  return undefined
}

/** What a local declaration is bound to, when that is another expression in the file. */
function aliasSourceOf(declaration: Node): AliasSource | undefined {
  if (Node.isVariableDeclaration(declaration)) {
    const initializer = declaration.getInitializer()
    return initializer === undefined ? undefined : { node: initializer, suffix: [] }
  }
  // `const { log } = console` / `const { env: e } = process`, at any depth.
  if (Node.isBindingElement(declaration)) {
    const property = declaration.getPropertyNameNode() ?? declaration.getNameNode()
    if (!Node.isIdentifier(property)) return undefined
    const outer = patternSourceOf(declaration)
    return outer === undefined
      ? undefined
      : { node: outer.node, suffix: [...outer.suffix, property.getText()] }
  }
  return undefined
}

/** The expression a binding pattern destructures, walking out through nested patterns. */
function patternSourceOf(element: Node): AliasSource | undefined {
  const owner = element.getParent()?.getParent()
  if (owner === undefined) return undefined
  if (Node.isVariableDeclaration(owner)) {
    const initializer = owner.getInitializer()
    return initializer === undefined ? undefined : { node: initializer, suffix: [] }
  }
  if (Node.isBindingElement(owner)) {
    const property = owner.getPropertyNameNode() ?? owner.getNameNode()
    if (!Node.isIdentifier(property)) return undefined
    const outer = patternSourceOf(owner)
    return outer === undefined
      ? undefined
      : { node: outer.node, suffix: [...outer.suffix, property.getText()] }
  }
  return undefined
}

/**
 * The identifier a dotted name chain starts from.
 *
 * The value wrappers — parentheses, `as`, `<T>`, `satisfies`, `!` — come from
 * {@link throughWrappers}, which owns that list for the whole package; what is left here is the
 * access-expression walk and the comma operator, which it does not cover.
 */
function rootIdentifierOf(node: Node): Identifier | undefined {
  let current: Node | undefined = node
  while (current !== undefined) {
    const unwrapped = throughWrappers(current)
    if (unwrapped !== current) {
      // A parenthesized comma expression is the indirect-call idiom `(0, eval)`, whose value is the
      // right-hand side; `throughWrappers` steps into the parentheses and stops at the comma.
      current =
        unwrapped !== undefined &&
        Node.isBinaryExpression(unwrapped) &&
        unwrapped.getOperatorToken().getKind() === SyntaxKind.CommaToken
          ? unwrapped.getRight()
          : unwrapped
      continue
    }
    if (Node.isIdentifier(current)) return current
    if (Node.isPropertyAccessExpression(current) || Node.isElementAccessExpression(current)) {
      current = current.getExpression()
      continue
    }
    return undefined
  }
  return undefined
}
