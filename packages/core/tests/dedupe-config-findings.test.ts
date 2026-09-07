import { describe, it, expect } from 'vitest'
import { dedupeConfigFindings } from '../src/dedupe-config-findings.js'
import type { ArchViolation } from '../src/violation.js'
import { noReceiptViolation } from '../src/emitter-findings.js'

const config = (over: Partial<ArchViolation> = {}): ArchViolation => ({
  rule: 'preset/x',
  ruleId: 'preset/x',
  // The offending GLOB — the thing the author actually wrote, which is what the
  // key's third part is for. This used to be `'preset/x'`, the rule id again,
  // which is the one shape that must NEVER collapse; every collapse assertion
  // below was passing over a fixture that did not represent the case it named.
  element: '**/src/not-built-yet/**',
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
      config({ ruleId: 'preset/y', rule: 'preset/y' }),
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

  it('never collapses an emitter finding', () => {
    // An emitter finding is about a verdict, not a rule's narrowing, so each one
    // stands for a different builder and is its own edit. It cannot be told apart
    // by shape: `emitter-findings.ts` sets `element: ruleId` and `file: ''`, so
    // the key degenerates and every occurrence in a run merges. Measured before
    // the guard: three hand-rolled builders in one rule file reported as ONE
    // finding whose note said they were "one edit". They are three edits.
    // Built by the real constructor, not a hand-restated literal: if the emitter
    // finding's shape drifts, a hand-written copy keeps this test green over a
    // fixture that no longer represents the case it names — the exact defect the
    // `element: 'preset/x'` correction in this same file fixed.
    const violations = [noReceiptViolation(), noReceiptViolation(), noReceiptViolation()]
    const result = dedupeConfigFindings(violations)
    expect(result).toHaveLength(3)
    expect(result[0]!.message).not.toContain('one edit')
  })

  it('CONTROL: a non-emitter finding whose element repeats its id still collapses', () => {
    // The guard is keyed on the emitter id SET, not on the `element === identity`
    // shape. A first cut used the shape and was too broad: a real rule with a real
    // narrowing and no glob to name looks identical, and two instances of it
    // genuinely are one edit. `packages/ts`'s `the-floor.test.ts` reds on that
    // over `smells.duplicateBodies(p).minLines(500)`; this is the same control,
    // held locally so the kernel unit does not depend on a dialect to state it.
    const violations = [
      config({ ruleId: 'x/no-dup', rule: 'x/no-dup', element: 'x/no-dup' }),
      config({ ruleId: 'x/no-dup', rule: 'x/no-dup', element: 'x/no-dup' }),
    ]
    expect(dedupeConfigFindings(violations)).toHaveLength(1)
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
