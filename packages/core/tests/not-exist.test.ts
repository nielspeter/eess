/**
 * Plan 0456: the kernel's one `notExist` condition, built by a dialect with its
 * own violation shape. Driven through a minimal `RuleBuilder` and its terminal.
 */
import { describe, it, expect } from 'vitest'
import { RuleBuilder, type ArchViolation, type ConditionContext } from '@nielspeter/eess'
import { notExistCondition } from '@nielspeter/eess/internal'

interface Widget {
  readonly name: string
  readonly file: string
  readonly line: number
}

class WidgetRules extends RuleBuilder<Widget, readonly Widget[]> {
  protected getElements(): Widget[] {
    return [...this.project]
  }
  named(re: RegExp): this {
    return this.addPredicate({ description: `named ${String(re)}`, test: (w) => re.test(w.name) })
  }
  notExist(name: (w: Widget, ctx: ConditionContext) => string = (w) => w.name): this {
    return this.addCondition(
      notExistCondition<Widget>({
        name,
        toViolation: (w, message, ctx): ArchViolation => ({
          rule: ctx.rule,
          ruleId: ctx.ruleId,
          element: w.name,
          file: w.file,
          line: w.line,
          message,
          because: ctx.because,
          suggestion: ctx.suggestion,
          docs: ctx.docs,
        }),
      }),
    )
  }
}

const widgets: readonly Widget[] = [
  { name: 'alpha', file: 'a.ts', line: 3 },
  { name: 'beta', file: 'b.ts', line: 7 },
]

describe('notExistCondition (plan 0456)', () => {
  it('an empty selection is green with no finding', () => {
    const found = new WidgetRules(widgets).that().named(/^zzz/).should().notExist().violations()
    expect([...found]).toEqual([])
  })

  it('two selected elements give two findings through the dialect constructor', () => {
    const found = new WidgetRules(widgets)
      .that()
      .named(/./)
      .should()
      .notExist()
      .rule({ id: 'w/none', because: 'widgets are gone', suggestion: 'delete it', docs: 'u' })
      .violations()
    expect(found.map((v) => [v.file, v.line, v.message])).toEqual([
      ['a.ts', 3, 'alpha should not exist'],
      ['b.ts', 7, 'beta should not exist'],
    ])
    for (const v of found) {
      expect(v.ruleId).toBe('w/none')
      expect(v.because).toBe('widgets are gone')
      expect(v.suggestion).toBe('delete it')
      expect(v.docs).toBe('u')
    }
  })

  it('the name function sees the condition context', () => {
    const found = new WidgetRules(widgets)
      .that()
      .named(/^alpha$/)
      .should()
      .notExist((w, ctx) => `${w.name} under ${ctx.rule}`)
      .violations()
    expect(found[0]?.message).toMatch(/^alpha under .+ should not exist$/)
  })

  it('composed with another condition, an empty selection is not exempt', () => {
    const found = new WidgetRules(widgets)
      .that()
      .named(/^zzz/)
      .should()
      .notExist()
      .andShould()
      .satisfy({ description: 'anything', evaluate: () => [] })
      .violations()
    expect(found.map((v) => v.bypassFilters)).toEqual([true])
  })

  it('the condition it returns is frozen', () => {
    const c = notExistCondition<Widget>({
      name: (w) => w.name,
      toViolation: () => ({
        rule: '',
        element: '',
        file: '',
        line: 0,
        message: '',
      }),
    })
    expect(Object.isFrozen(c)).toBe(true)
  })
})
