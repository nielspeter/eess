/**
 * The statements in a code fence that claim WHERE a symbol lives.
 *
 * Two forms qualify, and both are claims of the same kind:
 *   - `import { x } from 'p'` — x is exported by p
 *   - `export { x } from 'p'` — x is exported by p, and re-exported here
 *
 * Split out of `scripts/check-docs-code.mjs` so it can be unit-tested per shape
 * (bug 0273), and parsed with **ts-morph** rather than by regex.
 *
 * **Why the engine and not a regex.** ADR-002 makes ts-morph the engine for all
 * AST work, and the first version of this helper was a hand-rolled scanner that
 * proved the rule the hard way. An architecture review measured it missing
 * `export { … } from '…'` entirely — the fence became a fragment and was never
 * compiled, a fail-open in the exact shape this bug was filed for — and
 * `scripts/lib/family-re-exports.mjs` already records that same lesson about that
 * same node type. Its predecessor also swallowed lines past an unterminated
 * import and matched the word `import` inside comments and template literals.
 * The parser has no opinion about any of that; it just knows what a declaration
 * is.
 *
 * **Why a changeset is checked by these and not by its whole body.** The defect
 * bug 0273 was filed for is a claim about where a symbol is exported —
 * "`finishPreset` is exported from the same three places the alias was". That
 * claim is only checkable once written as a statement, and such a statement is
 * checkable alone: `tsc` reports TS2305 for a named member a module does not
 * export whether or not the name is ever used.
 *
 * Demanding the whole snippet compile would be the wrong bar. A migration reads
 * `finishPreset(violations, …)`, where `violations` is the reader's variable and
 * not one a changeset can invent. Requiring it to be invented would push authors
 * toward ceremony or toward the skip directive, and a gate people route around is
 * the failure ADR-009 rule 1 names.
 */
import { Project, ScriptKind } from 'ts-morph'

// One project reused across fences: creating a ts-morph Project per fence is the
// expensive part, and the source file is overwritten each call.
const project = new Project({
  useInMemoryFileSystem: true,
  skipFileDependencyResolution: true,
  compilerOptions: { allowJs: false, noResolve: true },
})

/**
 * @param {string} code a fence's contents
 * @returns {string[]} the module-claim statements, in source order
 */
export function moduleClaimsIn(code) {
  const sf = project.createSourceFile('__fence__.ts', code, {
    overwrite: true,
    scriptKind: ScriptKind.TS,
  })
  const claims = [
    ...sf.getImportDeclarations(),
    // Only the re-export form: a bare `export { x }` names no module and claims
    // nothing about where anything lives.
    ...sf.getExportDeclarations().filter((d) => d.getModuleSpecifier() !== undefined),
  ]
  return claims.sort((a, b) => a.getPos() - b.getPos()).map((d) => d.getText())
}
