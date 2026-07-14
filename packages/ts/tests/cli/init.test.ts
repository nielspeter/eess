import { describe, it, expect, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runInit } from '../../src/cli/commands/init.js'

const tmpDirs: string[] = []

/** Fresh temp project dir with a tsconfig; returns the dir. */
function tmpProject(tsconfig: Record<string, unknown> = { include: ['src'] }): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-init-'))
  tmpDirs.push(dir)
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2))
  return dir
}

const read = (dir: string, name: string): string => fs.readFileSync(path.join(dir, name), 'utf-8')
const exists = (dir: string, name: string): boolean => fs.existsSync(path.join(dir, name))

afterEach(() => {
  vi.restoreAllMocks()
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop()
    if (dir !== undefined) fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('eess-ts init (plan 0071)', () => {
  it('writes config, rules, and baseline; returns 0', () => {
    const dir = tmpProject()
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    const code = runInit({ cwd: dir })
    expect(code).toBe(0)
    expect(exists(dir, 'eess-ts.config.ts')).toBe(true)
    expect(exists(dir, 'arch.rules.ts')).toBe(true)
    expect(exists(dir, 'arch-baseline.json')).toBe(true)
  })

  it('generates a builder-based rule file (not an eager preset spread)', () => {
    const dir = tmpProject()
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    runInit({ cwd: dir })
    const rules = read(dir, 'arch.rules.ts')
    // Builder form the CLI can load — functions(p)...satisfy(...).rule(...)
    expect(rules).toContain('functions(p).that().resideInFile(include).should()')
    expect(rules).toContain('preset/recommended/no-eval')
    expect(rules).toContain("imperative: 'Do NOT call eval()'")
    // NOT the eager spread form that eess's loader rejects
    expect(rules).not.toContain('...recommended(')
  })

  it('--preset agent-guardrails scaffolds the guardrail builders', () => {
    const dir = tmpProject()
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    runInit({ cwd: dir, preset: 'agent-guardrails' })
    const rules = read(dir, 'arch.rules.ts')
    expect(rules).toContain('preset/agent/no-generic-errors')
    expect(rules).toContain('smells.duplicateBodies(p)')
  })

  it('rejects an unknown preset with exit code 1', () => {
    const dir = tmpProject()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(runInit({ cwd: dir, preset: 'layered' })).toBe(1)
    expect(exists(dir, 'arch.rules.ts')).toBe(false)
  })

  it('errors when the tsconfig is missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-init-'))
    tmpDirs.push(dir)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(runInit({ cwd: dir })).toBe(1)
  })

  it('refuses to overwrite without --force, succeeds with it', () => {
    const dir = tmpProject()
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(runInit({ cwd: dir })).toBe(0)
    expect(runInit({ cwd: dir })).toBe(1) // conflict
    expect(runInit({ cwd: dir, force: true })).toBe(0)
  })

  it('--dry-run writes nothing', () => {
    const dir = tmpProject()
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    expect(runInit({ cwd: dir, dryRun: true })).toBe(0)
    expect(exists(dir, 'arch.rules.ts')).toBe(false)
  })

  it('--no-baseline omits the baseline file and config field', () => {
    const dir = tmpProject()
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    runInit({ cwd: dir, noBaseline: true })
    expect(exists(dir, 'arch-baseline.json')).toBe(false)
    expect(read(dir, 'eess-ts.config.ts')).not.toContain('baseline:')
  })

  it('detects the source root from tsconfig include and scopes the glob', () => {
    const dir = tmpProject({ include: ['lib'] })
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    runInit({ cwd: dir })
    expect(read(dir, 'arch.rules.ts')).toContain("const include = '**/lib/**'")
  })

  it('skips a file-like include entry and picks the real source dir', () => {
    // A common shape: a config file listed before the source glob. Picking the
    // file would scaffold a glob matching nothing (a vacuous rule set).
    const dir = tmpProject({ include: ['vite.config.ts', 'src/**/*.ts'] })
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    runInit({ cwd: dir })
    const rules = read(dir, 'arch.rules.ts')
    expect(rules).toContain("const include = '**/src/**'")
    expect(rules).not.toContain('vite.config.ts')
  })

  it('falls back to src on a malformed (unparseable) tsconfig', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-init-'))
    tmpDirs.push(dir)
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{ this is not json')
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    expect(runInit({ cwd: dir })).toBe(0)
    expect(read(dir, 'arch.rules.ts')).toContain("const include = '**/src/**'")
  })

  it('preserves a minified package.json (no full-file reformat)', () => {
    const dir = tmpProject()
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"demo","version":"1.0.0"}')
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    runInit({ cwd: dir })
    const raw = read(dir, 'package.json')
    expect(raw).not.toContain('\n') // stayed single-line
    expect(raw).toContain('"arch":"eess-ts check"')
  })

  it('merges arch scripts into an existing package.json', () => {
    const dir = tmpProject()
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'demo', scripts: { build: 'tsc' } }, null, 2),
    )
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    runInit({ cwd: dir })
    const pkg: unknown = JSON.parse(read(dir, 'package.json'))
    const scripts =
      pkg !== null && typeof pkg === 'object' && 'scripts' in pkg
        ? (pkg.scripts as Record<string, string>)
        : {}
    expect(scripts['arch']).toBe('eess-ts check')
    expect(scripts['arch:baseline']).toBe('eess-ts baseline')
    expect(scripts['build']).toBe('tsc') // preserved
  })
})
