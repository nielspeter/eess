import { describe, it, expect, vi, afterEach } from 'vitest'
import { applyFilters } from '../src/internal.js'
import type { ArchViolation } from '../src/violation.js'

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * Bug 0298, the kernel half — `eess-md`, `eess-mermaid`, `eess-gherkin` and
 * `eess-crossvalidate` run this `applyFilters`, not the eess-ts copy. It warns only
 * about a pattern that matched nothing, so one pattern absorbing several subjects
 * writes nothing. A fix landed only in eess-ts leaves this test green.
 *
 * Distinct `element` values on purpose: `excluding-matching.test.ts` in eess-ts
 * records a control that passed for the wrong reason because its violations shared
 * one element.
 *
 * The KNOWN GAP test asserts today's behaviour; fixing 0298 in the kernel through a
 * write during filtering turns it red. A disclosure through the receipt does not
 * touch stderr and needs its own test.
 */
function violation(element: string): ArchViolation {
  return {
    rule: 'repositories must not query the database directly',
    element,
    file: `/src/${element}.ts`,
    line: 1,
    message: `${element} contains a raw query`,
  }
}

describe('bug 0298: the kernel applyFilters', () => {
  it('KNOWN GAP — the kernel applyFilters removes two subjects with one pattern and writes nothing', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const result = applyFilters(
      [
        violation('DirectRepository'),
        violation('AuditRepository'),
        violation('AuditTrailRepository'),
      ],
      { exclusions: [/Audit/], metadata: { id: 'test/0298-kernel' } },
    )

    expect(result.map((v) => v.element)).toEqual(['DirectRepository'])
    expect(stderr).not.toHaveBeenCalled()
  })
})
