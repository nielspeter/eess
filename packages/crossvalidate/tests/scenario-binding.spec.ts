import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ArchRuleError } from '@nielspeter/eess'
import { features } from '@nielspeter/eess-gherkin'
import { project } from '@nielspeter/eess-ts'
import { scenarioTestsResolve, scenariosCovered } from '../src/gherkin-ts.js'

/**
 * Dogfood: these tests PROVE the use case in `specs/scenario-binding.feature`,
 * and their `it()` titles CITE its scenarios — so `check:crossval` fails the
 * build if a scenario is renamed/deleted (scenarioTestsResolve) or left uncited
 * (scenariosCovered). The behaviour is exercised against the shared gherkin-ts
 * fixtures; the citation lives in the title, the proof in the body.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/gherkin-ts')
const set = () => features({ cwd: root, roots: ['features/**'] })
const proj = (name: string) => project(join(root, name, 'tsconfig.json'))

const violationsOf = (fn: () => void) => {
  try {
    fn()
  } catch (e) {
    if (e instanceof ArchRuleError) return e.violations
    throw e
  }
  return []
}

describe('scenario↔test binding — dogfood of specs/scenario-binding.feature', () => {
  it('scenario-binding.feature › A cited scenario resolves to a real scenario', () => {
    // The green project cites checkout's scenarios, which exist in the set.
    expect(() => scenarioTestsResolve(proj('green'), set())).not.toThrow()
  })

  it('scenario-binding.feature › A citation with no matching scenario fails the build', () => {
    const violations = violationsOf(() => scenarioTestsResolve(proj('red'), set()))
    expect(violations.length).toBeGreaterThan(0)
    expect(violations.some((v) => /no such (feature file|scenario)/.test(v.message))).toBe(true)
  })

  it('scenario-binding.feature › A scenario no test cites fails the build', () => {
    // The green project leaves the dup scenarios uncited → coverage violation.
    const violations = violationsOf(() => scenariosCovered(proj('green'), set()))
    expect(violations.some((v) => v.message === 'no test cites this scenario')).toBe(true)
  })
})
