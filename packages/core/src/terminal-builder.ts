import {
  zeroExaminedViolation,
  deadGlobViolation,
  unmetExpectNonEmptyViolation,
  zeroLoadedSourceViolation,
  expiredExpectEmptyViolation,
} from './vacuity-findings.js'
import type { RuleFacts } from './vacuity-findings.js'
import { UNSUPPRESSABLE } from './unsuppressable.js'
import type { ArchViolation } from './violation.js'
import { type CollectResult, collectResult } from './collect-result.js'
import type { CheckOptions } from './check-options.js'
import type { RuleMetadata } from './rule-metadata.js'
import type { RuleDescription } from './rule-description.js'
import { ruleDescriptionFrom } from './rule-description.js'
import type { SilentExclusion } from './silent-exclusion.js'
import { recordExclusions } from './silent-exclusion.js'
import { executeCheck, executeWarn, applyFilters } from './execute-rule.js'
import type { ExecuteRuleContext } from './execute-rule.js'
import { shallowClone } from './shallow-clone.js'

/**
 * A rule's verdict, carrying evidence of examination alongside the findings —
 * ADR-010. `examined` is the count of units the family's own examining seam
 * actually iterated (never a count of matches, never upstream discovery like
 * files loaded) — each concrete `collectViolations()` names its own unit.
 *
 * `sourceEmpty` — ADR-010 part 3's precedence rule: "an empty project
 * outranks every token." Set `true` when `examined === 0` because the
 * family's own upstream source (files loaded, a diagram parsed, an SDL
 * string) produced nothing at all — BEFORE any predicate/selection
 * narrowed it — as distinct from a predicate narrowing a non-empty source
 * down to zero. This is a stronger claim than a bare zero-examined dead
 * selector: `.expectEmpty()` cannot rescue it, because there is no
 * selection to widen — the instrument itself never loaded anything to
 * examine. Omit (or `false`) when the distinction doesn't apply (the
 * family has no separate source/selection stages) or the zero came from
 * narrowing, not upstream emptiness.
 */
export type { CollectResult } from './collect-result.js'

/**
 * Abstract base class for builders that share the terminal method pattern
 * (because, rule, excluding, check, warn, severity) but have different
 * element collection and evaluation models.
 *
 * Used by SliceRuleBuilder, SchemaRuleBuilder, ResolverRuleBuilder,
 * PairFinalBuilder, SmellBuilder, CorrespondenceBuilder, TsconfigBuilder, and
 * (as of plan 0088 Phase 4) RuleBuilder — all of which implement the same
 * terminal methods and now share evidence-of-examination (ADR-010) alongside
 * evaluation-model differences.
 */
export abstract class TerminalBuilder {
  protected _reason?: string
  protected _metadata?: RuleMetadata
  protected _exclusions: (string | RegExp)[] = []
  protected _silentIndices: Set<number> = new Set()
  /** ADR-010 part 3 — `.expectEmpty()`/`.expectNonEmpty()`. `undefined` = no declaration. */
  protected _expectEmpty?: boolean

  /**
   * Declare that this rule's examined set is expected to be empty. A pass is
   * legitimate only while the declaration stays true — the day a unit is
   * examined, this rule reddens (ADR-010 part 3's expiry property). The
   * complement of `expectNonEmpty()`; declaring both is nonsensical and the
   * later call wins (last-write, matching `.rule()`'s own semantics).
   */
  expectEmpty(): this {
    const next = this.copy()
    next._expectEmpty = true
    return next
  }

  /**
   * Declare that this rule's examined set must be non-empty — the opposite
   * assertion, for a corpus the author has positive knowledge should never
   * legitimately be empty. Unlike a bare, undeclared rule, this **overrides
   * `assertsCardinality()`'s exemption**: a `.notExist()`-shaped condition
   * that finds zero subjects normally passes silently (emptiness satisfies
   * what it asserts) — but if the author declared `.expectNonEmpty()`, that
   * silence is exactly what they said should never happen, so it reddens
   * instead, naming the declaration as the reason. This is the real
   * difference from not declaring anything: without it, a `.notExist()` rule
   * over an accidentally-emptied corpus (a glob typo, a temporarily-missing
   * folder) passes and says nothing; with it, that same emptiness is caught.
   */
  expectNonEmpty(): this {
    const next = this.copy()
    next._expectEmpty = false
    return next
  }

  /**
   * Attach a human-readable rationale to the rule.
   * Included in violation messages when `.check()` throws.
   */
  because(reason: string): this {
    const next = this.copy()
    next._reason = reason
    return next
  }

  /**
   * Attach rich metadata to the rule.
   * Provides educational context in violation output: why, how to fix, docs link.
   *
   * If `metadata.because` is set, it also sets the reason (same as `.because()`).
   */
  rule(metadata: RuleMetadata): this {
    const next = this.copy()
    next._metadata = metadata
    if (metadata.because) {
      next._reason = metadata.because
    }
    return next
  }

  /**
   * Exclude specific elements from violation reporting.
   *
   * Matched violations are silently suppressed. Use for permanent,
   * intentional exceptions — not for temporary violations (use baseline for those).
   *
   * Matches against the violation's `element` field.
   * Supports exact strings and regex patterns.
   *
   * Emits a warning if an exclusion matches zero violations (stale exclusion).
   */
  excluding(...patterns: (string | RegExp | SilentExclusion)[]): this {
    const next = this.copy()
    recordExclusions(patterns, next._exclusions, next._silentIndices)
    return next
  }

  /**
   * Return a structured description of this rule without executing it.
   * Used by the `explain` CLI subcommand.
   */
  describeRule(): RuleDescription {
    return ruleDescriptionFrom({
      metadata: this._metadata,
      reason: this._reason,
      rule: this._metadata?.id ?? 'unnamed',
    })
  }

  /** This rule's own account of itself, for `vacuity-findings.ts`. */
  private facts(): RuleFacts {
    return {
      ruleClass: { name: this.constructor.name },
      reason: this._reason,
      describeRule: () => this.describeRule(),
    }
  }

  /**
   * What every terminal method hands the filter pipeline.
   *
   * The same four fields were written out at each of `violations`, `check` and
   * `warn` — `no-copy-paste` reported the three at 100% with `applyFilters ->
   * executeCheck` as the only varying axis. `eess-ts`'s `TerminalBuilder`
   * already had exactly this method; the kernel never adopted it.
   *
   * Not just tidier: three terminal methods that build the filter context
   * separately can drift, and a field present on `.check()` but missing on
   * `.violations()` means a rule fails in CI and passes when a preset
   * aggregates it — the same finding, two answers.
   */
  private filterContext(): ExecuteRuleContext {
    return {
      reason: this._reason,
      metadata: this._metadata,
      exclusions: this._exclusions,
      silentIndices: this._silentIndices,
      // Bug 0258 round 2: an id-less rule still has a sentence, and every
      // builder already implements `describeRule()`. Deferred, because this
      // runs on every terminal call and is read only when an id-less rule meets
      // an exclusion comment it cannot honour.
      describe: () => this.describeRule().rule,
    }
  }

  /**
   * Execute the rule and return violations after exclusion filtering.
   * Does not throw — use for programmatic access (presets, aggregation).
   */
  violations(): CollectResult {
    const evidenced = this.evidencedViolations()
    // `applyFilters` returns a bare array (and the SAME reference when no
    // exclusion applies), so the evidence is re-stamped onto a fresh one here —
    // stamping onto its return would mutate whatever a family memoized.
    return collectResult(applyFilters(evidenced, this.filterContext()), {
      examined: evidenced.examined,
      sourceEmpty: evidenced.sourceEmpty,
      declaredEmpty: evidenced.declaredEmpty,
      deadGlob: evidenced.deadGlob,
    })
  }

  /**
   * Execute the rule and throw `ArchRuleError` if any violations are found.
   * This is the primary terminal method — use in test assertions.
   *
   * @param options - Optional baseline, diff filtering, and output format
   */
  check(options?: CheckOptions): void {
    executeCheck(this.evidencedViolations(), this.filterContext(), options)
  }

  /**
   * Execute the rule and log violations to stderr. Does not throw.
   * Use for rules that should warn but not fail CI.
   *
   * @param options - Optional baseline, diff filtering, and output format
   */
  warn(options?: CheckOptions): void {
    executeWarn(this.evidencedViolations(), this.filterContext(), options)
  }

  /**
   * ADR-010 — the evidence gate. Calls `collectViolations()` once and turns
   * its `{ violations, examined, sourceEmpty }` verdict into the
   * `ArchViolation[]` every terminal method still emits, applying the
   * declared-empty precedence:
   *
   * - `examined === 0`, `sourceEmpty === true`: ADR-010 part 3's precedence
   *   rule — "an empty project outranks every token." The family's own
   *   upstream source (files loaded, a diagram parsed) produced nothing at
   *   all, before any predicate ran. Neither `.expectEmpty()` nor
   *   `assertsCardinality()` can rescue this: there is no selection to
   *   widen, and a `.notExist()`-shaped condition "passing" against an
   *   instrument that never loaded anything is not evidence of anything.
   *   Always an unsuppressable configuration finding.
   * - `examined === 0`, `.expectNonEmpty()` declared: the caller has positive
   *   knowledge this corpus should never be empty — this OVERRIDES
   *   `assertsCardinality()`'s exemption (a `.notExist()` rule that would
   *   otherwise pass silently on zero subjects reddens instead, since silent
   *   emptiness is exactly what the declaration rules out). Fails, naming the
   *   unmet declaration.
   * - `examined === 0`, no `.expectEmpty()` declared: the rule's own
   *   instrument is broken (a dead selector, an unreachable seam) — this is
   *   a configuration finding, unsuppressable (`bypassFilters`), not a silent
   *   pass. This is the guarantee ADR-009/010 exist for.
   * - `examined === 0`, `.expectEmpty()` declared: satisfied. Passes.
   * - `examined === 0`, `assertsCardinality()` true (and no `.expectNonEmpty()`
   *   override above): the rule's own conditions are satisfied BY emptiness
   *   (e.g. `.notExist()`) — a different exemption from `.expectEmpty()`,
   *   because it is a property of what the condition asserts, not a caller's
   *   declaration about the corpus. Passes, with no finding at all (not even
   *   a silent one — the condition already reported truthfully that it found
   *   nothing wrong).
   * - `examined > 0`, `.expectEmpty()` declared: the declaration has expired
   *   — a unit was examined despite the author's "this stays empty" claim.
   *   Fails, appending an expiry finding to whatever `collectViolations()`
   *   found (never replacing it — the underlying findings are still real).
   * - `examined > 0`, no declaration or `.expectNonEmpty()` (the ordinary
   *   case — `.expectNonEmpty()` has nothing left to assert once subjects
   *   exist): the rule's own violations stand as computed.
   */
  private evidencedViolations(): CollectResult {
    const collected = this.collectViolations()
    const { examined, sourceEmpty, deadGlob } = collected
    const violations: ArchViolation[] = [...collected]

    // The evidence travels with every return below. A declaration reaches the
    // emitter ON the receipt (ADR-014 §3) rather than through delivery options:
    // one boolean over a sum cannot carry per-rule declarations, and this is the
    // moment the terminal knows the fact and used to discard it.
    const evidence = {
      examined,
      sourceEmpty,
      deadGlob,
      // `assertsCardinality()` is a declaration ONLY over zero subjects — ADR-010
      // §3: "`.notExist()` over zero subjects is a declaration by construction."
      // Over a non-empty selection it is an ordinary assertion that examined
      // real units, and marking it declared there made every passing
      // `.notExist()` expire the moment the emitter checked. Measured: it
      // reddened six crossvalidate tests.
      declaredEmpty:
        this._expectEmpty === true || (examined === 0 && this.assertsCardinality())
          ? true
          : undefined,
    }
    const withFinding = (f: ArchViolation): CollectResult =>
      collectResult([...violations, f], evidence)

    // Split out because threading the evidence through every branch pushed this
    // method to cyclomatic complexity 11 and the repo's own `check:arch` said so.
    // The ORDER is the content here, and it is unchanged.
    if (examined === 0) {
      const zero = this.zeroExaminedFinding(sourceEmpty, deadGlob)
      return zero === undefined ? collectResult(violations, evidence) : withFinding(zero)
    }
    if (this._expectEmpty === true) {
      return withFinding(expiredExpectEmptyViolation(this.facts(), examined))
    }
    return collectResult(violations, evidence)
  }

  /**
   * Which finding a zero-examined rule earns, or `undefined` when it earned none
   * because it declared the emptiness.
   *
   * Extracted from `evidencedViolations` under `check:arch`'s complexity rule.
   * The precedence is the whole content and is unchanged: an empty source
   * outranks every declaration (ADR-010 §3), an explicit declaration is
   * satisfied, `.expectNonEmpty()` is unmet, a cardinality condition is
   * satisfied by emptiness, and a nameable dead glob outranks the generic
   * message because it is strictly more actionable.
   */
  private zeroExaminedFinding(
    sourceEmpty: boolean | undefined,
    deadGlob: string | undefined,
  ): ArchViolation | undefined {
    if (sourceEmpty === true) return zeroLoadedSourceViolation(this.facts())
    if (this._expectEmpty === true) return undefined
    if (this._expectEmpty === false) return unmetExpectNonEmptyViolation(this.facts())
    if (this.assertsCardinality()) return undefined
    if (deadGlob !== undefined) return deadGlobViolation(this.facts(), deadGlob)
    return zeroExaminedViolation(this.facts())
  }

  /**
   * Execute the rule with the given severity.
   * `.severity('error')` is equivalent to `.check()`.
   * `.severity('warn')` is equivalent to `.warn()`.
   */
  severity(level: 'error' | 'warn'): void {
    if (level === 'error') {
      this.check()
    } else {
      this.warn()
    }
  }

  /**
   * An independent copy of this builder.
   *
   * **A held selection is immutable** (a bug class ported alongside the
   * kernel — plan 0088 Phase 4, matching `ts-archunit`'s own documented
   * "bug 0016"). Before this, every chain method mutated `this` in place:
   *
   * ```ts
   * const repos = classes(p).that().extend('BaseRepository')
   * repos.that().haveNameEndingWith('Legacy').should().notExist().check()
   * repos.should().beExported().check()   // silently narrowed to Legacy too
   * ```
   *
   * A held selection reused for a second rule silently inherited the first
   * rule's narrowing, exclusions, and rule id — found live in this repo's own
   * test suite once the ADR-010 evidence gate stopped treating "examined
   * zero units because a stale narrowing ate the selection" as an ordinary,
   * silent pass. `because`/`rule`/`excluding`/`expectEmpty`/`expectNonEmpty`
   * on `TerminalBuilder`, and `that`/`addPredicate`/`addCondition` on
   * `RuleBuilder`, all return a copy rather than mutating `this`.
   *
   * Subclasses with additional fields beyond `TerminalBuilder`'s own MUST
   * override this (see `RuleBuilder.copy()`) and call `super.copy()` first.
   */
  protected copy(): this {
    const clone = shallowClone(this)
    clone.adoptFilterState(this)
    clone._metadata = this._metadata ? { ...this._metadata } : undefined
    return clone
  }

  /**
   * Give this builder independent copies of another's filter state.
   *
   * `copy()` shallow-copies every field via `Object.assign`, so without this
   * a copy would share its source's `_exclusions` array and `_silentIndices`
   * set by reference — `.excluding()` on one would silently mutate the
   * other, the exact hazard `copy()` exists to close, one field deeper.
   */
  protected adoptFilterState(source: TerminalBuilder): void {
    this._exclusions = [...source._exclusions]
    this._silentIndices = new Set(source._silentIndices)
  }

  /**
   * Subclasses implement this to collect and evaluate violations, and to
   * report how many units they examined (ADR-010) — counted at the family's
   * own examining seam, in whatever unit that family names as its own
   * (post-predicate subjects for `RuleBuilder`, bodies compared for
   * `SmellBuilder`, the key sets of both sides for `correspondence()`).
   * Called lazily during `.check()` / `.warn()`.
   */
  protected abstract collectViolations(): CollectResult

  /**
   * Is this rule's own assertion satisfied by an empty examined set, as a
   * matter of what it asserts (`.notExist()`-shaped), not a caller's
   * `.expectEmpty()` declaration? Default `false` — most families have no
   * such condition and stay covered by the ordinary zero-examined gate.
   * `RuleBuilder` overrides this to check its own `_conditions` against the
   * kernel's `assertsCardinality()` registry (ADR-010, `cardinality.ts`).
   */
  protected assertsCardinality(): boolean {
    return false
  }
}

/**
 * The configuration finding for a rule that asserts nothing — bug 0155.
 *
 * An assertion-less rule — subjects found, nothing asserted about them —
 * cannot fail, so it certifies nothing while reading as coverage.
 *
 * **The guard was unreachable, not merely quiet.** It used to read
 * `_conditions.length === 0 && _phase === 'predicate'`, and `should()` sets
 * the phase to `'condition'`, so for every rule shape the DSL documents it
 * could never fire — the defect passed in total silence, never even reaching
 * the stderr warning it was routed to. Hence no `_phase` term at the call
 * site.
 *
 * **A finding, not a warning**, per ADR-009 rule 1's discriminator: the remedy
 * is not optional. There is no state in which "keeps asserting nothing" is
 * correct — add a condition, or delete the rule. The two rules ADR-009 names
 * as deliberately `warn` (`no-silent-catch`, `no-empty-bodies`) warn *because*
 * they carry suppressible false positives a reader must judge case by case.
 * This carries none.
 *
 * **A declared emptiness expectation is an assertion**, so `_expectEmpty`
 * exempts a rule from this gate. `.expectNonEmpty()` reddens when the corpus
 * it says must never be empty becomes empty; `.expectEmpty()` reddens the day
 * the set it says must stay empty gains a member. Neither lives in
 * `_conditions`. Without that term the gate called a working corpus guard
 * assertion-less and told its author to "add a condition or delete the rule" —
 * both of which destroy the guard — and for `.expectEmpty()` reported two
 * findings for one fault. Found in PR #71's review.
 *
 * **Placed AFTER the zero-examined branch**, so a dead selector still reports
 * as a dead selector. Measured: `resideInFolder('srcc/**')` with no condition
 * reports the dead glob, not this finding. An earlier draft of this docstring
 * (and of the changeset and bug record) claimed the opposite — "reports the
 * missing assertion only" — and justified it as gate-first. Both were wrong:
 * `getElements()` and the predicate filter already ran, so the ordering saves
 * no work, and the behaviour is the reverse. The real precedence is the better
 * one, and is now stated as what it is: this finding fires only when subjects
 * were actually selected.
 *
 * **Exported** rather than private to `RuleBuilder`. Its five siblings
 * (`zeroExaminedViolation`, `deadGlobViolation`, `unmetExpectNonEmptyViolation`,
 * `expiredExpectEmptyViolation`, `zeroLoadedSourceViolation`) have since moved to
 * `vacuity-findings.ts`; this one stayed, because unlike them it is constructed
 * from a builder's own condition list rather than from `RuleFacts` alone. The *detection* has to stay per-builder —
 * `TerminalBuilder` has no `_conditions` — but a private constructor meant
 * `eess-ts`'s slice/schema/resolver builders could not reuse it and were left
 * warning while the kernel's rules failed: the same defect, one DSL, four
 * different answers.
 *
 * `bypassFilters` makes it a **configuration** finding — `error` regardless of
 * `.asSeverity('warn')`, refused by `.excluding()`, skipped by diff and
 * baseline. It reports that the rule's own instrument is broken, not a fault
 * in what was examined, so a filter aimed at the latter must not suppress it.
 */
export function assertionLessViolation(ruleId: string, advice?: string): ArchViolation {
  const remedy =
    advice ??
    'Add a condition after .should() (a predicate-only method such as ' +
      'areExported/areAsync filters elements, it does not assert), or delete the rule.'
  // `message` is the diagnosis; `suggestion` is the remedy. Keeping them
  // DISTINCT matters: `remedyRepeatsMessage()` suppresses a `Fix:` line only
  // when it is byte-identical to `What:`, so folding the remedy into both
  // printed the whole thing twice — plan 0147's double-print, which an earlier
  // draft of this function reintroduced by appending UNSUPPRESSABLE to a
  // suggestion that already repeated the message.
  const message =
    `Rule '${ruleId}' selects subjects but asserts nothing about them, so it ` +
    `cannot fail and certifies nothing.`
  return {
    rule: ruleId,
    element: ruleId,
    file: '',
    line: 0,
    message,
    // The `.expectNonEmpty()` carve-out is named ON PURPOSE. It satisfies this
    // gate (a declared emptiness expectation IS an assertion), so an agent
    // told "add a condition, or delete the rule" and liking neither will find
    // that one token clears the finding — and on a non-empty corpus
    // `.expectNonEmpty()` asserts nothing further. ADR-009 rule 3: a marker an
    // agent can stamp to go green is worse than no marker unless the cost is
    // stated, so state it here rather than let it be discovered.
    suggestion:
      `${remedy} (\`.expectNonEmpty()\` also satisfies this gate, but asserts ` +
      `only that the corpus is non-empty — it is not a substitute for the ` +
      `condition you meant.) ${UNSUPPRESSABLE}`,
    bypassFilters: true,
  }
}
