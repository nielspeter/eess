import { describe, expect, it, vi, afterEach } from 'vitest'
import { ArchRuleError } from '../src/errors.js'
import { reportViolations, finishPreset } from '../src/report.js'
import type { ArchViolation } from '../src/violation.js'

const v = (n: number): ArchViolation[] =>
  Array.from({ length: n }, (_, i) => ({
    rule: 'r',
    element: `e${i}`,
    file: `f${i}.ts`,
    line: i + 1,
    message: `m${i}`,
  }))

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
    const payload = JSON.parse(String(out.mock.calls[0]?.[0]))
    expect(payload.violations).toHaveLength(1)
  })

  it('emits nothing for an empty set', () => {
    const err = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const out = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    reportViolations([])
    expect(err).not.toHaveBeenCalled()
    expect(out).not.toHaveBeenCalled()
  })
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

  it('under throw mode with no violations, does not throw or emit', () => {
    const err = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    expect(finishPreset([])).toEqual([])
    expect(err).not.toHaveBeenCalled()
  })

  it('emits JSON to stdout when format is json (preset can emit machine-readable)', () => {
    const out = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    expect(() => finishPreset(v(1), { format: 'json' })).toThrow(ArchRuleError)
    expect(out).toHaveBeenCalledOnce()
  })
})
