/**
 * Bug 0466 — on a `notExist()`-shaped rule, `.expectNonEmpty()` can never pass.
 *
 * The examined set is the selection after `.that()`. A selected element fails
 * the cardinality condition, and an empty selection fails the declaration. The
 * docstring used to recommend the combination as a typo guard for a ratchet;
 * it now says it can never pass. These rows pin the behaviour the docstring
 * describes, through the kernel's public `RuleBuilder`.
 */
import { describe, it, expect } from 'vitest'
import {
  RuleBuilder,
  type Condition,
  type ConditionContext,
  type ArchViolation,
} from '@nielspeter/eess'
import { marksAssertsCardinality } from '@nielspeter/eess/internal'

interface Widget {
  readonly name: string
}
interface WidgetProject {
  readonly widgets: readonly Widget[]
}

class WidgetRules extends RuleBuilder<Widget, WidgetProject> {
  protected getElements(): Widget[] {
    return [...this.project.widgets]
  }
  named(name: string): this {
    return this.addPredicate({ description: `named "${name}"`, test: (w) => w.name === name })
  }
  static notExist(): Condition<Widget> {
    return marksAssertsCardinality({
      description: 'not exist',
      evaluate: (elements: Widget[], context: ConditionContext): ArchViolation[] =>
        elements.map((w) => ({
          rule: context.rule,
          element: w.name,
          file: '',
          line: 0,
          message: `${w.name} should not exist`,
        })),
    })
  }
}

const project: WidgetProject = { widgets: [{ name: 'alpha' }] }

describe('.expectNonEmpty() on a notExist() rule can never pass (bug 0466)', () => {
  it('an empty selection fails the declaration', () => {
    const found = new WidgetRules(project)
      .that()
      .named('nothing')
      .expectNonEmpty()
      .should()
      .satisfy(WidgetRules.notExist())
      .violations()
    expect(found.map((v) => v.message)).toEqual([
      expect.stringContaining('declared .expectNonEmpty() but examined zero units'),
    ])
  })

  it('a non-empty selection fails the condition', () => {
    const found = new WidgetRules(project)
      .that()
      .named('alpha')
      .expectNonEmpty()
      .should()
      .satisfy(WidgetRules.notExist())
      .violations()
    expect(found.map((v) => v.message)).toEqual(['alpha should not exist'])
  })

  it('without the declaration, the empty selection passes', () => {
    const found = new WidgetRules(project)
      .that()
      .named('nothing')
      .should()
      .satisfy(WidgetRules.notExist())
      .violations()
    expect(found).toHaveLength(0)
  })
})
