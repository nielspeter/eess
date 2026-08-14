import { it, expect } from 'vitest'
import { corpus } from '@nielspeter/eess-md'
import { project } from '@nielspeter/eess-ts'
import { adrCitationsResolve, adrCitationStats } from '@nielspeter/eess-crossvalidate/md-ts'
import { ArchRuleError } from '@nielspeter/eess'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// `docs/adr/0001-good.md`, `tests/example.test.ts`, and `tsconfig.json` here
// are deliberate twins of packages/crossvalidate/tests/fixtures/citations/'s
// files of the same name — keep them in sync, or drop the reuse if they diverge.
const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/adr')
const proj = () => project(join(root, 'tsconfig.json'))
const c = (roots: string[]) => corpus({ roots, cwd: root })
const dir = { dir: 'docs/adr/**' }
const violations = (fn: () => void) => {
  try {
    fn()
  } catch (e) {
    if (e instanceof ArchRuleError) return e.violations
    throw e
  }
  return []
}

it('green — a cited it() actually exists in the project', () =>
  expect(() => adrCitationsResolve(c(['docs/adr/0001-good.md']), proj(), dir)).not.toThrow())

it('non-vacuous — the green ADR really cites a test', () =>
  expect(adrCitationStats(c(['docs/adr/0001-good.md']), dir).citations).toBeGreaterThan(0))

it('red — a cited it() that does not exist fails the build', () => {
  const v = violations(() => adrCitationsResolve(c(['docs/adr/0002-bad.md']), proj(), dir))
  expect(v).toHaveLength(1)
  expect(v[0]?.message).toMatch(/no matching test/)
})
