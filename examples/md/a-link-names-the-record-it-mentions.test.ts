/**
 * A link names the record it mentions (plan 0549): a mention that sits in a link must link to the
 * record it names, not to another one. The join is the kernel's `correspondence()`, written here:
 * every linked mention on the left, keyed by the source its link points at and the record it names;
 * every record on the right, this corpus's bugs under `work/bugs/` and an upstream project's closed
 * list. `beComplete` reds a mention naming no record in the source it points at; `preserveRelations`
 * reds one pointing at a different record than its own.
 *
 * A title link is not judged: a board row `[0002 — bug 0001 is quoted](…)` quotes bug 0001 because
 * the record's title does. `areInTitleLinks` exempts a link only when its text, less this corpus's
 * row prefix, is the target's whole title, less its record prefix.
 *
 * The relation never returns `[]`: `preserveRelations` skips an element with no relation, so a
 * mention whose link resolved to nothing would pass. The join reads the mentions it can read; one
 * outside any link, or in a link it cannot read (a reference-style link), is `beLinked()`'s finding,
 * so the two run together. Not a record's mention of its own number: the pair leaves that out, so a
 * reference-style link from a record's own number to another record is seen by neither.
 */
import {
  areInTitleLinks,
  areLinked,
  areSelfMentions,
  corpus,
  correspondence,
  mentions,
  not,
  type Corpus,
  type MdDocument,
  type MdMention,
} from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture.js'

const NAME = 'a-link-names-the-record-it-mentions'

const RECORD = /\b(?<kind>bug)\s+(?<n>\d{4})\b/gi
const UPSTREAM = 'https://github.com/acme/upstream/blob/main/'
const UPSTREAM_RECORDS = ['bugs/fixed/0046-x.md', 'bugs/fixed/0047-y.md']
/** This corpus's own URL: the owner and the repository in any letter case, the path as written. */
const OWN_URL = /^https:\/\/github\.com\/acme\/notes\/blob\/[^/]+\/([^#?]*)/i
const LOCAL_RECORD = /^work\/bugs\/(\d{4})-[^/]+\.md$/

interface RecordElement {
  readonly key: string
  readonly at: string
}

/** Every record: this corpus's bugs, then the upstream list, each keyed by source and number as written. */
function records(c: Corpus): RecordElement[] {
  const local = c.documents().flatMap((d) => {
    const n = LOCAL_RECORD.exec(d.relPath)?.[1]
    return n === undefined ? [] : [{ key: `local|bug:${n}`, at: d.relPath }]
  })
  const upstream = UPSTREAM_RECORDS.flatMap((p) => {
    const n = /\/(\d{4})-/.exec(p)?.[1]
    return n === undefined ? [] : [{ key: `upstream|bug:${n}`, at: UPSTREAM + p }]
  })
  return [...local, ...upstream]
}

/** Where a mention's link points: its source and the path or URL. Never empty, whatever the link. */
function pointsAt(m: MdMention): { readonly source: string; readonly at: string } {
  const link = m.link
  if (link === undefined) return { source: 'none', at: '' }
  const target = link.target
  switch (target.kind) {
    case 'external': {
      const own = OWN_URL.exec(link.url)?.[1]
      if (own !== undefined) return { source: 'local', at: decodeURIComponent(own) }
      const url = link.url.replace(/[#?].*$/, '')
      return { source: url.startsWith(UPSTREAM) ? 'upstream' : 'unclaimed', at: url }
    }
    case 'self':
      return { source: 'local', at: m.doc.relPath }
    case 'missing':
      return { source: 'local', at: target.tried[0] ?? link.url }
    default:
      return { source: 'local', at: target.path }
  }
}

const keyOf = (m: MdMention): string =>
  `${pointsAt(m).source}|${(m.groups['kind'] ?? '').toLowerCase()}:${m.groups['n'] ?? ''}`

const TITLE_LINK = areInTitleLinks({
  linkPrefix: /^\d{4} — /,
  titlePrefix: /^(Bug|Plan) \d{4}: /,
})

// Seven judged mentions, each read by both checks.
const EXAMINED = 14

const named = (m: MdMention): string => `${m.doc.relPath}:${String(m.line)} "${m.text}"`

const join = (cwd: string) => {
  const c = corpus({ cwd, roots: ['**/*.md'] })
  const all = records(c)
  const judged = mentions(c, { pattern: RECORD })
    .that()
    .satisfy(areLinked())
    .and()
    .satisfy(not(TITLE_LINK))
    .select({
      label: 'linked mention',
      identify: (m) => ({ name: named(m), file: m.doc.file, line: m.line }),
    })
  const byName = new Map(judged.elements.map((m) => [named(m), m]))
  return correspondence({
    left: judged,
    right: { elements: all, label: 'record', identify: (r: RecordElement) => ({ name: r.key }) },
    keyBy: { left: keyOf, right: (r) => r.key },
    suggest: {
      // Link the record the mention names; a title is never what is wrong.
      left: (info) => {
        const m = byName.get(info.name)
        const n = m?.groups['n'] ?? ''
        const holders = all.filter((r) => r.key.endsWith(`|bug:${n}`)).map((r) => r.at)
        return holders.length > 0
          ? `Link it to the record it names: ${holders.join(' or ')}.`
          : `No source holds bug ${n}: reword the mention, or add the record.`
      },
    },
  })
    .should()
    .beComplete({ direction: 'left-to-right' })
    .andShould()
    .preserveRelations({
      left: (m) => [pointsAt(m).at],
      right: (r) => [r.at],
      direction: 'left-to-right',
    })
    .expectNonEmpty()
    .because('a link that names one record and opens another sends its reader to the wrong place')
}

/** The pair: every mention of another record sits in a link this rule can read. */
const linked = (cwd: string) =>
  mentions(corpus({ cwd, roots: ['**/*.md'] }), { pattern: RECORD })
    .that()
    .satisfy(
      not(
        areSelfMentions({
          mention: (m: MdMention) =>
            m.groups['n'] === undefined ? undefined : `bug:${m.groups['n']}`,
          document: (d: MdDocument) => {
            const n = LOCAL_RECORD.exec(d.relPath)?.[1]
            return n === undefined ? undefined : `bug:${n}`
          },
        }),
      ),
    )
    .should()
    .beLinked()

/** How many linked mentions the title exemption takes out of the join. */
const exempted = (cwd: string): number =>
  mentions(corpus({ cwd, roots: ['**/*.md'] }), { pattern: RECORD })
    .that()
    .satisfy(areLinked())
    .and()
    .satisfy(TITLE_LINK)
    .select({ label: 'title link', identify: (m) => ({ name: named(m) }) }).elements.length

/** A violating folder's findings: each element and the part of its message that says why. */
const only = (kind: `violating-${string}`): string[] =>
  join(fixture(NAME, kind))
    .violations()
    .map((v) => {
      const why = /relates to "[^"]*"|has no matching record|examined zero units/.exec(v.message)
      return `${v.element}: ${why?.[0] ?? v.message}`
    })

describe('a link names the record it mentions', () => {
  it('clean: local, upstream, own-URL and title links name the record they open', () => {
    const v = join(fixture(NAME, 'clean')).violations()
    expect(v.map((x) => x.message)).toEqual([])
    // Eight linked mentions: five in the notes, one in each of three titles. The title link is
    // exempt, so seven are judged.
    expect(exempted(fixture(NAME, 'clean'))).toBe(1)
    expect(v.examined).toBe(EXAMINED)
    expect(
      linked(fixture(NAME, 'clean'))
        .violations()
        .map((x) => x.message),
    ).toEqual([])
  })

  it('violating-crossed-upstream: a link to another upstream record is red', () => {
    expect(only('violating-crossed-upstream')).toEqual([
      'docs/notes.md:3 "bug 0046": relates to "https://github.com/acme/upstream/blob/main/bugs/fixed/0047-y.md"',
    ])
  })

  it('violating-unclaimed-url: a URL no source claims names nothing', () => {
    expect(only('violating-unclaimed-url')).toEqual([
      'docs/notes.md:3 "bug 0046": has no matching record',
    ])
  })

  it('violating-wrong-local: a mention after a word, linked to another record, is red', () => {
    expect(only('violating-wrong-local')).toEqual([
      'docs/notes.md:3 "bug 0001": relates to "work/bugs/0002-b.md"',
    ])
  })

  it('violating-outside-the-list: an upstream number its list does not hold names nothing', () => {
    expect(only('violating-outside-the-list')).toEqual([
      'docs/notes.md:3 "bug 0048": has no matching record',
    ])
  })

  it("violating-escape: the target's number put in front is not a title link", () => {
    expect(only('violating-escape')).toEqual([
      'docs/notes.md:3 "bug 0001": relates to "work/bugs/0002-b.md"',
    ])
  })

  it('violating-crossed-subject: a mention linked to another record is red', () => {
    expect(only('violating-crossed-subject')).toEqual([
      'docs/notes.md:3 "bug 0001": relates to "work/bugs/0002-b.md"',
    ])
  })

  it('violating-whole-text: a mention that is the whole text is judged, though the title names it', () => {
    expect(only('violating-whole-text')).toEqual([
      'docs/notes.md:3 "bug 0001": relates to "work/bugs/0003-c.md"',
    ])
  })

  it('violating-self-anchor: a link to a heading of its own document is judged', () => {
    expect(only('violating-self-anchor')).toEqual([
      'work/bugs/0002-b.md:5 "bug 0001": relates to "work/bugs/0002-b.md"',
    ])
  })

  it('violating-self-only: a link to its own document is judged, though its text is the title', () => {
    expect(only('violating-self-only')).toEqual([
      'work/bugs/0004-d.md:3 "bug 0001": relates to "work/bugs/0004-d.md"',
    ])
  })

  it('violating-stamp: a link text that is only part of the title is not a title link', () => {
    expect(only('violating-stamp')).toEqual([
      'docs/notes.md:3 "bug 0001": relates to "work/bugs/0002-b.md"',
    ])
  })

  it("violating-wrong-case-path: this corpus's URL with its path in the wrong case opens nothing", () => {
    expect(only('violating-wrong-case-path')).toEqual([
      'docs/notes.md:3 "bug 0001": relates to "work/bugs/0001-A.md"',
    ])
  })

  it('violating-missing-file: a link to a file that is gone is red', () => {
    expect(only('violating-missing-file')).toEqual([
      'docs/notes.md:3 "bug 0001": relates to "work/bugs/0001-gone.md"',
    ])
  })

  it('violating-directory: a link to a folder is red', () => {
    expect(only('violating-directory')).toEqual([
      'docs/notes.md:3 "bug 0001": relates to "work/bugs"',
    ])
  })

  it("violating-reference-link: a link the join cannot read is beLinked()'s finding", () => {
    expect(only('violating-reference-link')).toEqual([])
    const v = linked(fixture(NAME, 'violating-reference-link')).violations()
    expect(v.map((x) => `${x.ruleId ?? ''} ${x.element}`)).toEqual([
      'md/unread-mention docs/notes.md:3',
    ])
  })

  it('violating-no-linked-mention: a join over no linked mention is red, not green', () => {
    expect(only('violating-no-linked-mention').map((f) => f.split(': ')[1])).toEqual([
      'examined zero units',
    ])
  })
})
