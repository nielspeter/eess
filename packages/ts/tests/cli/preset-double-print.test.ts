/**
 * A preset enforcing at module scope must not print its findings twice — bug 0203.
 *
 * `finishPreset` emitted through the kernel and then threw; `runCheck` collected the
 * same violations off that throw and reported them again. One violation, two blocks,
 * two contradicting counters — with **no flags involved**, which is what a migrator
 * from `@nielspeter/ts-archunit` sees on their first `eess-ts check`.
 *
 * Measured before the fix on this repo's own fixture: 13 violation blocks, 6 of them
 * exact duplicates, under a summary line claiming `1 violation`.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import path from 'node:path'
import { runCheck } from '../../src/cli/commands/check.js'

const fixture = (name: string): string =>
  path.join(import.meta.dirname, '../fixtures/rule-files', name)

const baseArgs = { changed: false, base: 'main', format: 'terminal' as const, fresh: true }

let stderr: string[] = []
afterEach(() => {
  vi.restoreAllMocks()
  stderr = []
})
function capture(): void {
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    stderr.push(String(chunk))
    return true
  })
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
}

/** Subject lines (`path:line — element`) that appear more than once. */
function duplicated(report: string): string[] {
  const counts = new Map<string, number>()
  for (const line of report.split('\n')) {
    const t = line.trim()
    if (/\.ts:\d+ — /.test(t)) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([l]) => l)
}

describe('a preset enforcing at module scope', () => {
  it('reports each finding once, not twice', async () => {
    capture()
    await runCheck({ ...baseArgs, ruleFiles: [fixture('double-print-preset.rules.ts')] })
    const report = stderr.join('')

    // Non-vacuity first: this fixture must actually produce findings, or the
    // no-duplicates assertion below holds trivially.
    expect(report).toMatch(/Architecture Violation \[/)
    expect(duplicated(report)).toEqual([])
  })

  it('the summary accounts for every block it printed', async () => {
    capture()
    await runCheck({
      ...baseArgs,
      ruleFiles: [fixture('double-print-preset-summary.rules.ts')],
    })
    const report = stderr.join('')
    const blocks = (report.match(/Architecture Violation \[/g) ?? []).length
    expect(blocks).toBeGreaterThan(0)

    // The summary splits error-severity from warn-severity, so the two together
    // are what must equal the blocks on screen. Before the fix this read
    // `1 violation · 6 warnings` over THIRTEEN blocks, because six of them were
    // the preset's own duplicate print and nothing counted them.
    const errors = Number(/· (\d+) violations?/.exec(report)?.[1] ?? '0')
    const warnings = Number(/· (\d+) warnings?/.exec(report)?.[1] ?? '0')
    expect(errors + warnings).toBe(blocks)
  })
})
