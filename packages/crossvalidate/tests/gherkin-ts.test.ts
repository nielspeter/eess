import { describe, it, expect, vi } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ArchRuleError } from '@nielspeter/eess'
import { features } from '@nielspeter/eess-gherkin'
import { project } from '@nielspeter/eess-ts'
import {
  scenarioTestsResolve,
  scenariosCovered,
  scenarioTestStats,
  defaultExtract,
} from '../src/gherkin-ts.js'

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
