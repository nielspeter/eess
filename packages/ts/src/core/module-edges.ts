import { Node, SyntaxKind } from 'ts-morph'
import type { SourceFile, StringLiteral } from 'ts-morph'
import { isTypeOnlyImport, isTypeOnlyReExport } from './import-options.js'
import { registerCacheReset, byCodepoint } from '@nielspeter/eess'
import { verbatimModuleSyntaxFor } from './per-root-compiler-options.js'

/**
 * One definition of "a module edge", for every condition that needs one.
 *
 * A real defect this closes: collecting edges from `sf.getImportDeclarations()`
 * sees only static `import` statements, while a reverse/cycle graph built a
 * different way can see static imports, re-exports **and** dynamic imports.
 * Two collectors disagreeing about what counts as an edge means
 * `onlyBeImportedVia('…')` can see a re-export as an import while
 * `notImportFrom('…')` does not, and `export { x } from './banned.js'`
 * crosses a banned edge unflagged.
 *
 * `SourceFile.getImportStringLiterals()` returns one literal per module
 * specifier across every edge-carrying form, from the binder's cached
 * `compilerNode.imports` rather than a descendant walk.
 *
 * **Two classification traps**, both of which would mark a *runtime*
 * dependency as erased — and both are why `kind` is a five-member union
 * rather than four:
 *
 * - `import x = require('s')` has parent `ExternalModuleReference`. A naive
 *   4-way branch ending in `else → 'type-expression'` gives it
 *   `typeOnly: true`, exempt under `ignoreTypeImports`. Common in
 *   hand-written `.d.ts`.
 * - `require('s')` in `.js` under `allowJs` has parent `CallExpression`, the
 *   same as `import('s')`. `getExpression().getKind() === ImportKeyword` is
 *   the only discriminator.
 *
 * **Nothing here narrows the literal.** `getImportStringLiterals()` is
 * declared `StringLiteral[]` and ``import(`./x.js`)`` yields a
 * `NoSubstitutionTemplateLiteral`, for which `Node.isStringLiteral()` is
 * **false**. ADR-005 bars the `as` that would re-narrow it, so an implementer
 * narrowing defensively silently drops the edge and `tsc` says nothing.
 * `getLiteralText()` typechecks and is correct for both.
 */
export type ModuleEdgeKind = 'import' | 'reexport' | 'dynamic' | 'type-expression' | 'require'

/** One module specifier leaving one file. */
export interface ModuleEdge {
  readonly kind: ModuleEdgeKind
  /** The specifier as written. */
  readonly specifier: string
  /** Resolved absolute path, when the compiler resolved it. */
  readonly resolvedPath: string | undefined
  /**
   * 1-based line of the **statement** carrying the edge.
   *
   * Equals `decl.getStartLineNumber()` for `kind === 'import'`. Not
   * necessarily the line of the specifier itself — a multi-line declaration
   * can put the two on different lines, and the reported line must track the
   * statement (what a code frame / GitHub annotation should point at), not
   * the literal.
   */
  readonly line: number
  /**
   * The **bindings** crossing this edge are type-level. Per-kind; see below.
   *
   * This is the *coupling* question — "does this file reference that file's
   * types" — and it is what `dependOn`, `notImportFrom`, `onlyImportFrom` and
   * the module predicates ask. It is deliberately NOT the same question as
   * {@link erasesModuleRequest}.
   */
  readonly typeOnly: boolean
  /**
   * The whole statement disappears, so **no module request is emitted** and
   * the target module is never evaluated.
   *
   * This is the *module-initialization* question — "will importing this file
   * cause that file to run" — and it is what cycle detection must ask. A
   * cycle is a deadlock in initialization order; a coupling is not.
   *
   * The two differ for exactly two spellings, and only under
   * `verbatimModuleSyntax: true`. Measured through ts-morph's own emit, same
   * source, both settings:
   *
   * | form                          | `vms: false` | `vms: true`                 |
   * | ----------------------------- | ------------ | --------------------------- |
   * | `import type { X } from 's'`  | erased       | erased                      |
   * | `import { type X } from 's'`  | erased       | **`import {} from 's'`**    |
   * | `import { type X, y } from`   | requests     | requests                    |
   * | `export type { X } from 's'`  | erased       | erased                      |
   * | `export { type X } from 's'`  | erased       | **`export {} from 's'`**    |
   * | `export { type X, y } from`   | requests     | requests                    |
   * | `export * from 's'`           | requests     | requests                    |
   * | `export type * as N from 's'` | erased       | erased                      |
   *
   * The specifiers vanish; the module request does not. So under that flag
   * those two forms are eager edges that can close a cycle, and treating
   * them as erased is a false negative.
   *
   * `erasesModuleRequest` implies `typeOnly`: a statement cannot vanish while
   * still binding a runtime value.
   */
  readonly erasesModuleRequest: boolean
  /**
   * Named bindings crossing the edge.
   *
   * **The name, not the local binding** — and which one differs per kind:
   *
   * - `reexport`: the **outward** name, `getAliasNode() ?? getName()`. For
   *   `export { INNER as OUTER } from 's'` this is `OUTER`, because that is
   *   the key the re-exporting module's runtime namespace carries.
   * - `import`: the **inward** name, `getName()`. For `import { c as d }`
   *   this is `c` — the name crossing the edge, not the local binding `d`.
   *
   * **Empty for `export *`**, and not because the names are unknowable — it
   * is empty for two other reasons: (1) it cannot separate an erased
   * re-export from a runtime one without a per-name resolve, and (2) it
   * would include names with no runtime existence when a module
   * augmentation elsewhere in the project injects an export into the star
   * target.
   *
   * **`export * as NS from 's'` is not a star for this purpose**: it
   * contributes exactly one name, `NS`, statically, with no recursion.
   * `isNamespaceExport()` returns true for both star forms, so
   * `getNamespaceExport()` is the only discriminator.
   *
   * Also empty for `dynamic`, `require`, `type-expression`, and for a
   * default or namespace `import` binding (`import D from 's'`,
   * `import * as NS from 's'`), which cross an edge under a name the
   * specifier list does not carry.
   */
  readonly names: readonly string[]
  /**
   * How many edges of the same `kind` and `specifier` precede this one in
   * the file, in source order. `0` for the first.
   *
   * It exists because {@link names} is **empty** wherever no name crosses
   * the edge, and a finding's identity is built from
   * `kind::specifier::names`. That is `dynamic`, `require` and
   * `type-expression` — and also four ordinary `import`/`reexport`
   * spellings: `import D from`, `import * as NS from`, a bare
   * `import './x.js'`, and `export * from`. Without a discriminator, two
   * lazy imports of the same module from one file collapse to one baseline
   * hash — one accepted entry silently pre-accepts the next one someone
   * adds.
   *
   * **Source-order ordinal rather than the line**, deliberately: a line
   * moves when anything above it is edited, and `identity` exists precisely
   * to survive that. The ordinal only moves when an edge of the same kind to
   * the same module is added or removed before it — which is a real change
   * to what the file does.
   *
   * The residual caveat, inherent to any positional tiebreaker: **a baseline
   * entry accepts "an edge of this kind to this module at position n", not
   * _this_ edge.** Deleting the first of a colliding pair and adding a
   * different one at the same position is a silent fail-open — strictly
   * better than the pre-ordinal behaviour (where any number of added
   * siblings was pre-accepted), but a limitation, not a guarantee. The
   * durable fix is a `binding` field consulted before the ordinal, which
   * would separate `import A` from `import C` outright — out of scope here.
   *
   * Both collectors must agree on it, so both walk the literals in source
   * order.
   */
  readonly ordinal: number
}

/**
 * Every module edge leaving each file, in one call.
 *
 * **Cached per file, invalidated by `onModified`.**
 */
export function moduleEdges(
  files: readonly SourceFile[],
): ReadonlyMap<string, readonly ModuleEdge[]> {
  const byFile = new Map<string, readonly ModuleEdge[]>()
  for (const sf of files) {
    byFile.set(sf.getFilePath(), edgesOf(sf))
  }
  return byFile
}

/**
 * Every module edge leaving one file, in source order.
 *
 * Exported for the predicate sites, which are per-element by construction
 * and would otherwise build a one-entry `Map` per file just to read it back
 * out.
 */
export function edgesOf(sourceFile: SourceFile): readonly ModuleEdge[] {
  const hit = cache.get(sourceFile)
  if (hit !== undefined) return hit
  const edges = buildEdges(sourceFile)
  if (!watched.has(sourceFile)) {
    // Once per file, not once per miss: a watch session that re-evaluates
    // rules would otherwise accumulate one listener per rule execution.
    watched.add(sourceFile)
    sourceFile.onModified(() => cache.delete(sourceFile))
  }
  cache.set(sourceFile, edges)
  return edges
}

/**
 * One built edge list per file, invalidated when the file is modified.
 *
 * **Why a listener rather than object identity.** A `SourceFile`'s identity
 * SURVIVES an edit — `addImportDeclaration` and `replaceWithText` both keep
 * the same object while the edges change — so a `WeakMap<SourceFile, …>`
 * without invalidation would serve pre-edit edges after an edit, and a
 * `notImportFrom` rule would then pass on the import the edit just added.
 * `onModified` is a ts-morph API (no raw compiler access, ADR-002) and fires
 * on every mutation path — `addImportDeclaration`, `replaceWithText`,
 * `remove` and `insertText` — and never on a read.
 */
let cache = new WeakMap<SourceFile, readonly ModuleEdge[]>()
const watched = new WeakSet<SourceFile>()

/**
 * Drop every cached edge list. Called by `resetProjectCache()`.
 *
 * `onModified` covers a change to the file that OWNS the edge. It does not
 * cover a change to the edge's **target** — `resolvedPath` is a function of
 * the whole program, so creating the file a specifier could not resolve to,
 * or deleting the one it did, leaves the importer's cached edge stale. This
 * is the escape hatch for that; `watched` is deliberately not cleared, since
 * those listeners stay correct.
 */
function clearModuleEdgeCache(): void {
  cache = new WeakMap<SourceFile, readonly ModuleEdge[]>()
}
registerCacheReset(clearModuleEdgeCache)

function buildEdges(sourceFile: SourceFile): readonly ModuleEdge[] {
  const verbatim = usesVerbatimModuleSyntax(sourceFile)
  const edges: (ModuleEdge & { pos: number })[] = []
  for (const literal of sourceFile.getImportStringLiterals()) {
    const parent = literal.getParent()
    if (parent === undefined) continue
    const kind = kindOf(parent)
    if (kind === undefined) continue
    edges.push({
      // The literal's absolute position, so the sort below is genuine source
      // order. It is dropped from the public shape by the `map` at the end.
      pos: literal.getPos(),
      ...makeEdge(literal, parent, kind, verbatim),
    })
  }
  // Source order, by the literal's absolute position.
  //
  // The binder's `imports` array puts declaration forms first and
  // expression forms after, regardless of where they appear — so without
  // this, filtering to one kind out of an interleaved file would still be
  // source-ordered per kind but not across kinds.
  //
  // Sorting by position (not by line + a name comparator): two edges on one
  // line, and `localeCompare` is ICU/locale sensitive — exactly the
  // machine-dependent ordering that would give one finding two identities
  // depending on which machine computed it.
  const counters = new Map<string, number>()
  return (edges.length > 1 ? [...edges].sort((a, b) => a.pos - b.pos) : edges).map(
    ({ pos: _pos, ...edge }) => ({ ...edge, ordinal: nextOrdinal(counters, edge) }),
  )
}

/**
 * What tells two edges of the same kind, from the same file, to the same
 * module apart.
 *
 * `names` when there are any; the source-order ordinal when there are not —
 * and **`names` is empty for a SPELLING, not for a kind**, which is the
 * distinction the whole of this comment turns on. `dynamic`, `require` and
 * `type-expression` never carry names, and neither do four ordinary
 * `import`/`reexport` spellings (`import D from`, `import * as NS from`, a
 * bare `import './x.js'`, `export * from`). Any of them, twice to one module
 * from one file, collapses to one hash without a discriminator — so one
 * accepted baseline entry silently pre-accepts the next one someone adds.
 *
 * The sort and the `,` are load-bearing and cheap to lose: `getNamedImports()`
 * returns source order, so without the sort a cosmetic reorder of a named
 * import list moves every multi-name entry in an adopter's baseline — an
 * import-sorting lint autofix would do it. Without the separator, `['a','b']`
 * and `['ab']` collide.
 *
 * **No existing baseline entry moves**, and that is what the `ordinal === 0`
 * branch buys. The naive form — `#${ordinal}` whenever `names` is empty —
 * moves far more than the three kinds it was written for, because `names` is
 * empty for four ordinary `import`/`reexport` spellings too. `export * as NS
 * from` is **not** among them — it carries one statically-known name.
 *
 * Emitting `''` for the first edge of each group reproduces exactly what the
 * pre-ordinal formula produced (`[...names].sort().join(',')` over an empty
 * list), so every single-occurrence finding keeps a byte-identical identity.
 * The `#n` suffix appears only on the **second and later** edge of one kind
 * to one module from one file, which is precisely the group that had two
 * findings and one hash before, i.e. a baseline entry that was already
 * wrong. So the fail-open closes and the migration is empty — the surviving
 * entry still matches, and only the genuinely-new sibling is reported.
 *
 * Uniqueness still holds: within a group the sequence `''`, `#1`, `#2`, … is
 * injective, and `''` is unreachable from the named branch because no
 * import specifier is an empty identifier.
 */
export function edgeDiscriminator(edge: ModuleEdge): string {
  // Unicode codepoint order, NOT `localeCompare` — see `byCodepoint`.
  if (edge.names.length > 0) return [...edge.names].sort(byCodepoint).join(',')
  return edge.ordinal === 0 ? '' : `#${String(edge.ordinal)}`
}

/** Which of the five forms this literal belongs to, or `undefined` if none. */
function kindOf(parent: Node): ModuleEdgeKind | undefined {
  if (Node.isImportDeclaration(parent)) return 'import'
  if (Node.isExportDeclaration(parent)) return 'reexport'
  if (Node.isLiteralTypeNode(parent)) return 'type-expression'
  if (Node.isExternalModuleReference(parent)) return 'require'
  if (Node.isCallExpression(parent)) {
    // The one place `import()` and `require()` are indistinguishable by
    // parent kind.
    return parent.getExpression().getKind() === SyntaxKind.ImportKeyword ? 'dynamic' : 'require'
  }
  return undefined
}

/**
 * The resolved file, via the **specifier's** symbol.
 *
 * One mechanism for all five parent kinds, and it returns the **named**
 * module: `type A = import('./barrel.js').Deep` resolves to `barrel.ts`,
 * where following the *type* symbol instead lands on `impl.ts` and would
 * make `notImportFrom('**\/impl.ts')` fire on a file that never names
 * `impl`.
 *
 * **`getDeclarations()[0]` is not the answer.** With a module augmentation
 * elsewhere in the project, the symbol has two declarations — the
 * `SourceFile` and a `ModuleDeclaration` in the augmenting file — and `[0]`
 * is whichever the compiler merged first. Finding the `SourceFile`
 * declaration explicitly rather than assuming index `0` is defence against
 * an ordering the compiler does not document, not a fix for an observed
 * defect.
 */
function resolve(literal: Node): string | undefined {
  for (const declaration of literal.getSymbol()?.getDeclarations() ?? []) {
    if (Node.isSourceFile(declaration)) return declaration.getFilePath()
  }
  return undefined
}

/**
 * The line of the statement carrying the edge, not of the literal.
 *
 * The nearest **edge-carrying node** — the declaration, call or import-type
 * that names the module — not the nearest enclosing `Statement`.
 *
 * For the declaration forms the two are the same node, so `import` still
 * equals `decl.getStartLineNumber()`. They diverge for an expression form
 * nested inside a larger statement, and there the statement is the wrong
 * answer: `register({ handlers: { a: () => import('./banned.js') } })`
 * spanning several lines should report the import's own line, not the line
 * `register(` opens on — and a class property `loader = import('./x.js')`
 * should report its own line, not the enclosing `ClassDeclaration`'s (a
 * `PropertyDeclaration` is not a `Statement`). A lazily-loaded route inside
 * an object literal is a common real dynamic import shape, not a corner
 * case.
 *
 * Falls back to the literal's own line if no carrier is found — a guard,
 * not a path any real form takes.
 */
function statementLine(literal: Node): number {
  const carrier = literal.getFirstAncestor(
    (a) =>
      Node.isImportDeclaration(a) ||
      Node.isExportDeclaration(a) ||
      Node.isImportEqualsDeclaration(a) ||
      Node.isCallExpression(a) ||
      Node.isImportTypeNode(a),
  )
  return (carrier ?? literal).getStartLineNumber()
}

/**
 * Whether the edge is erased at compile time.
 *
 * Per kind, and the two constants are the classification traps: `require`
 * is **runtime** (a naive `else → type-expression` branch is what would
 * make it look erased) and `dynamic` is always runtime.
 */
function isErased(kind: ModuleEdgeKind, parent: Node): boolean {
  switch (kind) {
    case 'import':
      // Reused unchanged. Its `getDefaultImport()`/`getNamespaceImport()`
      // guards are load-bearing: `import React, { type FC } from 'react'` is
      // a RUNTIME edge, and a formula without them classifies it type-only
      // and skips it under `ignoreTypeImports` — a lost existing finding.
      return Node.isImportDeclaration(parent) ? isTypeOnlyImport(parent) : false
    case 'reexport':
      return Node.isExportDeclaration(parent) ? isTypeOnlyReExport(parent) : false
    case 'type-expression':
      return true
    case 'dynamic':
    case 'require':
      return false
  }
}

/**
 * Whether the statement vanishes entirely, emitting no module request.
 *
 * `typeOnly` is passed in rather than recomputed: the two answers must
 * agree on the same node, and `isErased` is not free (it walks specifiers).
 *
 * Under `verbatimModuleSyntax` TypeScript preserves the statement unless the
 * `type` modifier is on the **declaration** — `import type { X }` goes,
 * `import { type X }` stays as `import {} from 's'`. Without the flag,
 * elision is by binding usage and every type-only form disappears.
 */
function erasesRequest(
  kind: ModuleEdgeKind,
  parent: Node,
  typeOnly: boolean,
  verbatimModuleSyntax: boolean,
): boolean {
  // A statement that binds a runtime value is always emitted.
  if (!typeOnly) return false
  if (!verbatimModuleSyntax) return true
  switch (kind) {
    case 'import':
      return Node.isImportDeclaration(parent) ? parent.isTypeOnly() : true
    case 'reexport':
      return Node.isExportDeclaration(parent) ? parent.isTypeOnly() : true
    case 'type-expression':
      // `type X = import('s').Y` is a type position: never emitted under any flag.
      return true
    case 'dynamic':
    case 'require':
      // Unreachable — neither is ever `typeOnly` — but stated rather than
      // defaulted, for the same reason the sibling switches in this file
      // are exhaustive.
      return false
  }
}

/**
 * One edge, built in one place.
 */
function makeEdge(
  literal: StringLiteral,
  parent: Node,
  kind: ModuleEdgeKind,
  verbatimModuleSyntax: boolean,
): ModuleEdge {
  const typeOnly = isErased(kind, parent)
  return {
    kind,
    // `getLiteralText()`, NOT `getText().slice(1, -1)` and NOT a narrowing —
    // see the module docstring. The declared element type of
    // `getImportStringLiterals()` is what this parameter takes, so the
    // accessor is available without narrowing a node that may really be a
    // NoSubstitutionTemplateLiteral.
    specifier: literal.getLiteralText(),
    resolvedPath: resolve(literal),
    line: statementLine(literal),
    typeOnly,
    erasesModuleRequest: erasesRequest(kind, parent, typeOnly, verbatimModuleSyntax),
    names: namesOf(kind, parent),
    // Filled by the collectors, which are the only callers that can see the
    // file's other edges. `makeEdge` is per-literal and has no way to count
    // siblings.
    ordinal: 0,
  }
}

/**
 * The next ordinal for `kind::specifier`, mutating `counters`.
 *
 * Shared by both collectors so they cannot drift: an identity that depended
 * on which code path built the edge would be worse than the collision it
 * fixes.
 */
function nextOrdinal(counters: Map<string, number>, edge: ModuleEdge): number {
  const key = `${edge.kind}::${edge.specifier}`
  const n = counters.get(key) ?? 0
  counters.set(key, n + 1)
  return n
}

/**
 * `verbatimModuleSyntax` for the package that owns this file.
 *
 * Per-root inside a `workspace()` of multiple tsconfigs (plan 0148) — falls
 * back to the project-wide value for `project()` and for any project built
 * without going through `workspace()`.
 */
function usesVerbatimModuleSyntax(sourceFile: SourceFile): boolean {
  return verbatimModuleSyntaxFor(sourceFile)
}

/** The names crossing the edge. See {@link ModuleEdge.names} for which name. */
function namesOf(kind: ModuleEdgeKind, parent: Node): readonly string[] {
  if (kind === 'import' && Node.isImportDeclaration(parent)) {
    // Inward names. A default or namespace binding contributes none — it
    // crosses under a name the specifier list does not carry.
    return parent.getNamedImports().map((specifier) => specifier.getName())
  }
  if (kind === 'reexport' && Node.isExportDeclaration(parent)) {
    // `export * as NS` is not a star here: one statically-known name.
    const namespaceExport = parent.getNamespaceExport()
    if (namespaceExport !== undefined) return [namespaceExport.getName()]
    // Outward names, so `export { INNER as OUTER }` reports `OUTER`.
    return parent
      .getNamedExports()
      .map((specifier) => specifier.getAliasNode()?.getText() ?? specifier.getName())
  }
  return []
}

/**
 * How a finding refers to this kind of edge.
 *
 * **An exhaustive `switch`, not a `Record` lookup or a 4-way branch.** A
 * missing verb must be a compile error; with an explicit `string` return and
 * no fallthrough, adding a sixth `ModuleEdgeKind` breaks the build here.
 *
 * `require` gets a real verb even though no condition reports it today. The
 * alternative — throwing, or returning a placeholder — makes a forgotten
 * kind filter produce nonsense instead of a correct sentence, and a correct
 * sentence costs one line.
 *
 * **`import` must stay byte-identical.** Every existing baselined dependency
 * finding hashes its message, so changing this string for `import` silently
 * invalidates them all; the new kinds get distinct verbs precisely so their
 * findings are NOT absorbed by an existing `import` entry for the same
 * module.
 */
export function edgeVerb(kind: ModuleEdgeKind): string {
  switch (kind) {
    case 'import':
      return 'imports'
    case 'reexport':
      return 're-exports'
    case 'dynamic':
      return 'dynamically imports'
    case 'type-expression':
      return 'references the type from'
    case 'require':
      return 'requires'
  }
}

/**
 * How a finding describes a **runtime** edge of this kind, for
 * `onlyHaveTypeImportsFrom`.
 *
 * Separate from {@link edgeVerb} because that condition's sentence needs a
 * noun phrase ("has a value import from") rather than a verb, and because
 * its remedy differs per kind in a way the verb does not capture — see
 * {@link edgeTypeOnlyRemedy}.
 */
export function edgeValuePhrase(kind: ModuleEdgeKind): string {
  switch (kind) {
    case 'import':
      return 'a value import from'
    case 'reexport':
      return 'a runtime re-export of'
    case 'dynamic':
      return 'a dynamic import of'
    case 'type-expression':
      return 'a type reference to'
    case 'require':
      return 'a require call for'
  }
}

/**
 * The remedy for a runtime edge that should be type-only — **per kind,
 * because the remedy differs and one of them has a consequence.**
 *
 * `onlyHaveTypeImportsFrom`'s shipped preset says *"Use `import type { X }`
 * so the dependency is erased"*. For an `import` that is complete and local.
 * For a re-export it is not: `export type { X } from` erases the edge **and
 * removes a runtime export consumers may be importing as a value**. The
 * finding still stands — the runtime dependency is real — but a remedy that
 * silently changes what the module publishes is a remedy the reader must be
 * told about.
 *
 * `dynamic` is excluded from that condition entirely for the stronger
 * version of the same reason: there is no remedy at all. You cannot erase
 * an `await import(…)`.
 */
export function edgeTypeOnlyRemedy(edge: Pick<ModuleEdge, 'kind' | 'names'>): string {
  switch (edge.kind) {
    case 'import':
      return 'Change it to `import type { … }` so the dependency is erased at compile time.'
    case 'reexport':
      // A STAR re-export has no names to put in the braces, and telling the
      // reader to write `export type { … } from` there asks them to
      // enumerate the target's entire export list — which an agent will
      // invent rather than look up. `export type * from` is the one-token
      // fix, and `isTypeOnlyReExport` already recognises it.
      if (edge.names.length === 0) {
        return (
          'Change it to `export type * from …`, which erases the dependency. Note this removes the ' +
          'runtime re-exports too — check no consumer imports any of them as a value.'
        )
      }
      return (
        'Change it to `export type { … } from …`, which erases the dependency but also removes a ' +
        'runtime export — check no consumer imports it as a value. If one does, re-export it from ' +
        'a module this rule permits, or stop re-exporting it here.'
      )
    case 'dynamic':
      return 'A dynamic import cannot be erased. Move the dependency behind an interface this rule permits.'
    case 'type-expression':
      return 'This edge is already erased; no change is needed.'
    case 'require':
      return 'Convert the `require` to an `import type { … }`, or move the dependency.'
  }
}

/**
 * The kinds a **forward** dependency site reports on.
 *
 * One constant, so a forward condition and its matching predicate cannot
 * disagree about what an import is by construction rather than by two lists
 * someone must keep in step.
 *
 * **Exhaustive, not an allowlist filter.** A sixth `ModuleEdgeKind` is a
 * compile error here rather than a kind silently excluded everywhere.
 *
 * `require` is `false`: the kind exists so a 4-way branch cannot mark a CJS
 * runtime dependency as erased, not to enforce CJS. The **reverse** graph
 * counts it, which is the opposite disposition and deliberately so.
 * `onlyHaveTypeImportsFrom` diverges further still (its own kind set), and
 * that one divergence is intentional and documented at its own site.
 */
export const FORWARD_EDGE_KINDS: Record<ModuleEdgeKind, boolean> = {
  import: true,
  reexport: true,
  dynamic: true,
  'type-expression': true,
  require: false,
}

/**
 * Every module edge leaving one file, **lazily and unsorted**.
 *
 * For a caller that only asks "is there any edge matching X". `edgesOf`
 * builds and resolves the whole array before returning, so
 * `edgesOf(sf).some(...)` pays a `getSymbol()` for every literal in the file
 * even when the first one answers the question — on a 100-import file whose
 * first import matches, 100 checker calls where a short-circuiting walk
 * makes 1.
 *
 * **Order is unspecified, and it differs between a cold and a warm call.**
 * Cold, edges arrive in walk order — the declaration forms first, because
 * that is how ts-morph enumerates them. Warm, they arrive in the source
 * order {@link edgesOf} sorted them into. "Sometimes sorted" is a worse
 * contract than "never sorted", so it is stated rather than left to be
 * discovered. **Anything that reports a finding must use {@link edgesOf}**,
 * whose source ordering is part of its contract — a reporting site fed from
 * here would name a different edge depending on whether an unrelated rule
 * warmed the file first, which is one finding with two identities.
 */
export function* edgeStream(sourceFile: SourceFile): Generator<ModuleEdge> {
  // Warm: yield the already-built edges. The caller still breaks early, and
  // iterating a materialized array costs nothing — the resolution it was
  // avoiding has already happened.
  const hit = cache.get(sourceFile)
  if (hit !== undefined) {
    yield* hit
    return
  }
  const verbatim = usesVerbatimModuleSyntax(sourceFile)
  // Cold: stream, and deliberately do NOT populate the cache. Filling it
  // here would resolve every literal in the file to answer a question the
  // first one may settle, which is the cost this generator exists to avoid.
  // Sorted by position, so `ordinal` matches what `buildEdges` assigns. The
  // binder's array puts declaration forms before expression forms
  // regardless of where they appear, so without this a file mixing `import`
  // and `import()` of the same module gets different ordinals depending on
  // which collector ran — and the identity would depend on whether the
  // cache was warm.
  const literals = [...sourceFile.getImportStringLiterals()].sort((a, b) => a.getPos() - b.getPos())
  const counters = new Map<string, number>()
  for (const literal of literals) {
    const parent = literal.getParent()
    if (parent === undefined) continue
    const kind = kindOf(parent)
    if (kind === undefined) continue
    const edge = makeEdge(literal, parent, kind, verbatim)
    yield { ...edge, ordinal: nextOrdinal(counters, edge) }
  }
}

export function edgeTypeOnlyNoun(kind: ModuleEdgeKind): string {
  switch (kind) {
    case 'import':
    case 'dynamic':
    case 'require':
      return 'import'
    case 'reexport':
      return 're-export'
    case 'type-expression':
      return 'reference'
  }
}
