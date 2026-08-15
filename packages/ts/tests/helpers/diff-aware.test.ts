import { describe, it, expect } from 'vitest'
import { DiffFilter } from '@nielspeter/eess'
import { makeViolation } from '../support/test-rule-builder.js'

/** Shorthand with diff-aware-test defaults. */
function mv(file: string, element: string = 'TestElement') {
  return makeViolation({ element, file, message: 'test message' })
}

describe('DiffFilter', () => {
  it('filterToChanged returns only violations in changed files', () => {
    const changedFiles = new Set(['/project/src/a.ts', '/project/src/b.ts'])
    const filter = new DiffFilter(changedFiles)

    const violations = [
      mv('/project/src/a.ts', 'A'),
      mv('/project/src/b.ts', 'B'),
      mv('/project/src/c.ts', 'C'),
      mv('/project/src/a.ts', 'A2'),
      mv('/project/src/d.ts', 'D'),
    ]

    const result = filter.filterToChanged(violations)
    expect(result).toHaveLength(3)
    expect(result.map((v) => v.element)).toEqual(['A', 'B', 'A2'])
  })

  it('filterToChanged returns empty for no changes', () => {
    const filter = new DiffFilter(new Set())
    const violations = [mv('/project/src/a.ts'), mv('/project/src/b.ts')]

    const result = filter.filterToChanged(violations)
    expect(result).toHaveLength(0)
  })

  it('size reflects number of changed files', () => {
    const filter = new DiffFilter(new Set(['/project/src/a.ts', '/project/src/b.ts']))
    expect(filter.size).toBe(2)
  })

  it('never filters out a bypassFilters finding, even though its file is always empty', () => {
    // A bypassFilters configuration finding (ADR-010) sets file: '', which
    // can never be a member of the changed-files set — without this, the
    // "unsuppressable" guarantee was false under --changed, the most
    // realistic incremental-adoption path.
    const filter = new DiffFilter(new Set(['/project/src/a.ts']))
    const configFinding = makeViolation({
      element: 'unnamed',
      file: '',
      line: 0,
      message: 'this rule examined zero units',
      bypassFilters: true,
    })
    const ordinary = mv('/project/src/unrelated.ts')

    const result = filter.filterToChanged([configFinding, ordinary])
    expect(result).toHaveLength(1)
    expect(result[0]?.bypassFilters).toBe(true)
  })
})
