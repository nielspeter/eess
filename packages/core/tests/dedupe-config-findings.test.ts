import { describe, it, expect } from 'vitest'
import { dedupeConfigFindings } from '../src/dedupe-config-findings.js'
import type { ArchViolation } from '../src/violation.js'

const config = (over: Partial<ArchViolation> = {}): ArchViolation => ({
  rule: 'preset/x',
  ruleId: 'preset/x',
  element: 'preset/x',
  file: 'rules.ts',
  line: 0,
  message: 'construct nothing',
  suggestion: 'construct nothing',
  bypassFilters: true,
  ...over,
})

const ordinary = (over: Partial<ArchViolation> = {}): ArchViolation => ({
  rule: 'r',
  element: 'Thing',
  file: 'src/thing.ts',
  line: 3,
  message: 'a real problem',
  ...over,
})

describe('dedupeConfigFindings', () => {
  it('passes ordinary (non-bypassFilters) violations through untouched, never collapsed', () => {
    const violations = [ordinary({ element: 'A' }), ordinary({ element: 'A' })]
    expect(dedupeConfigFindings(violations)).toHaveLength(2)
  })

  it('collapses N identical-shaped config findings to 1, with a count note appended', () => {
    const violations = [config(), config(), config()]
    const result = dedupeConfigFindings(violations)
    expect(result).toHaveLength(1)
    expect(result[0]!.message).toContain('3 rules')
    expect(result[0]!.suggestion).toContain('3 rules')
  })

  it('keeps a single config finding unchanged — no note when there is nothing to affect', () => {
    const result = dedupeConfigFindings([config()])
    expect(result).toHaveLength(1)
    expect(result[0]!.message).toBe('construct nothing')
  })

  it('does not collapse across different rule files (bug 0099 class)', () => {
    const violations = [config({ file: 'a.rules.ts' }), config({ file: 'b.rules.ts' })]
    expect(dedupeConfigFindings(violations)).toHaveLength(2)
  })

  it('does not collapse across different rule ids', () => {
    const violations = [
      config({ ruleId: 'preset/x' }),
      config({ ruleId: 'preset/y', rule: 'preset/y', element: 'preset/y' }),
    ]
    expect(dedupeConfigFindings(violations)).toHaveLength(2)
  })

  it('never collapses when the identity is the "unnamed" sentinel — a missing key means keep it', () => {
    const violations = [
      config({ rule: 'unnamed', ruleId: undefined, element: 'unnamed' }),
      config({ rule: 'unnamed', ruleId: undefined, element: 'unnamed' }),
    ]
    expect(dedupeConfigFindings(violations)).toHaveLength(2)
  })

  it('preserves declaration order, keeping the first occurrence', () => {
    const first = config({ message: 'first seen' })
    const second = config({ message: 'second seen' })
    const result = dedupeConfigFindings([first, second])
    expect(result[0]!.message).toContain('first seen')
  })

  it('leaves an undefined suggestion undefined rather than appending to nothing', () => {
    const violations = [config({ suggestion: undefined }), config({ suggestion: undefined })]
    const result = dedupeConfigFindings(violations)
    expect(result[0]!.suggestion).toBeUndefined()
  })
})
