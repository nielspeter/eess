/**
 * A rule file that contributes ZERO rules must not pass — bug filed from the
 * adopter review of PR #74.
 *
 * `CLAUDE.md` tells agents that "a zero or an unexpectedly low [denominator] means
 * the gate matched little or nothing — treat that as a red flag". `check` was
 * printing `✓ eess-ts — 0 rules across 1 file · 0 failing` and exiting 0 over
 * exactly that value, while `doctor` on the same file already errored with
 * "no rules found in the given files".
 *
 * Two commands in one CLI disagreeing about whether "no rules" is an error, and the
 * one wired into CI was the one blessing it.
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

describe('a rule file that contributes no rules', () => {
  it('fails instead of printing a green tick over zero rules', async () => {
    capture()
    const code = await runCheck({
      ...baseArgs,
      ruleFiles: [fixture('naive-migration-clean.rules.ts')],
    })
    const report = stderr.join('')
    expect(report).toContain('contributed no rules')
    expect(code).toBeGreaterThan(0)
  })

  /**
   * The discriminator: a file that DOES contribute rules must stay green. A fix
   * that failed whenever the run found no violations would satisfy the test above
   * and break every passing build.
   */
  it('stays green when the file does contribute rules and they all pass', async () => {
    capture()
    const code = await runCheck({
      ...baseArgs,
      ruleFiles: [fixture('naive-migration-clean-fixed.rules.ts')],
    })
    const report = stderr.join('')
    expect(report).not.toContain('contributed no rules')
    expect(report).toMatch(/— [1-9]\d* rules? across/)
    expect(code).toBe(0)
  })
})
