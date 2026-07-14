import { describe, it, expect, vi, afterEach } from 'vitest'
import { Project } from 'ts-morph'
import path from 'node:path'
import type { ArchProject } from '../../src/core/project.js'
import { ArchRuleError } from '@nielspeter/eess'
import { agentGuardrails } from '../../src/presets/agent-guardrails.js'

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures/presets/agent')
const tsconfigPath = path.join(fixturesDir, 'tsconfig.json')

function loadTestProject(): ArchProject {
  const tsMorphProject = new Project({ tsConfigFilePath: tsconfigPath })
  return {
    tsConfigPath: tsconfigPath,
    _project: tsMorphProject,
    getSourceFiles: () => tsMorphProject.getSourceFiles(),
  }
}

afterEach(() => vi.restoreAllMocks())

describe('agentGuardrails preset (plan 0071)', () => {
  const p = loadTestProject()
  const src = '**/violations.ts'

  it('detects generic errors, stubs, and empty bodies (report: return)', () => {
    const violations = agentGuardrails(p, {
      src,
      report: 'return',
      noGenericErrors: true,
      noStubs: true,
      noEmptyBodies: true,
    })
    const rules = violations.map((v) => v.ruleId)
    expect(rules).toContain('preset/agent/no-generic-errors')
    expect(rules).toContain('preset/agent/no-stubs')
    expect(rules).toContain('preset/agent/no-empty-bodies')
  })

  it('generates one no-inline-logic rule per banned call name', () => {
    const violations = agentGuardrails(p, {
      src,
      report: 'return',
      noInlineLogic: ['eval'],
    })
    expect(violations.map((v) => v.ruleId)).toContain('preset/agent/no-inline-logic/eval')
  })

  it('copy-paste is a warn — reported, not aggregated by default', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const violations = agentGuardrails(p, { src, report: 'return', noCopyPaste: true })
    expect(violations.map((v) => v.ruleId)).not.toContain('preset/agent/no-copy-paste')
    expect(warnSpy).toHaveBeenCalled()
  })

  it('override raises copy-paste to error so it aggregates', () => {
    const violations = agentGuardrails(p, {
      src,
      report: 'return',
      noCopyPaste: true,
      overrides: { 'preset/agent/no-copy-paste': 'error' },
    })
    expect(violations.map((v) => v.ruleId)).toContain('preset/agent/no-copy-paste')
  })

  it('throws by default when an error rule fires', () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    expect(() => agentGuardrails(p, { src, noGenericErrors: true })).toThrow(ArchRuleError)
  })

  it('is clean on a healthy file', () => {
    const violations = agentGuardrails(p, {
      src: '**/clean.ts',
      report: 'return',
      noGenericErrors: true,
      noStubs: true,
      noEmptyBodies: true,
      noCopyPaste: true,
    })
    expect(violations).toHaveLength(0)
  })
})
