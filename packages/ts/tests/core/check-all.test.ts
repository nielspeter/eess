import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadRuleFiles } from '../../src/cli/load-rules.js'
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
    // The bare-array case, loaded the way production loads it. An earlier cut of
    // this file argued the shape could not be tested here because forcing it
    // would need an `as` that ADR-005 forbids. **That was false, and it was the
    // load-bearing claim of the phase** — an architect and an enforcement review
    // each wrote the test independently, one through `loadRuleFiles` and one with
    // `@ts-expect-error`, and both typecheck and pass. The ceiling was asserted,
    // not driven, which is the mistake plan 0263 exists to remove.
    //
    // `loadRuleFiles` is the better of the two routes because it is the one
    // production takes: it guards only `typeof value.violations === 'function'`,
    // so a rule file really can hand this door a bare array, and no cast is
    // involved anywhere.
    it('throws on a builder loaded from a rule file that hands back a bare array', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'eess-bare-builder-'))
      const file = join(dir, 'bare.rules.ts')
      writeFileSync(file, 'export default [{ violations: () => [] }]\n')
      const builders = await loadRuleFiles([file])
      vi.spyOn(process.stderr, 'write').mockReturnValue(true)
      try {
        checkAll(builders)
        expect.unreachable('checkAll should have thrown')
      } catch (error) {
        const ids = (error instanceof ArchRuleError ? error.violations : []).map((x) => x.ruleId)
        expect(ids).toContain('emitter/no-receipt')
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })

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
