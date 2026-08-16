import type { SourceFile } from 'ts-morph'
import type { ArchViolation } from './violation.js'
import type { ConditionContext } from '@nielspeter/eess'
import type { LayerPair, Layer } from '../models/cross-layer.js'

/**
 * What a pair condition is given, beyond an ordinary condition's context.
 *
 * `layers` is the builder's **own resolved** layers. Without this, a condition
 * needing the full layer set (to check for one an earlier stage left empty)
 * has no public way to get it: `PairConditionBuilder`/`PairFinalBuilder` keep
 * their resolved `Layer[]` private, so a caller wanting to pass layers to a
 * condition factory has to hand-reconstruct the same globs the builder already
 * resolved — a second copy of one fact, free to disagree with the builder's
 * real resolution. `context.layers` is that same resolution, threaded through
 * instead of duplicated.
 *
 * Additive for an external implementer: TypeScript method parameters are
 * bivariant, so a condition declaring plain `ConditionContext` still satisfies
 * `PairCondition`.
 */
export interface PairConditionContext extends ConditionContext {
  /** The layers the builder resolved, in declaration order. */
  readonly layers: readonly Layer[]
}

/** Condition that evaluates matched pairs from two layers. */
export interface PairCondition<A = SourceFile, B = SourceFile> {
  readonly description: string
  evaluate(pairs: LayerPair<A, B>[], context: PairConditionContext): ArchViolation[]
}
