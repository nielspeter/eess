/**
 * Bug 0462 — the cardinality exemption attached to an object anyone could
 * change. Marking now freezes, so the exemption attaches to what was marked.
 */
import { describe, it, expect } from 'vitest'
import { marksAssertsCardinality } from '../src/internal.js'

describe('marksAssertsCardinality freezes what it marks (bug 0462)', () => {
  it('a marked object is frozen and assigning to it throws', () => {
    const marked = marksAssertsCardinality({ description: 'x', evaluate: () => [] })
    expect(Object.isFrozen(marked)).toBe(true)
    expect(() => {
      Object.assign(marked, { evaluate: () => [] })
    }).toThrow(TypeError)
  })

  it('a marked function is frozen and assigning to it throws', () => {
    const marked = marksAssertsCardinality(Object.assign(() => [], { description: 'x' }))
    expect(Object.isFrozen(marked)).toBe(true)
    expect(() => {
      Object.assign(marked, { description: 'y' })
    }).toThrow(TypeError)
  })
})
