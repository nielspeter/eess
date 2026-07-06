import picomatch from 'picomatch'
import type { SourceFile } from 'ts-morph'
import type { ArchProject } from '../core/project.js'
import type { PairCondition } from '../core/pair-condition.js'
import type { ConditionContext } from '@nielspeter/eess'
import type { Layer, LayerPair } from '../models/cross-layer.js'
import { TerminalBuilder, matchSelections } from '@nielspeter/eess'

/**
 * Resolve a layer by matching its glob against the project's source files.
 */
function resolveLayer(project: ArchProject, name: string, pattern: string): Layer {
  const isMatch = picomatch(pattern)
  const files: SourceFile[] = []
  for (const sf of project.getSourceFiles()) {
    if (isMatch(sf.getFilePath())) {
      files.push(sf)
    }
  }
  return { name, pattern, files }
}

/**
 * Compute matched pairs between two layers using a mapping function.
 *
 * Delegates the matching to the kernel's shared `matchSelections()` engine (the
 * same one `correspondence()` uses), then wraps each pair with its layer names.
 * There is no separate cross-layer matching implementation.
 */
function computePairs(
  leftLayer: Layer,
  rightLayer: Layer,
  mappingFn: (a: SourceFile, b: SourceFile) => boolean,
): LayerPair[] {
  const { pairs } = matchSelections(leftLayer.files, rightLayer.files, { matchBy: mappingFn })
  return pairs.map((p) => ({
    left: p.left,
    leftLayer: leftLayer.name,
    right: p.right,
    rightLayer: rightLayer.name,
  }))
}

/**
 * Builder for cross-layer consistency rules.
 *
 * Unlike RuleBuilder<T>, this operates on pairs of elements from different layers.
 * The chain is: `.layer()` -> `.mapping()` -> `.forEachPair()` -> `.should()` -> `.check()`
 *
 * @example
 * crossLayer(project)
 *   .layer('routes', 'src/routes/**')
 *   .layer('schemas', 'src/schemas/**')
 *   .mapping((a, b) => a.getBaseName().replace('Route', '') === b.getBaseName().replace('Schema', ''))
 *   .forEachPair()
 *   .should(haveMatchingCounterpart())
 *   .check()
 */
export class CrossLayerBuilder {
  private readonly _layerDefs: Array<{ name: string; pattern: string }> = []

  constructor(private readonly project: ArchProject) {}

  /**
   * Define a layer by name and glob pattern.
   * At least two layers must be defined before calling `.mapping()`.
   */
  layer(name: string, pattern: string): this {
    this._layerDefs.push({ name, pattern })
    return this
  }

  /**
   * Provide a mapping function that determines which elements form pairs.
   * The function receives one element from each layer and returns `true` if they should be paired.
   *
   * Requires at least 2 layers to have been defined.
   */
  mapping(fn: (a: SourceFile, b: SourceFile) => boolean): MappedCrossLayerBuilder {
    if (this._layerDefs.length < 2) {
      throw new RangeError('CrossLayerBuilder requires at least 2 layers before calling .mapping()')
    }

    // Resolve all layers
    const layers = this._layerDefs.map((def) => resolveLayer(this.project, def.name, def.pattern))

    // Compute pairs between consecutive layers
    const allPairs: LayerPair[] = []
    for (let i = 0; i < layers.length - 1; i++) {
      const left = layers[i]
      const right = layers[i + 1]
      if (left && right) allPairs.push(...computePairs(left, right, fn))
    }

    return new MappedCrossLayerBuilder(layers, allPairs)
  }
}

/**
 * Intermediate builder after `.mapping()` has been called.
 * The layers are resolved and pairs computed.
 */
// eess-exclude eess/no-unused-exports: return type of the exported CrossLayerBuilder.mapping() fluent-chain method (must stay exported for declaration emit)
export class MappedCrossLayerBuilder {
  constructor(
    private readonly layers: Layer[],
    private readonly pairs: LayerPair[],
  ) {}

  /**
   * Iterate over each matched pair. Returns a builder for attaching conditions.
   */
  forEachPair(): PairConditionBuilder {
    return new PairConditionBuilder(this.layers, this.pairs)
  }
}

/**
 * Builder after `.forEachPair()` — attach a pair condition via `.should()`.
 */
// eess-exclude eess/no-unused-exports: return type of the exported MappedCrossLayerBuilder.forEachPair() fluent-chain method (must stay exported for declaration emit)
export class PairConditionBuilder {
  constructor(
    private readonly layers: Layer[],
    private readonly pairs: LayerPair[],
  ) {}

  /**
   * Attach a pair condition to evaluate against matched pairs.
   */
  should(condition: PairCondition): PairFinalBuilder {
    return new PairFinalBuilder(this.layers, this.pairs, condition)
  }
}

/**
 * Terminal builder — call `.check()`, `.warn()`, or `.because()`.
 */
// eess-exclude eess/no-unused-exports: return type of the exported PairConditionBuilder.should() fluent-chain method (must stay exported for declaration emit)
export class PairFinalBuilder extends TerminalBuilder {
  constructor(
    private readonly layers: Layer[],
    private readonly pairs: LayerPair[],
    private readonly condition: PairCondition,
  ) {
    super()
  }

  protected collectViolations() {
    const layerNames = this.layers.map((l) => l.name)
    const context: ConditionContext = {
      rule: `cross-layer [${layerNames.join(', ')}] should ${this.condition.description}`,
      because: this._reason,
      ruleId: this._metadata?.id,
      suggestion: this._metadata?.suggestion,
      docs: this._metadata?.docs,
    }

    return this.condition.evaluate(this.pairs, context)
  }
}

/**
 * Entry point: create a cross-layer consistency rule builder.
 *
 * @param p - The loaded ArchProject
 * @returns A CrossLayerBuilder — call `.layer()` at least twice, then `.mapping()`
 *
 * @example
 * crossLayer(project)
 *   .layer('routes', 'src/routes/**')
 *   .layer('schemas', 'src/schemas/**')
 *   .mapping((a, b) => a.getBaseName().replace('-route', '') === b.getBaseName().replace('-schema', ''))
 *   .forEachPair()
 *   .should(haveMatchingCounterpart())
 *   .check()
 *
 * @deprecated Superseded by the kernel `correspondence()` primitive
 * (`@nielspeter/eess`), which binds two element `Selection`s from *any* loaders
 * (not just two globs within one project) and is the engine `crossLayer` should
 * have been built on. `crossLayer` continues to work; new rules should prefer
 * `correspondence({ left, right }).should().beComplete(...)`. Full internal
 * delegation onto `correspondence()` is a follow-up (see plan 0059, Phase 3).
 */
export function crossLayer(p: ArchProject): CrossLayerBuilder {
  return new CrossLayerBuilder(p)
}
