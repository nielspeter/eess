import { describe, it, expect } from 'vitest'
import { matchSelections } from '../src/index.js'

describe('matchSelections() — shared matching engine', () => {
  it('keyBy: pairs by key, reports unmatched both ways', () => {
    const left = [{ k: 'a' }, { k: 'b' }]
    const right = [{ k: 'a' }, { k: 'c' }]
    const r = matchSelections(left, right, { leftKey: (x) => x.k, rightKey: (x) => x.k })
    expect(r.pairs).toHaveLength(1)
    expect(r.leftUnmatched.map((x) => x.k)).toEqual(['b'])
    expect(r.rightUnmatched.map((x) => x.k)).toEqual(['c'])
  })

  it('keyBy: flags a left matching multiple rights as ambiguous', () => {
    const left = [{ k: 'a' }]
    const right = [{ k: 'a' }, { k: 'a' }]
    const r = matchSelections(left, right, { leftKey: (x) => x.k, rightKey: (x) => x.k })
    expect(r.leftAmbiguous).toHaveLength(1)
    expect(r.pairs).toHaveLength(2)
  })

  it('matchBy: Cartesian matching, same order as a nested loop', () => {
    const left = [{ n: 1 }, { n: 2 }]
    const right = [{ m: 1 }, { m: 2 }]
    const r = matchSelections(left, right, { matchBy: (l, x) => l.n === x.m })
    expect(r.pairs.map((p) => [p.left.n, p.right.m])).toEqual([
      [1, 1],
      [2, 2],
    ])
    expect(r.leftUnmatched).toHaveLength(0)
    expect(r.rightUnmatched).toHaveLength(0)
  })

  it('throws when neither matchBy nor keys are given', () => {
    expect(() => matchSelections([1], [2], {})).toThrow(/matchBy or both/)
  })
})
