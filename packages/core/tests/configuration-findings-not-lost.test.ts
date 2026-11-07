import { afterAll, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ArchConfigError,
  ArchRuleError,
  collectResult,
  collectViolations,
  finishPreset,
  generateBaseline,
  isArchRuleError,
  type ArchViolation,
} from '../src/index.js'

// Bugs 0577, 0586 and 0595: an unsuppressable configuration finding, or a configuration error, was
// lost on a path that does not throw: a preset's `report: 'warn'`, `collectViolations`, and
// `generateBaseline`. Each now fails the call, as `check()` does.

const finding = (over: Partial<ArchViolation>): ArchViolation => ({
  rule: 'demo rule',
  ruleId: 'demo/rule',
  element: 'a.ts',
  file: 'a.ts',
  line: 1,
  message: 'a finding',
  ...over,
})
const CONFIG = finding({
  ruleId: 'demo/dead-scope',
  message: 'the scope selects nothing',
  bypassFilters: true,
})
const ORDINARY = finding({ message: 'an ordinary violation' })

const quiet = <T>(fn: () => T): { value?: T; thrown?: unknown } => {
  const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  try {
    return { value: fn() }
  } catch (e) {
    return { thrown: e }
  } finally {
    spy.mockRestore()
  }
}

describe("finishPreset's report: 'warn' (bug 0577)", () => {
  it('an ordinary violation is printed and returned, not thrown', () => {
    const r = quiet(() =>
      finishPreset(collectResult([ORDINARY], { examined: 1 }), { report: 'warn' }),
    )
    expect(r.thrown).toBeUndefined()
    expect(r.value?.map((v) => v.message)).toEqual(['an ordinary violation'])
  })

  it("a configuration finding is thrown, alone, as a builder's .warn() throws it", () => {
    const r = quiet(() =>
      finishPreset(collectResult([ORDINARY, CONFIG], { examined: 1 }), { report: 'warn' }),
    )
    expect(isArchRuleError(r.thrown)).toBe(true)
    if (!isArchRuleError(r.thrown)) return
    expect(r.thrown.violations.map((v) => v.message)).toEqual(['the scope selects nothing'])
  })
})

describe('collectViolations (bug 0586)', () => {
  const throwing = (e: unknown) => ({
    check: () => {
      throw e
    },
  })

  it('a configuration error is rethrown, not swallowed', () => {
    const misconfigured = throwing(
      new ArchConfigError('report', "report: 'retrun' is not a report mode"),
    )
    expect(() => collectViolations(misconfigured)).toThrow(/retrun/)
  })

  it('any other error is rethrown', () => {
    expect(() => collectViolations(throwing(new TypeError('a bug in the rule')))).toThrow(TypeError)
  })

  it("a second kernel copy's ArchRuleError is harvested, by its structure", () => {
    const foreign = Object.assign(new Error('violations'), {
      name: 'ArchRuleError',
      violations: [ORDINARY],
    })
    expect(collectViolations(throwing(foreign)).map((v) => v.message)).toEqual([
      'an ordinary violation',
    ])
  })

  it('CONTROL: a builder that passes contributes nothing, and one that violates its violations', () => {
    const passes = { check: () => undefined }
    const violates = throwing(new ArchRuleError([ORDINARY]))
    expect(collectViolations(passes, violates)).toHaveLength(1)
  })
})

describe('generateBaseline (bug 0595)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eess-0595-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('writes what can be accepted, then throws naming each configuration finding', () => {
    const out = join(dir, 'baseline.json')
    const r = quiet(() => generateBaseline([ORDINARY, CONFIG], out))
    expect(isArchRuleError(r.thrown)).toBe(true)
    if (!isArchRuleError(r.thrown)) return
    expect(r.thrown.violations.map((v) => v.message)).toEqual(['the scope selects nothing'])
    expect(r.thrown.message).toMatch(/not baselined/)
    expect(existsSync(out)).toBe(true)
    const written: unknown = JSON.parse(readFileSync(out, 'utf-8'))
    expect(written).toMatchObject({ count: 1 })
  })

  it('CONTROL: with no configuration finding, it writes and returns', () => {
    const out = join(dir, 'clean.json')
    expect(() => generateBaseline([ORDINARY], out)).not.toThrow()
    expect(existsSync(out)).toBe(true)
  })
})
