import { it, expect } from 'vitest'
import { features } from '@nielspeter/eess-gherkin'
import { project } from '@nielspeter/eess-ts'
import { scenarioTestsResolve, scenarioTestStats } from '@nielspeter/eess-crossvalidate/gherkin-ts'
import { ArchRuleError } from '@nielspeter/eess'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// `red/dangling.cases.ts` and `green/tsconfig.json` here are deliberate
// near-twins of packages/crossvalidate/tests/fixtures/gherkin-ts/'s files of
// the same name — keep them in sync, or drop the reuse if they diverge.
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
