import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { runCheck } from '../../src/cli/commands/check.js'

// Mock the load-rules module to avoid needing actual rule files
vi.mock('../../src/cli/load-rules.js', () => ({
  loadRuleFiles: vi.fn(),
}))

// Partial mock: only withBaseline is stubbed, everything else (ArchRuleError,
// reportViolations, formatViolationsJson, ...) is the real implementation.
vi.mock('@nielspeter/eess', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...(actual as object), withBaseline: vi.fn() }
})

import { loadRuleFiles } from '../../src/cli/load-rules.js'
import { ArchRuleError, withBaseline } from '@nielspeter/eess'
import type { ArchViolation } from '@nielspeter/eess'
import { project } from '../../src/index.js'
import { agentGuardrails } from '../../src/presets/agent-guardrails.js'

const mockLoadRuleFiles = vi.mocked(loadRuleFiles)
const mockWithBaseline = vi.mocked(withBaseline)

afterEach(() => {
  vi.restoreAllMocks()
  process.exitCode = undefined
})

describe('runCheck', () => {
  it('returns 0 when all rules pass', async () => {
    mockLoadRuleFiles.mockResolvedValue([{ check: () => undefined }])

    const failures = await runCheck({
      ruleFiles: ['rules.ts'],
      changed: false,
      base: 'main',
      format: 'terminal',
    })

    expect(failures).toBe(0)
  })

  it('returns failure count when rules fail', async () => {
    const failingBuilder = {
      check: () => {
        throw new ArchRuleError(
          [
            {
              rule: 'test',
              element: 'Foo',
              file: '/test.ts',
              line: 1,
              message: 'violation',
            },
          ],
          'test reason',
        )
      },
    }
    mockLoadRuleFiles.mockResolvedValue([failingBuilder])

    const failures = await runCheck({
      ruleFiles: ['rules.ts'],
      changed: false,
      base: 'main',
      format: 'terminal',
    })

    expect(failures).toBe(1)
  })

  it('reports a non-ArchRuleError as a configuration finding instead of crashing the run', async () => {
    // Bug 0025 class: this used to rethrow and abort the whole run, discarding
    // every other rule file's already-collected result. Reproduced against
    // this file 2026-08-15, fixed the same day (plan 0147).
    const badBuilder = {
      check: () => {
        throw new TypeError('unexpected error')
      },
    }
    mockLoadRuleFiles.mockResolvedValue([badBuilder])

    const failures = await runCheck({
      ruleFiles: ['rules.ts'],
      changed: false,
      base: 'main',
      format: 'terminal',
    })

    expect(failures).toBe(1)
  })

  it('keeps checking every other rule file after one fails to load', async () => {
    // The regression this test guards: a syntax error (or any throw) from
    // ONE rule file's import must not discard the others' already-collected
    // findings — the whole point of bug 0025.
    const passing = { check: () => undefined }
    const failing = {
      check: () => {
        throw new ArchRuleError(
          [{ rule: 'r', element: 'e', file: '/x.ts', line: 1, message: 'violation' }],
          'reason',
        )
      },
    }
    mockLoadRuleFiles.mockImplementation((files: string[]) => {
      if (files[0] === 'bad.rules.ts') throw new SyntaxError('Unexpected token')
      if (files[0] === 'a.rules.ts') return Promise.resolve([passing])
      if (files[0] === 'c.rules.ts') return Promise.resolve([failing])
      return Promise.resolve([])
    })

    const failures = await runCheck({
      ruleFiles: ['a.rules.ts', 'bad.rules.ts', 'c.rules.ts'],
      changed: false,
      base: 'main',
      format: 'terminal',
    })

    // 1 for the file that could not load, 1 for the file whose rule failed —
    // both counted, neither discarded the other.
    expect(failures).toBe(2)
  })

  it('counts multiple failing rules independently', async () => {
    const makeFailingBuilder = () => ({
      check: () => {
        throw new ArchRuleError([
          { rule: 'test', element: 'X', file: '/x.ts', line: 1, message: 'fail' },
        ])
      },
    })
    const passingBuilder = { check: () => undefined }
    mockLoadRuleFiles.mockResolvedValue([
      makeFailingBuilder(),
      passingBuilder,
      makeFailingBuilder(),
    ])

    const failures = await runCheck({
      ruleFiles: ['rules.ts'],
      changed: false,
      base: 'main',
      format: 'terminal',
    })

    expect(failures).toBe(2)
  })

  it('WIRING: a location-less finding is attributed to its rule file', async () => {
    // attributeToRuleFile is unit-tested on its own; this is the other half —
    // sabotage would prove it missing here if this test didn't exist, because
    // every assertion about the attribution was otherwise made against the
    // function rather than against the command that has to call it.
    const reported: string[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      reported.push(String(chunk))
      return true
    })
    mockLoadRuleFiles.mockResolvedValue([
      {
        check: () => undefined,
        violations: () => [
          {
            rule: 'x/vacuous',
            element: 'x/vacuous',
            file: '',
            line: 0,
            message: 'this rule asserts nothing and can never fail',
            bypassFilters: true,
          },
        ],
      },
    ])
    const failures = await runCheck({
      ruleFiles: ['rules/mine.rules.ts'],
      changed: false,
      base: 'main',
      format: 'terminal',
    })
    expect(failures).toBe(1)
    expect(reported.join('')).toContain('rules/mine.rules.ts')
  })

  it('emits ONE JSON document for a multi-builder run (agent-loop contract)', async () => {
    // The bug this guards: calling each builder's own .check() individually
    // reports (and for JSON, writes) per builder, so N failing rules
    // concatenate N separate {summary, violations} documents on stdout — not
    // valid JSON as a whole, and exactly what `explain --format agent`'s own
    // generated instructions tell an agent to JSON.parse().
    const spy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    mockLoadRuleFiles.mockResolvedValue([
      {
        check: () => undefined,
        violations: () => [{ rule: 'r1', element: 'A', file: '/a.ts', line: 1, message: 'bad A' }],
      },
      {
        check: () => undefined,
        violations: () => [{ rule: 'r2', element: 'B', file: '/b.ts', line: 2, message: 'bad B' }],
      },
    ])

    const count = await runCheck({
      ruleFiles: ['rules.ts'],
      changed: false,
      base: 'main',
      format: 'json',
    })

    expect(count).toBe(2)
    expect(spy).toHaveBeenCalledTimes(1) // single write, not per-builder
    const output = String(spy.mock.calls[0]?.[0])
    const parsed = JSON.parse(output) as {
      summary: { total: number }
      violations: unknown[]
    }
    expect(parsed.summary.total).toBe(2)
    expect(parsed.violations).toHaveLength(2)
  })

  it('--format json emits a valid document even on a clean run (agent contract)', async () => {
    const spy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    mockLoadRuleFiles.mockResolvedValue([{ check: () => undefined, violations: () => [] }])

    const count = await runCheck({
      ruleFiles: ['rules.ts'],
      changed: false,
      base: 'main',
      format: 'json',
    })

    expect(count).toBe(0)
    expect(spy).toHaveBeenCalledTimes(1)
    const parsed = JSON.parse(String(spy.mock.calls[0]?.[0])) as {
      summary: { total: number }
      violations: unknown[]
    }
    expect(parsed.summary.total).toBe(0)
    expect(parsed.violations).toEqual([])
  })

  it('applies the baseline to the unified list before computing the exit code', async () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    // Baseline that suppresses the known violation, leaving only the new one.
    mockWithBaseline.mockReturnValue({
      filterNew: (vs: ArchViolation[]) => vs.filter((v) => v.element !== 'Known'),
    } as unknown as ReturnType<typeof withBaseline>)
    mockLoadRuleFiles.mockResolvedValue([
      {
        check: () => undefined,
        violations: () => [
          { rule: 'r', element: 'Known', file: '/x.ts', line: 1, message: 'known' },
        ],
      },
      {
        check: () => undefined,
        violations: () => [{ rule: 'r', element: 'New', file: '/x.ts', line: 2, message: 'new' }],
      },
    ])

    const count = await runCheck({
      ruleFiles: ['rules.ts'],
      changed: false,
      base: 'main',
      format: 'terminal',
      baseline: 'baseline.json',
    })

    expect(count).toBe(1) // Known filtered out by baseline, only New fails
  })

  // --- --fix (plan 0066) ---
  describe('--fix', () => {
    it('dry-run reports fixable violations without writing, returns 0 remaining', async () => {
      const f = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-cli-fix-'))
      const file = path.join(f, 'doc.md')
      fs.writeFileSync(file, 'see OLD here')
      mockLoadRuleFiles.mockResolvedValue([
        {
          check: () => undefined,
          violations: () => [
            {
              rule: 'r',
              element: 'e',
              file,
              line: 1,
              message: 'broken',
              fix: { file, start: 4, end: 7, replacement: 'NEW', describe: 'OLD→NEW' },
            },
          ],
        },
      ])
      const remaining = await runCheck({
        ruleFiles: ['rules.ts'],
        changed: false,
        base: 'main',
        format: 'terminal',
        fix: true,
      })
      expect(remaining).toBe(0)
      expect(fs.readFileSync(file, 'utf8')).toBe('see OLD here') // dry-run: untouched
      fs.rmSync(f, { recursive: true, force: true })
    })

    it('--apply writes the fix', async () => {
      const f = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-cli-fix-'))
      const file = path.join(f, 'doc.md')
      fs.writeFileSync(file, 'see OLD here')
      mockLoadRuleFiles.mockResolvedValue([
        {
          check: () => undefined,
          violations: () => [
            {
              rule: 'r',
              element: 'e',
              file,
              line: 1,
              message: 'broken',
              fix: { file, start: 4, end: 7, replacement: 'NEW', describe: 'OLD→NEW' },
            },
          ],
        },
      ])
      await runCheck({
        ruleFiles: ['rules.ts'],
        changed: false,
        base: 'main',
        format: 'terminal',
        fix: true,
        apply: true,
      })
      expect(fs.readFileSync(file, 'utf8')).toBe('see NEW here')
      fs.rmSync(f, { recursive: true, force: true })
    })

    it('counts violations with no fix as remaining failures', async () => {
      mockLoadRuleFiles.mockResolvedValue([
        {
          check: () => undefined,
          violations: () => [
            { rule: 'r', element: 'e', file: 'x', line: 1, message: 'no fix here' },
          ],
        },
      ])
      const remaining = await runCheck({
        ruleFiles: ['rules.ts'],
        changed: false,
        base: 'main',
        format: 'terminal',
        fix: true,
        apply: true,
      })
      expect(remaining).toBe(1)
    })
  })

  describe('dedupeConfigFindings wiring (plan 0147 Phase 4)', () => {
    it('collapses two identical-shaped bypassFilters findings from the same rule file into one', async () => {
      // A real fan-out, not a fabricated shape: agentGuardrails() called
      // twice in one rule file, neither call enabling any capability, both
      // producing the SAME presetConstructsNothingViolation() finding
      // (same rule, same element, and — post attributeToRuleFile — the same
      // file). Two edits with the identical mistake collapse to one report.
      const tsconfigPath = path.resolve(import.meta.dirname, '../fixtures/poc/tsconfig.json')
      const p = project(tsconfigPath)

      // `report: 'return'` — the default is `'throw'`, which would make the
      // FIRST call abort before the second ever runs (JS evaluates array
      // elements left to right), so only `{ report: 'return' }` actually
      // produces the two-finding fan-out this test exercises.
      mockLoadRuleFiles.mockResolvedValue([
        {
          check: () => undefined,
          violations: () => [
            ...agentGuardrails(p, { src: '**/a/**', report: 'return' }),
            ...agentGuardrails(p, { src: '**/b/**', report: 'return' }),
          ],
        },
      ])

      const spy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
      const failures = await runCheck({
        ruleFiles: ['rules.ts'],
        changed: false,
        base: 'main',
        format: 'json',
      })

      expect(failures).toBe(1)
      const written = spy.mock.calls.map((c) => String(c[0])).join('')
      const parsed = JSON.parse(written) as { violations: { message: string; file: string }[] }
      expect(parsed.violations).toHaveLength(1)
      expect(parsed.violations[0]!.file).toBe('rules.ts')
      expect(parsed.violations[0]!.message).toContain('This one option generated 2 rules')
    })
  })
})
