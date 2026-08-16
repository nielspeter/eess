/**
 * THE EXTENSION SURFACE AS A CONTRACT (plan 0088 Phase 6, adopting
 * ts-archunit ADR-010's consequence as an eess statement).
 *
 * eess's other dialects (md, mermaid, gherkin, crossvalidate) extend the
 * kernel's `TerminalBuilder`/`RuleBuilder` the way ts-archunit's own
 * `graphql/` builders do — protected members, the abstract methods, the
 * chain-method return contract. Once that's true, the kernel's PUBLISHED
 * surface is a contract other packages compile and run against, not an
 * implementation detail eess is free to reshape without noticing who breaks.
 *
 * This file plays THE STRANGER: a hypothetical new dialect, built against
 * ONLY `@nielspeter/eess`'s published bare specifier (dist-resolved via the
 * workspace symlink, exactly as an out-of-repo consumer would resolve it —
 * never a relative `../src/*` import into this package's own source). If a
 * future change renames a protected member a real dialect depends on, or
 * silently drifts `copy()`/`assertsCardinality()`/`sourceEmpty()`'s
 * semantics, this file is where that breaks — not a downstream dialect's own
 * suite discovering it after the fact.
 *
 * Two angles, matching the two extension shapes real dialects actually use
 * (plan 0088 Phase 4's own docstring on `TerminalBuilder`: "Used by
 * SliceRuleBuilder, SchemaRuleBuilder, ResolverRuleBuilder, PairFinalBuilder,
 * SmellBuilder, CorrespondenceBuilder, TsconfigBuilder, and ... RuleBuilder"):
 *   1. A direct `TerminalBuilder` subclass — the harder contract, no
 *      predicate/condition scaffolding to lean on.
 *   2. A `RuleBuilder<T, P>` subclass — the two-param generic every real
 *      dialect (ts, md, mermaid) actually builds on.
 */
import { describe, it, expect } from 'vitest'
import {
  TerminalBuilder,
  RuleBuilder,
  ArchRuleError,
  marksAssertsCardinality,
  type CollectResult,
  type Condition,
  type ConditionContext,
  type ArchViolation,
} from '@nielspeter/eess'

// --- Angle 1: a direct TerminalBuilder subclass — a fictional "widget" dialect ---

interface Widget {
  readonly name: string
}

/** The minimal project shape a stranger dialect might load. */
interface WidgetProject {
  readonly widgets: readonly Widget[]
}

class WidgetRuleBuilder extends TerminalBuilder {
  private _widgets: Widget[]
  private _mustBeEmpty = false

  constructor(project: WidgetProject) {
    super()
    this._widgets = [...project.widgets]
  }

  /** Mirrors a real dialect's `.notExist()`-shaped condition marker. */
  mustNotExist(): this {
    const next = this.copy()
    next._mustBeEmpty = true
    return next
  }

  protected override copy(): this {
    const clone = super.copy()
    clone._widgets = [...this._widgets]
    return clone
  }

  protected override assertsCardinality(): boolean {
    return this._mustBeEmpty
  }

  protected collectViolations(): CollectResult {
    if (this._mustBeEmpty) {
      return {
        violations: this._widgets.map((w) => ({
          rule: 'mustNotExist',
          element: w.name,
          file: '',
          line: 0,
          message: `widget ${w.name} should not exist`,
        })),
        examined: this._widgets.length,
      }
    }
    return { violations: [], examined: this._widgets.length }
  }
}

describe('extension surface contract — a direct TerminalBuilder subclass (stranger dialect)', () => {
  it('the constructor + inherited chain methods (.because/.rule/.excluding) all still exist and return `this`-typed values', () => {
    const p: WidgetProject = { widgets: [{ name: 'a' }] }
    const builder = new WidgetRuleBuilder(p)
      .because('a widget test')
      .rule({ id: 'widget/test' })
      .excluding('nonexistent')
    expect(builder).toBeInstanceOf(WidgetRuleBuilder)
    expect(builder.describeRule().because).toBe('a widget test')
  })

  it('copy() independence: a held selection is not mutated by .because() — the "bug 0016" contract', () => {
    const base = new WidgetRuleBuilder({ widgets: [{ name: 'a' }] })
    const branchA = base.because('branch A')
    const branchB = base.because('branch B')
    expect(branchA.describeRule().because).toBe('branch A')
    expect(branchB.describeRule().because).toBe('branch B')
    expect(base.describeRule().because).toBeUndefined()
  })

  it('the ADR-010 evidence gate fires for a zero-examined, non-cardinality-exempt stranger builder', () => {
    const empty = new WidgetRuleBuilder({ widgets: [] })
    try {
      empty.check()
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ArchRuleError)
      const archError = error as ArchRuleError
      expect(archError.violations[0]?.message).toMatch(/examined zero units/)
      expect(archError.violations[0]?.bypassFilters).toBe(true)
    }
  })

  it('assertsCardinality() override is honored — a dead selector for a mustNotExist()-shaped rule passes', () => {
    const empty = new WidgetRuleBuilder({ widgets: [] }).mustNotExist()
    expect(() => empty.check()).not.toThrow()
  })

  it('.expectEmpty() still works for a stranger subclass', () => {
    const empty = new WidgetRuleBuilder({ widgets: [] })
    expect(() => empty.expectEmpty().check()).not.toThrow()
  })
})

// --- Angle 2: a RuleBuilder<T, P> subclass — the shape every real dialect uses ---

class WidgetElementRuleBuilder extends RuleBuilder<Widget, WidgetProject> {
  protected getElements(): Widget[] {
    return [...this.project.widgets]
  }

  /** A stranger's own predicate method, mirroring a real dialect's identity predicates. */
  named(name: string): this {
    return this.addPredicate({
      description: `named "${name}"`,
      test: (w) => w.name === name,
    })
  }

  /** A stranger's own .notExist()-shaped condition, using the exported registry. */
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

describe('extension surface contract — a RuleBuilder<T, P> subclass (stranger dialect)', () => {
  const project: WidgetProject = { widgets: [{ name: 'a' }, { name: 'b' }] }

  it('the two-param generic signature holds: T = Widget, P = WidgetProject, .project is readonly-typed', () => {
    const builder = new WidgetElementRuleBuilder(project)
    expect(builder).toBeInstanceOf(RuleBuilder)
    expect(builder).toBeInstanceOf(TerminalBuilder)
  })

  it('.that()/.should() chain + a custom predicate + a custom cardinality-exempt condition, end to end', () => {
    expect(() => {
      new WidgetElementRuleBuilder(project)
        .that()
        .named('nonexistent')
        .should()
        .satisfy(WidgetElementRuleBuilder.notExist())
        .check()
    }).not.toThrow()
  })

  it('a real, non-exempt violation still throws with the expected shape', () => {
    try {
      new WidgetElementRuleBuilder(project)
        .that()
        .named('a')
        .should()
        .satisfy(WidgetElementRuleBuilder.notExist())
        .check()
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ArchRuleError)
      const archError = error as ArchRuleError
      expect(archError.violations[0]?.element).toBe('a')
    }
  })

  it('named-selection reuse across two branches does not leak conditions (bug 0016, RuleBuilder side)', () => {
    const selection = new WidgetElementRuleBuilder(project).that().named('a')
    // Branch A: adds a real condition, genuinely fails against 'a'.
    expect(() => {
      selection.should().satisfy(WidgetElementRuleBuilder.notExist()).check()
    }).toThrow(ArchRuleError)
    // Branch B: a FRESH .should() fork from the same held selection, no
    // condition added. If branch A's condition had leaked, this would also
    // throw (still asserting notExist() against 'a'); instead it hits the
    // "predicates but no conditions" assertion-less path and passes.
    expect(() => {
      selection.should().check()
    }).not.toThrow()
  })
})
