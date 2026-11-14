/**
 * Plan 0652: `withSourceEmpty`, the empty-source rule's one owner. Each assertion is exact, so a lift
 * that dropped the receipt's own findings on either branch cannot pass (the enforcement review's
 * finding: every existing suite stayed green under that break).
 */
import { describe, expect, it } from 'vitest'
import { collectResult, mergeCollectResults, type ArchViolation } from '../src/index.js'
import { withSourceEmpty } from '../src/internal.js'

const finding = (ruleId: string): ArchViolation => ({
  rule: 'demo',
  ruleId,
  element: ruleId,
  file: 'a.ts',
  line: 1,
  message: ruleId,
})

describe('plan 0652: withSourceEmpty', () => {
  it('over zero examined, keeps the receipt whole and says sourceEmpty itself', () => {
    const receipt = collectResult([finding('demo/one')], {
      examined: 0,
      undecided: 1,
      declaredEmpty: true,
      deadGlob: 'src/**',
    })
    const r = withSourceEmpty(true, receipt)
    expect(r.map((v) => v.ruleId)).toEqual(['demo/one'])
    expect(r.examined).toBe(0)
    expect(r.sourceEmpty).toBe(true)
    expect(r.undecided).toBe(1)
    expect(r.declaredEmpty).toBe(true)
    expect(r.deadGlob).toBeUndefined()
  })

  it('keeps notRun over zero examined, exactly', () => {
    const r = withSourceEmpty(true, collectResult([], { examined: 0, notRun: true }))
    expect(r.map((v) => v.ruleId)).toEqual([])
    expect(r.examined).toBe(0)
    expect(r.notRun).toBe(true)
    expect(r.sourceEmpty).toBe(true)
  })

  it("beside a non-zero examined, returns the merge's result field for field, adding none of its own", () => {
    const receipt = collectResult([finding('demo/one')], {
      examined: 3,
      undecided: 1,
      declaredEmpty: true,
      notRun: false,
    })
    const r = withSourceEmpty(true, receipt)
    const merged = mergeCollectResults([
      collectResult([], { examined: 0, sourceEmpty: true }),
      receipt,
    ])
    expect(r.map((v) => v.ruleId)).toEqual(['demo/one', 'emitter/source-empty'])
    expect(r.map((v) => v.ruleId)).toEqual(merged.map((v) => v.ruleId))
    for (const field of [
      'examined',
      'sourceEmpty',
      'declaredEmpty',
      'notRun',
      'deadGlob',
      'undecided',
    ] as const) {
      expect(r[field]).toEqual(merged[field])
    }
    // The merge drops `undecided` today (bug 0653); the helper must not re-stamp it here.
    expect(r.undecided).toBeUndefined()
  })

  it('when the source loaded something, returns the receipt itself', () => {
    const receipt = collectResult([finding('demo/one')], { examined: 0, undecided: 1 })
    expect(withSourceEmpty(false, receipt)).toBe(receipt)
  })
})
