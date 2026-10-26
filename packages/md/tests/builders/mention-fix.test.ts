/**
 * Plan 0550: `beLinked({ fix })`. Every row drives the public entry point, `mentions(corpus, { pattern })`
 * with `.should().beLinked({ fix })`, over `corpusFromText` or a throwaway tree; the round trip
 * applies through `applyFixes`, the door `eess-ts check --fix --apply` uses.
 */
import fs from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyFixes } from '@nielspeter/eess/internal'
import {
  areLinked,
  corpus,
  corpusFromText,
  isArchConfigError,
  mentions,
  type ArchViolation,
  type Corpus,
  type MdMention,
  type MentionFix,
} from '../../src/index.js'
import { tree } from '../helpers/tree.js'

/** A fresh pattern per use, so no test shares a `lastIndex` with another. */
const record = (): RegExp => /\b(?<kind>bug)s?\s+(?<n>\d{3,4})\b/gi

interface Rec {
  readonly key: string
  readonly target: string
}

/** The corpus's own bugs, `bugs/<digits>-….md`, keyed by the digits as written. */
const localRecords = (c: Corpus): Rec[] =>
  c.documents().flatMap((d) => {
    const n = /^bugs\/(\d{3,4})-[^/]+\.md$/.exec(d.relPath)?.[1]
    return n === undefined ? [] : [{ key: `bug:${n}`, target: d.relPath }]
  })

const keyOf = (m: MdMention): string | undefined =>
  m.groups['n'] === undefined ? undefined : `bug:${m.groups['n']}`

const fixOver = (records: readonly Rec[], foreign: RegExp = /(?!)/): MentionFix<Rec> => ({
  records: { elements: records, label: 'bugs', identify: (r) => ({ name: r.key }) },
  key: { mention: keyOf, record: (r) => r.key },
  target: (r) => r.target,
  foreign,
})

/** The run's findings over `files`, a note at `notes.md` and records `bugs/…`, with `extra` records added. */
const run = (
  files: Readonly<Record<string, string>>,
  options: { readonly extra?: readonly Rec[]; readonly foreign?: RegExp } = {},
): ArchViolation[] => {
  const c = corpusFromText(files)
  return mentions(c, { pattern: record() })
    .resideInFile('notes.md')
    .should()
    .beLinked({ fix: fixOver([...localRecords(c), ...(options.extra ?? [])], options.foreign) })
    .violations()
}

const BUGS = { 'bugs/0001-a.md': '# Bug 0001: a\n', 'bugs/0002-b.md': '# Bug 0002: b\n' }

/** Each finding as "<mention> → <replacement>" or "<mention> — <why not>". */
const outcome = (vs: readonly ArchViolation[]): string[] =>
  vs.map((v) => {
    const said = /^"([^"]*)"/.exec(v.message)?.[1] ?? v.message
    if (v.fix !== undefined) return `${said} → ${v.fix.replacement}`
    const why = / — not fixed: (.*)$/.exec(v.message)?.[1]
    return `${said} — ${why ?? v.message}`
  })

const note = (text: string): Record<string, string> => ({
  ...BUGS,
  'notes.md': `# Notes\n\n${text}\n`,
})

describe('beLinked({ fix }): what is fixed', () => {
  it("one record: a fix to that record, relative to the mention's document", () => {
    expect(outcome(run(note('See bug 0001.')))).toEqual(['bug 0001 → [bug 0001](./bugs/0001-a.md)'])
  })

  it('describe is exactly <file>:<line> link "<mention>" → <target>', () => {
    const [v] = run(note('See bug 0001.'))
    expect(v?.fix?.describe).toBe('notes.md:3 link "bug 0001" → ./bugs/0001-a.md')
  })

  it('two mentions on one line are both fixed', () => {
    expect(outcome(run(note('bug 0001 and bug 0002')))).toEqual([
      'bug 0001 → [bug 0001](./bugs/0001-a.md)',
      'bug 0002 → [bug 0002](./bugs/0002-b.md)',
    ])
  })

  it('a URL target is written verbatim; a path with a space is written in <…>', () => {
    const extra = [
      { key: 'bug:0047', target: 'https://example.com/up/bugs/0047-y.md' },
      { key: 'bug:0048', target: 'bugs/0048 two words.md' },
    ]
    expect(outcome(run(note('bug 0047, bug 0048'), { extra }))).toEqual([
      'bug 0047 → [bug 0047](https://example.com/up/bugs/0047-y.md)',
      'bug 0048 → [bug 0048](<./bugs/0048 two words.md>)',
    ])
  })

  it("a linked mention carries no finding, and a mention's fix is written relative to its own folder", () => {
    const files = {
      ...BUGS,
      'docs/notes.md': '# Notes\n\nbug 0001, [bug 0002](../bugs/0002-b.md)\n',
    }
    const c = corpusFromText(files)
    const vs = mentions(c, { pattern: record() })
      .resideInFile('docs/notes.md')
      .should()
      .beLinked({ fix: fixOver(localRecords(c)) })
      .violations()
    expect(outcome(vs)).toEqual(['bug 0001 → [bug 0001](../bugs/0001-a.md)'])
  })
})

describe('beLinked({ fix }): what is refused', () => {
  it('two records: no fix, both targets named; none: no fix, said so', () => {
    const extra = [{ key: 'bug:0001', target: 'https://example.com/up/bugs/0001-x.md' }]
    expect(outcome(run(note('bug 0001, bug 0009'), { extra }))).toEqual([
      'bug 0001 — 2 records hold bug:0001: bugs/0001-a.md, https://example.com/up/bugs/0001-x.md',
      'bug 0009 — no record holds bug:0009',
    ])
  })

  it('a key that is undefined: no fix, said so', () => {
    const c = corpusFromText(note('bug 0001, bug 0002'))
    const fix: MentionFix<Rec> = {
      ...fixOver(localRecords(c)),
      key: {
        mention: (m) => (m.groups['n'] === '0002' ? undefined : keyOf(m)),
        record: (r) => r.key,
      },
    }
    const vs = mentions(c, { pattern: record() })
      .resideInFile('notes.md')
      .should()
      .beLinked({ fix })
      .violations()
    expect(outcome(vs)).toEqual([
      'bug 0001 → [bug 0001](./bugs/0001-a.md)',
      'bug 0002 — its key names no record',
    ])
  })

  it('a four-digit mention beside a three-digit record of the same value: no fix', () => {
    const files = {
      'bugs/081-local.md': '# Bug 081\n',
      'notes.md': '# Notes\n\nbug 0081 and bug 081\n',
    }
    expect(outcome(run(files))).toEqual([
      'bug 0081 — no record holds bug:0081',
      'bug 081 → [bug 081](./bugs/081-local.md)',
    ])
  })

  it('inline code, after "!", without a span, and in a table cell with a | in its target: no fix', () => {
    const extra = [{ key: 'bug:0049', target: 'bugs/a|b.md' }]
    const text = [
      'In `bug 0001` code.',
      '',
      'Quoted ![bug 0001](x.png) here!bug 0002',
      '',
      'An entity inside it: bug&#32;0001.',
      '',
      '| x |',
      '| --- |',
      '| bug 0049 |',
    ].join('\n')
    const read = run(note(text), { extra }).filter((v) => v.ruleId !== 'md/unread-mention')
    expect(outcome(read)).toEqual([
      'bug 0001 — it is in inline code',
      'bug 0002 — it follows "!", so a link would be an image',
      'bug 0001 — its text in the source is not the mention as written (an entity, emphasis or line break in it)',
      'bug 0049 — its target holds "|", which would end its table cell',
    ])
  })
})

describe('beLinked({ fix }): targets a link cannot hold, and brackets', () => {
  it('a parenthesis goes in <…>; <, >, \\, # and ? in a path are refused; a path outside the repository is refused', () => {
    const extra = [
      { key: 'bug:0060', target: 'bugs/0060-a(b).md' },
      { key: 'bug:0061', target: 'bugs/0061 a>b.md' },
      { key: 'bug:0062', target: 'bugs/0062\\.md' },
      { key: 'bug:0063', target: 'bugs/0063#x.md' },
      { key: 'bug:0064', target: '/etc/0064.md' },
      { key: 'bug:0065', target: '../outside/0065.md' },
    ]
    expect(
      outcome(run(note('bug 0060, bug 0061, bug 0062, bug 0063, bug 0064, bug 0065'), { extra })),
    ).toEqual([
      'bug 0060 → [bug 0060](<./bugs/0060-a(b).md>)',
      'bug 0061 — its target "bugs/0061 a>b.md" cannot be written as a link destination',
      'bug 0062 — its target "bugs/0062\\.md" cannot be written as a link destination',
      'bug 0063 — its target "bugs/0063#x.md" cannot be written as a link destination',
      'bug 0064 — its target "/etc/0064.md" is not a path inside the repository',
      'bug 0065 — its target "../outside/0065.md" is not a path inside the repository',
    ])
  })

  it('a mention after an odd run of backslashes is refused, since the link would be escaped; an even run is fixed', () => {
    expect(outcome(run(note('see C:\\bug 0001 now, and C:\\\\bug 0002 too')))).toEqual([
      'bug 0001 — it follows a backslash, which would escape the link',
      'bug 0002 → [bug 0002](./bugs/0002-b.md)',
    ])
  })

  it('a mention touching *, _ or ~ is refused, since the link would change the emphasis beside it', () => {
    expect(
      outcome(run(note('see bug 0001*;* now\n\nsee *;*bug 0002 now\n\nand ~;~bug 0001'))),
    ).toEqual([
      'bug 0001 — it touches "*", "_" or "~", whose emphasis a link beside it would change',
      'bug 0002 — it touches "*", "_" or "~", whose emphasis a link beside it would change',
      'bug 0001 — it touches "*", "_" or "~", whose emphasis a link beside it would change',
    ])
  })

  it('a mention right after "]" is refused, so it never joins the brackets before it', () => {
    expect(outcome(run(note('See [x]bug 0001 here.')))).toEqual([
      'bug 0001 — it follows "]", so a link would join the brackets before it',
    ])
  })

  it('one record listed twice, under one target, is one record', () => {
    const extra = [{ key: 'bug:0001', target: 'bugs/0001-a.md' }]
    expect(outcome(run(note('See bug 0001.'), { extra }))).toEqual([
      'bug 0001 → [bug 0001](./bugs/0001-a.md)',
    ])
  })
})

describe('beLinked({ fix }): foreign, the text read around a mention', () => {
  const FOREIGN = /\bupstream\b/i
  const said = (text: string): string[] => outcome(run(note(text), { foreign: FOREIGN }))
  const refused = (text: string, mention = 'bug 0001'): void => {
    const row = said(text).find((o) => o.startsWith(mention))
    expect(row).toMatch(/— another project is named around it/)
  }

  it("foreign in the mention's paragraph refuses it", () => {
    refused('The upstream bug 0001 here.')
  })

  it('foreign before a hard line break still refuses it', () => {
    refused('This came from upstream\\\nbug 0001 there.')
    refused('This came from upstream  \nbug 0001 there.')
  })

  it("foreign in a list's parent item, or a grandparent item, refuses it", () => {
    refused('- upstream work\n  - bug 0001')
    refused('- upstream work\n  - nested\n    - bug 0001')
  })

  it("foreign in a table's header, or another cell of its own row, refuses it", () => {
    refused('| upstream | x |\n| --- | --- |\n| bug 0001 | y |')
    refused('| a | b |\n| --- | --- |\n| bug 0001 | upstream |')
  })

  it('foreign in another paragraph of its blockquote refuses it', () => {
    refused('> The upstream notes.\n>\n> bug 0001 here.')
  })

  it("foreign in a list's lead-in, for a nested item, or a table's lead-in, refuses it", () => {
    refused('From upstream:\n\n- a\n  - bug 0001')
    refused('From upstream:\n\n| a |\n| --- |\n| bug 0001 |')
  })

  it("foreign only in a containing section's heading two levels up refuses it", () => {
    refused('## Upstream\n\n### Detail\n\nbug 0001 here.')
  })

  it('foreign in a sibling list item or another table row only: fixed', () => {
    expect(said('- upstream work\n- bug 0001')).toContain('bug 0001 → [bug 0001](./bugs/0001-a.md)')
    expect(said('| a |\n| --- |\n| upstream |\n| bug 0001 |')).toContain(
      'bug 0001 → [bug 0001](./bugs/0001-a.md)',
    )
  })

  it('a g foreign refuses two qualified mentions in one block', () => {
    const out = outcome(run(note('upstream bug 0001, upstream bug 0002'), { foreign: /upstream/g }))
    expect(out.every((o) => /another project is named around it/.test(o))).toBe(true)
    expect(out).toHaveLength(2)
  })

  it('a missing records, key or target, a missing foreign (an untyped object), a non-RegExp one and an empty-matching one each throw ArchConfigError at build', () => {
    const c = corpusFromText(note('bug 0001'))
    const b = mentions(c, { pattern: record() }).should()
    const full = fixOver(localRecords(c))
    const noForeign = { records: full.records, key: full.key, target: full.target }
    const attempts = [
      // @ts-expect-error an untyped caller can leave records out; the type cannot reach it (ADR-015)
      () => b.beLinked({ fix: { key: full.key, target: full.target, foreign: /(?!)/ } }),
      // @ts-expect-error nor key
      () => b.beLinked({ fix: { records: full.records, target: full.target, foreign: /(?!)/ } }),
      // @ts-expect-error nor target
      () => b.beLinked({ fix: { records: full.records, key: full.key, foreign: /(?!)/ } }),
      // @ts-expect-error nor foreign
      () => b.beLinked({ fix: noForeign }),
      // @ts-expect-error nor stop a string
      () => b.beLinked({ fix: { ...fixOver([]), foreign: 'upstream' } }),
      () => b.beLinked({ fix: fixOver([], /x*/) }),
    ]
    for (const attempt of attempts) {
      let err: unknown
      try {
        attempt()
      } catch (e) {
        err = e
      }
      expect(isArchConfigError(err)).toBe(true)
    }
  })
})

describe('beLinked({ fix }): configuration findings', () => {
  const configs = (vs: readonly ArchViolation[]): string[] =>
    vs.filter((v) => v.ruleId === 'md/mention-fix-config').map((v) => v.message)

  it('an empty records is a configuration finding, with or without plain mentions, and nothing hides it', () => {
    for (const text of ['bug 0001', '[bug 0001](./bugs/0001-a.md)']) {
      const c = corpusFromText(note(text))
      const vs = mentions(c, { pattern: record() })
        .resideInFile('notes.md')
        .should()
        .beLinked({ fix: fixOver([]) })
        .excluding(/.*/)
        .violations()
      expect(configs(vs)).toEqual([
        'the fix\'s records, "bugs", hold no record, so no mention can be fixed',
      ])
      const config = vs.find((v) => v.ruleId === 'md/mention-fix-config')
      expect([config?.file, config?.line, config?.bypassFilters]).toEqual(['', 0, true])
      expect(vs.filter((v) => v.fix !== undefined)).toEqual([])
    }
  })

  it('keys that meet no record over linked and plain mentions alike are another; keys that meet trip neither', () => {
    const offKey: readonly Rec[] = [{ key: 'BUG-0001', target: 'bugs/0001-a.md' }]
    expect(configs(run(note('bug 0001, [bug 0002](./bugs/0002-b.md)'), { extra: offKey }))).toEqual(
      [],
    )
    const c = corpusFromText(note('bug 0001, [bug 0002](./bugs/0002-b.md)'))
    const vs = mentions(c, { pattern: record() })
      .resideInFile('notes.md')
      .should()
      .beLinked({ fix: fixOver(offKey) })
      .violations()
    expect(configs(vs)).toEqual([
      'no mention\'s key meets a record\'s: the mentions give "bug:0001", the records "bugs" give "BUG-0001"',
    ])
    // A corpus with no plain mention left, whose keys meet, trips neither.
    expect(configs(run(note('[bug 0002](./bugs/0002-b.md)')))).toEqual([])
  })
})

describe('beLinked({ fix }): the round trip', () => {
  it("applied to a temporary copy, the written target is that record's and every link resolves to its record", () => {
    const root = tree({ ...BUGS, 'notes.md': '# Notes\n\nSee bug 0001 and bug 0002.\n' })
    const load = (): Corpus => corpus({ cwd: root, roots: ['**/*.md'] })
    const before = load()
    const vs = mentions(before, { pattern: record() })
      .resideInFile('notes.md')
      .should()
      .beLinked({ fix: fixOver(localRecords(before)) })
      .violations()
    const result = applyFixes(vs, { write: true })
    expect(result.applied).toBe(2)
    expect(fs.readFileSync(join(root, 'notes.md'), 'utf8')).toBe(
      '# Notes\n\nSee [bug 0001](./bugs/0001-a.md) and [bug 0002](./bugs/0002-b.md).\n',
    )
    const after = load()
    const recs = localRecords(after)
    const linked = mentions(after, { pattern: record() })
      .resideInFile('notes.md')
      .that()
      .satisfy(areLinked())
      .select({ label: 'm', identify: (m) => ({ name: m.text }) }).elements
    expect(
      linked.map((m) => {
        const t = m.link?.target
        const holder = recs.find((r) => r.key === keyOf(m))
        return t?.kind === 'document' && t.path === holder?.target
      }),
    ).toEqual([true, true])
    expect(
      mentions(after, { pattern: record() })
        .resideInFile('notes.md')
        .should()
        .beLinked()
        .violations(),
    ).toHaveLength(0)
  })
})
