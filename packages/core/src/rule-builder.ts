import { assertionAdviceFor } from './assertion-advice.js'
import type { Predicate } from './predicate.js'
import { selectMatching, matchingElements } from './correspondence.js'
import { recordPredicate } from './predicate.js'
import type { Condition, ConditionContext } from './condition.js'
import type { ArchViolation } from './violation.js'
import type { RuleDescription } from './rule-description.js'
import type { Selection, ElementInfo } from './correspondence.js'
import type { DeclaredGlob, GlobNode } from './glob-site.js'
import { countDeclaredGlobs, stampGlobs } from './glob-site.js'
import { TerminalBuilder, type CollectResult, assertionLessViolation } from './terminal-builder.js'
import { assertsCardinality as conditionAssertsCardinality } from './cardinality.js'
import { ruleDescriptionOf, ruleDescriptionFrom } from './rule-description.js'
import { conditionContextFrom } from './condition.js'

/**
 * A declared glob's own label in a dead-glob finding — the predicate/
 * condition's description, disambiguated with the literal glob only when
 * more than one site shares the description (a variadic predicate like
 * `importFrom(...globs)` already spells every glob into its own
 * description, so a substring test would collapse the one case this exists
 * to separate — keyed on the site COUNT instead).
 */
function describeOrigin(description: string, glob: DeclaredGlob, siteCount: number): string {
  return siteCount > 1 ? `${description} ("${glob.glob}")` : description
}

/**
 * The actual walk `RuleBuilder.globs()` delegates to — a free function
 * rather than a method body, to keep the class itself under this repo's own
 * 300-line class-length gate (`arch.internal.rules.ts`).
 */
/**
 * The globs a rule declares, stamped with where each came from.
 *
 * Exported (as family plumbing) so `eess-ts` can call it instead of keeping its
 * own copy — they were 94% similar, and the difference was not cosmetic: only
 * the eess-ts copy honoured `originLabel`. The kernel's `Predicate` has carried
 * that field all along and this function ignored it, so a preset's label was
 * dropped for `eess-md`, `eess-mermaid` and `eess-gherkin`. Found by unifying.
 */
export function declaredGlobsOf<T>(
  // `readonly`, widened so a caller holding a frozen declaration can pass it
  // without a copy. Strictly more permissive; the body only iterates.
  predicates: readonly Predicate<T>[],
  conditions: readonly Condition<T>[],
): GlobNode[] {
  const trees: GlobNode[] = []
  for (const predicate of predicates) {
    if (predicate.globs) {
      const count = countDeclaredGlobs(predicate.globs)
      trees.push(
        stampGlobs(
          predicate.globs,
          'selector',
          (g) =>
            // A preset's `originLabel` names the option the user wrote rather
            // than the calls it expanded into. Used VERBATIM, skipping
            // `describeOrigin`: that appends `("glob")` to disambiguate a
            // predicate holding several sites, and a label already names exactly
            // one option and one glob — left in, the finding read
            // `shared: "**/x/**" ("**/x/**")`.
            predicate.originLabel ?? describeOrigin(predicate.description, g, count),
        ),
      )
    }
  }
  for (const condition of conditions) {
    if (condition.globs) {
      const count = countDeclaredGlobs(condition.globs)
      trees.push(
        stampGlobs(condition.globs, 'condition', (g) =>
          describeOrigin(condition.description, g, count),
        ),
      )
    }
  }
  return trees
}

/**
 * Abstract base class for all rule builders.
 *
 * Concrete entry points (plans 0007+) extend this and:
 * 1. Implement `getElements()` to return the elements to check
 * 2. Add predicate methods that call `addPredicate()`
 * 3. Add condition methods that call `addCondition()`
 *
 * The builder accumulates predicates and conditions. Nothing executes
 * until a terminal method (`.check()`, `.warn()`, `.severity()`) is called —
 * inherited from {@link TerminalBuilder} (plan 0088 Phase 4), which also
 * supplies `because`/`rule`/`excluding`/`violations`/`expectEmpty`/
 * `expectNonEmpty` and the ADR-010 evidence gate. `RuleBuilder` keeps its own
 * `<T, P>` two-param generic — `P` is the dialect's project type, kept
 * separate from `TerminalBuilder` (which has no project concept, since
 * `correspondence()`, `SmellBuilder`, and the graphql builders don't share a
 * uniform notion of "one project") — every builder across all five dialects
 * depends on this exact two-param signature, so it is not replaced by the
 * fold, only extended.
 */

export abstract class RuleBuilder<T, P = unknown> extends TerminalBuilder {
  protected _predicates: Predicate<T>[] = []
  protected _conditions: Condition<T>[] = []
  protected _phase: 'predicate' | 'condition' = 'predicate'
  /** Whether `.should()` was ever reached — bug 0155 state 3/4 vs state 1. */
  protected _reachedShould = false
  /**
   * Descriptions of predicate-only methods used AFTER `.should()` — bug 0155
   * state 2. A dual-use method dispatches to a condition in that phase and
   * never lands here, so anything recorded is genuinely a filter written where
   * an assertion was meant.
   */
  protected _misplaced: string[] = []

  constructor(protected readonly project: P) {
    super()
  }

  // --- Chain methods (grammar transitions) ---

  /**
   * Begin the predicate phase. Returns a COPY — a held selection is never
   * edited by narrowing it (see `TerminalBuilder.copy()`).
   * Purely a readability marker — `.that().haveNameMatching(...)` reads like English.
   * Explicitly resets phase to 'predicate' — defensive against `.should().that()` misuse.
   */
  that(): this {
    const next = this.copy()
    next._phase = 'predicate'
    return next
  }

  /**
   * Add another predicate (AND). Returns `this` for chaining.
   * `.that().extend('Base').and().resideInFolder('src/repos/**')` means both must match.
   */
  and(): this {
    return this
  }

  /**
   * Begin the condition phase. Returns a forked builder for named selection safety.
   * Creates a fresh builder with the same predicates but empty conditions.
   * Sets phase to 'condition' so dual-use methods dispatch correctly.
   */
  should(): this {
    const fork = this.fork()
    fork._phase = 'condition'
    fork._reachedShould = true
    return fork
  }

  /**
   * Add another condition that must ALSO pass (AND).
   * `.should().notContain(call('x')).andShould().notContain(call('y'))` means both must hold.
   */
  andShould(): this {
    return this
  }

  /**
   * Plug in a custom predicate or condition.
   *
   * After `.that()` — pass a `Predicate<T>` to filter elements.
   * After `.should()` — pass a `Condition<T>` to assert against filtered elements.
   *
   * Dispatch is structural: if the object has a `test` method it is treated
   * as a predicate; if it has `evaluate` it is treated as a condition.
   */
  satisfy(custom: Predicate<T> | Condition<T>): this {
    if ('test' in custom) {
      return this.addPredicate(custom)
    }
    return this.addCondition(custom)
  }

  // `because`, `rule`, `excluding`, `violations`, `check`, `warn`, `severity`,
  // `expectEmpty`, `expectNonEmpty` are inherited from `TerminalBuilder`
  // (plan 0088 Phase 4) — this class used to duplicate all of them, and the
  // two copies had already drifted (the exact hazard `ts-archunit`'s own
  // `RuleBuilder`/`TerminalBuilder` merge commit documents).

  // --- Terminal methods ---

  /**
   * Return the predicate-filtered elements as a labelled `Selection<T>` for
   * cross-validation (`correspondence()`). The set is exactly the elements this
   * rule would evaluate — the same filtering `.check()` applies.
   *
   * @param opts.label - human-readable name of this side ("diagram class")
   * @param opts.identify - map an element to its message metadata (name/file/line)
   */
  select(opts: { label: string; identify: (element: T) => ElementInfo }): Selection<T> {
    return selectMatching(this.getElements(), this._predicates, opts)
  }

  /**
   * Return a structured description of this rule without executing it.
   * Used by the `explain` CLI subcommand.
   */
  describeRule(): RuleDescription {
    return ruleDescriptionFrom({
      metadata: this._metadata,
      reason: this._reason,
      rule: this.buildRuleDescription(),
    })
  }

  /**
   * ADR-010: is this rule's assertion satisfied by an empty selection, as a
   * property of what its conditions assert (`.notExist()`) rather than a
   * caller's `.expectEmpty()` declaration?
   *
   * `.every()`, not `.some()` — `.andShould()` ANDs, so a rule reading
   * `.should().notExist().andShould().beExported()` still asserts something
   * about subjects that exist, and exempting it on the strength of the one
   * cardinality condition would silence the other. An empty condition list is
   * NOT exempt: `[].every()` is vacuously `true`, and a rule with zero
   * conditions is the assertion-less case `collectViolations()` now reports as
   * a configuration finding (bug 0155; it used to be an unreachable stderr
   * warning, which this comment named until that fix landed) — this override
   * must not paper over it by also declaring it cardinality-satisfied.
   *
   * **Load-bearing:** for a DEAD selector this early return is the only thing
   * between an assertion-less rule and a silent pass (the gate runs after the
   * zero-examined branch). Pinned in `assertion-less-rules.test.ts`.
   */
  /**
   * Does this rule assert anything at all? — bug 0155.
   *
   * Conditions alone are not enough: a predicate-only method written *after*
   * `.should()` silently shrank the set the conditions run over, possibly to
   * empty, in which case they hold vacuously. That rule asserts nothing
   * meaningful even though `_conditions` is non-empty.
   */
  protected assertsSomething(): boolean {
    return this._conditions.length > 0 && this._misplaced.length === 0
  }

  protected assertionAdvice(): string {
    return assertionAdviceFor({
      reachedShould: this._reachedShould,
      misplaced: this._misplaced,
      conditionCount: this._conditions.length,
    })
  }

  protected override assertsCardinality(): boolean {
    if (this._conditions.length === 0) return false
    return this._conditions.every((condition) => conditionAssertsCardinality(condition))
  }

  /**
   * ADR-010 part 3: did this rule's own underlying source (the project, a
   * diagram, an SDL string — whatever `P` loads) produce nothing at all,
   * before `getElements()`'s own domain-specific extraction or any
   * predicate ran? Default `false` — the kernel has no way to know, since
   * `P` is opaque here. A dialect's concrete builder, which knows `P`'s real
   * shape (e.g. `ArchProject`), overrides this to check its own project's
   * file count directly — never `getElements().length`, which conflates "the
   * source is empty" with "this domain legitimately has nothing in a
   * healthy project" (e.g. zero JSX elements in a backend-only codebase).
   */
  protected sourceEmpty(): boolean {
    return false
  }

  /** Declared globs, position derived from `_phase`. Pure — no `P` needed. */
  globs(): readonly GlobNode[] {
    return declaredGlobsOf(this._predicates, this._conditions)
  }

  /** This rule's own project, for `diagnose()`/`doctor` outside `.check()`. */
  getProject(): P {
    return this.project
  }

  /** A `globs()` tree diagnosably dead, when zero examined — same shape as `sourceEmpty()`. */
  protected deadGlobDiagnosis(): string | undefined {
    return undefined
  }

  // --- Protected: for subclasses ---

  /**
   * Register a predicate. Called by concrete builder methods like
   * `.haveNameMatching()`, `.extend()`, etc. Returns a COPY — see `copy()`.
   */
  protected addPredicate(predicate: Predicate<T>): this {
    const next = this.copy()
    recordPredicate(predicate, next._predicates, next._misplaced, next._phase)
    return next
  }

  /**
   * Register a condition. Called by concrete builder methods like
   * `.notContain()`, `.notExist()`, etc. Returns a COPY — see `copy()`.
   */
  protected addCondition(condition: Condition<T>): this {
    const next = this.copy()
    next._conditions.push(condition)
    return next
  }

  /**
   * Subclasses implement this to return the elements to check.
   * Called lazily during `.check()` / `.warn()`.
   */
  protected abstract getElements(): T[]

  /**
   * An independent copy, carrying **both** predicates and conditions.
   * Extends `TerminalBuilder.copy()` with the fields this class adds.
   *
   * Subclasses with additional mutable-reference fields of their own (arrays,
   * sets, maps a chain method pushes onto) MUST override this and call
   * `super.copy()` first, the same reason `TerminalBuilder.copy()`'s own
   * docstring gives — `Object.assign` shallow-copies a field, it does not
   * give it independent identity.
   */
  protected override copy(): this {
    const clone = super.copy()
    clone._predicates = [...this._predicates]
    clone._conditions = [...this._conditions]
    clone._misplaced = [...this._misplaced]
    return clone
  }

  /**
   * A fork of this builder, carrying BOTH lists. Used by `.should()` to support
   * named selections without mutation.
   *
   * **Nothing here clears the conditions** (bug 0156). It used to, and a second
   * `.should()` therefore silently discarded the first assertion — a rule that
   * asserted something turned into one that asserted less, by a chain method.
   * `.should().X().should().Y()` now accumulates exactly as `.andShould()` does.
   *
   * Ported from `packages/ts/src/core/rule-builder.ts`, where the engine copy
   * landed the fix and left the kernel behind. Found by the architect review of
   * PR #72: `eess-md`, `eess-mermaid` and `eess-gherkin` all extend THIS class,
   * so they carried the defect — and `check:corpus`, `check:ledger` and
   * `check:diagram` are md/mermaid gates, meaning this repo's own corpus
   * enforcement ran on the broken copy.
   */
  protected fork(): this {
    const fork = this.copy()
    fork._reason = fork._metadata?.because ?? this._reason
    return fork
  }

  // --- Private: execution engine ---

  /**
   * Build the rule description from predicates and conditions.
   */
  private buildRuleDescription(): string {
    return ruleDescriptionOf(this._predicates, this._conditions)
  }

  /**
   * Execute the full pipeline: filter elements with predicates, evaluate
   * conditions, return violations plus the ADR-010 evidence — the
   * post-predicate subject count, whatever it is. `TerminalBuilder.check()` /
   * `.warn()` / `.violations()` decide what a zero count means (a
   * configuration finding, unless `.expectEmpty()` was declared); this method
   * only reports the count, never interprets it.
   *
   * `sourceEmpty` (ADR-010 part 3) is deliberately not `allElements.length
   * === 0` — a domain's own `getElements()` legitimately returning nothing in
   * a healthy, fully-loaded project (e.g. zero JSX elements in a
   * backend-only codebase) is not brokenness, and conflating the two broke
   * `.notExist()`'s cardinality exemption for exactly that case. Subclasses
   * that can answer "did my underlying source load anything at all" override
   * `sourceEmpty()`; the default assumes it did.
   */
  protected collectViolations(): CollectResult {
    const allElements = this.getElements()
    const filtered = matchingElements(allElements, this._predicates)
    const examined = filtered.length

    if (filtered.length === 0) {
      const sourceEmpty = this.sourceEmpty()
      // Skip the diagnosis (a real filesystem walk, in a dialect's
      // override) when the project itself is already known empty — nothing
      // useful to say about one glob's fate against zero loaded files, and
      // `sourceEmpty` outranks it in `evidencedViolations()` regardless.
      const deadGlob = sourceEmpty ? undefined : this.deadGlobDiagnosis()
      return { violations: [], examined, sourceEmpty, deadGlob }
    }

    // Bug 0155 — gate-first, before the conditions run. See
    // `assertionLessViolation` for why this is a finding and not a warning,
    // and why there is no `_phase` term.
    // `_expectEmpty === undefined`: a declared emptiness expectation is an
    // assertion too — see `assertionLessViolation`.
    if (!this.assertsSomething() && this._expectEmpty === undefined) {
      const ruleId = this._metadata?.id ?? (this.buildRuleDescription() || 'unnamed')
      return { violations: [assertionLessViolation(ruleId, this.assertionAdvice())], examined }
    }

    // Step 4: Build context for conditions
    const context = this.buildConditionContext()

    // Step 5: Evaluate all conditions (AND — all must pass)
    const violations: ArchViolation[] = []
    for (const condition of this._conditions) {
      violations.push(...condition.evaluate(filtered, context))
    }

    return { violations, examined }
  }

  /**
   * Build the `ConditionContext` passed to each condition.
   *
   * Subclasses with builder-specific context fields (e.g. `CallRuleBuilder`'s
   * `_identifyByArgument`) override this to extend the base context.
   * Call `super.buildConditionContext()` and spread the result.
   */
  protected buildConditionContext(): ConditionContext {
    return conditionContextFrom({
      metadata: this._metadata,
      reason: this._reason,
      rule: this.buildRuleDescription(),
    })
  }
}
