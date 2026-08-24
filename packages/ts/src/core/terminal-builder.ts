import { collectWithAssertionGuard as runWithGuard } from './terminal-execution.js'
import type { RuleRun } from './terminal-execution.js'
import { zeroSubjectsAdviceOf, zeroSubjectsViolationOf } from './vacuity-diagnosis.js'
import type { RuleFacts } from './vacuity-diagnosis.js'
import type { ArchViolation } from '@nielspeter/eess'
import { severityFor, subjectOf } from '@nielspeter/eess/internal'
import type { GlobNode } from '@nielspeter/eess'
import type { ArchProject } from './project.js'
import type { CheckOptions } from '@nielspeter/eess'
import type { RuleMetadata } from '@nielspeter/eess'
import type { RuleDescription } from '@nielspeter/eess'
import type { SilentExclusion } from '@nielspeter/eess'
import { isSilent } from '@nielspeter/eess/internal'
import { executeCheck, executeWarn, applyFilters } from './execute-rule.js'
import { shallowClone } from '@nielspeter/eess/internal'

/**
 * Declaring both emptiness assertions is a contradiction, and 0069's appendix
 * says it "must fail at build time, not silently pick one".
 *
 * Thrown when the chain is built rather than reported as a finding: this is not
 * a property of the codebase under test, it is a rule that cannot be evaluated,
 * and the author is standing right there.
 *
 * `TypeError`, following `combinators.ts`'s "cannot mix Predicate objects and
 * TypeMatcher functions" — the same class of build-time misuse. A bare `Error`
 * was written first and this project's own `quality/typed-errors` rule rejected
 * it, which is the third time in this plan's implementation that the dogfooding
 * caught the new code.
 */
const CONTRADICTION =
  '.expectEmpty() and .expectNonEmpty() on the same rule contradict each other — ' +
  'a selection cannot be required to be both empty and non-empty. Keep the one you mean.'

/**
 * What a family returns from `collectViolations()` — plan 0098.
 *
 * Part of the extension surface [ts-archunit ADR-010](https://github.com/nielspeter/ts-archunit/blob/main/adr/010-the-extension-surface-is-a-contract.md)
 * rule 1 names as contract, so changing this shape is a breaking change.
 */
export interface CollectResult {
  /** The violations the family found. Unchanged in meaning from the array this replaced. */
  violations: ArchViolation[]
  /**
   * Units this family's own semantics examined — subjects, bodies, pairs, keys,
   * declared requirements. **Never a file count**: counting one layer too high
   * reads healthy on exactly the input this evidence exists to catch, which is a
   * rule whose own narrowing removed everything the project loaded.
   */
  examined: number
}

/**
 * True when two or more of this batch's RAW violations would share one
 * `subjectOf()` before `disambiguateIdentities()` (`applyFilters()`'s own
 * first step) repairs the collision with a positional `#1`/`#2` suffix —
 * plan 0090's own review found this, reproduced: a rule whose FIXED violation
 * held the bare subject and whose NEW violation lands on the same position a
 * PRIOR run's `#1` occupied gets the identical accepted-list identity the
 * fixed one held — a genuinely new finding silently absorbed as accepted,
 * because the identity `accepted` was built from was never stable, only
 * positionally stable. That is bug 0084's exact swap-blindness, reintroduced
 * through the identity primitive `accepted` is built on rather than through a
 * bare count.
 *
 * Deliberately coarse: this does not try to isolate which violations
 * collided and escalate only those — `violations()` escalates the WHOLE
 * batch once this is true, because a batch whose identities are not reliably
 * unique is a batch `accepted` cannot safely reason about AT ALL, and
 * silently trusting the non-colliding remainder risks the same false
 * confidence in a smaller blast radius. The remedy is on the rule, not the
 * mechanism: narrow the selector or qualify the condition's message so
 * violations do not collide (`ArchViolation.identity`'s own doc comment
 * states this contract), not to make the escalation more surgical.
 *
 * Computed independently of `identityCollisions()`/`resetIdentityCollisions()`
 * (`violation.ts`) — that channel is global, mutable, disclosure-only state
 * for a different consumer (a test asserting a specific producer collided);
 * reading or resetting it from inside `violations()`, a widely-called,
 * side-effect-free accessor, would couple this to a different feature's
 * instrumentation. This is a pure recomputation instead, using the same
 * `rule::subject` grouping key `disambiguateIdentities()` itself groups on.
 */
function hasIdentityCollision(violations: readonly ArchViolation[]): boolean {
  const seen = new Set<string>()
  for (const v of violations) {
    const key = `${v.rule}::${subjectOf(v)}`
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}

/**
 * The declaration half of every rule builder: what the author states.
 *
 * Owns `because`, `rule`, `excluding`, `describeRule`, `asSeverity`, the two
 * emptiness assertions and the filter state — everything a chain accumulates
 * BEFORE anything runs. {@link TerminalBuilder} extends this with the terminals
 * and the execution behind them; a builder subclasses that one and inherits both
 * halves, so the split is in this file rather than in their contracts.
 *
 * `RuleBuilder<T>` extends this too, as of plan 0069. It used not to, and the
 * old docstring said so plainly: "RuleBuilder does NOT extend this because it
 * predates it." The cost was not the duplicated methods, it was that every
 * safety feature added to one root silently did not reach the builders on the
 * other — which is what bug 0013 cost. Anything that must hold for all thirteen
 * builders now has exactly one place to live.
 */
abstract class RuleDeclaration {
  protected _reason?: string
  protected _metadata?: RuleMetadata
  protected _severity?: 'error' | 'warn'
  /**
   * Plan 0090 — the debt half of a `warn`. `undefined` means an ADVISORY
   * warning: permanent, no ceiling, exactly today's `.asSeverity('warn')`.
   * Set means DEFERRED: a violation whose `subjectOf()` is in this list stays
   * `warn`; anything not in it escalates to `error` in `violations()` — a new
   * finding this list did not accept. See `asSeverity()`'s own doc comment.
   */
  protected _acceptedWarnings?: readonly string[]
  // `protected`, not `private`. `RuleBuilder` declared these `protected` before
  // the single-root refactor and both classes are public exports, so narrowing
  // them is a compile break for an external subclass — the same argument that
  // kept `globs()` concrete rather than abstract.
  protected _exclusions: (string | RegExp)[] = []
  protected _silentIndices: Set<number> = new Set()
  /**
   * The declared-empty grammar — plan 0097, and [ts-archunit ADR-010](https://github.com/nielspeter/ts-archunit/blob/main/adr/010-the-extension-surface-is-a-contract.md)
   * rule 3(a).
   *
   * These lived on `RuleBuilder<T>`, so the smell family — the one bug 0066 is
   * filed against — could not reach them: that bug listed "is `.expectEmpty()`
   * reachable on a smell builder at all?" under Not measured, and the answer was
   * no. ADR-010 part 3 requires every family's grammar to expose a declaration
   * path, so they belong on the root every family shares.
   *
   * Booleans rather than registry membership, deliberately. `shallowClone` in
   * `copy()` carries an own property for free on every chain step, where a
   * `WeakSet` keyed on the builder would be lost at the first `copy()` — and the
   * threat model differs from the one that forced the cardinality registry,
   * which guards user-CONSTRUCTIBLE condition objects. These sit behind a
   * sanctioned method on a class whose only other audience is ADR-010's
   * contract.
   */
  protected _requireNonEmpty = false
  protected _expectEmpty = false

  /**
   * Assert that the predicate chain matches at least one subject. If the
   * filtered subject set is empty, the rule FAILS with a config-level
   * meta-finding instead of passing vacuously — the "0 === 0" false-green
   * ADR-008 forbids. Opt-in: legitimately-empty selections (e.g. "no
   * repositories yet") stay green without it. Built on the materialized
   * subject set (plan 0064); the finding bypasses diff/baseline (plan 0067).
   */
  expectNonEmpty(): this {
    if (this._expectEmpty) throw new TypeError(CONTRADICTION)
    const next = this.copy()
    next._requireNonEmpty = true
    return next
  }

  /**
   * Assert that this selector matches **nothing**, and fail the day it matches
   * something.
   *
   * Plan 0074 (R3b). Since an empty selection is now a failure by default, a
   * rule whose selection is legitimately empty needs a way to say so — and
   * 0069's appendix rejected `.allowEmpty()` for being "one word, silent
   * forever, typo or not, and nothing revisits it". This is the shape that
   * survived review, and the difference is that it is an **assertion**:
   *
   * ```ts
   * classes(p).that().haveDecorator('Deprecated')
   *   .expectEmpty()          // nothing is deprecated yet
   *   .should().beExported()
   *
   * // the day someone deprecates a class:
   * //   FAIL: .expectEmpty() asserted 0 subjects, found 1
   * ```
   *
   * An agent that reaches for this to silence a real typo gets a different
   * failure the moment the typo is fixed, and until then the intent is stated
   * in the rule where a reader sees it — rather than in a baseline, or nowhere.
   *
   * Symmetric with {@link expectNonEmpty} for the rule builders. A family may **refuse** the zero-arg form where a whole-rule notion of empty has no meaning — `CrossProjectBuilder` throws, because it declares per side — so a consumer walking `TerminalBuilder[]` must not call it unguarded. Exactly symmetric, and the two together mean
   * the empty/non-empty question is always answerable from the rule text.
   * Declaring both is a contradiction and throws here rather than silently
   * picking one.
   */
  expectEmpty(): this {
    if (this._requireNonEmpty) throw new TypeError(CONTRADICTION)
    const next = this.copy()
    next._expectEmpty = true
    return next
  }

  /**
   * True when this rule's emptiness is DECLARED — plan 0097, consumed by 0098.
   *
   * The base answer is the whole-rule flag. It is `protected` and overridable
   * because a family whose declaration is not whole-rule must be able to say so:
   * `CrossProjectBuilder` declares per SIDE and refuses the zero-arg form
   * entirely, so `_expectEmpty` is unreachable there and this default would
   * answer `false` for a rule whose every side the author declared — reporting a
   * finding that tells them to declare what they declared, which is ADR-008
   * rule 2's loop.
   *
   * PUBLIC, and forced rather than chosen — the same reason `assertsSomething()`
   * is: `DiagnosableRule` is a structural interface, and a protected member
   * cannot satisfy it. Plan 0096's preview is the first reader, and a preview
   * that ignored the declaration would report a finding on a rule the gate will
   * accept — over-reporting against the very thing it previews, which is the
   * rule 5 violation inside the migration that plan warns about.
   *
   * It exists now, ahead of the floor that reads it, for a reason worth stating:
   * a private version of this lived on `CrossProjectBuilder` and was deleted
   * as dead code, correctly — but the deletion also removed the only expression
   * of the concept, so the override 0098 needs would have gone missing SILENTLY
   * rather than as the compile error a narrowed-visibility clash would have
   * produced. Declaring it here makes the coupling loud again.
   */
  declaresEmpty(): boolean {
    return this._expectEmpty
  }

  /**
   * How THIS family spells the declaration, for a remedy that names a real call.
   *
   * The sibling of `assertionAdvice()`, and it exists for the same reason: a
   * remedy is only verified to remediate if following it works, and the generic
   * `.expectEmpty()` is a `TypeError` on `CrossProjectBuilder`, which declares
   * per side. Advice that names the one form the reader cannot call is ADR-008
   * rule 2's failure with extra confidence.
   *
   * Overriding `expectEmpty()` and not this leaves a remedy that throws, so the
   * classification census in `evidence-at-every-seam.test.ts` requires both
   * together rather than trusting the next author to remember.
   */
  emptyDeclarationAdvice(): string {
    // The AUTHOR states it; core does not guess. This branched on
    // `id.startsWith('preset/')`, which core cannot verify — false for a
    // hand-written `.rule({ id: 'preset/...' })`, for a third-party preset that
    // never extended `PresetBaseOptions`, and for one that forwards `overrides`
    // but not `expectEmpty`. The method exists precisely to stop advice naming a
    // call the reader cannot make, so deriving it from a string prefix gave up
    // the discipline it was added to enforce.
    return this._metadata?.declarationSpelling ?? '.expectEmpty()'
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
   * Exclude specific violations from reporting by matching against
   * the violation's `element`, `file`, or `message` fields.
   *
   * Matched violations are silently suppressed. Use for permanent,
   * intentional exceptions — not for temporary violations (use baseline for those).
   *
   * Patterns are matched against all three fields. Prefer anchored regexes
   * or full string matches over short substrings, especially for `message`
   * matching, to avoid accidentally suppressing unrelated violations whose
   * messages happen to contain the same text.
   *
   * Emits a warning if an exclusion matches zero violations — so renamed
   * or deleted exceptions don't silently stay in the rule.
   *
   * A configuration meta-finding — one that reports the rule enforces
   * nothing — is never excludable, and an exclusion that would have matched
   * one is reported as refused rather than as stale.
   *
   * For narrowing a rule's scope at the predicate phase (so the rule never
   * evaluates the excluded element), use `satisfy(not(<predicate>))` instead.
   * See the "Excluding a file from a rule's scope" recipe in docs/recipes.md.
   *
   * @example
   * // Exclude by element name (fully qualified)
   * .excluding('Asset.getImageUrl')
   *
   * @example
   * // Exclude by file path (regex anchored to suffix)
   * .excluding(/repositories\/index\.ts$/)
   *
   * @example
   * // Multiple exclusions, mixed forms
   * .excluding('Asset.getImageUrl', /\/legacy\//, /generated/)
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
      imperative: this._metadata?.imperative ?? this._reason,
    }
  }

  /**
   * Set the severity this rule reports at WITHOUT executing it (non-terminal).
   * Returns `this` so the builder can be collected into a rule array and run by
   * the CLI pipeline; its `.violations()` stamp each result with this severity.
   * Distinct from the terminal `.severity()` below, which executes immediately.
   *
   * `'warn'` alone is an ADVISORY warning — permanent, unchanged from every
   * release before plan 0090, for a finding ADR-009 rule 1 says the reader must
   * judge. `'warn'` with `accepted` is a DEFERRED warning — debt, with a
   * ceiling: any violation whose `subjectOf()` is not in `accepted` escalates to
   * `error`. The overloads make `accepted` a compile error on a literal
   * `'error'`, where it would mean nothing — every violation already fails
   * there. The third overload (no `options`) is for a caller dispatching on a
   * runtime-computed `'error' | 'warn'` — several presets do — which cannot
   * satisfy either literal overload; it still cannot pair a dynamic level with
   * `accepted` in the same call, which is not a real use case today.
   */
  asSeverity(level: 'error'): this
  asSeverity(level: 'warn', options?: { accepted?: readonly string[] }): this
  asSeverity(level: 'error' | 'warn'): this
  /**
   * Set this rule's severity, returning a COPY — the held builder is never
   * mutated.
   *
   * `options.accepted` applies only to `'warn'` and names the violations already
   * accepted at that level; it is cleared when the level is `'error'`, so a rule
   * escalated back to error cannot carry a stale allowlist that would silently
   * excuse the very findings the escalation was for.
   *
   * A configuration finding ignores this entirely (`severityFor`): its severity
   * is not the author's to lower.
   */
  asSeverity(level: 'error' | 'warn', options?: { accepted?: readonly string[] }): this {
    const next = this.copy()
    next._severity = level
    next._acceptedWarnings = level === 'warn' ? options?.accepted : undefined
    return next
  }

  /**
   * Whether this rule asserts anything about what it selects (plan 0070).
   *
   * `false` means the rule can never fail, and as of 0.23.0
   * `collectWithAssertionGuard()` turns that into an unsuppressable
   * configuration finding on every terminal; `diagnose()` / `doctor` report it
   * without running the rule. 0.22.0 shipped this hook with nothing at runtime
   * reading it, because the gate drafted for that release wrote through a
   * bespoke stderr channel that bypassed the formatter, the JSON payload, the
   * annotation path and the exit code — a review found a defect at each of those
   * seams, so the channel was withdrawn and the hook shipped on its own. The
   * finding form reaches all four surfaces by construction, which is what the
   * withdrawal bought.
   *
   * Concrete with a `true` default rather than abstract: both roots are public
   * exports, so an abstract member is a compile break for an external subclass
   * (the `globs()` argument). The default makes a new builder EXEMPT by
   * default — the opposite polarity from `globs()`'s empty default, which only
   * makes a builder invisible. The classification test in
   * `tests/core/assertion-gate.test.ts` is what forces the decision for every
   * exported builder.
   *
   * Public, not protected — `diagnose()` duck-types it through
   * `DiagnosableRule`, and a protected member cannot satisfy a structural
   * interface. Same forcing as `assertsSomething` on `RuleBuilder`, which was
   * already shipped public.
   */
  assertsSomething(): boolean {
    return true
  }

  /**
   * The remedy for this builder's assertion-less state, as one string.
   *
   * The "one string, one place" channel: `diagnose()`'s advice and the
   * finding's message and `suggestion` all read this method, so the diagnostic
   * a consumer runs before upgrading and the failure they get after cannot
   * disagree — plan 0070 round 2 measured an earlier design shipping two
   * diverging texts for one state.
   *
   * Public for the same `DiagnosableRule` duck-typing reason as
   * `assertsSomething` — plan 0070 drafted this `protected`, and a protected
   * member cannot satisfy the structural interface `diagnose()` consumes.
   */
  assertionAdvice(): string {
    return 'this rule asserts nothing, so it can never fail. Add an assertion, or delete the rule.'
  }

  /**
   * Every glob declaration this rule makes, as independent trees.
   *
   * One entry per independent declaration, because each one dies on its own:
   * a rule whose selector is satisfiable and whose discovery glob is not has
   * exactly one fault, and reporting them as one tree would lose that.
   *
   * Concrete with an empty default rather than abstract. Making it abstract
   * would enumerate every builder at compile time — genuinely attractive, and
   * how the census refactor did it — but `RuleBuilder` and `TerminalBuilder`
   * are both public exports, so an abstract member is a compile break for
   * anyone who has subclassed them. R2a is the release people install in order
   * to MEASURE before R3 flips anything; it cannot be the one that fails to
   * compile. The vacuity that `abstract` would have caught is caught instead
   * by a test that reflects over both entry points and fails a `return []`
   * stub, which the compiler could not have done anyway.
   */
  globs(): readonly GlobNode[] {
    return []
  }

  /**
   * The project this rule was built against, when it has one.
   *
   * Concrete returning `undefined` rather than abstract, for the reason
   * `globs()` above records: both roots are public exports, so an abstract
   * member is a compile break for an external subclass. `RuleBuilder`
   * overrides it with the non-optional form.
   *
   * The glob gate needs it, and a builder that cannot name its project simply
   * has its globs left unchecked — the same fallback `diagnose()` takes, and
   * the honest one: satisfiability is meaningless without a path universe to
   * take it against.
   */
  getProject(): ArchProject | undefined {
    return undefined
  }

  /**
   * Selector globs that can never match — plan 0074 (R3b), the flip.
   *
   * 0069's decision table, not reopened here: a **selector** glob that is
   * unsatisfiable means the rule can never have subjects, so it certifies
   * nothing and passing is a lie. `discovery` already fails (0067-D, and the
   * slice builders own their own message). `condition` and `exclusion` are
   * **never** faults — a condition glob matching nothing is indistinguishable
   * from an armed tripwire that has not fired, and plan 0072 got that wrong
   * twice before it stayed written down.
   *
   * Negative polarity is excluded by `isDeadGlobTree` itself: `not(dead)`
   * over-selects rather than under-selecting, so it cannot be dead.
   *
   * This is the same computation `diagnose()` performs — deliberately, and
   * from the same functions, so the pre-flight and the gate can never disagree
   * about what is dead. `doctor` told adopters what R3b would fail on; if the
   * two used separate logic that promise would be worth nothing.
   */
  /**
   * Whether any condition on this rule declares emptiness as its passing state.
   *
   * Concrete `false` default for the reason `globs()` records — an abstract
   * member breaks external subclasses. `RuleBuilder` overrides it by reading
   * its own conditions; the builders that take their condition as a
   * constructor argument have no cardinality condition to declare.
   *
   * **PUBLIC since plan 0098**, for the same structural reason as
   * `assertsSomething()` and `declaresEmpty()`: `diagnose()` reads it through a
   * structural interface and a protected member cannot satisfy one. It became a
   * reader the moment the rule-builder family started reporting evidence —
   * `.should().notExist()` examines zero subjects *because that is what it
   * asserts*, and previewing it as a fault tells the author their working rule
   * is broken. Caught by this repo's own 53-rule suite, on the one rule in it
   * that ends in `.notExist()`.
   *
   * Deliberately NOT folded into `declaresEmpty()`, though both suppress the
   * same finding. They are different facts and plan 0099 needs them apart: its
   * expiry branch reads the declaration flag alone, because `.notExist()` over a
   * selection that has grown is the condition doing its job, never a declaration
   * that has expired.
   */
  assertsCardinality(): boolean {
    return false
  }

  /**
   * The narrowing THIS family applied, when it can name it — plan 0099.
   *
   * ADR-010 part 4 wants the zero-examined remedy to name the **actual excluder,
   * including internal defaults**, because "fix your filters" to a user who wrote
   * none sends an agent looking for filters that do not exist.
   *
   * The root cannot know this: only the family holds its own thresholds. Review
   * measured the cost of leaving it out — `agentGuardrails({ src: '**\/lib/**',
   * noCopyPaste: true })` over two one-line functions, a **correctly configured**
   * rule pointing at real code, hard-failed with "widen it until it matches
   * something" while the true cause was `minLines(5)`, a default the author never
   * wrote and which that preset exposes no knob for.
   *
   * Returns `undefined` when a family has nothing specific to say, and the caller
   * falls back to naming the possibility rather than asserting a cause it cannot
   * verify.
   */
  protected narrowingHint(): string | undefined {
    return undefined
  }

  /**
   * What this family counts in `examined` — plan 0099.
   *
   * `CollectResult.examined` is unit-typed per family (subjects, bodies, pairs,
   * keys), so a message that prints a FILE count and then says the rule examined
   * "0 of them" commits a category error. Measured on this repo: a rule whose
   * glob matched essentially all 616 files and whose NAME predicate matched none
   * printed "loaded 616 files, and this rule examined 0 of them" — sending the
   * reader to widen a glob that was already maximal.
   */
  protected examinedUnitNoun(): string {
    return 'subjects'
  }

  /**
   * An independent copy of this builder.
   *
   * **A held selection is immutable** (bug 0016). Every method that adds to a
   * builder returns a copy instead of mutating `this`, so
   *
   * ```ts
   * const repositories = classes(p).that().extend('BaseRepository')
   * repositories.that().haveNameEndingWith('Legacy').should().notExist().check()
   * repositories.should().beExported().check()   // still ALL repositories
   * ```
   *
   * works. Before this, narrowing a held selection edited it in place: the
   * second rule silently inherited `Legacy` and reported on a subset — or on
   * nothing, and then passed. Same for `.excluding()`, which leaked a
   * suppression into every later rule off the same selection, and `.rule()`,
   * which leaked the id that `// eess-exclude <id>` comments are matched
   * against (`execute-rule.ts` gates the whole comment scan on `metadata.id`)
   * and that a preset's severity `overrides` are keyed on — so a later rule
   * inherited a suppression channel it never opted into.
   *
   * Not baselines: `hashViolation` keys on the rule *description*, never on
   * `metadata.id`. An earlier version of this docstring said baselines and a
   * `--rule` filter were keyed on the id. Neither is true, and `--rule` does
   * not exist — the only occurrences of it in the repo were three copies of
   * this sentence. ADR-009 rule 2: a failure may not assert a cause it cannot
   * verify, and that includes naming a flag the CLI does not have.
   *
   * Cost is one object per chain link, against a ts-morph walk. Irrelevant.
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
   * `copy()` shallow-copies every field, so without this a copy would share
   * its parent's exclusion array by reference and `.excluding()` on one would
   * silently mutate the other. The copy lives here rather than inline in
   * `copy()` because the knowledge of what needs duplicating belongs with the
   * fields — the same reason every other state-holding class overrides
   * `copy()` instead of `copy()` knowing about their fields.
   */
  protected adoptFilterState(source: RuleDeclaration): void {
    this._exclusions = [...source._exclusions]
    this._silentIndices = new Set(source._silentIndices)
  }
}

/**
 * The terminals — `check()`, `warn()`, `violations()` — and the execution behind
 * them.
 *
 * Split from {@link RuleDeclaration} because a builder does two jobs: it collects
 * a declaration, and it runs it. Both halves were one class of 372 code lines,
 * and the gate that measures class size was right about it.
 *
 * A subclass still extends `TerminalBuilder` and inherits both halves, so the ten
 * builders that do are untouched — the split is in this file, not in their
 * contracts.
 */
export abstract class TerminalBuilder extends RuleDeclaration {
  /**
   * Subclasses implement this to collect and evaluate violations, **and to say
   * how many units they examined while doing it** — plan 0098.
   *
   * Called lazily during `.check()` / `.warn()`.
   *
   * ## Why the return type carries the evidence
   *
   * Plan 0096 gave five families an `examinedUnits()` accessor and `diagnose()`
   * reads it — but it is **optional**, and four waves of vacuity guards have each
   * closed their own enumeration only for the next family to land outside it
   * ([ADR-010](../../../../adr/010-a-pass-is-constructed-from-evidence.md)'s Context
   * table). A guard is something you can forget to add. A required return type is
   * not: a new family cannot compile without stating its number.
   *
   * Nothing acts on `examined` in this release — plan 0099 adds the floor that
   * fails a rule which produced nothing from nothing. This plan ships the seam
   * alone so that the break to
   * [ts-archunit ADR-010](https://github.com/nielspeter/ts-archunit/blob/main/adr/010-the-extension-surface-is-a-contract.md)'s contract
   * lands in a commit whose only job is the break.
   *
   * ## What the compiler cannot force, and what does
   *
   * The type forces the field to **exist**; it cannot force it to mean anything,
   * and every implementer could satisfy it with `examined: 0`. That is a real
   * hole and it is half-closed:
   *
   * - **The numbers are guarded.** Every family exposes `examinedUnits()` and
   *   `tests/core/evidence-at-every-seam.test.ts` requires each to show its count
   *   **responding to input** — zero on a narrowed selection, non-zero on a wide
   *   one, over a corpus that loaded files either way. A constant fails one half
   *   of that pair whichever constant it is; measured, six sabotage rows caught.
   * - **The WIRING is not, and cannot be, in this release.** `examined` is
   *   produced here and discarded by the one consumer, so nothing observes it:
   *   rewriting any family's `collectViolations()` to `examined: 0` while leaving
   *   `examinedUnits()` correct leaves the entire suite green — measured, for the
   *   smell family and for `RuleBuilder`. An ADR-009 rule 5 equivalence, recorded
   *   rather than guarded by an instrument invented for it.
   *
   * **That equivalence expires in plan 0099**, which reads `examined` at the
   * floor. The commit that gives a claim its first reader is the commit that must
   * retire it — this repo has already had one recorded equivalence outlive its
   * truth by exactly one commit (`CrossProjectBuilder.declaresEmpty`), and a
   * sabotage row for the wiring belongs in 0099's matrix on day one.
   */
  protected abstract collectViolations(): CollectResult

  /**
   * Does this builder diagnose its own empty discovery?
   *
   * `false` — the gate reports a dead `discovery` glob, which is the fix for
   * [ts-archunit bug 0040](https://github.com/nielspeter/ts-archunit/blob/main/bugs/fixed/0040-a-crosslayer-rule-reports-nothing-when-its-layer-resolves-nothing.md)'s
   * silence half: two of three cross-layer conditions reported **nothing** when a
   * layer resolved to no files.
   *
   * `true` — the builder owns it, and the gate stays out. Two builders override,
   * and for different reasons, which is the thing to understand before adding a
   * third:
   *
   * - `SliceRuleBuilder` returns a constant `true`, because its discovery
   *   semantics are **not** per-tree and cannot be expressed by a position filter
   *   (below). Nothing about that varies by condition.
   * - `PairFinalBuilder` **asks its condition**, via the registry in
   *   `owns-empty-discovery.ts` (plan 0081). There, ownership does vary by
   *   condition, and a blanket `true` once suppressed the gate for the one
   *   condition that did not self-report — which is why this used to say
   *   "`SliceRuleBuilder` is the one that does" and was wrong.
   *
   * A hand-maintained roster of which builders override is the defect class plan
   * 0081 was filed to remove, so this names the two shapes rather than the two
   * classes:
   *
   * | builder | one dead tree among live ones |
   * | --- | --- |
   * | `crossLayer` | a **fault** — that layer's pairs are unchecked |
   * | slice `assignedFrom` | **legitimate** — a slice with no files yet is a real shape |
   *
   * `slice-rule-builder.ts` records that second guard being withdrawn before
   * release for firing on real projects: "a layer not created yet, and the
   * `strict-boundaries` scaffold itself". Slice already handles the all-empty case
   * with a better message than the gate's, so it owns both halves.
   *
   * Declared, never named from the outside. A list of exceptions in the gate is
   * an unchecked claim about who owns what — which is exactly the comment this
   * plan was filed to correct.
   */
  protected ownsDiscoveryDiagnosis(): boolean {
    return false
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
   * A rule that asserts nothing about what it selects cannot fail, so it is
   * reported as a configuration finding (bug 0019, plan 0070).
   *
   * **Gate-first**, ahead of `collectViolations()`, for three measured reasons:
   * an assertion-less rule cannot produce a legitimate finding, so running it
   * buys nothing but a full AST walk; `CrossProjectBuilder.collectViolations`
   * throws before returning, so a gate placed after it would never run for that
   * builder and its `RangeError` would escape the CLI's `ArchRuleError`-only
   * catch, dropping every remaining rule file; and the alternative ordering —
   * let an existing `bypassFilters` finding win — only functions for rules that
   * opted into `.expectNonEmpty()`, which is the opt-in this whole plan exists
   * because nobody uses.
   *
   * The consequence, accepted: a rule with a dead glob AND no condition reports
   * the missing assertion only. That is the right root cause — no selector
   * makes an assertion-less rule capable of failing — and the selector fault
   * resurfaces on the next run, once there is something to assert.
   *
   * `bypassFilters` makes it a configuration finding: `error` severity
   * regardless of `.asSeverity('warn')`, refused by `.excluding()`, and skipped
   * by diff and baseline. See `severityFor` and ADR-009 rule 1.
   */
  private collectWithAssertionGuard(): ArchViolation[] {
    return runWithGuard(this.asRun())
  }

  /** This rule, reduced to what `terminal-execution.ts` needs to run it. */
  private asRun(): RuleRun {
    return {
      facts: this.facts(),
      expectsEmpty: this._expectEmpty,
      assertsSomething: () => this.assertsSomething(),
      ownsDiscoveryDiagnosis: () => this.ownsDiscoveryDiagnosis(),
      collectViolations: () => this.collectViolations(),
    }
  }

  /**
   * What `applyFilters` needs, in one place.
   *
   * `violations()`, `check()` and `warn()` each rebuilt this object literally —
   * three copies of the same four fields, which is three places to forget one.
   */
  private filterContext(): {
    reason?: string
    metadata?: RuleMetadata
    exclusions: (string | RegExp)[]
    silentIndices: Set<number>
  } {
    return {
      reason: this._reason,
      metadata: this._metadata,
      exclusions: this._exclusions,
      silentIndices: this._silentIndices,
    }
  }

  /** This rule's own account of itself, for `vacuity-diagnosis.ts`. */
  private facts(): RuleFacts {
    return {
      ruleClass: { name: this.constructor.name },
      describeRule: () => this.describeRule(),
      assertionAdvice: () => this.assertionAdvice(),
      emptyDeclarationAdvice: () => this.emptyDeclarationAdvice(),
      examinedUnitNoun: () => this.examinedUnitNoun(),
      narrowingHint: () => this.narrowingHint(),
      getProject: () => this.getProject(),
      globs: () => this.globs(),
      assertsCardinality: () => this.assertsCardinality(),
      declaresEmpty: () => this.declaresEmpty(),
      zeroSubjectsAdvice: () => this.zeroSubjectsAdvice(),
      zeroSubjectsViolation: (project) => this.zeroSubjectsViolation(project),
    }
  }

  /**
   * Execute the rule and return violations after exclusion filtering.
   * Does not throw — use for programmatic access (presets, aggregation).
   */
  violations(): ArchViolation[] {
    const raw = this.collectWithAssertionGuard()
    const filtered = applyFilters(raw, this.filterContext())
    const sev: 'error' | 'warn' = this._severity ?? 'error'
    // Computed from `raw`, not `filtered`: `applyFilters()` already ran
    // `disambiguateIdentities()` by this point, which REPAIRS a colliding
    // subject with a positional `#1`/`#2` suffix — see `hasIdentityCollision`'s
    // own doc comment for why checking post-repair identities would miss
    // exactly the case this exists to catch. Only computed when it can matter.
    const unsafe =
      sev === 'warn' && this._acceptedWarnings !== undefined && hasIdentityCollision(raw)
    return filtered.map((v) => ({
      ...v,
      severity: severityFor(v, unsafe ? 'error' : this.fallbackSeverityFor(v, sev)),
    }))
  }

  /**
   * Plan 0090's escalation, per violation. A DEFERRED warning (`_acceptedWarnings`
   * set) stays `warn` only for a violation whose `subjectOf()` is in the accepted
   * list; anything else — a genuinely new finding — escalates to `error`, which is
   * the whole point: an accepted list that never fails on something new is
   * indistinguishable from an advisory warning, and bug 0084 is what that costs.
   * An ADVISORY warning (`_acceptedWarnings` `undefined`) is unaffected — `sev`
   * passes through unchanged, exactly today's behaviour.
   */
  private fallbackSeverityFor(v: ArchViolation, sev: 'error' | 'warn'): 'error' | 'warn' {
    if (sev !== 'warn' || this._acceptedWarnings === undefined) return sev
    return this._acceptedWarnings.includes(subjectOf(v)) ? 'warn' : 'error'
  }

  /**
   * Execute the rule and throw `ArchRuleError` if any violations are found.
   * This is the primary terminal method — use in test assertions.
   *
   * @param options - Optional baseline, diff filtering, and output format
   */
  check(options?: CheckOptions): void {
    const violations = this.collectWithAssertionGuard()
    executeCheck(violations, this.filterContext(), options)
  }

  /**
   * Execute the rule and log violations to stderr. Does not throw.
   * Use for rules that should warn but not fail CI.
   *
   * @param options - Optional baseline, diff filtering, and output format
   */
  warn(options?: CheckOptions): void {
    const violations = this.collectWithAssertionGuard()
    executeWarn(violations, this.filterContext(), options)
  }

  /**
   * The advice for a DEFERRED warning whose accepted list no longer covers
   * everything it currently finds — plan 0090.
   *
   * PUBLIC and zero-arg, following `inertAdvice()`/`zeroSubjectsAdvice()`'s
   * precedent exactly: read structurally by `diagnose()`, so `doctor`'s preview
   * and `checkAll()`/CLI `check`'s eventual failure carry the same evidence by
   * construction. Returns `''` for an advisory warning (`_acceptedWarnings`
   * `undefined`), for a rule at `'error'` severity, and for a deferred warning
   * whose current findings are all still within `accepted` — a working, healthy
   * deferral is not a problem `doctor` should report, only a breached one is.
   *
   * Calls `this.violations()` rather than re-deriving "is this accepted" a
   * second time: that already applies the exact escalation this reports on, so
   * the two can never disagree about which violations breached the list.
   *
   * Also checks `hasIdentityCollision()` separately, on its own
   * `collectWithAssertionGuard()` pass — not to decide WHETHER to report (that
   * is already folded into `.violations()`'s own escalation, which forces the
   * whole batch to `error` when unsafe), but to choose the RIGHT message: a
   * collision means `accepted` cannot be trusted at all here, which is a
   * different, more urgent fact than "this specific finding is new".
   */
  deferredWarningAdvice(): string {
    if (this._severity !== 'warn' || this._acceptedWarnings === undefined) return ''
    const breaching = this.violations().filter((v) => v.severity === 'error')
    if (breaching.length === 0) return ''
    const described = this.describeRule()
    const name = described.id || described.rule || this.constructor.name
    if (hasIdentityCollision(this.collectWithAssertionGuard())) {
      return (
        `"${name}" is a deferred warning, but its findings are not reliably identifiable: two or ` +
        `more share one subject (rule + element + message, with no producer-set \`identity\`), so ` +
        `the repair that keeps them distinct assigns a POSITIONAL "#1"/"#2" suffix — not stable ` +
        `across runs, so a fixed finding and a genuinely new one can land on the same suffix and ` +
        `\`accepted\` would silently treat the new one as already-known debt. Every finding here is ` +
        `escalated to error until this is fixed: qualify the condition's message, or set ` +
        `ArchViolation.identity explicitly, so each finding's subject is unique on its own.`
      )
    }
    const subjects = breaching.map((v) => subjectOf(v))
    return (
      `"${name}" is a deferred warning (accepted: ${String(this._acceptedWarnings.length)} finding` +
      `${this._acceptedWarnings.length === 1 ? '' : 's'}), and ${String(breaching.length)} current ` +
      `finding${breaching.length === 1 ? '' : 's'} ${breaching.length === 1 ? 'is' : 'are'} not in ` +
      `that list — a new finding this deferral did not accept, which will fail at check() time: ` +
      `${subjects.join(', ')}. Either fix it, or extend \`accepted\` if it is genuinely more debt of ` +
      `the same kind you already deferred.`
    )
  }

  /**
   * The advice for a rule that examined zero units — plan 0099.
   *
   * PUBLIC and zero-arg, following `assertionAdvice()`'s precedent exactly: it is
   * read structurally by `diagnose()` so `doctor` and the gate carry the same
   * string **by construction**. Plan 0070 added that seam after the two were
   * measured diverging; review measured this pair diverging the same way, with
   * `diagnose()` still closing "A later release makes this state fail at check
   * time" in the release that makes it fail.
   */
  zeroSubjectsAdvice(): string {
    return zeroSubjectsAdviceOf(this.facts())
  }

  protected zeroSubjectsViolation(project: ArchProject | undefined): ArchViolation {
    return zeroSubjectsViolationOf(this.facts(), project)
  }
}
