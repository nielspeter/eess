import type { ArchViolation } from './violation.js'
import type { CheckOptions } from './check-options.js'
import type { RuleMetadata } from './rule-metadata.js'
import type { RuleDescription } from './rule-description.js'
import type { SilentExclusion } from './silent-exclusion.js'
import { isSilent } from './silent-exclusion.js'
import { executeCheck, executeWarn, applyFilters } from './execute-rule.js'

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
export interface CollectResult {
  readonly violations: ArchViolation[]
  readonly examined: number
  readonly sourceEmpty?: boolean
}

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
   * assertion. Zero examined units under this declaration reddens with the
   * same message a bare zero-examined rule would, but the declaration makes
   * the author's intent explicit rather than inferred.
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
    for (const p of patterns) {
      if (isSilent(p)) {
        next._exclusions.push(p.pattern)
        next._silentIndices.add(next._exclusions.length - 1)
      } else {
        next._exclusions.push(p)
      }
    }
    return next
  }

  /**
   * Return a structured description of this rule without executing it.
   * Used by the `explain` CLI subcommand.
   */
  describeRule(): RuleDescription {
    return {
      rule: this._metadata?.id ?? 'unnamed',
      id: this._metadata?.id,
      because: this._reason,
      suggestion: this._metadata?.suggestion,
      docs: this._metadata?.docs,
      imperative: this._metadata?.imperative,
    }
  }

  /**
   * Execute the rule and return violations after exclusion filtering.
   * Does not throw — use for programmatic access (presets, aggregation).
   */
  violations(): ArchViolation[] {
    return applyFilters(this.evidencedViolations(), {
      reason: this._reason,
      metadata: this._metadata,
      exclusions: this._exclusions,
      silentIndices: this._silentIndices,
    })
  }

  /**
   * Execute the rule and throw `ArchRuleError` if any violations are found.
   * This is the primary terminal method — use in test assertions.
   *
   * @param options - Optional baseline, diff filtering, and output format
   */
  check(options?: CheckOptions): void {
    executeCheck(
      this.evidencedViolations(),
      {
        reason: this._reason,
        metadata: this._metadata,
        exclusions: this._exclusions,
        silentIndices: this._silentIndices,
      },
      options,
    )
  }

  /**
   * Execute the rule and log violations to stderr. Does not throw.
   * Use for rules that should warn but not fail CI.
   *
   * @param options - Optional baseline, diff filtering, and output format
   */
  warn(options?: CheckOptions): void {
    executeWarn(
      this.evidencedViolations(),
      {
        reason: this._reason,
        metadata: this._metadata,
        exclusions: this._exclusions,
        silentIndices: this._silentIndices,
      },
      options,
    )
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
   * - `examined === 0`, no `.expectEmpty()` declared: the rule's own
   *   instrument is broken (a dead selector, an unreachable seam) — this is
   *   a configuration finding, unsuppressable (`bypassFilters`), not a silent
   *   pass. This is the guarantee ADR-009/010 exist for.
   * - `examined === 0`, `.expectEmpty()` declared: satisfied. Passes.
   * - `examined === 0`, `assertsCardinality()` true: the rule's own
   *   conditions are satisfied BY emptiness (e.g. `.notExist()`) — a
   *   different exemption from `.expectEmpty()`, because it is a property of
   *   what the condition asserts, not a caller's declaration about the
   *   corpus. Passes, with no finding at all (not even a silent one — the
   *   condition already reported truthfully that it found nothing wrong).
   * - `examined > 0`, `.expectEmpty()` declared: the declaration has expired
   *   — a unit was examined despite the author's "this stays empty" claim.
   *   Fails, appending an expiry finding to whatever `collectViolations()`
   *   found (never replacing it — the underlying findings are still real).
   * - `examined > 0`, no declaration (the ordinary case): the rule's own
   *   violations stand as computed.
   */
  private evidencedViolations(): ArchViolation[] {
    const { violations, examined, sourceEmpty } = this.collectViolations()
    if (examined === 0) {
      if (sourceEmpty === true) return [...violations, this.zeroLoadedSourceViolation()]
      if (this._expectEmpty === true) return violations
      if (this.assertsCardinality()) return violations
      return [...violations, this.zeroExaminedViolation()]
    }
    if (this._expectEmpty === true) {
      return [...violations, this.expiredExpectEmptyViolation(examined)]
    }
    return violations
  }

  /**
   * The configuration finding for a rule that examined zero units with no
   * declared exemption — ADR-009 rule 2: named as a distinct cause (dead
   * selector, empty corpus, or an unreachable examining seam), not folded
   * into an ordinary violation message.
   */
  private zeroExaminedViolation(): ArchViolation {
    const described = this.describeRule()
    const name = described.id ?? described.rule ?? this.constructor.name
    const message =
      `this rule examined zero units. If this is expected (the corpus is legitimately ` +
      `empty right now), declare it explicitly with .expectEmpty() — otherwise this is a ` +
      `dead selector, an empty project, or a rule that never reaches its own examining ` +
      `seam, and the fix is to widen the selection, not to suppress this finding.`
    return {
      rule: described.rule ?? name,
      ruleId: described.id,
      element: name,
      file: '',
      line: 0,
      message,
      suggestion: message,
      because: this._reason,
      bypassFilters: true,
    }
  }

  /**
   * The configuration finding for the ADR-010 part 3 precedence case: the
   * family's own upstream source loaded nothing at all — a stronger claim
   * than an ordinary dead selector, and worded accordingly (the fix is not
   * "widen the selection", there is no selection yet to widen).
   */
  private zeroLoadedSourceViolation(): ArchViolation {
    const described = this.describeRule()
    const name = described.id ?? described.rule ?? this.constructor.name
    const message =
      `this rule's source loaded zero units before any selection ran — an empty project, ` +
      `an unreadable tsconfig, or a glob resolving to nothing. This outranks any ` +
      `.expectEmpty() declaration and any condition satisfied by emptiness: fix the ` +
      `project/source configuration, not the rule.`
    return {
      rule: described.rule ?? name,
      ruleId: described.id,
      element: name,
      file: '',
      line: 0,
      message,
      suggestion: message,
      because: this._reason,
      bypassFilters: true,
    }
  }

  /**
   * The configuration finding for a `.expectEmpty()` declaration that has
   * expired — ADR-010 part 3: the number IS the finding, so it is named.
   */
  private expiredExpectEmptyViolation(examined: number): ArchViolation {
    const described = this.describeRule()
    const name = described.id ?? described.rule ?? this.constructor.name
    const message =
      `this rule declared .expectEmpty() but examined ${String(examined)} unit(s) — the ` +
      `declaration has expired. If the corpus legitimately grew past empty, remove ` +
      `.expectEmpty() from this rule; the underlying violations (if any) above still stand.`
    return {
      rule: described.rule ?? name,
      ruleId: described.id,
      element: name,
      file: '',
      line: 0,
      message,
      suggestion: message,
      because: this._reason,
      bypassFilters: true,
    }
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
    // Object.create/getPrototypeOf return untyped — casts unavoidable at JS interop boundary
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const proto: object = Object.getPrototypeOf(this)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const clone: this = Object.create(proto)
    Object.assign(clone, this)
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
