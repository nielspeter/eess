import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { runCheck } from '../../src/cli/commands/check.js'

// Mock the load-rules module to avoid needing actual rule files
vi.mock('../../src/cli/load-rules.js', () => ({
  loadRuleFiles: vi.fn(),
}))

import { loadRuleFiles } from '../../src/cli/load-rules.js'
import { ArchRuleError } from '@nielspeter/eess'

const mockLoadRuleFiles = vi.mocked(loadRuleFiles)

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

  it('re-throws non-ArchRuleError errors', async () => {
    const badBuilder = {
      check: () => {
        throw new TypeError('unexpected error')
      },
    }
    mockLoadRuleFiles.mockResolvedValue([badBuilder])

    await expect(
      runCheck({
        ruleFiles: ['rules.ts'],
        changed: false,
        base: 'main',
        format: 'terminal',
      }),
    ).rejects.toThrow(TypeError)
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
})
