/**
 * An unknown `report` mode fails `eess-ts check` — bug 0508.
 *
 * `deliver` handles `'builders'` itself and hands any other mode to the kernel's
 * `finishPreset`, which compared it with `'return'` and `'throw'` only. A misspelt
 * mode fell through both: the preset printed its violations, threw nothing, and
 * the CLI exited 0. Driven through `runCheck` so the exit code is what is measured.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import path from 'node:path'
import { runCheck } from '../../src/cli/commands/check.js'

const fixture = (name: string): string =>
  path.join(import.meta.dirname, '../fixtures/rule-files', name)

const baseArgs = { changed: false, base: 'main', format: 'terminal' as const, fresh: true }

afterEach(() => vi.restoreAllMocks())

describe('a preset given an unknown report mode', () => {
  it('fails eess-ts check and names the mode', async () => {
    const stderr: string[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr.push(String(chunk))
      return true
    })
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const code = await runCheck({
      ...baseArgs,
      ruleFiles: [fixture('unknown-report-mode.rules.ts')],
    })
    expect(code).not.toBe(0)
    expect(stderr.join('')).toMatch(/report: 'thorw' is not a report mode/)
  })
})
