import type { ArchProject } from '../core/project.js'
import type { ArchViolation } from '../core/violation.js'
import type { Condition, ConditionContext } from '@nielspeter/eess'
import { TerminalBuilder, type CollectResult, writeStderr } from '@nielspeter/eess'
import type { Slice, SliceDefinition } from '../models/slice.js'
import { resolveByMatching, resolveByDefinition } from '../models/slice.js'
import type { ImportOptions } from '../core/import-options.js'
import { splitGlobArgs } from '../core/import-options.js'
import {
  beFreeOfCycles as beFreeOfCyclesCondition,
  respectLayerOrder as respectLayerOrderCondition,
  notDependOn as notDependOnCondition,
} from '../conditions/slice.js'

/**
 * Rule builder for slice-level architecture rules.
 *
 * Unlike other builders that extend RuleBuilder<T>, SliceRuleBuilder
 * has its own chain because the grouping step (matching/assignedFrom)
 * replaces the predicate phase entirely.
 *
 * Usage:
 *   slices(project).matching(glob).should().beFreeOfCycles().check()
 *   slices(project).assignedFrom(def).should().respectLayerOrder(...).check()
 */
export class SliceRuleBuilder extends TerminalBuilder {
  private _slices: Slice[] = []
  private _conditions: Condition<Slice>[] = []

  constructor(private readonly project: ArchProject) {
    super()
  }

  /**
   * Independent copy of `_slices`/`_conditions`. `TerminalBuilder.copy()`
   * (used by the inherited `.because()`/`.excluding()`/`.rule()`/
   * `.expectEmpty()`) only shallow-copies via `Object.assign`, so without
   * this override two branches derived from the same held selection (e.g.
   * `base.because('A')` and `base.because('B')`) would share one
   * `_conditions` array by reference — a condition pushed on one branch
   * silently appearing on the other. Same bug class as `RuleBuilder`'s
   * "bug 0016", one layer down: this builder never adopted `RuleBuilder`'s
   * fix because it doesn't extend it.
   */
  protected override copy(): this {
    const clone = super.copy()
    clone._slices = [...this._slices]
    clone._conditions = [...this._conditions]
    return clone
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
    const next = this.copy()
    next._slices = resolveByDefinition(this.project, definition)
    return next
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
   *
   * @param options - `ignoreTypeImports` defaults to **true**: a type-only
   *   import is erased at compile time and creates no runtime dependency, so
   *   counting it as a cycle edge reports cycles that cannot exist. Pass
   *   `{ ignoreTypeImports: false }` to count type-only edges too.
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
  /** Overload implementation — see the signatures above for the documented API. */
  respectLayerOrder(...args: [string[], ImportOptions] | string[]): this {
    // Split and re-dispatch rather than spreading `args` straight through:
    // TypeScript cannot match a tuple-union spread to an overload, and
    // ADR-005 bars the `as` that would force it.
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
   * **Type-only edges COUNT by default here**, unlike `beFreeOfCycles()`. It
   * looks inconsistent and it is deliberate: a cycle is about runtime
   * module-initialization order, so an erased edge cannot contribute to one
   * — but isolation is about *coupling*, and a type-only dependency on
   * `legacy` is still a dependency on `legacy` that breaks when `legacy` is
   * deleted. This matches `dependOn` and `notImportFrom` as shipped. Pass
   * `{ ignoreTypeImports: true }` to disagree.
   *
   * @param args - Forbidden slice names, or `(names[], options)`
   *
   * @example
   * .should().notDependOn('legacy', 'deprecated')
   * .should().notDependOn(['legacy'], { ignoreTypeImports: true })
   */
  notDependOn(sliceNames: string[], options: ImportOptions): this
  notDependOn(...sliceNames: string[]): this
  /** Overload implementation — see the signatures above for the documented API. */
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

  protected collectViolations(): CollectResult {
    // Deliberately NOT marking this sourceEmpty: unlike RuleBuilder, there's
    // no separate predicate-filter stage — `.matching()`/`.assignedFrom()`
    // fuse "get elements" and "select" into one step, so zero slices here
    // can't be honestly distinguished from a glob/definition that simply
    // doesn't match yet (a legitimate `.expectEmpty()` use case, e.g. mid
    // migration) versus a genuinely empty project. Conflating the two would
    // make `.expectEmpty()` wrongly unusable for the ordinary case.
    if (this._slices.length === 0) {
      return { violations: [], examined: 0 }
    }

    const filesExamined = this.examinedFiles()

    if (this._conditions.length === 0) {
      return this.noConditionsResult(filesExamined)
    }

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

    return { violations, examined: filesExamined }
  }

  /**
   * FILES across the defined slices, not the slice count. `.matching()`/
   * `.assignedFrom()` always produce one Slice per named layer regardless of
   * whether any file matched it — a layer set whose globs all match zero
   * files (the whole project is empty, or a typo) would otherwise report
   * `examined: 2` (two named, empty layers) and silently pass, since
   * beFreeOfCycles()/respectLayerOrder() find zero edges among zero files and
   * that's indistinguishable from "correctly found nothing wrong." Real bug,
   * found live by the vacuity matrix (plan 0088 Phase 4a) on
   * layeredArchitecture() over a zero-file project.
   */
  private examinedFiles(): number {
    return this._slices.reduce((n, s) => n + s.files.length, 0)
  }

  /**
   * An assertion-less rule (slices found, nothing asserted about them) is
   * distinct from the zero-examined case in `collectViolations` and stays a
   * stderr warning, not the unsuppressable ADR-010 finding — mirrors
   * `RuleBuilder`'s own identical branch. `examined` must be the real count
   * here too: a hardcoded 0 would make the message that fires (if any)
   * misname the cause as "examined zero units" when slices with real files
   * WERE found — the rule just never asked a condition about them (Important
   * finding, plan 0088 Phase 4 review; fixed here, plan 0147).
   */
  private noConditionsResult(filesExamined: number): CollectResult {
    const ruleId = this._metadata?.id ?? 'unnamed'
    writeStderr(
      `[eess] Slice rule '${ruleId}' has no conditions. ` +
        `Did you forget to add a condition like beFreeOfCycles()?`,
    )
    return { violations: [], examined: filesExamined }
  }

  private buildRuleDescription(): string {
    const sliceDesc = this._slices.map((s) => s.name).join(', ')
    const conditionDesc = this._conditions.map((c) => c.description).join(' and ')
    return `slices [${sliceDesc}] should ${conditionDesc}`
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
