/**
 * Suppressing emission under an aggregating caller must lose nothing.
 *
 * ADR-008's amendment names the invariant every emitter has to satisfy:
 * **suppress exactly what rides the throw, and nothing else.** `checkAll()` throws
 * only the error-severity subset, so its warn-severity findings ride nothing — a
 * guard that suppresses all violations deletes them.
 *
 * Measured before the fix: four warn findings produced and discarded, under
 * `✓ eess-ts — 4 rules across 1 file · 0 failing`, exit 0. A fake green arriving
 * through the CLI of the package that exists to prevent them.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { runCheck } from '../../src/cli/commands/check.js'

const fixture = (name: string): string =>
  path.join(import.meta.dirname, '../fixtures/rule-files', name)

let stderr: string[] = []
afterEach(() => {
  vi.restoreAllMocks()
  stderr = []
})

describe('checkAll() under an aggregating caller', () => {
  it('still reports warn-severity findings, which ride no throw', async () => {
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr.push(String(chunk))
      return true
    })
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    await runCheck({
      ruleFiles: [fixture('checkall-warn-only.rules.ts')],
      changed: false,
      base: 'main',
      format: 'terminal',
      fresh: true,
    })
    vi.restoreAllMocks()

    const report = stderr.join('')
    // The four `parse*` functions in the poc fixture, each named on its own
    // subject line. A COUNT rather than a presence check, so a duplicate print
    // fails this too — losing them and printing them twice are both wrong.
    //
    // Counted by subject line rather than by violation block, because the run
    // legitimately carries one more finding: this fixture has no default export,
    // so it contributes no rules and bug 0204's producer fires. That is correct
    // and unrelated.
    const subjects = report.split('\n').filter((l) => /\.ts:\d+ — parse/.test(l.trim()))
    expect(subjects).toHaveLength(4)
    expect(report).toContain('parseFooOrder')
  })

  /**
   * The other half: that warn write is output the CLI could not filter, so the
   * "your filters did not apply" notice is owed — and this is the ONLY path in the
   * suite that flows through the DIALECT's `writeReport`. Every other leak goes
   * through the kernel's `reportViolations`, so without this test deleting the
   * dialect counter's increment leaves the whole suite green (measured: margin 0).
   */
  it('owes the unfiltered-output notice, since the warn write bypasses the filter', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-checkall-warn-'))
    try {
      const baselinePath = path.join(dir, 'arch-baseline.json')
      fs.writeFileSync(
        baselinePath,
        JSON.stringify({ generatedAt: '', hashVersion: 5, root: '.', count: 0, violations: [] }),
      )
      vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
        stderr.push(String(chunk))
        return true
      })
      vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
      await runCheck({
        ruleFiles: [fixture('checkall-warn-leaks-under-baseline.rules.ts')],
        baseline: baselinePath,
        changed: false,
        base: 'main',
        format: 'terminal',
        fresh: true,
      })
      vi.restoreAllMocks()

      const report = stderr.join('')
      // The warn findings really were written — otherwise the notice below would
      // be owed for nothing.
      expect(report).toContain('parseFooOrder')
      expect(report).toMatch(/was not applied|could not be applied/i)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
