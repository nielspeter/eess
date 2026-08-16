import { describe, expect, it, vi, afterEach } from 'vitest'
import { dispatchRule } from '../src/preset-dispatch.js'
import type { RuleMetadata } from '../src/rule-metadata.js'
import type { ArchViolation } from '../src/violation.js'

afterEach(() => vi.restoreAllMocks())

/**
 * Minimal `Dispatchable` double: records the metadata it was given via `.rule()`
 * and returns a fixed violation set from `.violations()`.
 */
function fakeBuilder(violations: ArchViolation[]): {
  seen?: RuleMetadata
  rule(m: RuleMetadata): { violations(): ArchViolation[] }
  violations(): ArchViolation[]
} {
  return {
    seen: undefined,
    rule(m: RuleMetadata) {
      this.seen = m
      return { violations: () => violations }
    },
    violations: () => violations,
  }
}

const oneViolation: ArchViolation[] = [
  { rule: 'r', element: 'e', file: 'f.ts', line: 1, message: 'm' },
]

describe('dispatchRule() metadata form (plan 0071 Phase 1)', () => {
  it('accepts a bare id (back-compat) and passes { id } to .rule()', () => {
    const b = fakeBuilder(oneViolation)
    const out = dispatchRule(b, 'preset/x/y', 'error', undefined)
    expect(out).toHaveLength(1)
    expect(b.seen).toEqual({ id: 'preset/x/y' })
  })

  it('accepts full metadata and threads it into .rule() verbatim', () => {
    const b = fakeBuilder(oneViolation)
    const meta = {
      id: 'preset/agent/no-eval',
      because: 'eval executes arbitrary code',
      suggestion: 'remove eval()',
      imperative: 'Do NOT call eval()',
    }
    dispatchRule(b, meta, 'error', undefined)
    expect(b.seen).toEqual(meta)
  })

  it('honours an override keyed by the metadata id', () => {
    const b = fakeBuilder(oneViolation)
    const off = dispatchRule(b, { id: 'preset/agent/no-eval' }, 'error', {
      'preset/agent/no-eval': 'off',
    })
    expect(off).toHaveLength(0)
  })

  it('warn severity reports but does not aggregate for the throw', () => {
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const b = fakeBuilder(oneViolation)
    const out = dispatchRule(b, { id: 'preset/agent/no-stubs' }, 'warn', undefined)
    expect(out).toHaveLength(0)
    expect(warnSpy).toHaveBeenCalledOnce()
  })

  // Plan 0147 (severityFor, reconciled against ts-archunit): a `bypassFilters`
  // config finding (e.g. `presetConstructsNothingViolation`) is UNSUPPRESSABLE
  // by its own text — a per-rule `overrides: { id: 'warn' }` downgrading that
  // finding's severity must still surface it for the preset's aggregated
  // throw, even though `dispatchRule` still reports it to stderr as a warning
  // like any other 'warn'-severity finding.
  it('still aggregates a bypassFilters violation for the throw, even under a warn override', () => {
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const configFinding: ArchViolation[] = [
      { rule: 'r', element: 'e', file: '', line: 0, message: 'm', bypassFilters: true },
    ]
    const b = fakeBuilder(configFinding)
    const out = dispatchRule(b, { id: 'preset/agent/no-stubs' }, 'warn', undefined)
    expect(out).toHaveLength(1)
    expect(out[0]?.bypassFilters).toBe(true)
    expect(warnSpy).toHaveBeenCalledOnce()
  })

  it('separates bypassFilters from ordinary violations under a warn override — only the former aggregates', () => {
    const mixed: ArchViolation[] = [
      { rule: 'r', element: 'ordinary', file: 'f.ts', line: 1, message: 'm' },
      { rule: 'r', element: 'config', file: '', line: 0, message: 'm', bypassFilters: true },
    ]
    const b = fakeBuilder(mixed)
    const out = dispatchRule(b, { id: 'preset/agent/no-stubs' }, 'warn', undefined)
    expect(out).toHaveLength(1)
    expect(out[0]?.element).toBe('config')
  })
})
