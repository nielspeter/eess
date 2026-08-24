import { describe, it, expect, vi, afterEach } from 'vitest'
import { applyFilters } from '../src/internal.js'
import { executeWarn, executeCheck } from '../src/execute-rule.js'
import { ArchRuleError } from '../src/errors.js'
import type { ArchViolation } from '../src/violation.js'
import type { DiffFilterLike } from '../src/check-options.js'
import { resetDiffDisclosureForTests } from '../src/diff-disclosure.js'

/**
 * The metadata stamp (bugs 0122, 0113) and its precedence rule.
 *
 * These live here rather than in `correspondence.test.ts` because `applyFilters`
 * is the seam every builder shares and is exported public API — and because a
 * review mutation matrix found the correspondence tests could not reach two
 * properties the stamp depends on:
 *
 *   - inverting all four `v.X === undefined` guards (so the rule clobbers what a
 *     condition computed) passed 1934 tests and all 20 non-vacuity gates;
 *   - stamping only `result[0]` instead of every violation did too.
 *
 * Four documents assert the non-overwrite rule and nothing could falsify it.
 * `spec.rules.ts` already computes a per-row `suggestion`, so the day that rule
 * grows a rule-level one, the un-guarded version would silently replace every
 * per-row remedy with the generic sentence.
 */
const bare = (over: Partial<ArchViolation> = {}): ArchViolation => ({
  rule: 'a rule description',
  element: 'Element',
  file: 'src/thing.ts',
  line: 1,
  message: 'something is wrong',
  ...over,
})

describe('applyFilters — rule metadata stamp', () => {
  it('stamps ruleId, because, suggestion and docs when the violation carries none', () => {
    const [v] = applyFilters([bare()], {
      reason: 'the rule rationale',
      metadata: { id: 'rule/id', suggestion: 'the rule remedy', docs: 'adr/001.md' },
    })

    expect(v?.ruleId).toBe('rule/id')
    expect(v?.because).toBe('the rule rationale')
    expect(v?.suggestion).toBe('the rule remedy')
    expect(v?.docs).toBe('adr/001.md')
  })

  it('never overwrites a value the condition computed for this violation', () => {
    const own = bare({
      ruleId: 'condition/id',
      because: 'the condition knew better',
      suggestion: 'the per-element remedy',
      docs: 'adr/own.md',
    })

    const [v] = applyFilters([own], {
      reason: 'the generic rationale',
      metadata: { id: 'rule/id', suggestion: 'the generic remedy', docs: 'adr/generic.md' },
    })

    // All four are the condition's, not the rule's. A per-element remedy is
    // strictly better advice than the rule's blanket one, so the rule may only
    // fill a gap — never win.
    expect(v?.ruleId).toBe('condition/id')
    expect(v?.because).toBe('the condition knew better')
    expect(v?.suggestion).toBe('the per-element remedy')
    expect(v?.docs).toBe('adr/own.md')
  })

  it('fills only the gaps when a violation carries some of the four', () => {
    const partial = bare({ suggestion: 'the per-element remedy' })

    const [v] = applyFilters([partial], {
      reason: 'the rule rationale',
      metadata: { id: 'rule/id', suggestion: 'the generic remedy', docs: 'adr/001.md' },
    })

    expect(v?.suggestion).toBe('the per-element remedy') // kept
    expect(v?.because).toBe('the rule rationale') // filled
    expect(v?.docs).toBe('adr/001.md') // filled
  })

  it('stamps every violation, not just the first', () => {
    const vs = applyFilters(
      [bare({ element: 'A' }), bare({ element: 'B' }), bare({ element: 'C' })],
      {
        reason: 'the rule rationale',
        metadata: { id: 'rule/id', suggestion: 'the rule remedy' },
      },
    )

    expect(vs.map((v) => [v.element, v.because, v.ruleId, v.suggestion])).toEqual([
      ['A', 'the rule rationale', 'rule/id', 'the rule remedy'],
      ['B', 'the rule rationale', 'rule/id', 'the rule remedy'],
      ['C', 'the rule rationale', 'rule/id', 'the rule remedy'],
    ])
  })

  it('stamps because with no .rule() metadata at all', () => {
    const [v] = applyFilters([bare()], { reason: 'the rule rationale' })

    expect(v?.because).toBe('the rule rationale')
    expect(v?.ruleId).toBeUndefined()
  })

  it('leaves a violation untouched when the rule declares nothing', () => {
    const [v] = applyFilters([bare()], {})

    expect(v?.because).toBeUndefined()
    expect(v?.ruleId).toBeUndefined()
    expect(v?.suggestion).toBeUndefined()
    expect(v?.docs).toBeUndefined()
  })
})

/**
 * `severityFor` outranks `.warn()` for a `bypassFilters` finding (plan 0147,
 * reconciled against ts-archunit). Reproduced live: a rule chained with
 * `.warn()` that examines zero elements printed the "examined zero units"
 * finding to stderr and exited 0 — the finding's own `UNSUPPRESSABLE` text
 * promises "not by .warn()", and nothing enforced that promise.
 */
describe('executeWarn — bypassFilters escalation', () => {
  it('does not throw for an ordinary (non-bypassFilters) violation', () => {
    expect(() => executeWarn([bare()], {})).not.toThrow()
  })

  it('throws for a bypassFilters violation even under .warn()', () => {
    const configFinding = bare({ bypassFilters: true })
    expect(() => executeWarn([configFinding], {})).toThrow(ArchRuleError)
  })

  it('throws with ONLY the bypassFilters violations, not the ordinary ones alongside them', () => {
    const ordinary = bare({ element: 'Ordinary' })
    const configFinding = bare({ element: 'Config', bypassFilters: true })
    try {
      executeWarn([ordinary, configFinding], {})
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ArchRuleError)
      const archError = error as ArchRuleError
      expect(archError.violations).toHaveLength(1)
      expect(archError.violations[0]?.element).toBe('Config')
    }
  })
})

/** A `DiffFilterLike` that drops every violation it's given — the worst case. */
const dropsEverything: DiffFilterLike = {
  filterToChanged: () => [],
}

/** A `DiffFilterLike` that suppresses nothing. */
const keepsEverything: DiffFilterLike = {
  filterToChanged: (violations) => violations,
}

describe('executeCheck/executeWarn — diff-aware disclosure (plan 0147 Phase 4)', () => {
  afterEach(() => {
    resetDiffDisclosureForTests()
    vi.restoreAllMocks()
  })

  it('executeCheck writes an activeNotice to stderr when the diff filter suppressed a finding', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    expect(() => executeCheck([bare()], {}, { diff: dropsEverything })).not.toThrow()
    const written = spy.mock.calls.map((c) => String(c[0])).join('')
    expect(written).toContain('Diff-aware mode is active')
  })

  it('executeWarn writes an activeNotice to stderr when the diff filter suppressed a finding', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    executeWarn([bare()], {}, { diff: dropsEverything })
    const written = spy.mock.calls.map((c) => String(c[0])).join('')
    expect(written).toContain('Diff-aware mode is active')
  })

  it('does not write a notice when the diff filter suppressed nothing', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    executeWarn([bare()], {}, { diff: keepsEverything })
    const written = spy.mock.calls.map((c) => String(c[0])).join('')
    expect(written).not.toContain('Diff-aware mode is active')
  })

  it('fires only once per process across two separate rules', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    executeWarn([bare()], {}, { diff: dropsEverything })
    const firstCount = spy.mock.calls.filter((c) =>
      String(c[0]).includes('Diff-aware mode is active'),
    ).length
    executeWarn([bare({ element: 'Other' })], {}, { diff: dropsEverything })
    const secondCount = spy.mock.calls.filter((c) =>
      String(c[0]).includes('Diff-aware mode is active'),
    ).length
    expect(firstCount).toBe(1)
    expect(secondCount).toBe(1)
  })
})
