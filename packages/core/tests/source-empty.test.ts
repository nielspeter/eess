/**
 * Plan 0652: `withSourceEmpty`, the empty-source rule's one owner. Each assertion is exact, so a lift
 * that dropped the receipt's own findings on either branch cannot pass (the enforcement review's
 * finding: every existing suite stayed green under that break).
 */
import { describe, expect, it } from 'vitest'
import { collectResult, type ArchViolation } from '../src/index.js'
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

  it('keeps notRun over zero examined', () => {
    const r = withSourceEmpty(true, collectResult([], { examined: 0, notRun: true }))
    expect(r.notRun).toBe(true)
    expect(r.sourceEmpty).toBe(true)
  })

  it("beside a non-zero examined, returns the merge's result: the receipt's findings and one emitter/source-empty", () => {
    const receipt = collectResult([finding('demo/one')], { examined: 3 })
    const r = withSourceEmpty(true, receipt)
    expect(r.map((v) => v.ruleId)).toEqual(['demo/one', 'emitter/source-empty'])
    expect(r.examined).toBe(3)
    expect(r.sourceEmpty).toBeUndefined()
  })

  it('when the source loaded something, returns the receipt itself', () => {
    const receipt = collectResult([finding('demo/one')], { examined: 0, undecided: 1 })
    expect(withSourceEmpty(false, receipt)).toBe(receipt)
  })
})
