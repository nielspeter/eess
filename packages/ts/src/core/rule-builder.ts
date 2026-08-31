import { selectMatching, recordPredicate, matchingElements } from '@nielspeter/eess/internal'
import { conditionContextFrom } from '@nielspeter/eess/internal'
import type { GlobNode } from '@nielspeter/eess'
import {
  assertionAdviceOf,
  buildRuleDescription,
  describeRuleOf,
  globsOf,
} from './rule-declaration.js'
import type { DeclaredRule } from './rule-declaration.js'
import type { ArchProject } from './project.js'
import type { CollectResult } from './terminal-builder.js'
import type { Predicate } from '@nielspeter/eess'
import type { Condition, ConditionContext } from '@nielspeter/eess'
import type { ArchViolation } from '@nielspeter/eess'
import type { RuleDescription } from '@nielspeter/eess'
import type { Selection, ElementInfo } from '@nielspeter/eess'
import { TerminalBuilder } from './terminal-builder.js'
import { assertsCardinality } from '@nielspeter/eess'

/**
 * Abstract base class for the predicate/condition rule builders.
 *
 * Concrete entry points (plans 0007+) extend this and:
 * 1. Implement `getElements()` to return the elements to check
 * 2. Add predicate methods that call `addPredicate()`
 * 3. Add condition methods that call `addCondition()`
 *
 * The builder accumulates predicates and conditions. Nothing executes
 * until a terminal method (`.check()`, `.warn()`, `.severity()`) is called.
 *
 * Extends `TerminalBuilder`, which owns everything that is not about the
 * predicate/condition pipeline: `because`, `rule`, `excluding`, `violations`,
 * `check`, `warn`, `asSeverity`, `severity`. Those used to exist twice, once
 * here and once there, and the two copies had already drifted — this class's
 * `excluding()` documented matching against element/file/message while the
 * other still claimed element only, and the more accurate one was the one
 * fewer builders inherited.
 *
 * The cost of the second root was not duplication, it was silent
 * non-coverage: the materialized subject set (plan 0064) and the
 * empty-selector guard (plan 0067) were added here and never reached the
 * seven builders on the other branch. Plan 0069 needs `globs()` to reach all
 * thirteen, so it goes on the root and the root is now singular.
 */

export abstract class RuleBuilder<T> extends TerminalBuilder {
  protected _predicates: Predicate<T>[] = []
  protected _conditions: Condition<T>[] = []
  protected _phase: 'predicate' | 'condition' = 'predicate'
  // Plan 0070: state for the assertion-less remedies. `_phase` cannot carry
  // either fact — `.should().that()` legally returns to the predicate phase,
  // so `_phase === 'predicate'` does not mean `.should()` was never reached,
  // and a predicate applied after `should()` leaves no other trace.
  protected _reachedShould = false
  protected _misplaced: string[] = []
  /** `.expectEmpty()` — plan 0074. Asserts the selection is empty, and fails when it is not. */

  constructor(protected readonly project: ArchProject) {
    super()
  }

  // --- Chain methods (grammar transitions) ---

  /**
   * Begin the predicate phase. Returns a COPY, per bug 0016 — a held selection
   * is never edited by narrowing it. Every ordinary chain is unaffected,
   * because the copy is what the chain continues on; what changed is that
   * `held.that()...` no longer reaches back into `held`.
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

  // --- Terminal methods ---

  /**
   * Return the predicate-filtered elements as a labelled `Selection<T>` for
   * cross-validation (`crossProject()`). The set is exactly the elements this
   * rule would evaluate — the same filtering `.check()` applies.
   *
   * **Restored in plan 0165 Phase 2.** `select()` is eess's, not upstream's: it
   * is the side of the kernel's two-sided join, and `@nielspeter/eess-crossvalidate`
   * is built entirely on it — four of its five source files failed `tsc` and 33 of
   * its tests failed without it. The wholesale engine copy of plan 0165 dropped it
   * along with the rest of eess's `RuleBuilder`.
   *
   * Stateless by construction, which is why it can live here while the kernel keeps
   * its own copy: it reads `getElements()` and `_predicates` and returns a plain
   * object. The duplication that matters — and that Phase 1 measured breaking — is
   * module-level STATE, not a pure method.
   *
   * @param opts.label - human-readable name of this side ("diagram class")
   * @param opts.identify - map an element to its message metadata (name/file/line)
   */
  select(opts: { label: string; identify: (element: T) => ElementInfo }): Selection<T> {
    // The kernel's — this was byte-identical, and the hierarchies differ, so a
    // free function is the only way the two builders can share it.
    return selectMatching(this.getElements(), this._predicates, opts)
  }

  /** This rule as declared — the input every description and advice reads. */
  private asDeclared(): DeclaredRule {
    return {
      predicates: this._predicates,
      conditions: this._conditions,
      misplaced: this._misplaced,
      reachedShould: this._reachedShould,
      metadata: this._metadata,
      reason: this._reason,
    }
  }

  /**
   * Return a structured description of this rule without executing it.
   * Used by the `explain` CLI subcommand.
   */
  describeRule(): RuleDescription {
    return describeRuleOf(this.asDeclared())
  }

  /**
   * Return the subject set this rule would evaluate: the elements matched by
   * the predicate chain (`.that()...`), before any condition runs. Executes the
   * predicate filter and returns the materialized set.
   *
   * Distinct from the abstract `getElements()`, which is the *pre-filter*
   * population. This is the materialization contract (F1, plan 0064) that
   * composable primitives build on — `crossProject().side(selection, keyFn)`
   * keys each subject, and `.expectNonEmpty()` (plan 0064+) asserts the set is
   * non-empty. It does not evaluate conditions and never warns about their
   * absence, so it is safe to call on a bare `.that()` selection.
   *
   * Note (ADR-007): the returned `T` is the builder's element type (e.g. a
   * ts-morph `ClassDeclaration` for `classes()`), so this is an acknowledged
   * raw-node seam for callers that derive keys from subjects.
   */
  subjects(): readonly T[] {
    return this.filterElements()
  }

  /**
   * The selector and condition globs this rule declares.
   *
   * `position` is derived, not declared: a predicate registered while
   * `_phase` is `'predicate'` is a selector, one registered after `.should()`
   * is a condition. That is a structural fact about where the code is, which
   * is why it is not on `DeclaredGlob` for an author to get wrong.
   */
  override globs(): readonly GlobNode[] {
    return globsOf(this.asDeclared())
  }

  /**
   * The project this rule was built against.
   *
   * Used by `within()` to create scoped builders, and by `doctor` to find the
   * project to compare globs against — which must be the one the rules
   * actually ran on, not one the CLI guessed at.
   */
  /**
   * Plan 0074: is EVERY condition satisfied by an empty selection?
   *
   * `.every()`, not `.some()` — `andShould()` ANDs, so a rule reading
   * `.should().notExist().andShould().beExported()` still asserts something
   * about subjects that exist, and exempting it on the strength of one
   * cardinality condition would silence the other. 0069's appendix names this
   * as an implementation constraint; the first cut used `.some()`.
   *
   * An empty condition list is NOT exempt: `[].every()` is `true`, and a rule
   * with no conditions is the assertion-less case that its own gate reports.
   */
  override assertsCardinality(): boolean {
    if (this._conditions.length === 0) return false
    return this._conditions.every((condition) => assertsCardinality(condition))
  }

  /**
   * The project this rule was built against.
   *
   * Public because the empty-project and dead-glob findings are constructed by
   * `TerminalBuilder`, which has no project of its own to consult.
   */
  getProject(): ArchProject {
    return this.project
  }

  /**
   * Whether this rule asserts anything about the elements it selected.
   *
   * `.that()...` with no `.should()` selects a set and then says nothing about
   * it, so it can never fail — proposal 019. Exposed as a method because
   * `_conditions` is protected and `doctor` must not duck-type a private name.
   *
   * **A misplaced predicate disqualifies the rule even when conditions exist**,
   * which `_conditions.length > 0` alone did not. Measured on the shipped 0.23.0
   * branch, and it is the worst shape of the seven rather than a corner:
   *
   *     functions(p).that().haveNameMatching(/^parse/).should().notExist().areAsync()
   *       subjects 4 -> 0   violations 4 -> 0   diagnose() []   check() passes
   *
   * `areAsync()` after `.should()` lands in `addPredicate` and retroactively
   * narrows the set every condition is evaluated over — here to nothing, so
   * `notExist` holds vacuously. The rule reads as deliberate, its description
   * reads as deliberate, and it certifies nothing. Every other assertion-less
   * shape at least looks unfinished; this one does not, so the author has no
   * reason to look. Under ADR-008 the finding is not optional: the remedy is
   * one method call and nothing about it is a judgement call.
   */
  override assertsSomething(): boolean {
    return this._conditions.length > 0 && this._misplaced.length === 0
  }

  /**
   * Three assertion-less states, three remedies (plan 0070). Branching on
   * `_reachedShould`/`_misplaced`, never `_phase` — `.should().that()` lands
   * in the predicate phase having reached `.should()`, and would be told a
   * verifiable falsehood by any phase-derived message.
   */
  override assertionAdvice(): string {
    return assertionAdviceOf(this.asDeclared())
  }

  /**
   * The root's collection hook. `evaluate()` is this builder's pipeline —
   * filter by predicates, run conditions, add the empty-selector finding —
   * and the root's terminal methods do the rest.
   */
  protected collectViolations(): CollectResult {
    // Plan 0098. The unit is the POST-predicate set — what the conditions
    // actually receive — not `getElements()`. `filterElements()` is memoized per
    // builder (`element-cache.ts`), so asking here and again inside `evaluate()`
    // walks once.
    return { violations: this.evaluate(), examined: this.examinedUnits() }
  }

  /**
   * Units this rule examined — plan 0098: the POST-predicate subjects, which is
   * exactly what `subjects()` returns and what the conditions receive.
   *
   * Public for the same structural reason as `assertsSomething()`: `diagnose()`
   * reads it through a structural interface and a protected member cannot
   * satisfy one. One definition, two readers — `collectViolations()` above and
   * the preview — so the number the gate carries and the number the preview
   * reports cannot drift apart.
   */
  examinedUnits(): number {
    return this.filterElements().length
  }

  // --- Protected: for subclasses ---

  /**
   * Register a predicate. Called by concrete builder methods like
   * `.haveNameMatching()`, `.extend()`, etc.
   */
  protected addPredicate(predicate: Predicate<T>): this {
    const next = this.copy()
    // The kernel's. The two copies differed only in comment wording and braces.
    recordPredicate(predicate, next._predicates, next._misplaced, next._phase)
    return next
  }

  /**
   * Register a condition. Called by concrete builder methods like
   * `.notContain()`, `.notExist()`, etc.
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
   * An independent copy, carrying **both** lists. See `TerminalBuilder.copy`.
   *
   * Nothing on this class clears the conditions any more (bug 0020): a rule
   * that asserted something must never be turned into one that asserts nothing
   * by a chain method, which is what `.should()` used to do via `fork()`.
   * `.should().beExported().that().areAsync()` keeps `beExported`, and a second
   * `.should()` accumulates exactly as `.andShould()` does.
   */
  protected override copy(): this {
    const clone = super.copy()
    clone._predicates = [...this._predicates]
    clone._conditions = [...this._conditions]
    clone._misplaced = [...this._misplaced]
    return clone
  }

  /**
   * A copy carrying everything, including the conditions, with `_reason`
   * resolved from metadata. The only caller is `.should()`.
   *
   * **The name is historical.** It used to clear the conditions, which is what
   * distinguished it from `copy()`, and that clearing was
   * [bug 0156](../../../../work/bugs/fixed/0156-should-twice-silently-drops-the-first-assertion.md):
   * a second `.should()` on a builder that already carried a condition discarded
   * it, so `.should().notExist().should().beExported()` enforced only the second
   * and lost four findings with no output. Measured. Removed in 0.23.0 —
   * conditions accumulate, and a second `.should()` behaves as `.andShould()`.
   *
   * What is left is `copy()` plus the `_reason` resolution, so the method is now
   * thin enough to inline. It stays because it is `protected` on an exported
   * class: deleting it is a compile break for an external subclass that
   * overrides or calls it, which is the same compatibility argument that keeps
   * `globs()` concrete and `assertsSomething()` exempt-by-default. Do not read
   * the name as a description of the behaviour.
   */
  protected fork(): this {
    const fork = this.copy()
    fork._reason = fork._metadata?.because ?? this._reason
    return fork
  }

  // --- Private: execution engine ---

  /**
   * Materialize the subject set: all elements narrowed by the predicate chain
   * (the post-`.that()` set), before any condition runs. Shared by the
   * `RuleBuilder` execution pipeline (`evaluate`) and the public `subjects()`
   * accessor so those two cannot diverge (F1). Note: a few builders keep their
   * own separate materialization for other paths (e.g. `CallRuleBuilder`'s
   * `within()` matcher) — those are not routed through here.
   */
  protected filterElements(): T[] {
    // AND semantics — every predicate must match.
    return matchingElements(this.getElements(), this._predicates)
  }

  /**
   * Build the config-level meta-finding for an empty selector under
   * `.expectNonEmpty()`. A typed literal (no `createViolation` — there is no
   * Node), ADR-005-clean, flagged `bypassFilters` so diff/baseline keep it.
   */

  private emptySelectionViolation(): ArchViolation {
    const description = buildRuleDescription(this.asDeclared()) || 'selector'
    // The TEXT comes from the shared producer; the ATTRIBUTION stays here.
    //
    // Plan 0099 keeps this family's block because it is the better-attributed
    // implementation — it names the chain and carries the author's `because`.
    // What it must not keep is its own wording: two texts for one state is the
    // plan-0070 drift shape, and its copy carried the three defects 0098's
    // user-perspective review found.
    //
    // Fields are assigned LITERALLY rather than spread, and that is not style.
    // The config-finding census scans for a `bypassFilters: true`
    // PropertyAssignment and for a literal `suggestion`; a spread made this
    // producer invisible to it, which silently dropped its census row — through
    // the exact route the census docstring claims is impossible ("no spreads that
    // introduce the flag"). Review measured that regression.
    //
    // `element` keeps the rule id: unlike the expiry finding, N rules that cannot
    // enforce ARE one edit, so `dedupeConfigFindings` collapsing them is correct.
    const shared = this.zeroSubjectsViolation(this.project)
    return {
      rule: description,
      ruleId: this._metadata?.id,
      element: this._metadata?.id ?? description,
      file: '',
      line: 0,
      message: shared.message,
      suggestion: shared.suggestion,
      // The author's rationale, which the shared producer has no access to. Not
      // their `suggestion`/`docs` (bug 0021): this finding says the selector
      // matched nothing, and the author's remedy is for a violation of the rule.
      because: this._reason,
      bypassFilters: true,
    }
  }

  /**
   * Execute the full pipeline: filter elements with predicates,
   * evaluate conditions, return violations.
   */
  private evaluate(): ArchViolation[] {
    // Step 1+2: Get elements and narrow by predicates (see filterElements).
    const filtered = this.filterElements()

    // Step 3: the selection is empty — a FAULT by default since plan 0074.
    //
    // The inversion R3b exists for. A condition reports a violation when SOME
    // subject fails; over an empty set that is vacuously false, so every rule
    // passed and the suite counted it as coverage. `.expectNonEmpty()` was the
    // opt-in, and terminal-builder.ts records why that was not enough: it is
    // "the opt-in this whole plan exists because nobody uses".
    //
    // Read the exemptions in this order — most specific first.
    if (filtered.length === 0) {
      // The author said so, in the rule, where a reader sees it. Not a
      // silencer: the non-empty branch below fails the day it matches.
      if (this._expectEmpty) return []
      // Every condition is satisfied BY emptiness — `.should().notExist()`, the
      // pre-emptive guard. `.every()`, because `andShould()` ANDs.
      if (this.assertsCardinality()) return []
      return [this.emptySelectionViolation()]
    }

    // NO expiry branch here. Plan 0099 moved it to the root
    // (`TerminalBuilder.collectWithAssertionGuard`), because this family's copy
    // and the root's would both fire and double-report one fault.
    //
    // The property it enforced is unchanged and is now enforced for EVERY family
    // rather than this one: a false declaration fails, and — the part plan 0089's
    // review measured — it does not swallow the violations underneath it. The
    // root appends them, so a fanned-out preset id whose one non-empty instance
    // used to replace a genuine `imports "lodash" which matches forbidden` with a
    // config error now reports both.

    // Step 4: Build context for conditions
    const context = this.buildConditionContext()

    // Step 5: Evaluate all conditions (AND — all must pass)
    const violations: ArchViolation[] = []
    for (const condition of this._conditions) {
      violations.push(...condition.evaluate(filtered, context))
    }

    return violations
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
      rule: buildRuleDescription(this.asDeclared()),
    })
  }
}
