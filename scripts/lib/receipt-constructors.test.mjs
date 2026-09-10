import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FAMILY_ONLY, KERNEL_INTERNAL, ANSI_INTERNAL } from './kernel-surface.mjs'

/**
 * Bug 0276 — the DEMAND side of standalone sufficiency.
 *
 * `check:family` enforces the supply side: a dialect re-exports every kernel
 * symbol its own source imports. That is import-driven by design, so a dialect
 * whose source never touches a symbol owes nothing — which is correct, and is
 * why it stayed green while `eess-gherkin` published neither receipt
 * constructor. Nothing asked whether a dialect publishes what an ADR says an
 * ADOPTER needs.
 *
 * **The set is derived from the ADRs, not from a release.** The first version of
 * this test asserted the two constructors a pending changeset happened to name,
 * and an architecture review measured what that produced: gherkin could build a
 * receipt and merge two, and could reach neither thing to hand one to. The
 * clauses, in order:
 *
 *   - ADR-014 — a verdict carries its evidence. `collectResult` builds a
 *     receipt, `mergeCollectResults` combines two.
 *   - ADR-008 — one emitter, `reportViolations`; the caller owns reporting.
 *   - ADR-014 again — `eess-md`, `eess-gherkin` and `eess-crossvalidate` publish
 *     no binary, so "the seam is the preset a caller finishes": `finishPreset`.
 *   - And a caller handed a configuration finding needs `isArchConfigError` to
 *     recognise it, or the seam throws something they cannot branch on.
 *
 * Adding a clause to those ADRs means adding a name here. That coupling is the
 * point: it is what makes this a check of the decision rather than of the code.
 */
const REQUIRED = [
  'collectResult',
  'mergeCollectResults',
  'reportViolations',
  'finishPreset',
  'isArchConfigError',
]

/**
 * The dialects with a barrel. `eess-crossvalidate` ships seven flat entry files
 * and no index, so "what its adopter can reach" is a per-subpath question this
 * list cannot express — named here rather than silently absent, and tracked
 * separately.
 */
const DIALECTS = ['ts', 'mermaid', 'md', 'gherkin']

for (const dialect of DIALECTS) {
  const pkg = `@nielspeter/eess-${dialect}`
  test(`${pkg} publishes the receipt seam the ADRs require`, async () => {
    const mod = await import(pkg)
    const missing = REQUIRED.filter((name) => typeof mod[name] !== 'function')
    assert.deepEqual(
      missing,
      [],
      `${pkg} does not publish ${missing.join(', ')} — a standalone consumer would ` +
        `need a second, direct @nielspeter/eess install to use a receipt`,
    )
  })
}

test('the required set is real — every name is a kernel root export', async () => {
  // Guards the list from rotting into a check of nothing. Rename a symbol in the
  // kernel and this fails, rather than four cases above quietly asserting
  // something nobody exports any more.
  const kernel = await import('@nielspeter/eess')
  const absent = REQUIRED.filter((name) => typeof kernel[name] !== 'function')
  assert.deepEqual(absent, [], `not on the kernel root: ${absent.join(', ')}`)
})

test('the required set does not contradict the exclusion vocabulary', async () => {
  // `scripts/lib/kernel-surface.mjs` calls itself "the one place that says which
  // kernel exports a dialect need NOT re-export", and records that its two
  // consumers were unified because a hand-synced pair drifts. This is a third
  // consumer of the same question, so it reads those sets rather than becoming a
  // fourth opinion: a name required here and excused there is a contradiction to
  // resolve in the ADR, not to leave standing in two files.
  const excused = new Set([...FAMILY_ONLY, ...KERNEL_INTERNAL, ...ANSI_INTERNAL])
  const conflict = REQUIRED.filter((name) => excused.has(name))
  assert.deepEqual(
    conflict,
    [],
    `required of every dialect here and excused in kernel-surface.mjs: ${conflict.join(', ')}`,
  )
})
