/**
 * Report aggregation lasts as long as the RUN, not the process.
 *
 * `runCheck` declares that it aggregates so a self-executing rule file's terminals
 * stay quiet. That declaration used to be a latch — `setCallerAggregatesReports(true)`
 * with nothing ever setting it back. Harmless while `executeCheck` was the only
 * reader, because the CLI wanted suppression for its whole life.
 *
 * It stopped being harmless the moment `deliver()` and `checkAll()` read it too
 * (bug 0203): a preset called directly, in a process that had already run
 * `runCheck` once, went permanently silent. Measured before the fix — **6
 * violation blocks before the run, 0 after**. It still threw, so nothing went
 * falsely green; what vanished was the report itself, the `Why:` and the `Fix:`,
 * with no signal that anything had been swallowed.
 *
 * The suite runs many tests in one process, so this is not a hypothetical shape —
 * it is the shape of this repo's own test files.
 */
import { describe, it, expect, vi } from 'vitest'
import path from 'node:path'
import { runCheck } from '../../src/cli/commands/check.js'
import { project } from '../../src/index.js'
import { recommended } from '../../src/presets/index.js'

const fixture = (name: string): string =>
  path.join(import.meta.dirname, '../fixtures/rule-files', name)
const POC = path.join(import.meta.dirname, '../fixtures/poc/tsconfig.json')

/** Violation blocks a direct preset call writes to stderr. */
function blocksFromDirectPreset(): number {
  const captured: string[] = []
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    captured.push(String(chunk))
    return true
  })
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  try {
    recommended(project(POC))
  } catch {
    // The default mode throws once it has emitted — that is the behaviour here.
  }
  vi.restoreAllMocks()
  return (captured.join('').match(/Architecture Violation \[/g) ?? []).length
}

describe('report aggregation is scoped to the run', () => {
  it('a direct preset call still reports after the CLI has run in the same process', async () => {
    const before = blocksFromDirectPreset()
    // Non-vacuity: if the preset stopped finding anything, the comparison below
    // would hold at 0 === 0 and prove nothing.
    expect(before).toBeGreaterThan(0)

    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    await runCheck({
      ruleFiles: [fixture('baselined-inline.rules.ts')],
      changed: false,
      base: 'main',
      format: 'terminal',
      fresh: true,
    })
    vi.restoreAllMocks()

    expect(blocksFromDirectPreset()).toBe(before)
  })
})
