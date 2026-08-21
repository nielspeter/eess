/**
 * A second `.should()` must not discard the first assertion —
 * [bug 0156](../../../work/bugs/0156-should-twice-silently-drops-the-first-assertion.md),
 * the KERNEL half.
 *
 * The fix landed in `packages/ts` when plan 0165's engine copy arrived and never
 * reached `packages/core`, where `fork()` went on doing `fork._conditions = []`.
 * `eess-md`, `eess-mermaid` and `eess-gherkin` all extend the kernel's
 * `RuleBuilder`, so all three silently dropped the first assertion of any
 * `.should().X().should().Y()` chain — and `check:corpus`, `check:ledger` and
 * `check:diagram` are md/mermaid gates, so this repo's own corpus enforcement
 * ran on the defective copy. Found by the architect review of PR #72.
 *
 * **Why this file exists at all.** Porting the one-line fix changed no test
 * result anywhere: 3528 + 457 green before and after. A High-severity false
 * green was repaired and the suite could not tell — which is the same defect one
 * level up, and exactly what ADR-009 says a check is for. This is the test that
 * would have caught it.
 */
import { describe, it, expect } from 'vitest'
import {
  RuleBuilder,
  type Condition,
  type ConditionContext,
  type ArchViolation,
} from '@nielspeter/eess'

interface Widget {
  readonly name: string
}
interface WidgetProject {
  readonly widgets: readonly Widget[]
}

/** Reports one violation per element whose name is missing `needle`. */
function mustContain(needle: string): Condition<Widget> {
  return {
    description: `contain "${needle}"`,
    evaluate: (elements: Widget[], context: ConditionContext): ArchViolation[] =>
      elements
        .filter((w) => !w.name.includes(needle))
        .map((w) => ({
          rule: context.rule,
          element: w.name,
          file: '',
          line: 0,
          message: `${w.name} does not contain "${needle}"`,
        })),
  }
}

class WidgetRules extends RuleBuilder<Widget, WidgetProject> {
  protected getElements(): Widget[] {
    return [...this.project.widgets]
  }
}

const project: WidgetProject = { widgets: [{ name: 'alpha' }, { name: 'beta' }] }
const rules = (): WidgetRules => new WidgetRules(project)

describe('a second .should() keeps the first assertion (bug 0156, kernel side)', () => {
  // Both halves must be independently capable of reporting, or the combined row
  // below could pass for an uninteresting reason (ADR-010).
  it('VACUITY: each condition alone reports at least one violation', () => {
    expect(rules().should().satisfy(mustContain('z')).violations().length).toBeGreaterThan(0)
    expect(rules().should().satisfy(mustContain('q')).violations().length).toBeGreaterThan(0)
  })

  it('reports BOTH assertions — the first is not discarded', () => {
    const violations = rules()
      .should()
      .satisfy(mustContain('z'))
      .should()
      .satisfy(mustContain('q'))
      .violations()

    const messages = violations.map((v) => v.message)
    // The first assertion's findings are the ones the defect deleted.
    expect(messages.filter((m) => m.includes('"z"')).length).toBeGreaterThan(0)
    expect(messages.filter((m) => m.includes('"q"')).length).toBeGreaterThan(0)
  })

  it('accumulates exactly as .andShould() does — the two spellings agree', () => {
    const viaShould = rules()
      .should()
      .satisfy(mustContain('z'))
      .should()
      .satisfy(mustContain('q'))
      .violations()
    const viaAndShould = rules()
      .should()
      .satisfy(mustContain('z'))
      .andShould()
      .satisfy(mustContain('q'))
      .violations()
    expect(viaShould.map((v) => v.message).sort()).toEqual(
      viaAndShould.map((v) => v.message).sort(),
    )
  })

  it('the rule description names both conditions, so the identity reflects both', () => {
    const described = rules()
      .should()
      .satisfy(mustContain('z'))
      .should()
      .satisfy(mustContain('q'))
      .describeRule()
    expect(described.rule).toContain('"z"')
    expect(described.rule).toContain('"q"')
  })
})
