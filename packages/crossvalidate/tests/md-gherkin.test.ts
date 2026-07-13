import { describe, it, expect, vi } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ArchRuleError } from '@nielspeter/eess'
import { corpus } from '@nielspeter/eess-md'
import { features } from '@nielspeter/eess-gherkin'
import {
  scenarioCitationsResolve,
  scenarioCitationStats,
  defaultExtract,
} from '../src/md-gherkin.js'

const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/gherkin-citations')
const c = (roots: string[]) => corpus({ roots, cwd: root })
const set = () => features({ cwd: root, roots: ['features/**', 'other/**'] })

const violationsOf = (fn: () => void) => {
  try {
    fn()
  } catch (e) {
    if (e instanceof ArchRuleError) return e.violations
    throw e
  }
  return []
}

describe('scenarioCitationsResolve() — md↔gherkin', () => {
  it('passes when cited scenarios exist (green), ignoring fenced-code citations', () => {
    expect(() => scenarioCitationsResolve(c(['docs/good.md']), set())).not.toThrow()
  })

  it('is non-vacuous on the green doc — the stats see real citations', () => {
    const stats = scenarioCitationStats(c(['docs/good.md']), set())
    expect(stats.citations).toBe(3) // two with titles + one file-level; fenced one excluded
    expect(stats.features).toBe(3)
    expect(stats.scenarios).toBe(4)
  })

  it('fails when the cited scenario title does not exist in the feature file (red)', () => {
    const violations = violationsOf(() =>
      scenarioCitationsResolve(c(['docs/bad-missing-scenario.md']), set()),
    )
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toMatch(/'Trigger job manually'.*no such scenario/)
    expect(violations[0]?.line).toBe(3)
  })

  it('fails when the cited feature file does not exist (red)', () => {
    const violations = violationsOf(() =>
      scenarioCitationsResolve(c(['docs/bad-missing-feature.md']), set()),
    )
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toMatch(/customer-sync\.feature.*no such feature file/)
  })

  it('fails on an ambiguous suffix citation, naming the candidates', () => {
    const violations = violationsOf(() =>
      scenarioCitationsResolve(c(['docs/bad-ambiguous.md']), set()),
    )
    expect(violations).toHaveLength(1)
    expect(violations[0]?.message).toMatch(/ambiguous, matches 2 feature files/)
  })

  it('scopes to dir when given', () => {
    expect(() =>
      scenarioCitationsResolve(c(['docs/**']), set(), { dir: 'docs/good.md' }),
    ).not.toThrow()
  })

  it('defaultExtract implements the frozen convention (path + optional quoted title)', () => {
    expect(defaultExtract("see `a/b.feature` · 'My title' for details")).toEqual([
      { path: 'a/b.feature', title: 'My title' },
    ])
    expect(defaultExtract('bare file citation `a/b.feature` only')).toEqual([
      { path: 'a/b.feature' },
    ])
    expect(defaultExtract('no citation on this line')).toEqual([])
  })
})

describe('report modes (ADR-008)', () => {
  it('report: return hands back violations without writing to stderr', () => {
    const errSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const result = scenarioCitationsResolve(c(['docs/bad-missing-feature.md']), set(), {
      extract: undefined,
      report: 'return',
    })
    expect(result).toHaveLength(1) // returned, not thrown
    expect(errSpy).not.toHaveBeenCalled() // caller owns emission
    errSpy.mockRestore()
  })
})
