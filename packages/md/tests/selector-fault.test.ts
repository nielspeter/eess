/**
 * Bug 0460 — the kernel exempted a cardinality rule before it looked at its
 * selector, so a `notExist()`-shaped rule whose glob can never match a
 * repository-relative path passed, permanently. Plan 0456 adds the hook
 * `cardinalitySelectorFault()`, and eess-md's corpus builders answer it.
 */
import { describe, it, expect } from 'vitest'
import { marksAssertsCardinality } from '@nielspeter/eess/internal'
import { corpus, docs } from '../src/index.js'
import { tree } from './helpers/tree.js'

describe('a cardinality rule with a broken selector is red (bug 0460)', () => {
  it('a marked condition behind an anchored folder glob reds instead of passing', () => {
    const c = corpus({ cwd: tree(['guides/a.md']), roots: ['**/*.md'] })
    const found = docs(c)
      .that()
      .resideInFolder('/guides/**')
      .should()
      .satisfy(marksAssertsCardinality({ description: 'cardinality probe', evaluate: () => [] }))
      .violations()
    expect(found).toHaveLength(1)
    expect(found[0]?.message).toContain('This absence rule examined nothing')
    expect(found[0]?.message).toContain('resideInFolder')
    expect(found[0]?.bypassFilters).toBe(true)
  })
})
