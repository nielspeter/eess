import type { SourceFile } from 'ts-morph'
import type { PairCondition, PairConditionContext } from '../core/pair-condition.js'
import { UNSUPPRESSABLE } from '@nielspeter/eess'
import type { ArchViolation } from '../core/violation.js'
import type { LayerPair, Layer } from '../models/cross-layer.js'

/**
 * The finding for a layer that resolved no files, shared by all three conditions.
 *
 * A layer with no files makes every pair through it unchecked, so the condition
 * enforces nothing. Named here rather than left to a generic "no counterpart"
 * finding: naming the layer sends a reader to the `.layer()` call to fix,
 * instead of to individual files that were never the problem.
 */
function emptyLayerFinding(
  layer: Layer,
  layerCount: number,
  context: PairConditionContext,
): ArchViolation {
  return {
    rule: context.rule,
    element: layer.name,
    file: '',
    line: 1,
    message: `Layer "${layer.name}" matched 0 files — a correspondence over an empty layer enforces nothing. Fix the layer glob.`,
    because: context.because,
    ruleId: context.ruleId,
    // Its own remedy, never the author's — the author's `.because()`/`.docs()`
    // describes the RULE's intent, not this configuration problem, and would
    // print as this finding's Fix otherwise.
    suggestion:
      `Fix the .layer("${layer.name}", "${layer.pattern}") glob so it matches at ` +
      `least one file.` +
      (layerCount >= 3
        ? ` Or drop the layer: ${String(layerCount - 1)} would remain, still a valid chain.`
        : ` Dropping the layer is not available here — a chain needs two, and this one has` +
          ` ${String(layerCount)}. Delete the rule instead if the layer should not exist.`) +
      ` Until then every pair through this layer is unchecked, so the rule reports` +
      ` nothing whether the code complies or not. ${UNSUPPRESSABLE}`,
    // Config-level meta-finding: no source file, so it must survive
    // diff-aware/baseline or it re-greens under standard CI.
    bypassFilters: true,
  }
}

/**
 * The finding for a layer set too small to judge, shared by all three conditions.
 *
 * A pair condition needs two layers. Unreachable through the DSL —
 * `CrossLayerBuilder.mapping()` throws `RangeError` below two layers — so this
 * is the direct-`evaluate()` path: `PairCondition` is a public interface and
 * these factories are public exports, so a caller can construct a context with
 * fewer than two layers without going through `.mapping()` at all. A finding
 * rather than a `throw`, because a condition throwing takes down the whole run
 * over one misconfigured rule.
 */
function unusableLayersFinding(count: number, context: PairConditionContext): ArchViolation {
  return {
    rule: context.rule,
    element: '(layer set)',
    file: '',
    line: 1,
    message:
      `A pair condition was evaluated against ${String(count)} layer(s) — it needs two, ` +
      `so it judged nothing.`,
    because: context.because,
    ruleId: context.ruleId,
    suggestion:
      `Build the rule through crossLayer(project).layer(...).layer(...).mapping(...), which ` +
      `guarantees at least two layers. If you are calling evaluate() directly, pass a ` +
      `PairConditionContext whose \`layers\` holds every layer the pairs were drawn from — ` +
      `with fewer than two there are no pairs to judge, so the condition reports nothing ` +
      `whether the code complies or not. ${UNSUPPRESSABLE}`,
    bypassFilters: true,
  }
}

/**
 * Every element in the left layer must have at least one match in the right layer.
 *
 * Produces a violation for each left-layer file that has no matching pair.
 * "Match" is determined by the mapping function provided via `.mapping()`.
 *
 * @param explicitLayers - Optional, and kept only so a direct `evaluate()`
 *   caller without a `PairConditionContext.layers` can still supply layers.
 *   The builder's own resolved layers (via `context.layers`) win when present.
 */
export function haveMatchingCounterpart(explicitLayers?: Layer[]): PairCondition {
  return {
    description: 'have a matching counterpart in the paired layer',
    evaluate(pairs: LayerPair[], context: PairConditionContext): ArchViolation[] {
      // The BUILDER's layers by default. A hand-built argument is a second
      // copy of the builder's own resolution and judging the copy is the
      // defect this exists to avoid — but `>= 2`, not `> 0`: a context
      // carrying only one layer (an unusable context) must not win over a
      // real two-layer argument, or this falls through to the guard below
      // with the wrong layer count.
      const fromContext = context.layers.length >= 2 ? context.layers : undefined
      const layers = fromContext ?? explicitLayers ?? []
      if (layers.length < 2) return [unusableLayersFinding(layers.length, context)]

      // EVERY layer, before the pair loop — including the last one, which the
      // loop below never visits as `leftLayer` (`i < length - 1`). A layer
      // that only ever appears as `rightLayer` reports as N confusing
      // "no counterpart" findings on its neighbour instead of the one clear
      // "this layer's glob matched nothing" finding; a layer that only ever
      // appears as `leftLayer` and is itself empty produces ZERO findings for
      // its own iteration — real elsewhere in a longer chain, silent in a
      // two-layer one.
      //
      // Gated on `pairs.length > 0`: when the whole evaluation produced zero
      // pairs, `PairFinalBuilder`'s own `examined: this.pairs.length` already
      // triggers the kernel's generic non-vacuity guard — the SAME root
      // cause, with a real `.expectEmpty()` escape hatch this finding does
      // not have. Emitting both would report one dead layer twice. This
      // finding earns its keep only in the narrower case the generic guard
      // cannot see: a 3+-layer chain where ONE layer is dead but pairs still
      // formed elsewhere, so `examined > 0` and the generic guard stays
      // quiet while this specific layer's problem would otherwise vanish
      // into per-file noise or true silence.
      if (pairs.length > 0) {
        const empty = layers.filter((layer) => layer.files.length === 0)
        if (empty.length > 0) {
          return empty.map((layer) => emptyLayerFinding(layer, layers.length, context))
        }
      }

      const violations: ArchViolation[] = []

      // Check consecutive layer pairs
      for (let i = 0; i < layers.length - 1; i++) {
        const leftLayer = layers[i]
        const rightLayer = layers[i + 1]
        if (!leftLayer || !rightLayer) continue

        // Collect all left files that appear in at least one pair
        const matchedLeftFiles = new Set<string>()
        for (const pair of pairs) {
          if (pair.leftLayer === leftLayer.name && pair.rightLayer === rightLayer.name) {
            matchedLeftFiles.add(pair.left.getFilePath())
          }
        }

        // Find unmatched left files
        for (const file of leftLayer.files) {
          if (!matchedLeftFiles.has(file.getFilePath())) {
            violations.push({
              rule: context.rule,
              element: file.getBaseName(),
              file: file.getFilePath(),
              line: 1,
              message: `File "${file.getBaseName()}" in layer "${leftLayer.name}" has no matching counterpart in layer "${rightLayer.name}"`,
              because: context.because,
              ruleId: context.ruleId,
              suggestion: context.suggestion,
              docs: context.docs,
            })
          }
        }
      }

      return violations
    },
  }
}

/**
 * The matched pair must have consistent exported symbol names.
 *
 * Takes two extractor functions that pull symbol names from each side.
 * Every symbol extracted from the left file must appear in the right file.
 */
export function haveConsistentExports(
  extractLeft: (file: SourceFile) => string[],
  extractRight: (file: SourceFile) => string[],
): PairCondition {
  return {
    description: 'have consistent exports between paired layers',
    evaluate(pairs: LayerPair[], context: PairConditionContext): ArchViolation[] {
      // The guard `haveMatchingCounterpart` has and this lacked: a dead left
      // layer produced zero findings here — this condition has no layers
      // argument to fall back to, so it depends entirely on `context.layers`.
      if (context.layers.length < 2) {
        return [unusableLayersFinding(context.layers.length, context)]
      }

      // Same `pairs.length > 0` gate as `haveMatchingCounterpart` — when
      // `pairs.length === 0`, the kernel's own `examined: 0` non-vacuity
      // guard already owns this root cause (with a real `.expectEmpty()`
      // escape hatch), so don't report it twice.
      if (pairs.length > 0) {
        const empty = context.layers.filter((layer) => layer.files.length === 0)
        if (empty.length > 0) {
          return empty.map((layer) => emptyLayerFinding(layer, context.layers.length, context))
        }
      }

      const violations: ArchViolation[] = []

      for (const pair of pairs) {
        const leftSymbols = extractLeft(pair.left)
        const rightSymbols = new Set(extractRight(pair.right))

        for (const symbol of leftSymbols) {
          if (!rightSymbols.has(symbol)) {
            violations.push({
              rule: context.rule,
              element: pair.left.getBaseName(),
              file: pair.left.getFilePath(),
              line: 1,
              message: `Symbol "${symbol}" in "${pair.left.getBaseName()}" (${pair.leftLayer}) has no counterpart in "${pair.right.getBaseName()}" (${pair.rightLayer})`,
              because: context.because,
              ruleId: context.ruleId,
              suggestion: context.suggestion,
              docs: context.docs,
            })
          }
        }
      }

      return violations
    },
  }
}

/**
 * Custom pair assertion — shorthand for inline PairCondition.
 *
 * The provided function is called for each pair. Return an `ArchViolation`
 * to signal failure, or `null` if the pair is consistent.
 */
export function satisfyPairCondition(
  description: string,
  fn: (pair: LayerPair) => ArchViolation | null,
): PairCondition {
  return {
    description,
    evaluate(pairs: LayerPair[], context: PairConditionContext): ArchViolation[] {
      // Same guard, same reason: a custom pair assertion over an empty layer
      // is asserted about nothing, whatever the callback does.
      if (context.layers.length < 2) {
        return [unusableLayersFinding(context.layers.length, context)]
      }

      // Same `pairs.length > 0` gate as `haveMatchingCounterpart` — see there.
      if (pairs.length > 0) {
        const empty = context.layers.filter((layer) => layer.files.length === 0)
        if (empty.length > 0) {
          return empty.map((layer) => emptyLayerFinding(layer, context.layers.length, context))
        }
      }

      const violations: ArchViolation[] = []
      for (const pair of pairs) {
        const result = fn(pair)
        if (result !== null) {
          violations.push(result)
        }
      }
      return violations
    },
  }
}
