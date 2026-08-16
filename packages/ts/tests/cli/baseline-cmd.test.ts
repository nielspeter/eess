import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { runBaseline } from '../../src/cli/commands/baseline.js'

// Mock load-rules to return controllable builders
vi.mock('../../src/cli/load-rules.js', () => ({
  loadRuleFiles: vi.fn(),
}))

import { loadRuleFiles } from '../../src/cli/load-rules.js'
import { ArchRuleError } from '@nielspeter/eess'

const mockLoadRuleFiles = vi.mocked(loadRuleFiles)

let tmpDir: string | undefined

function createTmpDir(): string {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-ts-cli-baseline-'))
  return tmpDir
}

afterEach(() => {
  vi.restoreAllMocks()
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true })
    tmpDir = undefined
  }
})

describe('runBaseline', () => {
  it('generates a baseline file', async () => {
    const dir = createTmpDir()
    const outputPath = path.join(dir, 'baseline.json')

    // Builder that throws an ArchRuleError with one violation
    const builder = {
      check: () => {
        throw new ArchRuleError([
          {
            rule: 'test rule',
            element: 'TestClass',
            file: '/src/test.ts',
            line: 10,
            message: 'test violation',
          },
        ])
      },
    }
    mockLoadRuleFiles.mockResolvedValue([builder])

    const code = await runBaseline({ ruleFiles: ['rules.ts'], output: outputPath })

    expect(fs.existsSync(outputPath)).toBe(true)
    const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8')) as {
      count: number
      violations: unknown[]
    }
    expect(content.count).toBe(1)
    expect(content.violations).toHaveLength(1)
    expect(code).toBe(0) // ordinary, baseline-eligible violation — not a blocker
  })

  it('keeps collecting from every other rule file after one fails to load', async () => {
    // Same bug-0025 class as check.ts: a syntax error in one rule file used
    // to reject the whole loadRuleFiles(...) call and produce no baseline
    // at all, discarding every other file's violations too.
    const dir = createTmpDir()
    const outputPath = path.join(dir, 'baseline.json')
    const builder = {
      check: () => {
        throw new ArchRuleError([{ rule: 'r', element: 'e', file: '/x.ts', line: 1, message: 'm' }])
      },
    }
    mockLoadRuleFiles.mockImplementation((files: string[]) => {
      if (files[0] === 'bad.rules.ts') throw new SyntaxError('Unexpected token')
      return Promise.resolve([builder])
    })

    const code = await runBaseline({
      ruleFiles: ['a.rules.ts', 'bad.rules.ts', 'c.rules.ts'],
      output: outputPath,
    })

    const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8')) as { violations: unknown[] }
    // a.rules.ts and c.rules.ts each contribute one real, baseline-eligible
    // violation. bad.rules.ts's own configuration finding correctly does NOT
    // appear here — generateBaseline already refuses to baseline anything
    // carrying bypassFilters (a broken rule file is never "known debt"). The
    // real assertion is that a.rules.ts and c.rules.ts got a chance to
    // contribute at all — zero would mean the old crash-the-whole-run defect
    // is back.
    expect(content.violations).toHaveLength(2)
    // But the run is NOT clean: bad.rules.ts's own load failure is a
    // bypassFilters finding that could not be baselined, so the command must
    // say so via a non-zero exit code — not silently succeed while leaving a
    // blocker for the next CI run to discover.
    expect(code).toBe(1)
  })

  it('reports violation count to stdout', async () => {
    const dir = createTmpDir()
    const outputPath = path.join(dir, 'baseline.json')
    const chunks: string[] = []
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      chunks.push(String(chunk))
      return true
    })

    // No violations — builder passes
    mockLoadRuleFiles.mockResolvedValue([{ check: () => undefined }])

    const code = await runBaseline({ ruleFiles: ['rules.ts'], output: outputPath })

    const output = chunks.join('')
    expect(output).toContain('0 violations')
    expect(code).toBe(0)
    writeSpy.mockRestore()
  })

  it('exits non-zero and lists what could not be baselined (config findings are never "known debt")', async () => {
    // Bug-0029-class parity with `check.ts`: exiting 0 here would mean
    // `npm run arch:baseline` reported the blocker, "succeeded", got
    // committed, and the next `arch` job failed on findings the baseline was
    // supposed to have covered.
    const dir = createTmpDir()
    const outputPath = path.join(dir, 'baseline.json')
    const chunks: string[] = []
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      chunks.push(String(chunk))
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

    const code = await runBaseline({ ruleFiles: ['rules/mine.rules.ts'], output: outputPath })

    expect(code).toBe(1)
    const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8')) as { violations: unknown[] }
    expect(content.violations).toHaveLength(0) // refused, never written
    const output = chunks.join('')
    expect(output).toContain('could NOT be baselined')
    expect(output).toContain('rules/mine.rules.ts')
    writeSpy.mockRestore()
  })
})
