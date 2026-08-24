import { emptyDiscoveryMessage, metaViolation } from './slice-discovery-message.js'
import type { RuleDescription } from '@nielspeter/eess'
import type { CollectResult } from '../core/terminal-builder.js'
import type { ArchProject } from '../core/project.js'
import type { ArchViolation } from '@nielspeter/eess'
import type { Condition, ConditionContext } from '@nielspeter/eess'
import type { GlobNode } from '@nielspeter/eess'
import { globAnyOf, stampGlobs } from '@nielspeter/eess/internal'
import { TerminalBuilder } from '../core/terminal-builder.js'
import type { Slice, SliceDefinition } from '../models/slice.js'
import {
  resolveByMatching,
  resolveByDefinition,
  matchingGlobPrefix,
  matchingGlobPattern,
} from '../models/slice.js'
import type { ImportOptions } from '../core/import-options.js'
import { splitGlobArgs } from '../core/import-options.js'
import {
  beFreeOfCycles as beFreeOfCyclesCondition,
  respectLayerOrder as respectLayerOrderCondition,
  notDependOn as notDependOnCondition,
} from '../conditions/slice.js'
import { isProjectRelative } from '../core/project-relative.js'

/**
 * How many causes one group names before it truncates to "and N more".
 *
 * Per GROUP, never across groups, so no cause is hidden entirely — see the call
 * site. Four is a readability budget, not a semantic limit.
 */

/**
 * How slices were sourced. Recorded so an empty-discovery failure can state the
 * remedy that actually works: `matching()` takes one glob whose literal prefix
 * locates the slices, `assignedFrom()` takes globs matched against the whole
 * absolute path, and their failure modes differ — so one generic hint would
 * misdirect half of all callers (ADR-008 — a failure must carry its sanctioned
 * fix). Declared before the class's own doc block so it does not detach it.
 */
export type DiscoverySource =
  | { readonly mode: 'matching'; readonly glob: string }
  | {
      readonly mode: 'assignedFrom'
      readonly entries: readonly { readonly name: string; readonly glob: string }[]
    }

/**
 * Rule builder for slice-level architecture rules.
 *
 * Unlike the builders that extend `RuleBuilder<T>`, this one has its own chain:
 * the grouping step (`matching` / `assignedFrom`) replaces the predicate phase
 * entirely, because a slice is defined by how files are grouped rather than by a
 * predicate over already-selected subjects.
 *
 * ```ts
 * slices(project).matching(glob).should().beFreeOfCycles().check()
 * slices(project).assignedFrom(def).should().respectLayerOrder(...).check()
 * ```
 *
 * This class carried a docblock on `main` and lost it when the file was split
 * for `eess/max-class-lines`; it is restored rather than rewritten.
 */
export class SliceRuleBuilder extends TerminalBuilder {
  private _slices: Slice[] = []
  private _discovery?: DiscoverySource
  private _conditions: Condition<Slice>[] = []

  constructor(private readonly project: ArchProject) {
    super()
  }

  /**
   * Define slices by glob matching. Each directory matching the glob
   * becomes a slice named after that directory.
   *
   * @param glob - A glob pattern where the wildcard segment identifies slices
   *
   * @example
   * slices(project).matching('src/features/*\/')
   * // Slices: auth, billing, orders, etc.
   */
  matching(glob: string): this {
    const next = this.copy()
    next._discovery = { mode: 'matching', glob }
    next._slices = resolveByMatching(this.project, glob)
    return next
  }

  /**
   * Define slices from an explicit name-to-glob mapping.
   *
   * @param definition - Map of slice names to glob patterns
   *
   * @example
   * slices(project).assignedFrom({
   *   presentation: 'src/controllers/**',
   *   domain: 'src/domain/**',
   * })
   */
  assignedFrom(definition: SliceDefinition): this {
    const entries = Object.entries(definition).map(([name, glob]) => ({ name, glob }))
    const next = this.copy()
    next._discovery = { mode: 'assignedFrom', entries }
    next._slices = resolveByDefinition(this.project, definition)
    return next
  }

  /** The project this rule was built against. See `RuleBuilder.getProject`. */
  getProject(): ArchProject {
    return this.project
  }

  /**
   * The discovery globs this rule was scoped with.
   *
   * `assignedFrom` fans out into one slice per entry, so each entry is its own
   * tree: one dead layer glob is one empty slice, and folding them into an
   * `any` node would say "no fault unless every slice is empty" — a false
   * green. This is the same reason a preset's option list is not an `any`
   * node.
   *
   * `matching()` needs no `base` special case, because it declares the glob
   * `parseMatchingGlob` produces rather than the one the author wrote — and
   * that one is already anchored. Declaring the author's spelling and
   * exempting it via `base` was the earlier design, and it reported every
   * nested-layout rule as dead while looking correct on a flat fixture.
   */
  override globs(): readonly GlobNode[] {
    if (!this._discovery) return []
    if (this._discovery.mode === 'matching') {
      // Declare the glob picomatch is given, not the one the author wrote.
      // `parseMatchingGlob` strips './' and '**/', normalises a trailing
      // slash, and appends '*/**' — so the author's spelling is matched
      // against nothing at runtime and declaring it reports every correct
      // nested-layout rule as dead. `origin` keeps the spelling, which is what
      // the reader needs to find the line.
      const authored = this._discovery.glob
      // `resolveByMatching` bails before matching anything when the glob has no
      // literal directory prefix ('*', '**', 'src'), because the slice name is
      // the segment after that prefix and there is none. Decidable from the
      // glob alone, so declare a glob that cannot match rather than let the
      // pre-flight stay silent about a rule the runtime guard will fail.
      const unresolvable = matchingGlobPrefix(authored) === ''
      return [
        stampGlobs(
          globAnyOf([unresolvable ? NEVER_MATCHES : matchingGlobPattern(authored)], 'file-path'),
          'discovery',
          () => `matching("${authored}")`,
        ),
      ]
    }
    return this._discovery.entries.map((entry) =>
      stampGlobs(
        // `base: 'normalized'` for a project-relative glob — bug 0033. The
        // anchor check calls an unanchored glob dead against absolute paths,
        // and since this entry point now resolves one against the project root
        // it stops being dead exactly when it starts working. Without this,
        // `doctor` reds a rule that discovers slices correctly: measured, a
        // relative `assignedFrom` glob gave 0 violations and a `dead-glob`
        // diagnosis in the same run.
        globAnyOf(
          [entry.glob],
          'file-path',
          isProjectRelative(entry.glob) ? 'normalized' : 'absolute',
        ),
        'discovery',
        (g) => `assignedFrom({ ${entry.name}: "${g.glob}" })`,
      ),
    )
  }

  /**
   * An independent copy, carrying the condition list and the resolved slices.
   *
   * `_slices` is replaced wholesale by both discovery methods, so only the
   * condition array needs its own copy — but it is listed here anyway, because
   * the next person to add a field will read this method, not the two callers.
   */
  protected override copy(): this {
    const clone = super.copy()
    clone._slices = [...this._slices]
    clone._conditions = [...this._conditions]
    return clone
  }

  /**
   * Begin the condition phase. Returns `this` for chaining.
   */
  should(): this {
    return this
  }

  /**
   * Add another condition (AND).
   */
  andShould(): this {
    return this
  }

  /**
   * Assert that no circular dependencies exist between slices.
   */
  /**
   * @param options - `ignoreTypeImports` defaults to **true**: a type-only import
   *   is erased at compile time and creates no runtime dependency, so counting it
   *   as a cycle edge reports cycles that cannot exist (plan 0084). Pass
   *   `{ ignoreTypeImports: false }` to count type-only edges too.
   *   NOT a way back to the pre-0.47 graph: since v0.48.0 re-exports are counted as
   *   well, so type edges plus re-export edges is WIDER than 0.46.1 ever was.
   */
  beFreeOfCycles(options?: ImportOptions): this {
    const next = this.copy()
    next._conditions.push(beFreeOfCyclesCondition(options))
    return next
  }

  /**
   * Assert that slices respect a layered dependency order.
   * Layer N may depend on layers N+1, N+2, ... but NOT on layers with lower index.
   *
   * @param layers - Ordered layer names from highest to lowest
   */
  respectLayerOrder(layers: string[], options: ImportOptions): this
  respectLayerOrder(...layers: string[]): this
  /**
   * Asserts that imports between the named slices flow in the declared order —
   * outermost first — so no inner layer depends on an outer one.
   *
   * Variadic, with an optional trailing `ImportOptions`.
   */
  respectLayerOrder(...args: [string[], ImportOptions] | string[]): this {
    // Split and re-dispatch rather than spreading `args` straight through: TypeScript
    // cannot match a tuple-union spread to an overload, and ADR-005 bars the `as` that
    // would force it. `splitGlobArgs` exists for exactly this (it removed ten casts).
    const { globs: layers, options } = splitGlobArgs(args)
    const next = this.copy()
    next._conditions.push(
      options === undefined
        ? respectLayerOrderCondition(...layers)
        : respectLayerOrderCondition(layers, options),
    )
    return next
  }

  /**
   * Assert that no slice depends on any of the listed slices.
   *
   * **Type-only edges COUNT by default here**, unlike `beFreeOfCycles()`. It looks
   * inconsistent and it is deliberate: a cycle is about runtime module-initialization
   * order, so an erased edge cannot contribute to one — but isolation is about
   * *coupling*, and a type-only dependency on `legacy` is still a dependency on
   * `legacy` that breaks when `legacy` is deleted. This matches `dependOn` and
   * `notImportFrom` as shipped. Pass `{ ignoreTypeImports: true }` to disagree.
   *
   * Counts every edge kind `notImportFrom()` counts, including `import('…')` and
   * `type X = import('…').Y`. `require()` is not counted (ESM-only, ADR-004).
   *
   * @param args - Forbidden slice names, or `(names[], options)`
   *
   * @example
   * .should().notDependOn('legacy', 'deprecated')
   * .should().notDependOn(['legacy'], { ignoreTypeImports: true })
   */
  notDependOn(sliceNames: string[], options: ImportOptions): this
  notDependOn(...sliceNames: string[]): this
  /**
   * Asserts that the selected slices import nothing from the named slices.
   *
   * Variadic, with an optional trailing `ImportOptions`.
   */
  notDependOn(...args: [string[], ImportOptions] | string[]): this {
    const { globs: sliceNames, options } = splitGlobArgs(args)
    const next = this.copy()
    next._conditions.push(
      options === undefined
        ? notDependOnCondition(...sliceNames)
        : notDependOnCondition(sliceNames, options),
    )
    return next
  }

  /**
   * Whether this rule states an assertion at all — the assertion gate's question.
   *
   * True once a condition has been added; a slice selection with none can never fail.
   *
   * Overrides the `TerminalBuilder` default (`true`), whose JSDoc carries the
   * contract and the reason this is public rather than protected.
   */
  override assertsSomething(): boolean {
    return this._conditions.length > 0
  }

  /**
   * The remedy for this builder's assertion-less state, as one string.
   *
   * One channel, so `diagnose()`'s advice and the finding's own message cannot
   * disagree. Overrides `TerminalBuilder`'s generic text with wording specific to
   * what this builder is missing.
   */
  override assertionAdvice(): string {
    return (
      'this rule has no condition, so it asserts nothing and can never fail. Add a ' +
      'condition after .should(), e.g. beFreeOfCycles(), respectLayerOrder(...) or ' +
      'notDependOn(...).'
    )
  }

  /**
   * Named by id when one is set, else by the rule description (plan 0070 §4).
   * The inherited root version says 'unnamed' for every id-less rule, which
   * made three of the assertion hooks unlocatable in a doctor report.
   */
  override describeRule(): RuleDescription {
    // The rule's own description, not a call-site locator. An earlier revision
    // derived a bounded name from `_discovery` so the withdrawn runtime
    // warning would not carry ten filenames — but `explain --format agent`
    // reads this field, and consumers commit that output into their agent's
    // prompt, so bounding it stripped the condition (the only architectural
    // imperative in the line) from every id-less slice rule.
    return {
      ...super.describeRule(),
      rule: this._metadata?.id ?? this.buildRuleDescription(),
    }
  }

  /**
   * Slice discovery is not per-tree, so the gate must stay out (plan 0080).
   *
   * `assignedFrom` fans out one glob tree per entry, and a single dead entry among
   * populated siblings is a dead *tree* — which the gate would report. That guard
   * was written and **withdrawn before release** for firing on legitimate
   * projects (see `collectViolations` below): a layer not created yet, and the
   * `strict-boundaries` scaffold itself.
   *
   * The all-empty case is handled here too, with a message the gate cannot match
   * — it names the discovery mode and its remedy (bug 0009's corpus). So this
   * builder owns both halves.
   *
   * **Why this is a builder-level `true` while `PairFinalBuilder` asks its
   * condition** (`owns-empty-discovery.ts`, plan 0081): there, ownership varies by
   * condition, and a blanket `true` once suppressed the gate for the one condition
   * that did not self-report. Here nothing varies — the reason is a property of
   * `assignedFrom`'s fan-out, identical for every condition reachable through this
   * builder. The asymmetry reflects the discovery models, not an oversight.
   */
  protected override ownsDiscoveryDiagnosis(): boolean {
    return true
  }

  /**
   * Slices holding at least one file — plan 0098.
   *
   * Counting `_slices.length` would count the SHAPE of the discovery rather than
   * what was examined: `assignedFrom()` returns one slice per key whether or not
   * anything matched, so the empty case is "every slice has no files", never "no
   * slices" (arch-014 I1) — which is the same condition this family already
   * fails closed on.
   */
  examinedUnits(): number {
    return this._slices.filter((slice) => slice.files.length > 0).length
  }

  protected collectViolations(): CollectResult {
    // Discovery non-vacuity (ADR-008 / plan 0067): a slice selection that
    // resolved to no slices — or slices that matched no files — discovered
    // nothing, so it enforces nothing. Fail with a config-level meta-finding
    // (bypasses diff/baseline) rather than passing vacuously. `assignedFrom()`
    // returns one slice per key regardless of matches, so the empty case is
    // "every slice has no files", not "no slices" (arch-014 I1).
    if (this._slices.length === 0 || this._slices.every((slice) => slice.files.length === 0)) {
      // Plan 0098: this family ALREADY fails closed here, and has since 0067 —
      // a config-level meta-finding, not a vacuous pass. The floor 0099 adds is a
      // generalisation of this branch, not an invention. `examined` is 0 on the
      // same condition that produces the finding.
      return { violations: [this.emptyDiscoveryViolation()], examined: 0 }
    }

    // Every slice condition is a statement about relationships BETWEEN slices, so a
    // single slice makes all of them unfalsifiable: `beFreeOfCycles` drops
    // intra-slice edges, and `respectLayerOrder` / `notDependOn` have no second
    // slice to relate to. This is not a hypothetical — a glob that silently
    // collapsed to one mega-slice turned a real cycle green twice while every other
    // guard stayed quiet, so the count itself has to be a finding (ADR-008).
    // NOTE: two further guards were prototyped here — failing when discovery yields
    // exactly one non-empty slice (every inter-slice condition is then
    // unfalsifiable), and when one slice is empty among populated siblings (the
    // conditions silently skip names they cannot resolve). Both catch real
    // false-greens, and both were withdrawn before release: they fire on
    // legitimate projects (a one-feature repo, a layer not created yet, and the
    // `strict-boundaries` scaffold itself) with no opt-out, and their remedies were
    // written for one input and emitted for all of them. They return once the
    // remedy is executable data and an opt-out exists, mirroring
    // `crossProject().allowEmpty(name)`.

    const context: ConditionContext = {
      rule: this.buildRuleDescription(),
      because: this._reason,
      ruleId: this._metadata?.id,
      suggestion: this._metadata?.suggestion,
      docs: this._metadata?.docs,
    }

    const violations: ArchViolation[] = []
    for (const condition of this._conditions) {
      violations.push(...condition.evaluate(this._slices, context))
    }
    // Slices holding at least one file. Counting `_slices.length` would count the
    // shape of the discovery rather than what was examined: `assignedFrom()`
    // returns one slice per key whether or not anything matched, so the empty
    // case is "every slice has no files", never "no slices" (arch-014 I1).
    return { violations, examined: this.examinedUnits() }
  }

  private buildRuleDescription(): string {
    const sliceDesc = this._slices.map((s) => s.name).join(', ')
    const conditionDesc = this._conditions.map((c) => c.description).join(' and ')
    return `slices [${sliceDesc}] should ${conditionDesc}`
  }

  /** Config-level meta-finding for empty slice discovery (plan 0067). */
  private emptyDiscoveryViolation(): ArchViolation {
    return metaViolation(
      emptyDiscoveryMessage(this.project, this._discovery),
      this._metadata,
      this._reason,
    )
  }
}

/**
 * Entry point: create a slice-level rule builder.
 *
 * @param p - The loaded ArchProject
 * @returns A SliceRuleBuilder — call `.matching()` or `.assignedFrom()` next
 *
 * @example
 * slices(project)
 *   .matching('src/features/*\/')
 *   .should().beFreeOfCycles()
 *   .check()
 */
export function slices(p: ArchProject): SliceRuleBuilder {
  return new SliceRuleBuilder(p)
}

/**
 * A glob no path can match, for declaring a discovery that cannot resolve for
 * a reason the glob itself does not express. Anchored, so it is reported as
 * `no-match` rather than as a syntax fault whose remedy would be nonsense.
 */
const NEVER_MATCHES = '**/\u0000never-matches'
