import { it, expect } from 'vitest'
import { features } from '@nielspeter/eess-gherkin'
import { project } from '@nielspeter/eess-ts'
import {
  scenarioTestsResolve,
  scenarioTestStats,
  scenariosCovered,
  scenarioExemptionsCurrent,
} from '@nielspeter/eess-crossvalidate/gherkin-ts'
import { ArchRuleError } from '@nielspeter/eess'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// `red/dangling.cases.ts`, `green/tsconfig.json`, and `covered/` here are
// deliberate near-twins of packages/crossvalidate/tests/fixtures/gherkin-ts/'s
// files of the same name — keep them in sync, or drop the reuse if they diverge.
const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/gherkin-ts')
const set = () => features({ cwd: root, roots: ['features/**'] })
const proj = (name: string) => project(join(root, name, 'tsconfig.json'))
const violations = (fn: () => void) => {
  try {
    fn()
  } catch (e) {
    if (e instanceof ArchRuleError) return e.violations
    throw e
  }
  return []
}

it('green — every citing test resolves to a real scenario', () =>
  expect(() => scenarioTestsResolve(proj('green'), set())).not.toThrow())

it('non-vacuous — the green project really cites a scenario', () =>
  expect(scenarioTestStats(proj('green'), set()).citations).toBeGreaterThan(0))

it('red — a dangling path, an ambiguous suffix, and a missing scenario each fail the build', () => {
  const v = violations(() => scenarioTestsResolve(proj('red'), set()))
  expect(v).toHaveLength(3)
  expect(v.map((x) => x.message)).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/ghost\.feature.*no such feature file/),
      expect.stringMatching(/dup\.feature.*ambiguous, matches 2/),
      expect.stringMatching(/'No Such Scenario'.*no such scenario/),
    ]),
  )
})

// scenariosCovered() — the coverage direction, the complement of scenarioTestsResolve.
it('green — every scenario is cited by at least one test (coverage)', () =>
  expect(() => scenariosCovered(proj('covered'), set())).not.toThrow())

it('non-vacuous — the covered project really cites every scenario', () => {
  const stats = scenarioTestStats(proj('covered'), set())
  expect(stats.citations).toBe(3) // all three scenarios in this fixture's set
  expect(stats.scenarios).toBe(3)
})

it('red — a scenario no test cites fails the build (coverage)', () => {
  const v = violations(() => scenariosCovered(proj('green'), set()))
  expect(v).toHaveLength(2)
  expect(v.map((x) => x.element)).toEqual(
    expect.arrayContaining([
      'features/dup.feature › A dup scenario',
      'features/nested/dup.feature › Another dup scenario',
    ]),
  )
})

it("include narrows the requirement — excluding @wip drops it from the count, doesn't fake it", () => {
  const v = violations(() =>
    scenariosCovered(proj('green'), set(), { include: (s) => !s.tags.includes('wip') }),
  )
  expect(v).toHaveLength(1)
  expect(v[0]?.element).toBe('features/dup.feature › A dup scenario')
})

// scenarioExemptionsCurrent() — the reverse of scenariosCovered: an exempt
// scenario must NOT already have a citing test.
it('red — an exempt scenario that already has a citing test is a stale exemption', () => {
  const v = violations(() =>
    scenarioExemptionsCurrent(proj('covered'), set(), { isExempt: (s) => s.tags.includes('wip') }),
  )
  expect(v).toHaveLength(1)
  expect(v[0]?.message).toMatch(/is exempt but .*all\.cases\.ts:\d+ already cites it/)
})

it('green — an exempt scenario with no citing test yet is silent', () =>
  expect(() =>
    scenarioExemptionsCurrent(proj('green'), set(), { isExempt: (s) => s.tags.includes('wip') }),
  ).not.toThrow())
