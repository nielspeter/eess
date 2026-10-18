/**
 * Bug 0462 — a returned `notExist()` could be emptied and keep its exemption.
 *
 * `marksAssertsCardinality` keyed the exemption onto the object, and the object
 * stayed writable: `c.evaluate = () => []` gave a condition that passed over an
 * empty selection where a plain no-op condition reds. Marking now freezes.
 */
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { classes, notExist, project } from '../../src/index.js'

const tsconfig = path.resolve(import.meta.dirname, '../fixtures/poc/tsconfig.json')
const p = project(tsconfig)

describe('a returned notExist() cannot be emptied (bug 0462)', () => {
  it('assigning evaluate on a returned notExist() throws', () => {
    const c = notExist()
    expect(Object.isFrozen(c)).toBe(true)
    expect(() => {
      Object.assign(c, { evaluate: () => [] })
    }).toThrow(TypeError)
  })

  it('a notExist() someone tried to empty still judges a selection through the public entry', () => {
    // The harm bug 0462 recorded: an emptied notExist() kept its exemption and passed everything.
    const c = notExist()
    try {
      Object.assign(c, { evaluate: () => [] })
    } catch {
      // The freeze refuses the forgery; the condition stays the one shipped.
    }
    const found = classes(p)
      .that()
      .haveNameMatching(/^OrderService$/)
      .should()
      .satisfy(c)
      .violations()
    expect(found.map((v) => v.message)).toEqual([expect.stringContaining('OrderService')])
  })

  it('a no-op condition over an empty selection still reds with examined zero', () => {
    const found = classes(p)
      .that()
      .haveNameMatching(/^NoSuchClassXyz$/)
      .should()
      .satisfy({ description: 'no-op', evaluate: () => [] })
      .violations()
    expect(found.map((v) => v.message)).toEqual([expect.stringContaining('examined 0 subjects')])
  })
})
