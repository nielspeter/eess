import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { run } from '../../src/cli/index.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const passing = path.resolve(here, '../fixtures/rules/passing.rules.ts')
const failing = path.resolve(here, '../fixtures/rules/failing.rules.ts')

interface CapturedOutput {
  stdout: string
  stderr: string
  exitCode: number | undefined
}

async function runCli(args: string[]): Promise<CapturedOutput> {
  const stdout: string[] = []
  const stderr: string[] = []
  const stdoutSpy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: string | Uint8Array): boolean => {
      stdout.push(typeof chunk === 'string' ? chunk : chunk.toString())
      return true
    })
  const errSpy = vi.spyOn(console, 'error').mockImplementation((...parts: unknown[]) => {
    stderr.push(parts.map((p) => String(p)).join(' '))
  })
  const prevExitCode = process.exitCode
  process.exitCode = undefined
  try {
    await run(args)
    return {
      stdout: stdout.join(''),
      stderr: stderr.join('\n'),
      exitCode: process.exitCode,
    }
  } finally {
    stdoutSpy.mockRestore()
    errSpy.mockRestore()
    process.exitCode = prevExitCode
  }
}

describe('eess-mermaid CLI', () => {
  beforeEach(() => {
    process.exitCode = undefined
  })
  afterEach(() => {
    process.exitCode = undefined
  })

  it('prints help with --help', async () => {
    const out = await runCli(['--help'])
    expect(out.stdout).toContain('eess-mermaid — Architecture testing for Mermaid diagrams')
    expect(out.stdout).toContain('eess-mermaid check')
    expect(out.stdout).toContain('eess-mermaid explain')
  })

  it('prints version with --version', async () => {
    const out = await runCli(['--version'])
    expect(out.stdout).toMatch(/\d+\.\d+\.\d+/)
  })

  it('errors when no command is given', async () => {
    const out = await runCli([])
    expect(out.exitCode).toBe(1)
    expect(out.stderr).toContain('No command specified')
  })

  it('errors on unknown command', async () => {
    const out = await runCli(['nuke'])
    expect(out.exitCode).toBe(1)
    expect(out.stderr).toContain('Unknown command')
  })

  it('check passes for a clean rule file (exit code 0)', async () => {
    const out = await runCli(['check', '--format', 'json', passing])
    expect(out.exitCode).toBeFalsy()
  })

  it('check fails for a violating rule file (exit code 1)', async () => {
    const out = await runCli(['check', '--format', 'json', failing])
    expect(out.exitCode).toBe(1)
  })

  it('explain dumps rules as JSON', async () => {
    const out = await runCli(['explain', passing])
    expect(out.exitCode).toBeFalsy()
    const parsed = JSON.parse(out.stdout) as { rules: { id?: string }[] }
    expect(parsed.rules.length).toBeGreaterThan(0)
    expect(parsed.rules.map((r) => r.id)).toContain('arch/services-extend-base')
  })

  it('explain --markdown emits a markdown table', async () => {
    const out = await runCli(['explain', '--markdown', passing])
    expect(out.exitCode).toBeFalsy()
    expect(out.stdout).toContain('| ID | Rule |')
    expect(out.stdout).toContain('arch/services-extend-base')
  })

  it('rejects --watch without check', async () => {
    const out = await runCli(['--watch', 'explain', passing])
    expect(out.exitCode).toBe(1)
    expect(out.stderr).toContain('--watch is only supported')
  })
})
