import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import { Project } from 'ts-morph'

/**
 * ADR-015's conditional sanction, made checkable.
 *
 * `eess-mermaid` loads every rule file through jiti, so a rule file gets its own
 * copy of the kernel — a second module registry, which is the shape ADR-015
 * otherwise forecloses. That divergence is **sanctioned**, not overlooked, and
 * the sanction has a condition: it holds only while the dialect keeps no state
 * that must be shared with the rule file's copy.
 *
 * **Why that condition and not "align the loader".** Measured when the sanction
 * was written: the two-registry hazard has two halves. `instanceof` breaking is
 * real and `packages/mermaid/src/cli/commands/check.ts` duck-types around it,
 * which works. The other half — module-level state set on one copy and read on
 * the other, which has no duck-type available — is `callerAggregatesReports`,
 * and that lives entirely in `packages/ts/src/core/execute-rule.ts`.
 * `eess-mermaid` has no equivalent and reads none of the kernel's shared
 * registries. So the live cost today is one function that works, and aligning
 * the loader would break rule files using syntax nothing taught, to delete it.
 *
 * **What this test is for.** That reasoning expires the moment `eess-mermaid`
 * reaches for shared state, and nothing would announce it. This is the
 * announcement: importing any kernel accessor whose answer depends on one
 * registry reds here, and the remedy is not to add an exception but to reopen
 * [bug 0281](../../work/bugs/0281-every-mermaid-rule-file-loads-into-a-second-registry.md)
 * and align the loader.
 */

/**
 * Kernel accessors whose correctness requires a single registry.
 *
 * Readers and resetters, not writers: `reportViolations` incrementing a counter
 * inside its own copy is harmless, and `violationsEmittedCount` reading that
 * counter across the boundary is not. The distinction is what the seam is about.
 */
const SHARED_REGISTRY_ACCESSORS = new Set([
  // cache-registry.ts — a reset that must reach every cache in the process
  'registerCacheReset',
  'clearRegisteredCaches',
  // comment-suppression.ts — recorded by a rule, read by the emitter
  'recordCommentSuppression',
  'resetCommentSuppression',
  'commentSuppressions',
  'commentSuppressionNotice',
  // edge-coverage.ts — recorded during a run, read at the end of it
  'recordEdgeCoverage',
  'resetEdgeCoverage',
  'untestedRules',
  'edgeCoverageNotice',
  // diff-disclosure.ts — a once-per-process notice
  'activeNotice',
  'suppressionNotice',
  'resetDiffDisclosureForTests',
  // report.ts / violation.ts — counters and collision tables read after the fact
  'violationsEmittedCount',
  'identityCollisions',
  'resetIdentityCollisions',
])

/** Every named binding `packages/mermaid/src/**` imports, with its file. */
function importedNames() {
  const project = new Project({
    useInMemoryFileSystem: true,
    skipFileDependencyResolution: true,
    compilerOptions: { allowJs: false, noResolve: true },
  })
  const found = []
  const files = globSync('packages/mermaid/src/**/*.ts')
  for (const file of files) {
    const sf = project.createSourceFile(`__${found.length}_${file}`, readFileSync(file, 'utf8'))
    for (const decl of sf.getImportDeclarations()) {
      for (const spec of decl.getNamedImports()) found.push({ name: spec.getName(), file })
    }
  }
  return { found, fileCount: files.length }
}

test('eess-mermaid holds no state shared across the rule-file boundary', () => {
  const { found } = importedNames()
  const shared = found.filter(({ name }) => SHARED_REGISTRY_ACCESSORS.has(name))
  assert.deepEqual(
    shared.map(({ name, file }) => `${name} in ${file}`),
    [],
    `eess-mermaid imports a kernel accessor whose answer depends on a single ` +
      `module registry, and its rule files load through jiti into a different ` +
      `one — so the value set on one copy is not the value read on the other. ` +
      `ADR-015 sanctions the transpiled loader only while this holds. The fix is ` +
      `not an exception here: it is bug 0281, aligning the loader`,
  )
})

test('the reader sees the sources it claims to — a denominator', () => {
  // Guards the check above from passing because the glob matched nothing, which
  // is the failure this repository exists to catch.
  const { found, fileCount } = importedNames()
  assert.ok(
    // Floors, not pins: measured at 29 files and 118 named imports when written,
    // set well below so ordinary growth or tidying does not red this, while a
    // broken glob returning nothing or a handful still does.
    fileCount > 20 && found.length > 60,
    `read ${fileCount} files and ${found.length} named imports from ` +
      `packages/mermaid/src — too few, so the check above proves nothing`,
  )
})

test('the banned set is real — every name is a kernel export', () => {
  // Keeps the list from rotting into a check of nothing: a renamed kernel
  // accessor fails here rather than silently leaving the seam unguarded.
  const internal = readFileSync('packages/core/src/internal.ts', 'utf8')
  const root = readFileSync('packages/core/src/index.ts', 'utf8')
  const published = `${internal}\n${root}`
  const missing = [...SHARED_REGISTRY_ACCESSORS].filter((name) => !published.includes(name))
  assert.deepEqual(missing, [], `not exported by the kernel any more: ${missing.join(', ')}`)
})
