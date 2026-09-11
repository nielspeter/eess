import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Project } from 'ts-morph'

/**
 * Bug 0278 — the falsifier that bug was closed without.
 *
 * `v0.5.0` dropped `isStrictFamily` and `resolveFlag` from the `eess-ts` barrel
 * while keeping `STRICT_FAMILY_SIZE` and the `StrictFamilyFlag` type from the
 * same module. An adopter's rule file imported all three values; ESM resolves
 * named imports at load, so their architecture gate stopped running rather than
 * type-erroring.
 *
 * **Why the published-surface census could not catch it, measured.** Its two
 * assertions guard published-but-unclassified and classified-but-unpublished. A
 * removal edits both sides in one commit, so they move in lockstep. Reproduced
 * on the fixed tree: delete the export AND its classification row together and
 * the matrix passes 48 of 48, with `check:family` and `check:surface` green
 * beside it. That is not a defect in the census — it is what a two-sided ledger
 * is for — but it means a shrinking surface has no witness.
 *
 * **Why these four and not a general rule.** A general "all exports of a module
 * or none" gate is available and cheaper than this record first estimated — an
 * enforcement review measured 17 split modules out of 75, not hundreds — but
 * whether the barrel may shrink at all, and on what signal, is an ADR-011
 * decision owned by bug 0279. This test does the narrow job: it names what a
 * rule file needs to mirror tsc's strict-family resolution, so removing any of
 * it fails here with the reason attached.
 *
 * Adding a strict-family flag to the kernel means nothing here. Removing one of
 * these four from the barrel means an adopter's rule file stops loading.
 */
const REQUIRED_VALUES = ['STRICT_FAMILY_SIZE', 'isStrictFamily', 'resolveFlag']

/**
 * The fourth thing the module exports, and the one a runtime check cannot see.
 *
 * Everything above imports the barrel and reads its namespace, which is how the
 * published-surface census works too. A `export type { … }` line leaves no
 * runtime binding, so all of it is blind to all 88 type-only names on
 * this barrel — an enforcement review measured that and named it inside the fix
 * for 0278, where the doc comment says "these four" and instrumented three.
 *
 * `StrictFamilyFlag` is `resolveFlag`'s parameter type. Dropping it does not stop
 * a rule file loading — it fails at type-check, which is the softer half — but it
 * is the same removal criterion reaching the same module, so it is checked the
 * only way it can be: by reading the barrel's own source with the engine
 * ADR-002 names.
 */
const REQUIRED_TYPES = ['StrictFamilyFlag']

/** Type-only exported names on the `eess-ts` barrel, read with ts-morph. */
function typeExportsOfBarrel() {
  const barrel = fileURLToPath(new URL('../../packages/ts/src/index.ts', import.meta.url))
  const project = new Project({
    useInMemoryFileSystem: true,
    skipFileDependencyResolution: true,
    compilerOptions: { allowJs: false, noResolve: true },
  })
  const sf = project.createSourceFile('__barrel__.ts', readFileSync(barrel, 'utf8'))
  const names = new Set()
  for (const decl of sf.getExportDeclarations()) {
    const wholeClauseIsTypeOnly = decl.isTypeOnly()
    for (const spec of decl.getNamedExports()) {
      if (wholeClauseIsTypeOnly || spec.isTypeOnly()) names.add(spec.getName())
    }
  }
  return names
}

test('@nielspeter/eess-ts publishes the strict-family resolution surface', async () => {
  const mod = await import('@nielspeter/eess-ts')
  const missing = REQUIRED_VALUES.filter((name) => mod[name] === undefined)
  assert.deepEqual(
    missing,
    [],
    `@nielspeter/eess-ts does not publish ${missing.join(', ')} — a rule file ` +
      `mirroring tsc's strict-family resolution imports these by name, and ESM ` +
      `refuses a missing named export at LOAD, so the rule file does not run at all`,
  )
})

test('the constant and the functions travel together', async () => {
  // The specific incoherence 0278 shipped: the count survived and the two
  // functions that give it meaning did not. Either all of them are published or
  // none is; publishing a subset is the state that broke an adopter.
  const mod = await import('@nielspeter/eess-ts')
  const present = REQUIRED_VALUES.filter((name) => mod[name] !== undefined)
  assert.ok(
    present.length === 0 || present.length === REQUIRED_VALUES.length,
    `strict-family surface is split: published ${present.join(', ')} and not ` +
      `${REQUIRED_VALUES.filter((n) => !present.includes(n)).join(', ')}`,
  )
})

test('the barrel publishes the strict-family type a runtime check cannot see', () => {
  const published = typeExportsOfBarrel()
  const missing = REQUIRED_TYPES.filter((name) => !published.has(name))
  assert.deepEqual(
    missing,
    [],
    `the eess-ts barrel has no type-only export of ${missing.join(', ')} — ` +
      `importing the package and reading its namespace cannot see this, and ` +
      `neither can the published-surface census, so the removal is silent`,
  )
})

test('the barrel type-export reader sees something at all', () => {
  // Guards the check above from passing because the reader returned an empty
  // set. If the parse or the path breaks, this fails instead of greening.
  const published = typeExportsOfBarrel()
  assert.ok(
    published.size > 20,
    `read ${published.size} type-only exports from the eess-ts barrel — the ` +
      `reader is broken or pointed at the wrong file, so the check above proves nothing`,
  )
})

test('the required set is real — every name exists in the source module', async () => {
  // Guards the list from rotting into a check of nothing. If a symbol is renamed
  // upstream this fails here rather than leaving the tests above asserting
  // something nobody exports.
  const src = await import('../../packages/ts/src/tsconfig/strict-family.js').catch(() => undefined)
  const mod = src ?? (await import('@nielspeter/eess-ts'))
  const absent = REQUIRED_VALUES.filter((name) => mod[name] === undefined)
  assert.deepEqual(absent, [], `not found in the strict-family module: ${absent.join(', ')}`)
})
