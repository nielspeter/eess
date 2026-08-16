import { describe, it, expect, vi, afterEach } from 'vitest'
import { Project } from 'ts-morph'
import path from 'node:path'
import { runDoctor } from '../../src/cli/commands/doctor.js'
import { ClassRuleBuilder } from '../../src/builders/class-rule-builder.js'
import type { ArchProject } from '../../src/core/project.js'

vi.mock('../../src/cli/load-rules.js', () => ({
  loadRuleFiles: vi.fn(),
}))

import { loadRuleFiles } from '../../src/cli/load-rules.js'
import { ArchRuleError } from '@nielspeter/eess'

const mockLoadRuleFiles = vi.mocked(loadRuleFiles)

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures/poc')
const tsconfigPath = path.join(fixturesDir, 'tsconfig.json')

function loadTestProject(): ArchProject {
  const tsMorphProject = new Project({ tsConfigFilePath: tsconfigPath })
  return {
    tsConfigPath: tsconfigPath,
    _project: tsMorphProject,
    getSourceFiles: () => tsMorphProject.getSourceFiles(),
  }
}

/** A real rule (via the real `ClassRuleBuilder`) whose declared glob is dead. */
function deadGlobRule(): ClassRuleBuilder {
  return new ClassRuleBuilder(loadTestProject())
    .that()
    .resideInFolder('**/this-folder-does-not-exist-anywhere/**')
    .should()
    .beExported()
}

afterEach(() => {
  vi.restoreAllMocks()
  mockLoadRuleFiles.mockReset()
})

describe('runDoctor', () => {
  it('returns 1 when no rule files are given', async () => {
    const code = await runDoctor({ ruleFiles: [], format: 'terminal' })
    expect(code).toBe(1)
  })

  it('returns 0 and reports a clean bill of health when nothing is wrong', async () => {
    mockLoadRuleFiles.mockResolvedValue([{ check: (): void => {} }])
    const code = await runDoctor({ ruleFiles: ['rules.ts'], format: 'terminal' })
    expect(code).toBe(0)
  })

  it('returns 1 when a real rule declares a dead glob', async () => {
    mockLoadRuleFiles.mockResolvedValue([deadGlobRule()])
    const code = await runDoctor({ ruleFiles: ['rules.ts'], format: 'terminal' })
    expect(code).toBe(1)
  })

  it('prints the dead glob and its rule file to stderr', async () => {
    mockLoadRuleFiles.mockResolvedValue([deadGlobRule()])
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    await runDoctor({ ruleFiles: ['rules.ts'], format: 'terminal' })

    const output = writeSpy.mock.calls.map((c) => String(c[0])).join('')
    expect(output).toContain('this-folder-does-not-exist-anywhere')
    expect(output).toContain('rules.ts')
  })

  it('--format json emits a parseable document naming the finding', async () => {
    mockLoadRuleFiles.mockResolvedValue([deadGlobRule()])
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const code = await runDoctor({ ruleFiles: ['rules.ts'], format: 'json' })

    expect(code).toBe(1)
    const stdout = writeSpy.mock.calls.map((c) => String(c[0])).join('')
    const parsed = JSON.parse(stdout) as { findings: { kind: string }[]; loadFailures: unknown[] }
    expect(parsed.findings).toHaveLength(1)
    expect(parsed.findings[0]!.kind).toBe('dead-glob')
    expect(parsed.loadFailures).toEqual([])
  })

  it('reports a load failure and keeps diagnosing the remaining files', async () => {
    mockLoadRuleFiles
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([{ check: (): void => {} }])
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    const code = await runDoctor({ ruleFiles: ['bad.ts', 'good.ts'], format: 'terminal' })

    expect(code).toBe(1)
    expect(mockLoadRuleFiles).toHaveBeenCalledTimes(2)
    const output = writeSpy.mock.calls.map((c) => String(c[0])).join('')
    expect(output).toContain('bad.ts')
  })

  it('treats a self-executing ArchRuleError-throwing rule file distinctly from an ordinary load failure', async () => {
    mockLoadRuleFiles.mockRejectedValue(new ArchRuleError([]))
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    const code = await runDoctor({ ruleFiles: ['self-executing.ts'], format: 'terminal' })

    expect(code).toBe(1)
    const output = writeSpy.mock.calls.map((c) => String(c[0])).join('')
    expect(output).toContain('executes its rules at import')
  })

  it('returns 1 when a rule file loads but exports zero rules', async () => {
    mockLoadRuleFiles.mockResolvedValue([])
    const code = await runDoctor({ ruleFiles: ['empty.ts'], format: 'terminal' })
    expect(code).toBe(1)
  })
})
