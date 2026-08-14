import { describe, it, expect, vi } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ArchRuleError } from '@nielspeter/eess'
import { features } from '@nielspeter/eess-gherkin'
import { project } from '@nielspeter/eess-ts'
import {
  scenarioTestsResolve,
  scenariosCovered,
  scenarioExemptionsCurrent,
  citedScenarioSites,
  scenarioTestStats,
  defaultExtract,
} from '../src/gherkin-ts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/gherkin-ts')
const set = () => features({ cwd: root, roots: ['features/**'] })
// Its own root, so this fixture's scenario does not move the counts above.
const quotedSet = () => features({ cwd: root, roots: ['quoted-features/**'] })
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

describe('scenarioTestsResolve() — gherkin↔ts', () => {
  it('passes when every citing test resolves to a real scenario (green)', () => {
    expect(() => scenarioTestsResolve(proj('green'), set())).not.toThrow()
  })

  it('is non-vacuous — the green project carries real citations (incl. a template literal)', () => {
    const stats = scenarioTestStats(proj('green'), set())
    expect(stats.citations).toBe(2) // string-literal + template; the plain test excluded
    expect(stats.scenarios).toBe(4) // checkout ×2 + dup ×2
  })

  it('fails on a dangling path, an ambiguous suffix, and a missing scenario (red ×3)', () => {
    const violations = violationsOf(() => scenarioTestsResolve(proj('red'), set()))
    expect(violations).toHaveLength(3)
    expect(violations.map((v) => v.message)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/ghost\.feature.*no such feature file/),
        expect.stringMatching(/dup\.feature.*ambiguous, matches 2/),
        expect.stringMatching(/'No Such Scenario'.*no such scenario/),
      ]),
    )
  })

  it('sees it.only and the test() alias, not just plain it()', () => {
    // Both cite real checkout scenarios via modifier/alias forms.
    const stats = scenarioTestStats(proj('aliases'), set())
    expect(stats.citations).toBe(2)
    expect(() => scenarioTestsResolve(proj('aliases'), set())).not.toThrow()
  })

  it('report: return hands violations back without writing to stderr (ADR-008)', () => {
    const errSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const result = scenarioTestsResolve(proj('red'), set(), { report: 'return' })
    expect(result).toHaveLength(3) // returned, not thrown
    expect(errSpy).not.toHaveBeenCalled() // caller owns emission
    errSpy.mockRestore()
  })

  it('honors a custom extract override', () => {
    const extract = (t: string): { path: string; title: string } | undefined => {
      const m = /^FEATURE (\S+\.feature) (.+)$/.exec(t)
      if (m?.[1] === undefined || m[2] === undefined) return undefined
      return { path: m[1], title: m[2] }
    }
    // The fixture uses the `›` convention, so a different one finds zero citations.
    expect(scenarioTestStats(proj('green'), set(), { extract }).citations).toBe(0)
  })

  it('resolves a citation whose scenario title contains a backtick (bug 0104)', () => {
    // Truncated at the backtick, the citation read `discount.feature › Reject a `
    // — no such scenario — so the gate went red over a scenario that is present.
    const violations = violationsOf(() => scenarioTestsResolve(proj('quoted'), quotedSet()))
    expect(violations).toEqual([])
    expect(scenarioTestStats(proj('quoted'), quotedSet()).citations).toBe(1)
  })

  it('counts a backticked scenario as covered by the test that cites it', () => {
    // Its own denominator: a drifted `quoted-features/**` root would load zero
    // scenarios and leave "nothing uncovered" trivially true.
    expect(scenarioTestStats(proj('quoted'), quotedSet()).scenarios).toBe(1)
    expect(() => scenariosCovered(proj('quoted'), quotedSet())).not.toThrow()
  })

  it('defaultExtract parses the it()-title convention', () => {
    expect(defaultExtract('checkout.feature › Apply a valid code')).toEqual({
      path: 'checkout.feature',
      title: 'Apply a valid code',
    })
    expect(defaultExtract('adds two numbers')).toBeUndefined()
  })
})

describe('scenariosCovered() — the coverage direction', () => {
  it('fails for scenarios no test cites (red)', () => {
    // The green project cites only checkout's two scenarios; both dup scenarios
    // are left uncovered.
    const violations = violationsOf(() => scenariosCovered(proj('green'), set()))
    expect(violations).toHaveLength(2)
    expect(violations.map((v) => v.message)).toEqual([
      'no test cites this scenario',
      'no test cites this scenario',
    ])
    expect(violations.map((v) => v.element)).toEqual(
      expect.arrayContaining([
        'features/dup.feature › A dup scenario',
        'features/nested/dup.feature › Another dup scenario',
      ]),
    )
  })

  it('include filter excludes @wip scenarios from the coverage requirement', () => {
    const result = scenariosCovered(proj('green'), set(), {
      include: (s) => !s.tags.includes('wip'),
      report: 'return',
    })
    // Only the untagged dup scenario remains required; the @wip one is excluded.
    expect(result).toHaveLength(1)
    expect(result[0]?.element).toBe('features/dup.feature › A dup scenario')
  })

  it('passes when every scenario is cited (green, non-vacuous)', () => {
    expect(() => scenariosCovered(proj('covered'), set())).not.toThrow()
    const stats = scenarioTestStats(proj('covered'), set())
    expect(stats.citations).toBe(4) // all four scenarios cited
    expect(stats.scenarios).toBe(4)
  })
})

describe('citedScenarioSites() — plan 0145', () => {
  it('maps a cited scenario to the site of the test that cites it', () => {
    const sites = citedScenarioSites(proj('covered'), set(), defaultExtract)
    const site = sites.get('features/nested/dup.feature Another dup scenario')
    expect(site).toBeDefined()
    expect(site?.title).toBe('features/nested/dup.feature › Another dup scenario')
    expect(site?.file).toMatch(/all\.cases\.ts$/)
    expect(site?.line).toBeGreaterThan(0)
  })

  it('omits a scenario no test cites', () => {
    const sites = citedScenarioSites(proj('green'), set(), defaultExtract)
    expect(sites.has('features/nested/dup.feature Another dup scenario')).toBe(false)
  })
})

describe('scenarioExemptionsCurrent() — plan 0145 (proposal 005)', () => {
  const wip = { isExempt: (s: { tags: readonly string[] }) => s.tags.includes('wip') }

  it('fires when an exempt scenario already has a citing test (stale exemption)', () => {
    const violations = violationsOf(() => scenarioExemptionsCurrent(proj('covered'), set(), wip))
    expect(violations).toHaveLength(1)
    expect(violations[0]?.element).toBe('features/nested/dup.feature › Another dup scenario')
    expect(violations[0]?.ruleId).toBe('crossval/scenario-exemption-stale')
    expect(violations[0]?.message).toMatch(/is exempt but .*all\.cases\.ts:\d+ already cites it/)
    expect(violations[0]?.suggestion).toMatch(/remove the exempting tag/)
  })

  it('is silent when the exempt scenario has no citing test yet (green)', () => {
    expect(() => scenarioExemptionsCurrent(proj('green'), set(), wip)).not.toThrow()
  })

  it('is silent for a non-exempt scenario regardless of citation (isExempt scopes the check)', () => {
    // `covered` cites every scenario, including three non-@wip ones — none of
    // them should be reported, since only exempt scenarios are ever checked.
    const violations = violationsOf(() =>
      scenarioExemptionsCurrent(proj('covered'), set(), { isExempt: () => false }),
    )
    expect(violations).toEqual([])
  })

  it('report: return hands violations back without writing to stderr (ADR-008)', () => {
    const errSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const result = scenarioExemptionsCurrent(proj('covered'), set(), { ...wip, report: 'return' })
    expect(result).toHaveLength(1)
    expect(errSpy).not.toHaveBeenCalled()
    errSpy.mockRestore()
  })
})
