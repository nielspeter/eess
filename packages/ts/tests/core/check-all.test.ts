import { describe, it, expect, vi, afterEach } from 'vitest'
import { collectResult } from '@nielspeter/eess'
import { checkAll } from '../../src/core/check-all.js'
import { ArchRuleError } from '@nielspeter/eess'
import type { ArchViolation } from '@nielspeter/eess'
import type { RuleBuilderLike } from '@nielspeter/eess'

const rule = (violations: ArchViolation[]): RuleBuilderLike => ({
  violations: () => collectResult(violations, { examined: Math.max(violations.length, 1) }),
})
const v = (ruleId: string, severity?: 'error' | 'warn'): ArchViolation => ({
  rule: 'r',
  element: 'e',
  file: '/f.ts',
  line: 1,
  message: 'm',
  ruleId,
  severity,
})

afterEach(() => vi.restoreAllMocks())

describe('checkAll', () => {
  describe('the evidence gate (plan 0263 Phase 2)', () => {
    // **The bare-array case is not tested here, and that is not an omission.**
    // `RuleBuilderLike.violations()` is typed to return `CollectResult`, so a
    // builder handing back a plain array does not compile — the compiler is the
    // Tier-1 mechanism and ADR-014's `violations() returns the receipt` row is
    // already gated on `npm run typecheck`. Forcing one here would need an `as`,
    // which ADR-005 forbids, and would test the cast rather than the door.
    //
    // The shape DOES reach production untyped: the CLI imports a rule file at
    // runtime, so `export default [{ violations: () => [] }]` is loadable. That
    // path is covered end to end by `check:nonvacuity`'s
    // `emitter/bare-builder-reds-the-cli`, which drives the real binary over a
    // probe rule file and asserts `emitter/no-receipt` by id.
    //
    // What IS testable here is the other half of the same gate: a well-typed
    // receipt that examined nothing.
    it('reds a member that ran and examined nothing', () => {
      // Before this phase `checkAll` aggregated with `flatMap`, which drops every
      // `examined` on the floor, so this returned silently — bug 0206's shape at
      // a different door.
      vi.spyOn(process.stderr, 'write').mockReturnValue(true)
      const dead: RuleBuilderLike = { violations: () => collectResult([], { examined: 0 }) }
      expect(() => checkAll([dead])).toThrow(ArchRuleError)
    })

    it('names the cause, rather than throwing for some other reason', () => {
      // Identity, not the exit path: a throw proves only that something went
      // wrong, and the row this test answers for is about the evidence.
      vi.spyOn(process.stderr, 'write').mockReturnValue(true)
      const dead: RuleBuilderLike = { violations: () => collectResult([], { examined: 0 }) }
      try {
        checkAll([dead])
        expect.unreachable('checkAll should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ArchRuleError)
        const ids = (error instanceof ArchRuleError ? error.violations : []).map((x) => x.ruleId)
        expect(ids).toContain('emitter/pass-without-evidence')
      }
    })

    it('reds ONE dead member among healthy ones, rather than absorbing it', () => {
      // The fail-closed merge at this door. Summing alone would report a healthy
      // total over a dead member, which is ADR-014 §7's whole subject.
      vi.spyOn(process.stderr, 'write').mockReturnValue(true)
      const dead: RuleBuilderLike = { violations: () => collectResult([], { examined: 0 }) }
      try {
        checkAll([rule([]), rule([]), dead])
        expect.unreachable('checkAll should have thrown')
      } catch (error) {
        const ids = (error instanceof ArchRuleError ? error.violations : []).map((x) => x.ruleId)
        expect(ids).toContain('emitter/pass-without-evidence')
      }
    })

    it('CONTROL — a declared-empty member stays green', () => {
      // Without this the three above are satisfied by a gate that reds on every
      // zero, which would make a declared emptiness unusable through this door.
      const declared: RuleBuilderLike = {
        violations: () => collectResult([], { examined: 0, declaredEmpty: true }),
      }
      expect(() => checkAll([declared])).not.toThrow()
    })
  })

  it('does not throw when every rule passes', () => {
    expect(() => checkAll([rule([]), rule([])])).not.toThrow()
  })

  it('throws ONE aggregated error carrying every error-severity violation', () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    try {
      checkAll([rule([v('a', 'error')]), rule([v('b', 'error')])])
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ArchRuleError)
      expect((e as ArchRuleError).violations.map((x) => x.ruleId).sort()).toEqual(['a', 'b'])
    }
  })

  it('treats an un-stamped violation as error (default)', () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    expect(() => checkAll([rule([v('a', undefined)])])).toThrow(ArchRuleError)
  })

  it('does not throw when only warn-severity violations are present', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    expect(() => checkAll([rule([v('a', 'warn')])])).not.toThrow()
    expect(spy).toHaveBeenCalled() // the warn is still reported
  })

  it('filters known violations through a baseline before deciding', () => {
    const baseline = { filterNew: (_: ArchViolation[]) => [] as ArchViolation[] }
    expect(() => checkAll([rule([v('a', 'error')])], { baseline })).not.toThrow()
  })

  it('filters to changed files through a diff before deciding', () => {
    const diff = { filterToChanged: (_: ArchViolation[]) => [] as ArchViolation[] }
    expect(() => checkAll([rule([v('a', 'error')])], { diff })).not.toThrow()
  })
})
