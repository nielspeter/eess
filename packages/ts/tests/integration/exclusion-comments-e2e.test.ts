import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { ArchRuleError } from '@nielspeter/eess'
import { project, functions, call } from '../../src/index.js'
import { functionNotContain } from '../../src/conditions/body-analysis-function.js'

/**
 * End-to-end coverage for inline exclusion comments
 * (`// eess-exclude <rule-id>: <reason>`).
 *
 * The mechanism was inert for most conditions: only the few conditions that
 * stamped `ruleId` onto their violations (cross-layer, jsx) were excludable,
 * because `isExcludedByComment` early-returns `false` when a violation has no
 * `ruleId`. The fix stamps the rule's own id (`ctx.metadata.id`) onto un-tagged
 * violations inside `applyFilters` before the comment scan, so exclusion works
 * for every condition.
 *
 * `notContain(call(...))` (body-analysis) is exactly a non-stamping condition:
 * `functionNotContain` builds its violations via a hand-rolled object literal
 * with no `ruleId` field. So these tests exercise the regression through the
 * real public path — a fluent rule with `.rule({ id })` over a fixture project —
 * and would fail on the pre-fix kernel.
 */

const tsconfigPath = path.resolve(import.meta.dirname, '../fixtures/exclusion-e2e/tsconfig.json')

const RULE_ID = 'test/no-forbidden-call'
const OTHER_ID = 'test/some-other-rule'

/** A `notContain(call('forbiddenFn'))` rule scoped to a single fixture file. */
function forbiddenCallRule(file: string, id: string) {
  return functions(project(tsconfigPath))
    .that()
    .resideInFile(`**/${file}`)
    .should()
    .notContain(call('forbiddenFn'))
    .rule({ id })
}

describe('inline exclusion comments — end-to-end (condition → applyFilters → exclusion)', () => {
  it('(a) throws when the forbidden call has no exclusion comment', () => {
    let caught: ArchRuleError | undefined
    try {
      forbiddenCallRule('violating-plain.ts', RULE_ID).check()
    } catch (err) {
      caught = err as ArchRuleError
    }
    expect(caught).toBeInstanceOf(ArchRuleError)
    expect(caught!.violations).toHaveLength(1)
    expect(caught!.violations[0]!.ruleId).toBe(RULE_ID)
  })

  it('(b) passes when a matching single-line exclude comment sits above the violation', () => {
    // Regression case: notContain() does not stamp ruleId itself, so this only
    // passes because applyFilters stamps RULE_ID before scanning comments.
    expect(() => forbiddenCallRule('excluded-single.ts', RULE_ID).check()).not.toThrow()
  })

  it('(c) still throws when the exclude comment names a DIFFERENT rule id (id-scoped)', () => {
    let caught: ArchRuleError | undefined
    try {
      forbiddenCallRule('excluded-single.ts', OTHER_ID).check()
    } catch (err) {
      caught = err as ArchRuleError
    }
    expect(caught).toBeInstanceOf(ArchRuleError)
    expect(caught!.violations).toHaveLength(1)
    expect(caught!.violations[0]!.ruleId).toBe(OTHER_ID)
  })

  it('(d) a rule with NO id cannot be excluded by comment (the id is load-bearing)', () => {
    // Without .rule({ id }) there is no ctx.metadata.id, so applyFilters never
    // stamps or scans — the comment has no id to match against.
    expect(() =>
      functions(project(tsconfigPath))
        .that()
        .resideInFile('**/excluded-single.ts')
        .should()
        .notContain(call('forbiddenFn'))
        .check(),
    ).toThrow(ArchRuleError)
  })

  it('the same regression holds through .satisfy(<non-stamping condition>)', () => {
    // .satisfy() is the generic path the rules-family presets use. Passing a
    // body-analysis (non-stamping) condition through it must be excludable too.
    const passing = functions(project(tsconfigPath))
      .that()
      .resideInFile('**/excluded-single.ts')
      .should()
      .satisfy(functionNotContain(call('forbiddenFn')))
      .rule({ id: RULE_ID })
    expect(() => passing.check()).not.toThrow()

    const throwing = functions(project(tsconfigPath))
      .that()
      .resideInFile('**/violating-plain.ts')
      .should()
      .satisfy(functionNotContain(call('forbiddenFn')))
      .rule({ id: RULE_ID })
    expect(() => throwing.check()).toThrow(ArchRuleError)
  })

  describe('block form (eess-exclude-start / -end)', () => {
    it('passes when a matching block fences all the violations', () => {
      expect(() => forbiddenCallRule('excluded-block.ts', RULE_ID).check()).not.toThrow()
    })

    it('is id-scoped too — throws for a different id, one violation per fenced call', () => {
      let caught: ArchRuleError | undefined
      try {
        forbiddenCallRule('excluded-block.ts', OTHER_ID).check()
      } catch (err) {
        caught = err as ArchRuleError
      }
      expect(caught).toBeInstanceOf(ArchRuleError)
      expect(caught!.violations).toHaveLength(2)
    })
  })
})
