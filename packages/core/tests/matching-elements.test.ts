import { describe, expect, it } from 'vitest'
import type { Predicate } from '../src/index.js'
import { matchingElements, selectMatching } from '../src/internal.js'

/**
 * `matchingElements` is the ONE answer to "which elements did the predicates
 * admit". Six call sites read it — the kernel's `collectViolations` and
 * `selectMatching`, `eess-ts`'s `filterElements`, `getMatchedCalls`, and both
 * GraphQL builders' `selected()` — because a rule whose `.select()` side and
 * whose condition side disagree about that set is the fail-open divergence
 * ADR-010 exists to make impossible.
 */
const admits = (allowed: readonly string[]): Predicate<string> => ({
  description: `is one of ${allowed.join(', ')}`,
  test: (element: string) => allowed.includes(element),
})

describe('matchingElements', () => {
  it('admits an element only when every predicate admits it', () => {
    const elements = ['a', 'b', 'c']
    expect(matchingElements(elements, [admits(['a', 'b']), admits(['b', 'c'])])).toEqual(['b'])
  })

  it('admits everything when there are no predicates', () => {
    // The `.that()`-less chain: no narrowing means the whole population, not
    // the empty set. Getting this backwards makes every unfiltered rule vacuous.
    expect(matchingElements(['a', 'b'], [])).toEqual(['a', 'b'])
  })

  it('gives selectMatching the same elements it computes on its own', () => {
    // The binding that makes the extraction worth having: `Selection.elements`
    // and the bare array are the same conjunction, not two that agree by luck.
    const elements = ['a', 'b', 'c']
    const predicates = [admits(['a', 'c'])]
    const selection = selectMatching(elements, predicates, {
      label: 'letter',
      identify: (name) => ({ name, file: 'letters.ts', line: 1 }),
    })
    expect(selection.elements).toEqual(matchingElements(elements, predicates))
    expect(selection.elements).toEqual(['a', 'c'])
  })
})
