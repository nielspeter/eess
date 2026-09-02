import type {
  ClassDeclaration,
  MethodDeclaration,
  ConstructorDeclaration,
  GetAccessorDeclaration,
  SetAccessorDeclaration,
} from 'ts-morph'
import type { Condition, ConditionContext } from '@nielspeter/eess'
import type { ArchViolation } from '@nielspeter/eess'
import { cyclomaticComplexity, linesOfCode } from '../helpers/complexity.js'
import { metricViolation } from '../core/metric-violation.js'

/** All callable members of a class: methods, constructors, getters, setters */
type ClassMember =
  | MethodDeclaration
  | ConstructorDeclaration
  | GetAccessorDeclaration
  | SetAccessorDeclaration

function getClassMembers(cls: ClassDeclaration): ClassMember[] {
  return [
    ...cls.getMethods(),
    ...cls.getConstructors(),
    ...cls.getGetAccessors(),
    ...cls.getSetAccessors(),
  ]
}

function getMemberName(cls: ClassDeclaration, member: ClassMember): string {
  const clsName = cls.getName() ?? '<anonymous>'
  if ('getName' in member && typeof member.getName === 'function') {
    const memberName = String(member.getName())
    return `${clsName}.${memberName}`
  }
  return `${clsName}.constructor`
}

/**
 * A ceiling on one measurement of every callable member of every class.
 *
 * `maxCyclomaticComplexity`, `maxMethodLines` and `maxParameters` were the same
 * nested walk three times over — `no-copy-paste` reported them at 98% — and the
 * walk is the part that must not drift: a metric that visited methods but not
 * accessors would report a clean ceiling for a class whose getter breaches it,
 * which is a pass constructed from a partial scan (ADR-010).
 *
 * `unit` is threaded rather than derived from `metric`: `lines` kept its name
 * when `linesOfCode` stopped counting comments, and the baseline refuses to
 * compare across a unit change precisely so that silent tripling cannot happen
 * again (bug 0171). A metric whose name already says what it counts passes
 * nothing here.
 */
function memberCeiling(
  threshold: number,
  spec: {
    description: string
    metric: string
    unit?: string
    measure: (member: ClassMember) => number
    message: (name: string, measured: number) => string
  },
): Condition<ClassDeclaration> {
  return {
    description: spec.description,
    evaluate(elements: ClassDeclaration[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const cls of elements) {
        for (const member of getClassMembers(cls)) {
          const value = spec.measure(member)
          if (value <= threshold) continue
          const name = getMemberName(cls, member)
          violations.push(
            metricViolation(
              member,
              {
                metric: spec.metric,
                ...(spec.unit === undefined ? {} : { unit: spec.unit }),
                // Written long-hand deliberately: `measured,` is a
                // ShorthandPropertyAssignment, and the producer census in
                // `every-metric-finding-carries-its-unit.test.ts` walks
                // PropertyAssignment. Shorthand here made this producer
                // invisible to it — the census now sees both kinds, and this
                // spelling keeps the two from having to agree twice.
                measured: value,
                qualifiedName: name,
                message: spec.message(name, value),
              },
              context,
            ),
          )
        }
      }
      return violations
    },
  }
}

/**
 * No method/constructor/getter/setter in the class may exceed the given
 * cyclomatic complexity.
 *
 * @example
 * ```ts
 * import { maxCyclomaticComplexity } from '@nielspeter/eess-ts/rules/metrics'
 *
 * classes(p).should().satisfy(maxCyclomaticComplexity(15)).check()
 * ```
 */
export function maxCyclomaticComplexity(threshold: number): Condition<ClassDeclaration> {
  return memberCeiling(threshold, {
    description: `have no method with cyclomatic complexity > ${String(threshold)}`,
    metric: 'complexity',
    measure: (member) => cyclomaticComplexity(member.getBody()),
    message: (name, cc) =>
      `${name} has cyclomatic complexity ${String(cc)} (max: ${String(threshold)}) — split into smaller methods`,
  })
}

/**
 * No class may exceed the given number of CODE lines — comments and blank
 * lines are not counted (bug 0170).
 *
 * @example
 * ```ts
 * import { maxClassLines } from '@nielspeter/eess-ts/rules/metrics'
 *
 * classes(p).should().satisfy(maxClassLines(300)).warn()
 * ```
 */
export function maxClassLines(threshold: number): Condition<ClassDeclaration> {
  return {
    description: `have no more than ${String(threshold)} code lines`,
    evaluate(elements: ClassDeclaration[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const cls of elements) {
        const loc = linesOfCode(cls)
        if (loc > threshold) {
          violations.push(
            metricViolation(
              cls,
              {
                metric: 'lines',
                // `code-lines` since bug 0170 — the metric kept its name when it stopped
                // counting comments, and the baseline must not compare across that.
                unit: 'code-lines',
                measured: loc,
                message: `${cls.getName() ?? '<anonymous>'} has ${String(loc)} code lines (max: ${String(threshold)}) — consider splitting into focused classes`,
              },
              context,
            ),
          )
        }
      }
      return violations
    },
  }
}

/**
 * No method/constructor/getter/setter may exceed the given number of lines.
 *
 * @example
 * ```ts
 * import { maxMethodLines } from '@nielspeter/eess-ts/rules/metrics'
 *
 * classes(p).should().satisfy(maxMethodLines(50)).warn()
 * ```
 */
export function maxMethodLines(threshold: number): Condition<ClassDeclaration> {
  return memberCeiling(threshold, {
    description: `have no method longer than ${String(threshold)} code lines`,
    metric: 'lines',
    // `code-lines` since bug 0170 — the metric kept its name when it stopped
    // counting comments, and the baseline must not compare across that.
    unit: 'code-lines',
    measure: (member) => linesOfCode(member),
    message: (name, loc) => `${name} has ${String(loc)} code lines (max: ${String(threshold)})`,
  })
}

/**
 * No class may have more than the given number of methods.
 *
 * Counts methods only (not constructors/getters/setters).
 *
 * @example
 * ```ts
 * import { maxMethods } from '@nielspeter/eess-ts/rules/metrics'
 *
 * classes(p).should().satisfy(maxMethods(15)).warn()
 * ```
 */
export function maxMethods(threshold: number): Condition<ClassDeclaration> {
  return {
    description: `have no more than ${String(threshold)} methods`,
    evaluate(elements: ClassDeclaration[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const cls of elements) {
        const count = cls.getMethods().length
        if (count > threshold) {
          violations.push(
            metricViolation(
              cls,
              {
                metric: 'methods',
                measured: count,
                message: `${cls.getName() ?? '<anonymous>'} has ${String(count)} methods (max: ${String(threshold)}) — consider splitting into focused classes`,
              },
              context,
            ),
          )
        }
      }
      return violations
    },
  }
}

/**
 * No method/constructor may have more than the given number of parameters.
 *
 * @example
 * ```ts
 * import { maxParameters } from '@nielspeter/eess-ts/rules/metrics'
 *
 * classes(p).should().satisfy(maxParameters(4))
 *   .because('use an options object for >4 parameters')
 *   .check()
 * ```
 */
export function maxParameters(threshold: number): Condition<ClassDeclaration> {
  return memberCeiling(threshold, {
    description: `have no method with more than ${String(threshold)} parameters`,
    metric: 'parameters',
    measure: (member) => member.getParameters().length,
    message: (name, params) =>
      `${name} has ${String(params)} parameters (max: ${String(threshold)}) — use an options object`,
  })
}

// Re-export function-level metric conditions from the same sub-path
export {
  maxFunctionComplexity,
  maxFunctionLines,
  maxFunctionParameters,
} from './metrics-function.js'
