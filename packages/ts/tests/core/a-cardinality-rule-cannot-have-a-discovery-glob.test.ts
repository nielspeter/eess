/**
 * Bug 0371 — can a cardinality rule have a dead DISCOVERY glob, and would anything report it?
 *
 * The worry was a silence: `cardinalitySelectorMissedDisk` returns `deadSitesIn(...).selector`
 * and discards `.discovery`, and `deadSelectorFindings` exempts cardinality rules outright — so
 * a `.notExist()` whose *discovery* glob silently stopped matching would be invisible in both
 * paths. That is
 * [bug 0355](../../../../work/bugs/fixed/0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md)'s
 * silence one glob position over.
 *
 * **It cannot happen, and this file pins WHY rather than asserting that it doesn't.** Every
 * builder that stamps `'discovery'` extends `TerminalBuilder` (or `GraphqlRuleBuilder`, which
 * also extends it), whose `assertsCardinality()` is a constant `false`; the sole override lives
 * in `RuleBuilder`, which stamps no discovery globs. So a rule carrying a discovery glob always
 * answers `false`, never reaches the cardinality exemptions, and its dead discovery glob is
 * reported by the ordinary path.
 *
 * Both halves are asserted, because only the pair is the safety property: if a future builder
 * gains the override while still stamping a discovery glob, the first assertion reds; if the
 * ordinary reporting path stops covering discovery globs, the second does.
 *
 * _The record's first survey claimed discovery globs existed only in a preset's internal
 * diagnostic. It had grepped `position: 'discovery'` and missed five builders passing the
 * position as a bare argument — a search of one spelling reported as absence. The conclusion
 * held; the evidence for it did not._
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { project } from '../../src/core/project.js'
import { slices } from '../../src/builders/slice-rule-builder.js'
import { smells } from '../../src/smells/index.js'
import { diagnose } from '../../src/core/diagnose.js'
import type { ArchProject } from '../../src/core/project.js'

let base: string
let p: ArchProject

/** A glob that matches nothing in this project — a dead discovery glob. */
const DEAD = '**/no-such-area/**'

beforeAll(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0371-'))
  const root = path.join(base, 'repo')
  fs.mkdirSync(path.join(root, 'src', 'features', 'a'), { recursive: true })
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'repo' }))
  fs.writeFileSync(path.join(root, 'src', 'features', 'a', 'a.ts'), 'export const a = 1\n')
  const cfg = path.join(root, 'tsconfig.json')
  fs.writeFileSync(cfg, JSON.stringify({ compilerOptions: { strict: true }, include: ['src'] }))
  p = project(cfg)
})
afterAll(() => fs.rmSync(base, { recursive: true, force: true }))

describe('bug 0371: a discovery glob and a cardinality assertion cannot meet', () => {
  it('every builder that stamps a discovery glob answers false to assertsCardinality()', () => {
    // The load-bearing half. `assertsCardinality()` gates both exemptions the silence would
    // have needed, and a constant `false` means neither can engage for these shapes.
    const built = [
      slices(p).matching(DEAD).should().beFreeOfCycles(),
      smells.duplicateBodies(p).inFolder(DEAD).withMinSimilarity(0.9),
    ]
    for (const builder of built) expect(builder.assertsCardinality()).toBe(false)
    // Guard the guard: a builder with no globs at all would satisfy the loop vacuously.
    for (const builder of built) expect(builder.globs().length).toBeGreaterThan(0)
  })

  it('a dead discovery glob is therefore REPORTED by check, not silently exempt', () => {
    // The other half, asserted on the surface the bug was about. A first version checked
    // `diagnose()` — doctor — and a sabotage row dropping check's discovery reporting fired
    // nothing against it, because doctor has its own path. The silence 0371 feared was in
    // `check`: `cardinalitySelectorMissedDisk` discards `.discovery` and `deadSelectorFindings`
    // exempts cardinality, so `violations()` is where the hole would have been.
    const rule = slices(p).matching(DEAD).should().beFreeOfCycles().rule({ id: 'test/0371' })
    const found = rule.violations()
    expect(found.length).toBeGreaterThan(0)
    // Unsuppressable, like every configuration finding — so it cannot be absorbed by a baseline.
    expect(found[0]?.bypassFilters).toBe(true)
    expect(found[0]?.message ?? '').toContain('resolved no slices')
    // …and doctor agrees, so the two tools do not disagree about a broken rule (bug 0357).
    expect(diagnose([rule]).map((f) => f.position)).toContain('discovery')
  })

  it('CONTROL: a live discovery glob reports nothing, so the row above is not trivially true', () => {
    const live = slices(p)
      .matching('**/src/features/*')
      .should()
      .beFreeOfCycles()
      .rule({ id: 'test/0371-live' })
    expect(diagnose([live]).filter((f) => f.kind === 'dead-glob')).toEqual([])
  })
})
