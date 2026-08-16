import { describe, it, expect } from 'vitest'
import { shallowClone } from '../src/shallow-clone.js'

class Base {
  readonly kind = 'base'
  value = 1
}

class Sub extends Base {
  readonly tag = 'sub'
}

describe('shallowClone', () => {
  it('produces a distinct object with the same own enumerable properties', () => {
    const source = new Base()
    const clone = shallowClone(source)
    expect(clone).not.toBe(source)
    expect(clone.value).toBe(1)
    expect(clone.kind).toBe('base')
  })

  it('preserves the prototype chain, so instanceof still holds', () => {
    const source = new Sub()
    const clone = shallowClone(source)
    expect(clone).toBeInstanceOf(Sub)
    expect(clone).toBeInstanceOf(Base)
    expect(clone.tag).toBe('sub')
  })

  it('is shallow — a mutable field is shared by reference until the owner replaces it', () => {
    class WithArray {
      items: number[] = [1, 2]
    }
    const source = new WithArray()
    const clone = shallowClone(source)
    expect(clone.items).toBe(source.items)
    clone.items.push(3)
    expect(source.items).toEqual([1, 2, 3])
  })

  it('gives the clone independent slots for a reassigned field', () => {
    const source = new Base()
    const clone = shallowClone(source)
    clone.value = 99
    expect(source.value).toBe(1)
    expect(clone.value).toBe(99)
  })

  it('carries across a constructor parameter property', () => {
    class WithParam {
      constructor(readonly project: string) {}
    }
    const source = new WithParam('p')
    const clone = shallowClone(source)
    expect(clone.project).toBe('p')
  })
})
