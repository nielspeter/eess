import { describe, it, expect } from 'vitest'
import { isRecord, isNullaryCallable } from '../src/type-guards.js'

describe('isRecord', () => {
  it('accepts a plain object', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord({ a: 1 })).toBe(true)
  })

  it('rejects null', () => {
    expect(isRecord(null)).toBe(false)
  })

  it('rejects an array — load-bearing, not incidental', () => {
    expect(isRecord([])).toBe(false)
    expect(isRecord([1, 2, 3])).toBe(false)
  })

  it('rejects primitives', () => {
    expect(isRecord('x')).toBe(false)
    expect(isRecord(1)).toBe(false)
    expect(isRecord(true)).toBe(false)
    expect(isRecord(undefined)).toBe(false)
  })
})

describe('isNullaryCallable', () => {
  it('accepts a function', () => {
    expect(isNullaryCallable(() => 1)).toBe(true)
    expect(isNullaryCallable(function named() {})).toBe(true)
  })

  it('rejects non-functions', () => {
    expect(isNullaryCallable({})).toBe(false)
    expect(isNullaryCallable(null)).toBe(false)
    expect(isNullaryCallable(1)).toBe(false)
  })

  it('narrows so the result can be called with no arguments, no cast needed', () => {
    const value: unknown = () => 'ok'
    if (isNullaryCallable(value)) {
      const result: unknown = value()
      expect(result).toBe('ok')
    } else {
      expect.unreachable('isNullaryCallable should have narrowed')
    }
  })
})
