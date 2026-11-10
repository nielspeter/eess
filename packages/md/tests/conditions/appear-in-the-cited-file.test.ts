/**
 * Plan 0648: `mentions(c, { pattern, keepBackticks: true }).should().appearInTheCitedFile()`. Every
 * row drives the public entry point over `corpusFromText`, and asserts a finding by its cause.
 */
import { describe, it, expect } from 'vitest'
import { corpusFromText, isArchConfigError, mentions, type ArchViolation } from '../../src/index.js'

/** The stock pattern, frozen by value in plan 0647. A fresh copy per use. */
const named = (): RegExp =>
  /`(?<name>[A-Za-z_$][\w$.]*)(?:\([^`)]*\))?`(?<gap>[^`\n]{0,12})`(?<path>[\w./@-]+\.[A-Za-z]+):(?<line>\d+)(?:-(?<end>\d+))?`/g

const CODE = {
  'src/index.ts': 'export function pathSuffixIndex() {}\nexport const a = { b: { cee: 1 } }\n',
  'src/notes.ts': '// keepsake: oldName lives on in this comment\nimport x from "./x.ts"\n',
  'src/one/util.ts': 'export const u = 1\n',
  'src/two/util.ts': 'export const u = 2\n',
}

const rule = (doc: string, pattern: RegExp = named(), keepBackticks = true) =>
  mentions(corpusFromText({ ...CODE, 'docs/a.md': `# A\n\n${doc}\n` }), {
    pattern,
    keepBackticks,
  })
    .should()
    .appearInTheCitedFile()

const findings = (doc: string, pattern?: RegExp): ArchViolation[] => [
  ...rule(doc, pattern).violations(),
]

/** The findings a terminal threw, or none when it did not throw. */
const thrownBy = (run: () => void): ArchViolation[] => {
  try {
    run()
  } catch (err) {
    if (err instanceof Error && 'violations' in err && Array.isArray(err.violations)) {
      return err.violations.filter((v): v is ArchViolation => typeof v === 'object' && v !== null)
    }
    throw err
  }
  return []
}

const said = (doc: string, pattern?: RegExp): string[] =>
  findings(doc, pattern).map((v) => v.message)

describe('plan 0648: appearInTheCitedFile', () => {
  it('holds when the cited file holds the name as a whole token', () => {
    expect(findings('See `pathSuffixIndex` (`src/index.ts:1`).')).toEqual([])
  })

  it('a dotted name holds when its last segment is in the file', () => {
    expect(findings('See `a.b.cee` (`src/index.ts:2`).')).toEqual([])
  })

  it('a name the file does not hold is red, with four remedies', () => {
    const [v, ...rest] = findings('See `renamedAway` (`src/index.ts:1`).')
    expect(rest).toEqual([])
    expect(v?.message).toContain('`renamedAway` is not in src/index.ts, as code or as text')
    expect(v?.suggestion).toContain('If it was renamed, write its new name.')
    expect(v?.suggestion).toContain('If it moved, cite the file it moved to.')
    expect(v?.suggestion).toContain('reword so each name sits beside its own')
    expect(v?.suggestion).toContain('waive it here with <!-- eess-exclude')
    expect(v?.bypassFilters).toBeUndefined()
  })

  it('a whole-token match: a prefix of a name in the file does not hold', () => {
    expect(said('See `pathSuffix` (`src/index.ts:1`).')[0]).toContain('is not in')
  })

  it('the stated limit: a name left only in a comment holds', () => {
    expect(findings('See `oldName` (`src/notes.ts:1`).')).toEqual([])
  })

  it('the stated limit: a file name read as a name is judged by its last segment', () => {
    // `config.ts` is judged as `ts`, which the file holds in `"./x.ts"`.
    expect(findings('See `config.ts` (`src/notes.ts:2`).')).toEqual([])
  })

  it('a path the corpus does not hold is red, and suppressible', () => {
    const [v] = findings('See `pathSuffixIndex` (`src/gone.ts:1`).')
    expect(v?.message).toContain('"src/gone.ts" does not exist in this corpus')
    expect(v?.suggestion).toContain('its waivers do not cover this rule')
    expect(v?.bypassFilters).toBeUndefined()
  })

  it('an ambiguous path cannot be judged, and the finding cannot be waived', () => {
    const [v] = findings('See `u` (`util.ts:1`) and `uu` (`util.ts:1`).')
    // `u` fails the name rule first; `uu` reaches the path.
    expect(findings('See `uu` (`util.ts:1`).')[0]?.message).toContain(
      'matches 2 files (src/one/util.ts, src/two/util.ts), so this rule cannot judge which file is cited',
    )
    expect(findings('See `uu` (`util.ts:1`).')[0]?.bypassFilters).toBe(true)
    expect(v?.message).toContain('is not a name this rule can look for')
  })

  it('a name this rule cannot look for is a finding, never a pass', () => {
    expect(said('See `foo.` (`src/index.ts:1`).')[0]).toContain(
      '`foo.` is not a name this rule can look for (it judges the last segment, "")',
    )
    expect(said('See `x` (`src/index.ts:1`).')[0]).toContain('is not a name this rule can look for')
  })

  it('a name forged from escaped backticks is not judged', () => {
    const [v] = findings('A literal \\`pathSuffixIndex\\` (`src/index.ts:1`) here.')
    expect(v?.message).toContain('the name is not inside one code span')
    expect(v?.suggestion).toContain('each in its own code span')
    expect(v?.bypassFilters).toBe(true)
  })

  it('a group that did not capture is reported first, alone', () => {
    const optional = /`(?<name>\w+)`(?: \(`(?<path>[\w./]+):\d+`\))?/g
    const [v, ...rest] = findings('A literal \\`alpha\\` stands alone.', optional)
    expect(rest).toEqual([])
    expect(v?.message).toContain('the pattern\'s "path" group did not capture here')
    expect(v?.bypassFilters).toBe(true)
  })

  it('two red references on one line are two findings, each naming its own reference', () => {
    const vs = findings('See `oneGone` (`src/index.ts:1`) and `twoGone` (`src/index.ts:2`).')
    expect(vs.map((v) => v.element)).toEqual([
      'docs/a.md → `oneGone` `src/index.ts`',
      'docs/a.md → `twoGone` `src/index.ts`',
    ])
  })

  it('refuses a reading without keepBackticks when the rule is built, naming the option', () => {
    let thrown: unknown
    try {
      rule('x', named(), false)
    } catch (err) {
      thrown = err
    }
    expect(isArchConfigError(thrown)).toBe(true)
    expect(String(thrown)).toContain('keepBackticks: true')
  })

  it('refuses a pattern without a path group when the rule is built', () => {
    let thrown: unknown
    try {
      rule('x', /`(?<name>\w+)`/g)
    } catch (err) {
      thrown = err
    }
    expect(isArchConfigError(thrown)).toBe(true)
    expect(String(thrown)).toContain('has no "path"')
  })

  it("lists a pattern's groups with its flags, so a pattern that needs u compiles", () => {
    const unicode = /`(?<name>\p{L}[\p{L}\d]*)`(?<gap>[^`\n]{0,12})`(?<path>[\w./]+):\d+`/gu
    expect(findings('See `pathSuffixIndex` (`src/index.ts:1`).', unicode)).toEqual([])
  })

  it('a finding it cannot judge fails .warn(); a plain miss does not', () => {
    const forged = thrownBy(() =>
      rule('A literal \\`pathSuffixIndex\\` (`src/index.ts:1`) here.').warn(),
    )
    expect(forged.map((v) => v.message).join('\n')).toContain('not inside one code span')
    expect(thrownBy(() => rule('See `renamedAway` (`src/index.ts:1`).').warn())).toEqual([])
  })

  it('zero examined is a finding unless declared', () => {
    expect(() => rule('No reference here.').check()).toThrow()
    expect(() => rule('No reference here.').expectEmpty().check()).not.toThrow()
  })

  it('the unread wording names no condition: a reference-style link cannot be judged', () => {
    const doc = '# A\n\nSee [`pathSuffixIndex` (`src/index.ts:1`)][r].\n\n[r]: ./r.md\n'
    const c = corpusFromText({ ...CODE, 'docs/a.md': doc })
    for (const b of [
      mentions(c, { pattern: named(), keepBackticks: true }).should().appearInTheCitedFile(),
      mentions(c, { pattern: named(), keepBackticks: true }).should().beLinked(),
    ]) {
      const unread = b.violations().find((v) => v.message.includes('reference-style link'))
      expect(unread?.message).toContain('so this rule cannot judge it')
    }
  })
})
