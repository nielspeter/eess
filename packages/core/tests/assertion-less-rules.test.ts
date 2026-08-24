/**
 * A rule that selects subjects and asserts nothing about them must FAIL —
 * [bug 0155](../../../work/bugs/fixed/0155-a-rule-with-no-condition-passes-in-total-silence.md).
 *
 * Such a rule cannot fail, so it certifies nothing while reading as coverage:
 * the false-green class ADR-009 and ADR-010 exist to make unrepresentable.
 * It used to pass in total silence — not even the stderr warning fired,
 * because that warning's guard tested `_phase === 'predicate'` and `should()`
 * sets the phase to `'condition'`, so it was unreachable for every rule shape
 * the DSL documents.
 *
 * **Why a finding and not a warning** (the ruling, per ADR-009 rule 1's
 * optional-remedy discriminator): there is no state in which "it keeps
 * asserting nothing" is correct — the answer is add a condition or delete the
 * rule. Contrast `no-silent-catch`/`no-empty-bodies`, which ADR-009 names as
 * deliberately `warn` *because* they carry suppressible false positives the
 * reader must judge case by case. This carries none.
 */
import { describe, it, expect } from 'vitest'
import {
  RuleBuilder,
  ArchRuleError,
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
  /** A condition that never fires — the control's "asserts something, and passes". */
  static alwaysPasses(): Condition<Widget> {
    return { description: 'always passes', evaluate: (): ArchViolation[] => [] }
  }
}

const project: WidgetProject = { widgets: [{ name: 'alpha' }, { name: 'beta' }] }

describe('an assertion-less rule fails (bug 0155)', () => {
  it('VACUITY: the fixture really selects subjects', () => {
    // Every row below is about a rule that selected something and asserted
    // nothing. If the selection were empty this would be the zero-examined
    // case instead — a different finding with a different message — and the
    // rows below would pass for the wrong reason.
    //
    // Proven with a condition that reports one violation per selected
    // element, so a non-empty result IS the non-empty selection. Note this
    // cannot be shown by running the assertion-less rule itself: that now
    // returns the very finding under test.
    const selected = new WidgetRules(project)
      .that()
      .named('alpha')
      .should()
      .satisfy(WidgetRules.notExist())
      .violations()
    expect(selected.map((v) => v.element)).toEqual(['alpha'])
  })

  it('.should() with no condition produces a finding, not silence', () => {
    // THE headline shape. `should()` sets the phase to 'condition', so the old
    // guard could never fire here — this is the row that was silent.
    const violations = new WidgetRules(project).that().named('alpha').should().violations()
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toContain('asserts nothing')
  })

  it('a predicate-only method after .should() produces a finding', () => {
    // The shape the old warning's own text asked about ("Did you use a
    // predicate-only method after .should()?") and provably could not catch.
    const violations = new WidgetRules(project)
      .that()
      .named('alpha')
      .should()
      .named('alpha')
      .violations()
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toContain('asserts nothing')
  })

  it('.check() throws rather than passing silently', () => {
    expect(() => new WidgetRules(project).that().named('alpha').should().check()).toThrow(
      ArchRuleError,
    )
  })

  it('the finding is unsuppressable — .excluding() cannot remove it', () => {
    // bypassFilters: it reports that the rule's own instrument is broken, not
    // a fault in what was examined, so an exclusion aimed at the latter must
    // not suppress it.
    const violations = new WidgetRules(project)
      .that()
      .named('alpha')
      .should()
      .excluding(/.*/)
      .violations()
    expect(violations).toHaveLength(1)
    expect(violations[0]?.bypassFilters).toBe(true)
  })

  it('a declared .expectNonEmpty() IS an assertion — no finding', () => {
    // Found in PR #71's customer review. `.expectNonEmpty()` says "this corpus
    // must never legitimately be empty" — a real, failing assertion that lives
    // on TerminalBuilder rather than in `_conditions`. Calling it
    // assertion-less told the author to add a condition or delete the rule,
    // both of which destroy a working corpus guard.
    const violations = new WidgetRules(project).that().named('alpha').expectNonEmpty().violations()
    expect(violations).toEqual([])
  })

  it('…and it still reddens when the corpus it guards IS empty', () => {
    // The other half: without this the row above could pass by the assertion
    // having been disabled rather than recognised.
    const empty: WidgetProject = { widgets: [] }
    const violations = new WidgetRules(empty).that().named('alpha').expectNonEmpty().violations()
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toContain('expectNonEmpty')
  })

  it('a declared .expectEmpty() reports ONE finding when it expires, not two', () => {
    // `.expectEmpty()` is likewise an assertion. Before the fix this emitted
    // the assertion-less finding AND the expiry finding for one fault.
    const violations = new WidgetRules(project).that().named('alpha').expectEmpty().violations()
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toContain('expectEmpty')
  })

  it('the remedy is DISTINCT from the message, so it is not printed twice', () => {
    // Plan 0147's double-print. `remedyRepeatsMessage()` suppresses the `Fix:`
    // line only when it is byte-identical to `What:`; a suggestion that
    // *contains* the message renders the whole thing twice. An earlier draft
    // of this fix did exactly that by appending UNSUPPRESSABLE to a suggestion
    // that already repeated the message.
    const [v] = new WidgetRules(project).that().named('alpha').should().violations()
    expect(v?.suggestion).toBeDefined()
    expect(v?.suggestion).not.toContain(v?.message ?? '__never__')
  })

  it('the remedy names the .expectNonEmpty() carve-out and what it costs', () => {
    // ADR-009 rule 3: a marker an agent can stamp to go green is worse than no
    // marker. `.expectNonEmpty()` satisfies this gate and, on a non-empty
    // corpus, asserts nothing further — so the cost is stated in the remedy
    // rather than left to be discovered as a one-token escape.
    const [v] = new WidgetRules(project).that().named('alpha').should().violations()
    expect(v?.suggestion).toContain('expectNonEmpty')
    expect(v?.suggestion).toContain('not a substitute')
  })

  it('a rule with NO predicates and no condition also produces a finding', () => {
    // Sabotage S5, PR #71's testing review: every other row selects with
    // `.named('alpha')`, so narrowing the gate to `_predicates.length > 0`
    // left `entry(p).should().check()` — a rule selecting the WHOLE corpus and
    // asserting nothing — silent again, with nothing in the repo noticing.
    const violations = new WidgetRules(project).should().violations()
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toContain('asserts nothing')
  })

  it('an assertion-less rule with a DEAD selector still reports (not silence)', () => {
    // Sabotage S12. The gate sits after the zero-examined branch, so for a
    // dead selector the only thing standing between this and a silent pass is
    // `assertsCardinality()`'s `if (this._conditions.length === 0) return false`
    // (rule-builder.ts:193). Deleting that one line restored bug 0155 and was
    // caught by nothing across the monorepo. This row pins it.
    const violations = new WidgetRules(project).that().named('nope').should().violations()
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toContain('examined zero units')
  })

  it('the finding names the rule and carries a remedy — identity, not just a count', () => {
    // Sabotages S7/S9/S10: blanking `element`, hardcoding the id to 'unnamed',
    // or dropping `suggestion` each ships a report naming no rule or printing
    // no Fix: line, and all three stayed green on counts alone.
    const [v] = new WidgetRules(project)
      .that()
      .named('alpha')
      .should()
      .rule({ id: 'widgets/must-assert' })
      .violations()
    expect(v?.rule).toBe('widgets/must-assert')
    expect(v?.element).toBe('widgets/must-assert')
    expect(v?.suggestion).toBeTruthy()
  })

  it('CONTROL: a rule that asserts something is unaffected', () => {
    const failing = new WidgetRules(project)
      .that()
      .named('alpha')
      .should()
      .satisfy(WidgetRules.notExist())
      .violations()
    expect(failing.map((v) => v.element)).toEqual(['alpha'])
    const passing = new WidgetRules(project)
      .that()
      .named('alpha')
      .should()
      .satisfy(WidgetRules.alwaysPasses())
      .violations()
    expect(passing).toEqual([])
  })
})
