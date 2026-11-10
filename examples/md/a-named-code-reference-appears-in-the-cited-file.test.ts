/**
 * A named code reference's name appears in the cited file (plan 0648): a sentence that names code
 * and points at a file, as `` `pathSuffixIndex` (`src/index.py:1`) ``, is red when the cited file no
 * longer holds the name at all. That catches a rename, a removal, or a move out of the file. It
 * needs no code facts, so it serves any language whose names are ASCII identifiers: the cited files
 * here are Python.
 *
 * What it claims is narrow: the file holds the name, in code or in text. It does not claim the cited
 * line holds it, nor that the name is code there; a name left only in a comment holds. The line is
 * `pointers().resolve()`'s to check, and whether the line holds the name as code is a second
 * condition's.
 *
 * The mentions are read with inline code's backticks kept, and the name and the path must each sit
 * inside a code span: a pattern can match a prose word dressed in escaped backticks, and that
 * mention is reported, not judged. A finding the rule cannot judge fails even under `.warn()`.
 *
 * Over eess's own records, at f17759a6, the instrument behind it counted 27 such reds, and a judge
 * found 7 of them to be real renames; the rest cited old code on purpose, paired a name with
 * another name's pointer, or said the name was gone. So a rule built from this belongs at
 * `.warn()`, and each finding's remedy names all four. This test reads the findings directly.
 */
import { corpusFromText, mentions, type ArchViolation } from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixtureFiles } from './fixture.js'

const NAME = 'a-named-code-reference-appears-in-the-cited-file'

// A name, then its pointer, each in its own code span: `pathSuffixIndex` (`src/index.py:1`).
const NAMED =
  /`(?<name>[A-Za-z_$][\w$.]*)(?:\([^`)]*\))?`(?<gap>[^`\n]{0,12})`(?<path>[\w./@-]+\.[A-Za-z]+):(?<line>\d+)(?:-(?<end>\d+))?`/g

const rule = (files: Record<string, string>, keepBackticks = true) =>
  mentions(corpusFromText(files), { pattern: NAMED, keepBackticks })
    .should()
    .appearInTheCitedFile()
    .rule({ id: 'docs/code-names-appear' })

const found = (kind: Parameters<typeof fixtureFiles>[1]): ArchViolation[] => [
  ...rule(fixtureFiles(NAME, kind)).violations(),
]

describe('a named code reference appears in the cited file', () => {
  it('clean: every named reference names code its file holds, a dotted one by its last segment', () => {
    const v = rule(fixtureFiles(NAME, 'clean')).violations()
    expect(v).toHaveLength(0)
    // Two references are examined: `pathSuffixIndex` and `a.b.cee`.
    expect(v.examined).toBe(2)
  })

  it('violating-renamed: a name the cited file no longer holds is red, with four remedies', () => {
    const [finding, ...rest] = found('violating-renamed')
    expect(rest).toHaveLength(0)
    expect(finding?.element).toBe('docs/refs.md → `pathSuffixIndex` `src/index.py`')
    expect(finding?.message).toBe('`pathSuffixIndex` is not in src/index.py, as code or as text')
    expect(finding?.suggestion).toContain('If it was renamed, write its new name.')
    expect(finding?.suggestion).toContain('If it moved, cite the file it moved to.')
    expect(finding?.suggestion).toContain('reword so each name sits beside its own')
    expect(finding?.suggestion).toContain('<!-- eess-exclude docs/code-names-appear: <reason> -->')
  })

  it('violating-broken-path: a path the corpus does not hold is red', () => {
    const [finding, ...rest] = found('violating-broken-path')
    expect(rest).toHaveLength(0)
    expect(finding?.message).toContain('"src/indexes.py" does not exist in this corpus')
  })

  it('violating-forged-name: a name dressed in escaped backticks is reported, not judged', () => {
    const [finding, ...rest] = found('violating-forged-name')
    expect(rest).toHaveLength(0)
    expect(finding?.message).toContain('the name is not inside one code span')
    expect(finding?.suggestion).toContain('each in its own code span')
    // A finding the rule cannot judge fails even under `.warn()`.
    expect(finding?.bypassFilters).toBe(true)
  })

  it('violating-empty-name: a name with nothing after its last dot is reported, never passed', () => {
    const [finding, ...rest] = found('violating-empty-name')
    expect(rest).toHaveLength(0)
    expect(finding?.message).toContain('is not a name this rule can look for')
    expect(finding?.bypassFilters).toBe(true)
  })

  it('refuses: a reading without keepBackticks, when the rule is built', () => {
    expect(() => rule(fixtureFiles(NAME, 'clean'), false)).toThrow('keepBackticks: true')
  })

  it('refuses: a pattern without a path group, when the rule is built', () => {
    expect(() =>
      mentions(corpusFromText(fixtureFiles(NAME, 'clean')), {
        pattern: /`(?<name>\w+)`/g,
        keepBackticks: true,
      })
        .should()
        .appearInTheCitedFile(),
    ).toThrow('has no "path"')
  })
})
