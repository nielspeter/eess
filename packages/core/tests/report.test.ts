import { describe, expect, it, vi, afterEach } from 'vitest'
import { ArchRuleError } from '../src/errors.js'
import { reportViolations, finishPreset } from '../src/report.js'
import { type CollectResult, collectResult } from '../src/collect-result.js'

/**
 * A receipt carrying `n` violations over a healthy denominator.
 *
 * Plan 0235 Phase 1: this used to return a bare `ArchViolation[]`, and every
 * assertion below read `toHaveLength(n)` off it. Both had to change — the
 * emitters now take the receipt (ADR-014), and a length assertion on a bare
 * array becomes `n + 1` the moment a finding is appended, which makes the test
 * change meaning under the very change it guards. `examined` is non-zero on
 * purpose: these tests are about DELIVERY, not about the evidence gate, and a
 * zero here would fire `emitter/pass-without-evidence` in every one of them.
 */
const v = (n: number): CollectResult =>
  collectResult(
    Array.from({ length: n }, (_, i) => ({
      rule: 'r',
      element: `e${i}`,
      file: `f${i}.ts`,
      line: i + 1,
      message: `m${i}`,
    })),
    { examined: 10 },
  )

afterEach(() => vi.restoreAllMocks())

describe('reportViolations()', () => {
  it('emits rich text to stderr by default', () => {
    const err = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    reportViolations(v(2))
    expect(err).toHaveBeenCalledOnce()
  })

  it('emits JSON to stdout when format is json', () => {
    const out = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    reportViolations(v(1), { format: 'json' })
    expect(out).toHaveBeenCalledOnce()
    const payload = JSON.parse(String(out.mock.calls[0]?.[0])) as { violations: unknown[] }
    expect(payload.violations).toHaveLength(1)
  })

  // REMOVED — plan 0235 Phase 1. This asserted `reportViolations([])` emits
  // nothing, which is the exact line ADR-014 names as the seam where a pass
  // without evidence leaves eess. Its replacement is
  // `emitter-refuses-without-evidence.test.ts`, which asserts the opposite by
  // rule id. Deleted rather than left failing: a contradicted test invites the
  // next reader to "fix" it by weakening the new behaviour.
})

describe('finishPreset()', () => {
  it('emits then throws under the default throw mode', () => {
    const err = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    expect(() => finishPreset(v(1))).toThrow(ArchRuleError)
    expect(err).toHaveBeenCalledOnce()
  })

  it('returns violations without emitting under report: return', () => {
    const err = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const out = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    const result = finishPreset(v(3), { report: 'return' })
    expect(result).toHaveLength(3)
    expect(err).not.toHaveBeenCalled()
    expect(out).not.toHaveBeenCalled()
  })

  it('emits without throwing under report: warn', () => {
    const err = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const result = finishPreset(v(2), { report: 'warn' })
    expect(result).toHaveLength(2)
    expect(err).toHaveBeenCalledOnce()
  })

  // REMOVED — plan 0235 Phase 1. Asserted `finishPreset([])` returns `[]`: a
  // pass built from a bare array with no evidence, which ADR-014 makes a
  // configuration finding. Same replacement as above.

  it('emits JSON to stdout when format is json (preset can emit machine-readable)', () => {
    const out = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    expect(() => finishPreset(v(1), { format: 'json' })).toThrow(ArchRuleError)
    expect(out).toHaveBeenCalledOnce()
  })
})
