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
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const b = fakeBuilder(oneViolation)
    const out = dispatchRule(b, { id: 'preset/agent/no-stubs' }, 'warn', undefined)
    expect(out).toHaveLength(0)
    expect(warnSpy).toHaveBeenCalledOnce()
  })
})
