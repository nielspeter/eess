import { describe, it, expect, vi, afterEach } from 'vitest'
import { Project } from 'ts-morph'
import path from 'node:path'
import type { ArchProject } from '../../src/core/project.js'
import { ArchRuleError } from '@nielspeter/eess'
import { recommended } from '../../src/presets/recommended.js'

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

describe('recommended preset (plan 0071)', () => {
  const p = loadTestProject()

  it('returns the error-severity violations without throwing (report: return)', () => {
    const violations = recommended(p, { include: '**/violations.ts', report: 'return' })
    const rules = violations.map((v) => v.ruleId)
    expect(rules).toContain('preset/recommended/no-eval')
    expect(rules).toContain('preset/recommended/no-function-constructor')
    // warn rules (silent-catch, empty-bodies) are reported, not aggregated
    expect(rules).not.toContain('preset/recommended/no-silent-catch')
  })

  it('threads rule metadata onto the violation (because comes from the preset meta)', () => {
    const [first] = recommended(p, { include: '**/violations.ts', report: 'return' })
    expect(first?.ruleId).toBe('preset/recommended/no-eval')
    expect(first?.because).toContain('eval()')
  })

  it('is clean on a healthy file', () => {
    const violations = recommended(p, { include: '**/clean.ts', report: 'return' })
    expect(violations).toHaveLength(0)
  })

  it('throws by default when an error rule fires', () => {
    const err = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    expect(() => recommended(p, { include: '**/violations.ts' })).toThrow(ArchRuleError)
    expect(err).toHaveBeenCalled()
  })

  it('override to off suppresses a rule', () => {
    const violations = recommended(p, {
      include: '**/violations.ts',
      report: 'return',
      overrides: { 'preset/recommended/no-eval': 'off' },
    })
    expect(violations.map((v) => v.ruleId)).not.toContain('preset/recommended/no-eval')
  })

  it('override a warn rule to error surfaces it in the returned set', () => {
    const violations = recommended(p, {
      include: '**/violations.ts',
      report: 'return',
      overrides: { 'preset/recommended/no-silent-catch': 'error' },
    })
    expect(violations.map((v) => v.ruleId)).toContain('preset/recommended/no-silent-catch')
  })
})
