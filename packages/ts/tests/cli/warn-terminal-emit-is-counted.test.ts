/**
 * A rule-level `.warn()` emits output no CLI-side filter can reach, and the run
 * must say so.
 *
 * `executeWarn` writes its advisory violations directly — `writeStderr`, not
 * `writeReport` — so neither emission counter moved, and `baselineNotApplied`'s
 * `leaked` conjunct computed **false** over a run in which output genuinely leaked.
 * Measured: the warn findings printed, the notice did not fire.
 *
 * That is bug 0199's false negative reopened through the one emitter a comment in
 * `execute-rule.ts` claimed was already counted. A silence built on a blind spot,
 * which is worse than the wrong claim it replaced, because the run says nothing.
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

describe('a rule-level .warn() under a CLI-side filter', () => {
  it('is counted as emitted, so the unfiltered-output notice fires', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-warnemit-'))
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
        ruleFiles: [fixture('warn-terminal-leaks.rules.ts')],
        baseline: baselinePath,
        changed: false,
        base: 'main',
        format: 'terminal',
        fresh: true,
      })
      vi.restoreAllMocks()

      const report = stderr.join('')
      // The leak is real — the advisory findings reached the user unfiltered.
      expect(report).toContain('parseFooOrder')
      // ...so the notice is owed. This is the assertion that was false.
      expect(report).toMatch(/was not applied|could not be applied/i)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
