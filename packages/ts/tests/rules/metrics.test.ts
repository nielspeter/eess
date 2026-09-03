import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import path from 'node:path'
import {
  maxCyclomaticComplexity,
  maxClassLines,
  maxMethodLines,
  maxMethods,
  maxParameters,
} from '../../src/rules/metrics.js'
import { maxFunctionLines } from '../../src/rules/metrics-function.js'
import { collectFunctions } from '../../src/models/arch-function.js'

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures/metrics')
const project = new Project({ tsConfigFilePath: path.join(fixturesDir, 'tsconfig.json') })

function findClass(name: string) {
  const cls = project
    .getSourceFiles()
    .flatMap((sf) => sf.getClasses())
    .find((c) => c.getName() === name)
  if (!cls) throw new Error(`Fixture class not found: ${name}`)
  return cls
}

const context = { rule: 'test rule' }

describe('maxCyclomaticComplexity', () => {
  it('passes for simple class', () => {
    const condition = maxCyclomaticComplexity(10)
    const violations = condition.evaluate([findClass('SimpleService')], context)
    expect(violations).toHaveLength(0)
  })

  it('fails for complex method', () => {
    const condition = maxCyclomaticComplexity(3)
    const violations = condition.evaluate([findClass('ComplexService')], context)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations.some((v) => v.message.includes('cyclomatic complexity'))).toBe(true)
  })

  it('checks constructors', () => {
    const condition = maxCyclomaticComplexity(2)
    const violations = condition.evaluate([findClass('ConfigService')], context)
    expect(violations.some((v) => v.message.includes('constructor'))).toBe(true)
  })

  it('checks getters', () => {
    const condition = maxCyclomaticComplexity(2)
    const violations = condition.evaluate([findClass('ConfigService')], context)
    expect(violations.some((v) => v.message.includes('value'))).toBe(true)
  })

  it('threshold is configurable', () => {
    const strict = maxCyclomaticComplexity(1)
    const lenient = maxCyclomaticComplexity(100)
    const cls = findClass('ComplexService')
    expect(strict.evaluate([cls], context).length).toBeGreaterThan(0)
    expect(lenient.evaluate([cls], context)).toHaveLength(0)
  })
})

describe('maxClassLines', () => {
  it('passes for small class', () => {
    const condition = maxClassLines(500)
    const violations = condition.evaluate([findClass('SmallService')], context)
    expect(violations).toHaveLength(0)
  })

  it('fails for class exceeding threshold', () => {
    const condition = maxClassLines(3)
    const violations = condition.evaluate([findClass('LargeService')], context)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0]!.message).toContain('lines')
  })
})

describe('maxMethodLines', () => {
  it('passes for short methods', () => {
    const condition = maxMethodLines(100)
    const violations = condition.evaluate([findClass('SimpleService')], context)
    expect(violations).toHaveLength(0)
  })

  it('fails for long method', () => {
    const condition = maxMethodLines(2)
    const violations = condition.evaluate([findClass('ComplexService')], context)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0]!.message).toContain('lines')
  })

  it('checks constructors', () => {
    const condition = maxMethodLines(2)
    const violations = condition.evaluate([findClass('ConfigService')], context)
    expect(violations.some((v) => v.message.includes('constructor'))).toBe(true)
  })
})

describe('maxMethods', () => {
  it('passes for small class', () => {
    const condition = maxMethods(10)
    const violations = condition.evaluate([findClass('SmallService')], context)
    expect(violations).toHaveLength(0)
  })

  it('fails for class with many methods', () => {
    const condition = maxMethods(5)
    const violations = condition.evaluate([findClass('LargeService')], context)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0]!.message).toContain('methods')
  })
})

describe('maxParameters', () => {
  it('passes for few-param methods', () => {
    const condition = maxParameters(10)
    const violations = condition.evaluate([findClass('SimpleService')], context)
    expect(violations).toHaveLength(0)
  })

  it('fails for many-param method', () => {
    const condition = maxParameters(4)
    const violations = condition.evaluate([findClass('ParamHeavy')], context)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0]!.message).toContain('parameters')
  })

  it('checks constructor parameters', () => {
    const condition = maxParameters(4)
    const violations = condition.evaluate([findClass('ParamHeavy')], context)
    expect(violations.some((v) => v.message.includes('constructor'))).toBe(true)
  })
})

/**
 * Bug 0068 changed `element` for CLASS metrics too, and nothing pinned it — the
 * full suite was green with the change in and green with it out, so an output
 * change on three published conditions shipped unguarded and the release notes
 * said class metrics were unaffected.
 *
 * `element` is not cosmetic: it is what the terminal prints, what JSON reports,
 * and one of the three fields string-form `.excluding()` matches by exact
 * membership. `ArchViolation.element`'s own contract says `"OrderService.getTotal()"`
 * — a qualified name — so the class metrics were the family that had been
 * violating it, and this is the fix. Pinned as a literal, not a count.
 */
describe('class metrics report a qualified element (bug 0068)', () => {
  it('maxMethodLines names the member as Class.member, not the bare member', () => {
    const violations = maxMethodLines(1).evaluate([findClass('ComplexService')], context)
    expect(violations.length).toBeGreaterThan(0)
    for (const v of violations) {
      expect(v.element).toMatch(/^ComplexService\./)
      // element and message agree — the invariant bug 0068 is about.
      expect(v.message.split(' has ')[0]).toBe(v.element)
    }
  })

  it('the identity is unchanged, so no class-metric baseline entry moves', () => {
    // A LITERAL pin, not `identity contains element`: both fields now come from
    // `getMemberName`, so comparing them stays green under any change that moves
    // both together — which would invalidate every class-metric baseline entry
    // while the release notes promise they are byte-identical. The claim is about
    // stability across 0.57.0 → 0.58.0, so the expected value has to be written
    // down, not derived from the thing under test.
    const names = maxMethodLines(1)
      .evaluate([findClass('ComplexService')], context)
      .map((v) => String(v.identity).split('::')[1] ?? '')
      .sort()
    expect(names).toEqual(['ComplexService.complex', 'ComplexService.simple'])
  })
})

/**
 * The PRODUCER half of [bug 0171](../../../../work/bugs/fixed/0171-a-metric-unit-change-silently-loosens-every-baselined-ratchet.md).
 *
 * The baseline refuses to compare measurements whose units disagree — but that
 * mechanism is inert unless the rules actually stamp a unit. Measured: deleting
 * `measuredUnit: options.unit ?? options.metric` from `metric-violation.ts` left
 * the entire suite green at 27 pre-existing failures, unchanged. Every guard for
 * 0171 hand-built its violations with the unit written in by the test, so all of
 * them proved the consumer and none proved a producer.
 *
 * **This half is behavioural and its enumeration is by hand.** It RUNS five
 * conditions and reads what they produced, which is the only way to prove a
 * stamp actually reaches a violation. What it cannot do is prove the list is
 * complete — and it was not: `haveMaxExports` is a real metric condition and is
 * absent below, which is exactly the producer that hand-writes its unit. An
 * earlier version of this docstring claimed the list was "written over the real
 * conditions … so a metric added later is covered on the day it is added". It
 * was five literals.
 *
 * Completeness is proved mechanically instead, in
 * `tests/core/every-metric-finding-carries-its-unit.test.ts`, which derives the
 * producer set from source and fails on one that stamps nothing. The two are
 * complementary: that census cannot tell whether a stamp survives to the
 * violation, and this cannot tell whether a producer is missing.
 */
describe('every metric finding carries the unit its ratchet is denominated in', () => {
  const cls = findClass('ComplexService')

  // Thresholds low enough that each condition certainly fires.
  const producers = [
    { name: 'maxClassLines', violations: maxClassLines(1).evaluate([cls], context) },
    { name: 'maxMethodLines', violations: maxMethodLines(1).evaluate([cls], context) },
    { name: 'maxMethods', violations: maxMethods(0).evaluate([cls], context) },
    { name: 'maxParameters', violations: maxParameters(0).evaluate([cls], context) },
    {
      name: 'maxCyclomaticComplexity',
      violations: maxCyclomaticComplexity(0).evaluate([cls], context),
    },
  ]

  it.each(producers)('$name stamps a unit on everything it measures', ({ violations }) => {
    // Non-vacuity: a condition that produced nothing would pass the loop below.
    expect(violations.length).toBeGreaterThan(0)
    for (const violation of violations) {
      expect(violation.measured).toBeDefined()
      expect(violation.measuredUnit).toBeDefined()
    }
  })

  it('names code-lines specifically, since that is the unit that changed', () => {
    // `lines` kept its name when it stopped counting comments, which is the whole
    // reason a unit exists. Pinned by value, not merely "defined".
    const [violation] = maxClassLines(1).evaluate([cls], context)
    expect(violation?.measuredUnit).toBe('code-lines')
  })

  it('and names it for the member and function line metrics too', () => {
    // The other two `lines` producers. Only `maxClassLines` was pinned BY VALUE,
    // so deleting `unit: 'code-lines'` from either of these left the suite green
    // — the unit silently fell back to the metric name `lines`, which is
    // precisely the baseline comparison bug 0171 exists to refuse. Found when
    // both were folded onto shared ceilings and the sabotage did not red.
    const [method] = maxMethodLines(1).evaluate([cls], context)
    expect(method?.measuredUnit).toBe('code-lines')

    const [fn] = maxFunctionLines(1).evaluate(
      collectFunctions(findClass('ComplexService').getSourceFile()),
      context,
    )
    expect(fn?.measuredUnit).toBe('code-lines')
  })
})
