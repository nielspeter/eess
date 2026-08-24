import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * ADR-011 clause 2, across the whole family.
 *
 * `packages/ts/tests/standalone-surface.test.ts` asserts this too, and better in
 * one way — it reads the BUILT namespace, so it sees what a consumer actually
 * gets. But it reads one dialect, and `import * as ns` cannot see type-only
 * exports. Review found both gaps: md, mermaid, gherkin and crossvalidate were
 * unguarded, and a barrel could forward an `/internal` TYPE with nothing to stop
 * it.
 *
 * This is the complement, not a replacement: a source scan over every dialect,
 * which sees all five and both export kinds. It is deliberately syntactic — a
 * forward has to be written down somewhere, so re-export chains do not hide it,
 * and a negative assertion needs no transitive type resolution (the trap that
 * cost `reachableExportNames` 16 false positives when it tried the static route
 * for the POSITIVE question).
 */
describe('no dialect forwards @nielspeter/eess/internal (ADR-011 clause 2)', () => {
  const repoRoot = path.resolve(__dirname, '../../..')
  const files = execFileSync('git', ['ls-files', 'packages/*/src/**/*.ts', 'packages/*/src/*.ts'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((f) => f && !f.startsWith('packages/core/'))

  const sources = files.map((f) => [f, readFileSync(path.join(repoRoot, f), 'utf8')] as const)

  /** `export … from '@nielspeter/eess/internal'` — a direct forward, either kind. */
  const FORWARD = /export\s+(?:type\s+)?\{[^}]*\}\s*from\s*['"]@nielspeter\/eess\/internal['"]/
  /** `export * from '…/internal'` — a blanket forward. */
  const STAR = /export\s+\*\s+from\s*['"]@nielspeter\/eess\/internal['"]/
  /** `export * as ns from '…/internal'` — one namespace object, still a forward. */
  const STAR_AS = /export\s+\*\s+as\s+[A-Za-z_]\w*\s+from\s*['"]@nielspeter\/eess\/internal['"]/

  it('no dialect source re-exports anything from the internal entry point', () => {
    const offenders = sources
      .filter(([, text]) => FORWARD.test(text) || STAR.test(text) || STAR_AS.test(text))
      .map(([file]) => file)
    expect(offenders).toEqual([])
  })

  it('VACUITY: the scan sees every dialect, and can recognise a forward', () => {
    // Without this, a broken glob or a wrong path would make the assertion above
    // pass over an empty file list — a green built from nothing (ADR-010).
    expect(sources.length).toBeGreaterThan(100)
    for (const pkg of ['ts', 'md', 'mermaid', 'gherkin', 'crossvalidate']) {
      expect(files.some((f) => f.startsWith(`packages/${pkg}/src/`))).toBe(true)
    }
    // and the patterns match the shapes they are written for
    expect(FORWARD.test("export { writeStderr } from '@nielspeter/eess/internal'")).toBe(true)
    expect(FORWARD.test("export type { OnDisk } from '@nielspeter/eess/internal'")).toBe(true)
    expect(STAR.test("export * from '@nielspeter/eess/internal'")).toBe(true)
    expect(STAR_AS.test("export * as internal from '@nielspeter/eess/internal'")).toBe(true)
    // …and do not match the legitimate root form
    expect(FORWARD.test("export { not } from '@nielspeter/eess'")).toBe(false)
  })
})
