import type { ArchProject } from '../core/project.js'
import type { ArchViolation } from '../core/violation.js'
import type { Condition, ConditionContext } from '@nielspeter/eess'
import { TerminalBuilder, type CollectResult } from '@nielspeter/eess'
import type { Slice, SliceDefinition } from '../models/slice.js'
import { resolveByMatching, resolveByDefinition } from '../models/slice.js'
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
    this._slices = resolveByMatching(this.project, glob)
    return this
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
    this._slices = resolveByDefinition(this.project, definition)
    return this
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
  beFreeOfCycles(): this {
    this._conditions.push(beFreeOfCyclesCondition())
    return this
  }

  /**
   * Assert that slices respect a layered dependency order.
   * Layer N may depend on layers N+1, N+2, ... but NOT on layers with lower index.
   *
   * @param layers - Ordered layer names from highest to lowest
   */
  respectLayerOrder(...layers: string[]): this {
    this._conditions.push(respectLayerOrderCondition(...layers))
    return this
  }

  /**
   * Assert that no slice depends on any of the listed slices.
   *
   * @param sliceNames - Names of forbidden dependency targets
   */
  notDependOn(...sliceNames: string[]): this {
    this._conditions.push(notDependOnCondition(...sliceNames))
    return this
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

    if (this._conditions.length === 0) {
      const ruleId = this._metadata?.id ?? 'unnamed'
      console.warn(
        `[eess] Slice rule '${ruleId}' has no conditions. ` +
          `Did you forget to add a condition like beFreeOfCycles()?`,
      )
      return { violations: [], examined: 0 }
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

    // `examined` is FILES across the defined slices, not the slice count.
    // `.matching()`/`.assignedFrom()` always produce one Slice per named
    // layer regardless of whether any file matched it — a layer set whose
    // globs all match zero files (the whole project is empty, or a typo)
    // would otherwise report `examined: 2` (two named, empty layers) and
    // silently pass, since beFreeOfCycles()/respectLayerOrder() find zero
    // edges among zero files and that's indistinguishable from "correctly
    // found nothing wrong." Real bug, found live by the vacuity matrix
    // (plan 0088 Phase 4a) on layeredArchitecture() over a zero-file project.
    const filesExamined = this._slices.reduce((n, s) => n + s.files.length, 0)
    return { violations, examined: filesExamined }
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
