import { it, expect } from 'vitest'
import { corpus } from '@nielspeter/eess-md'
import { features } from '@nielspeter/eess-gherkin'
import {
  scenarioCitationsResolve,
  scenarioCitationStats,
} from '@nielspeter/eess-crossvalidate/md-gherkin'
import { ArchRuleError } from '@nielspeter/eess'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// `job-management.feature` and `docs/good.md`'s citation line here are
// deliberate twins of packages/crossvalidate/tests/fixtures/gherkin-citations/'s
// files of the same name — keep them in sync, or drop the reuse if they diverge.
const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/gherkin')
const c = (roots: string[]) => corpus({ roots, cwd: root })
const set = () => features({ cwd: root, roots: ['features/**'] })
const violations = (fn: () => void) => {
  try {
    fn()
  } catch (e) {
    if (e instanceof ArchRuleError) return e.violations
    throw e
  }
  return []
}

it('green — cited scenario resolves', () =>
  expect(() => scenarioCitationsResolve(c(['docs/good.md']), set())).not.toThrow())

it('non-vacuous — the green doc really cites a scenario', () =>
  expect(scenarioCitationStats(c(['docs/good.md']), set()).citations).toBeGreaterThan(0))

it('red — a cited scenario that does not exist fails the build', () => {
  const v = violations(() => scenarioCitationsResolve(c(['docs/bad-missing.md']), set()))
  expect(v).toHaveLength(1)
  expect(v[0]?.message).toMatch(/no such scenario/)
})
