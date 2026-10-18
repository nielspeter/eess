/**
 * Bug 0460 — the kernel exempted a cardinality rule that examined zero before
 * asking whether its selector could have selected anything. The hook
 * `cardinalitySelectorFault()` is now asked first, after an empty source and
 * before every declaration (plan 0456, Kernel (2)).
 */
import { describe, it, expect } from 'vitest'
import { RuleBuilder, type ArchViolation } from '@nielspeter/eess'
import { notExistCondition, type SelectorFault } from '@nielspeter/eess/internal'

interface Item {
  readonly name: string
}
interface Source {
  readonly items: readonly Item[]
  readonly fault?: SelectorFault
  readonly empty?: boolean
}

class ItemRules extends RuleBuilder<Item, Source> {
  protected getElements(): Item[] {
    return [...this.project.items]
  }
  protected override sourceEmpty(): boolean {
    return this.project.empty === true
  }
  protected override cardinalitySelectorFault(): SelectorFault | undefined {
    return this.project.fault
  }
  named(name: string): this {
    return this.addPredicate({ description: `named ${name}`, test: (i) => i.name === name })
  }
  notExist(): this {
    return this.addCondition(
      notExistCondition<Item>({
        name: (i) => i.name,
        toViolation: (i, message, ctx): ArchViolation => ({
          rule: ctx.rule,
          element: i.name,
          file: 'x',
          line: 1,
          message,
        }),
      }),
    )
  }
}

const fault: SelectorFault = {
  origin: 'named("/x")',
  cause: 'a leading / can never match a repository-relative path',
  remedy: 'Write the glob as `x`.',
}
const items: readonly Item[] = [{ name: 'a' }]

describe('a cardinality rule reports its selector fault (bug 0460)', () => {
  it('the fault reds an absence rule with its own message, remedy and bypass', () => {
    const found = new ItemRules({ items, fault })
      .that()
      .named('/x')
      .should()
      .notExist()
      .violations()
    expect(found).toHaveLength(1)
    expect(found[0]?.message).toBe(
      'This absence rule examined nothing because its selector named("/x") is broken: a leading / ' +
        'can never match a repository-relative path. It has not been enforcing anything. Correct ' +
        'the selector; do not delete the rule.',
    )
    expect(found[0]?.suggestion).toBe('Write the glob as `x`.')
    expect(found[0]?.bypassFilters).toBe(true)
  })

  it('the selector fault outranks an expectEmpty declaration, and the receipt claims no declaration', () => {
    const found = new ItemRules({ items, fault })
      .that()
      .named('/x')
      .expectEmpty()
      .should()
      .notExist()
      .violations()
    expect(found.map((v) => v.message)).toEqual([expect.stringContaining('This absence rule')])
    expect(found.declaredEmpty).toBeUndefined()
  })

  it('excluding the rule element does not hide the selector fault', () => {
    const found = new ItemRules({ items, fault })
      .that()
      .named('/x')
      .should()
      .notExist()
      .rule({ id: 'items/none' })
      .excluding('items/none')
      .violations()
    expect(found.map((v) => v.message)).toEqual([expect.stringContaining('This absence rule')])
  })

  it('with no fault the absence rule over nothing is green and declared empty', () => {
    const found = new ItemRules({ items }).that().named('/x').should().notExist().violations()
    expect([...found]).toEqual([])
    expect(found.declaredEmpty).toBe(true)
  })

  it('an empty source outranks the selector fault', () => {
    const found = new ItemRules({ items: [], fault, empty: true }).should().notExist().violations()
    expect(found.map((v) => v.message)).toEqual([
      expect.stringContaining("this rule's source loaded zero units"),
    ])
  })

  it('a positive rule never asks for the selector fault', () => {
    const found = new ItemRules({ items, fault })
      .that()
      .named('/x')
      .should()
      .satisfy({ description: 'anything', evaluate: () => [] })
      .violations()
    expect(found.map((v) => v.message)).toEqual([expect.stringContaining('examined zero units')])
  })
})
