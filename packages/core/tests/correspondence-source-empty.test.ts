import { describe, expect, it } from 'vitest'
import { correspondence, RuleBuilder, type Selection } from '../src/index.js'

// Spike 0640 (bug 0477): a side whose source loaded nothing reds the join, once, while two loaded
// sides that select nothing stay green (a release gate's empty diff is the right answer).
interface Item {
  readonly name: string
}
class ItemRules extends RuleBuilder<
  Item,
  { readonly items: readonly Item[]; readonly empty?: boolean }
> {
  protected getElements(): Item[] {
    return [...this.project.items]
  }
  protected override sourceEmpty(): boolean {
    return this.project.empty === true
  }
}
const side = (items: readonly Item[], label: string, empty = false): Selection<Item> =>
  new ItemRules({ items, empty }).select({ label, identify: (i) => ({ name: i.name }) })
const join = (left: Selection<Item>, right: Selection<Item>) =>
  correspondence({ left, right, keyBy: (i: Item) => i.name })
    .should()
    .beComplete()
    .rule({ id: 'demo/join' })
    .violations()

describe('a correspondence over a side whose source loaded nothing (spike 0640)', () => {
  it('select() carries the builder source fact, and only when it is true', () => {
    expect(side([], 'l', true).sourceEmpty).toBe(true)
    expect('sourceEmpty' in side([], 'l')).toBe(false)
  })

  it('CONTROL: two loaded sides that select nothing pass, as an absence join over nothing does', () => {
    expect(join(side([], 'l'), side([], 'r'))).toHaveLength(0)
  })

  it('both sides empty from an empty source: one finding, under the rule, unsuppressable', () => {
    const v = join(side([], 'l', true), side([], 'r', true))
    expect(v.map((x) => [x.ruleId, x.bypassFilters])).toEqual([['demo/join', true]])
    expect(v[0]?.message).toMatch(/source loaded zero units/)
  })

  it('one side empty from an empty source, beside a side that examined: the empty source is still reported', () => {
    const v = join(side([{ name: 'a' }], 'l'), side([], 'r', true))
    expect(v.map((x) => x.ruleId)).toContain('emitter/source-empty')
    expect(v.examined).toBeGreaterThan(0)
  })
})
