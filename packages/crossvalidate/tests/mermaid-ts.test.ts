import { afterEach, describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ArchRuleError } from '@nielspeter/eess'
import { project } from '@nielspeter/eess-ts'
import { diagram } from '@nielspeter/eess-mermaid'
import { diagramMatchesCode } from '../src/mermaid-ts.js'

const calc = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/calc')
const tsProject = () => project(join(calc, 'tsconfig.json'))
const mmd = (name: string) => diagram(readFileSync(join(calc, name), 'utf8'))

describe('diagramMatchesCode() — Mermaid↔TS', () => {
  it('stage 6: passes when the diagram and code agree', () => {
    expect(() => diagramMatchesCode(mmd('complete.mmd'), tsProject())).not.toThrow()
  })

  it('stage 7: fails when code has a class missing from the diagram', () => {
    // ModuloOperation exists in src/ but not in drift.mmd — the payoff moment
    let err: unknown
    try {
      diagramMatchesCode(mmd('drift.mmd'), tsProject())
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(ArchRuleError)
    const messages = (err as ArchRuleError).violations.map((v) => v.message).join('\n')
    expect(messages).toMatch(/TS class "ModuloOperation" has no matching diagram class/)
  })

  it('left-to-right only: ignores extra code classes', () => {
    // drift.mmd is missing ModuloOperation, but left-to-right only checks
    // that every DIAGRAM class exists in code — which it does
    expect(() =>
      diagramMatchesCode(mmd('drift.mmd'), tsProject(), { completeness: 'left-to-right' }),
    ).not.toThrow()
  })
})

// Bug 0097: the preset ended in `.check()`, so a caller could not ask for its findings; it now
// finishes through `finishPreset`, as every other preset does (ADR-008).
describe('diagramMatchesCode() — the caller owns reporting (bug 0097)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('with report: return, hands the findings back and writes nothing', () => {
    const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const v = diagramMatchesCode(mmd('drift.mmd'), tsProject(), { report: 'return' })
    expect(v.map((x) => x.message)).toEqual([
      expect.stringMatching(/TS class "ModuloOperation" has no matching diagram class/),
    ])
    expect(v.examined).toBe(5)
    expect(err).not.toHaveBeenCalled()
    expect(out).not.toHaveBeenCalled()
  })

  it('without options, prints the findings once and throws with the rule reason', () => {
    const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    expect(() => diagramMatchesCode(mmd('drift.mmd'), tsProject())).toThrow(
      'Architecture violation (1 found) — the diagram and the code must agree on which classes exist',
    )
    expect(err).toHaveBeenCalledTimes(1)
    expect(String(err.mock.calls[0]?.[0])).toMatch(/ModuloOperation/)
  })

  it('with report: warn, prints the findings once and returns them without throwing', () => {
    const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const v = diagramMatchesCode(mmd('drift.mmd'), tsProject(), { report: 'warn' })
    expect(v.map((x) => x.ruleId)).toEqual(['crossval/diagram-completeness'])
    expect(err).toHaveBeenCalledTimes(1)
  })

  it('with expectEmpty over a diagram that has classes, reds as an expired declaration', () => {
    const v = diagramMatchesCode(mmd('complete.mmd'), tsProject(), {
      expectEmpty: true,
      report: 'return',
    })
    expect(v.map((x) => x.ruleId)).toEqual(['emitter/expired-declaration'])
  })

  it('with report: return, a clean run returns no findings and counts what it examined', () => {
    const v = diagramMatchesCode(mmd('complete.mmd'), tsProject(), { report: 'return' })
    expect([...v]).toEqual([])
    expect(v.examined).toBeGreaterThan(0)
  })

  it('with format: json, writes the findings as JSON and still throws', () => {
    const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    expect(() => diagramMatchesCode(mmd('drift.mmd'), tsProject(), { format: 'json' })).toThrow(
      ArchRuleError,
    )
    expect(out).toHaveBeenCalledTimes(1)
    expect(err).not.toHaveBeenCalled()
    expect(String(out.mock.calls[0]?.[0])).toMatch(/"ruleId":\s*"crossval\/diagram-completeness"/)
  })
})
