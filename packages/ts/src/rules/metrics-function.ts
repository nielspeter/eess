import type { ArchFunction } from '../models/arch-function.js'
import type { Condition, ConditionContext } from '@nielspeter/eess'
import type { ArchViolation } from '@nielspeter/eess'
import { cyclomaticComplexity, linesOfCode } from '../helpers/complexity.js'
import { metricViolation } from '../core/metric-violation.js'

/**
 * A ceiling on one measurement of every function.
 *
 * `maxFunctionComplexity`, `maxFunctionLines` and `maxFunctionParameters` were
 * the same walk three times over — `no-copy-paste` reported them at 96% — and
 * `rules/metrics.ts` carries the class-member twin of this helper.
 *
 * `name` is derived ONCE and used for the message and the identity alike. Two
 * expressions that agree in every branch but one is how bug 0068 happened:
 * `fn.getName() ?? '<anonymous>'` beside a bare `fn.getName()` disagree for an
 * anonymous function, which would have reproduced that defect inside its own
 * fix. One derivation in one place is what makes them unable to disagree.
 *
 * `unit` is threaded rather than derived from `metric`: `lines` kept its name
 * when `linesOfCode` stopped counting comments, and the baseline refuses to
 * compare across a unit change precisely so that silent loosening cannot
 * happen again (bug 0171).
 */
function functionCeiling(
  threshold: number,
  spec: {
    description: string
    metric: string
    unit?: string
    measure: (fn: ArchFunction) => number
    message: (name: string, measured: number) => string
  },
): Condition<ArchFunction> {
  return {
    description: spec.description,
    evaluate(elements: ArchFunction[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const fn of elements) {
        const value = spec.measure(fn)
        if (value <= threshold) continue
        const name = fn.getName() ?? '<anonymous>'
        violations.push(
          metricViolation(
            fn.getNode(),
            {
              metric: spec.metric,
              ...(spec.unit === undefined ? {} : { unit: spec.unit }),
              // Long-hand, not `measured,` — see the note in `rules/metrics.ts`.
              measured: value,
              message: spec.message(name, value),
              qualifiedName: name,
            },
            context,
          ),
        )
      }
      return violations
    },
  }
}

/**
 * Function must not exceed the given cyclomatic complexity.
 *
 * Uses fn.getBody() which returns the body Node for all function
 * kinds (declarations, arrow functions, methods).
 *
 * @example
 * ```ts
 * import { maxFunctionComplexity } from '@nielspeter/eess-ts/rules/metrics'
 *
 * functions(p).that().resideInFolder('src/**')
 *   .should().satisfy(maxFunctionComplexity(15))
 *   .check()
 * ```
 */
export function maxFunctionComplexity(threshold: number): Condition<ArchFunction> {
  return functionCeiling(threshold, {
    description: `have cyclomatic complexity <= ${String(threshold)}`,
    metric: 'complexity',
    measure: (fn) => cyclomaticComplexity(fn.getBody()),
    message: (name, cc) =>
      `${name} has cyclomatic complexity ${String(cc)} (max: ${String(threshold)})`,
  })
}

/**
 * Function must not exceed the given number of CODE lines — comments and blank
 * lines are not counted (bug 0170).
 *
 * @example
 * ```ts
 * import { maxFunctionLines } from '@nielspeter/eess-ts/rules/metrics'
 *
 * functions(p).should().satisfy(maxFunctionLines(40)).warn()
 * ```
 */
export function maxFunctionLines(threshold: number): Condition<ArchFunction> {
  return functionCeiling(threshold, {
    description: `have no more than ${String(threshold)} code lines`,
    metric: 'lines',
    // `code-lines` since bug 0170 — the metric kept its name when it stopped
    // counting comments, and the baseline must not compare across that.
    unit: 'code-lines',
    measure: (fn) => linesOfCode(fn.getNode()),
    message: (name, loc) => `${name} has ${String(loc)} code lines (max: ${String(threshold)})`,
  })
}

/**
 * Function must not have more than the given number of parameters.
 *
 * Uses fn.getParameters() from the ArchFunction interface.
 *
 * @example
 * ```ts
 * import { maxFunctionParameters } from '@nielspeter/eess-ts/rules/metrics'
 *
 * functions(p).that().areExported()
 *   .should().satisfy(maxFunctionParameters(4))
 *   .check()
 * ```
 */
export function maxFunctionParameters(threshold: number): Condition<ArchFunction> {
  return functionCeiling(threshold, {
    description: `have no more than ${String(threshold)} parameters`,
    metric: 'parameters',
    measure: (fn) => fn.getParameters().length,
    message: (name, params) =>
      `${name} has ${String(params)} parameters (max: ${String(threshold)}) — use an options object`,
  })
}
