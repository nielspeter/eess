/**
 * A plain mention is fixed to the one record it names (plan 0550): `beLinked({ fix })` reports each
 * mention of another record that is not a link, and gives it a fix when exactly one record, in every
 * source this corpus names, holds its key. `eess-ts check --fix` lists those fixes as a dry run;
 * `--fix --apply` writes them.
 *
 * The records are this corpus's bugs under `work/bugs/` and an upstream project's closed list. The
 * key keeps the digits as written, so `bug 0081` never meets the three-digit `081`. `foreign` is how
 * this corpus names the upstream project; a mention with that name around it is reported, never
 * linked, since the fix cannot tell which list it means. A record's own number in its title is not a
 * mention of another record, and `archive/` is frozen: neither is selected.
 *
 * What the fix cannot see is a number from another numbering said only in prose: a record that
 * says its numbers predate a renumbering still has them linked to the records that hold them now.
 * The dry run is the guard; read it grouped by target before `--apply`.
 */
import {
  areSelfMentions,
  corpus,
  mentions,
  not,
  type ArchViolation,
  type Corpus,
  type MdDocument,
  type MdMention,
} from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture.js'

const NAME = 'a-plain-mention-is-fixed'

const RECORD = /\b(?<kind>bug)s?\s+(?<n>\d{3,4})\b/gi
const UPSTREAM = 'https://github.com/acme/upstream/blob/main/'
const UPSTREAM_RECORDS = ['bugs/fixed/0002-x.md']

interface RecordElement {
  readonly key: string
  readonly target: string
}

const LOCAL_RECORD = /^work\/bugs\/(\d{3,4})-[^/]+\.md$/

/** Every record a mention could name: this corpus's bugs, then the upstream list. */
function records(c: Corpus): RecordElement[] {
  const local = c.documents().flatMap((d) => {
    const n = LOCAL_RECORD.exec(d.relPath)?.[1]
    return n === undefined ? [] : [{ key: `bug:${n}`, target: d.relPath }]
  })
  const upstream = UPSTREAM_RECORDS.flatMap((p) => {
    const n = /\/(\d{3,4})-/.exec(p)?.[1]
    return n === undefined ? [] : [{ key: `bug:${n}`, target: UPSTREAM + p }]
  })
  return [...local, ...upstream]
}

/** Digits as written: `bug 0081` and `bug 081` are different keys. */
const mentionKey = (m: MdMention): string | undefined =>
  m.groups['n'] === undefined ? undefined : `bug:${m.groups['n']}`

const documentKey = (d: MdDocument): string | undefined => {
  const n = LOCAL_RECORD.exec(d.relPath)?.[1]
  return n === undefined ? undefined : `bug:${n}`
}

const rule = (cwd: string) => {
  const c = corpus({ cwd, roots: ['**/*.md'], ignore: ['archive/**'] })
  return mentions(c, { pattern: RECORD })
    .that()
    .satisfy(not(areSelfMentions({ mention: mentionKey, document: documentKey })))
    .should()
    .beLinked({
      fix: {
        records: {
          elements: records(c),
          label: 'bug record',
          identify: (r: RecordElement) => ({ name: r.key }),
        },
        key: { mention: mentionKey, record: (r) => r.key },
        target: (r) => r.target,
        foreign: /\bupstream\b/i,
      },
    })
    .because('a record named by a link is checked and can be followed; a bare number is neither')
}

/** Each finding: where, and either the fix's `describe` and replacement, or why it has none. */
const outcome = (kind: 'clean' | `violating-${string}`): string[] =>
  rule(fixture(NAME, kind))
    .violations()
    .map((v: ArchViolation) =>
      v.fix !== undefined
        ? `${v.fix.describe} = ${v.fix.replacement}`
        : `${v.element}: ${/ — not fixed: (.*)$/.exec(v.message)?.[1] ?? v.message}`,
    )

describe('a plain mention is fixed to the one record it names', () => {
  it('clean: a mention exactly one record holds is fixed; titles and the frozen folder are not selected', () => {
    expect(outcome('clean')).toEqual([
      'work/notes.md:3 link "bug 0001" → ./bugs/0001-login.md = [bug 0001](./bugs/0001-login.md)',
    ])
  })

  it('violating-two-sources: a key two sources hold is refused, both named', () => {
    expect(outcome('violating-two-sources')).toEqual([
      'work/notes.md:3: 2 records hold bug:0002: work/bugs/0002-export.md, https://github.com/acme/upstream/blob/main/bugs/fixed/0002-x.md',
    ])
  })

  it('violating-qualifier-beside: the upstream name beside the number refuses it', () => {
    expect(outcome('violating-qualifier-beside')).toEqual([
      'work/notes.md:3: another project is named around it: "See upstream bug 0001."',
    ])
  })

  it("violating-qualifier-in-heading: the upstream name only in a containing section's heading refuses it", () => {
    expect(outcome('violating-qualifier-in-heading')).toEqual([
      'work/notes.md:7: another project is named around it: "Upstream"',
    ])
  })

  it("violating-qualifier-in-parent-item: the upstream name in a list's parent item refuses it", () => {
    expect(outcome('violating-qualifier-in-parent-item')).toEqual([
      'work/notes.md:4: another project is named around it: "Upstream work:"',
    ])
  })

  it("violating-qualifier-in-table-header: the upstream name in a table's header refuses it", () => {
    expect(outcome('violating-qualifier-in-table-header')).toEqual([
      'work/notes.md:5: another project is named around it: "upstream state"',
    ])
  })

  it('violating-four-digit-beside-three: a four-digit mention never meets a three-digit record', () => {
    expect(outcome('violating-four-digit-beside-three')).toEqual([
      'work/notes.md:3: no record holds bug:0081',
    ])
  })

  it('violating-moved-record: a number no record holds now is reported, never guessed', () => {
    expect(outcome('violating-moved-record')).toEqual(['work/notes.md:3: no record holds bug:0003'])
  })

  it('violating-sibling-item: the upstream name in a sibling list item does not refuse it', () => {
    expect(outcome('violating-sibling-item')).toEqual([
      'work/notes.md:4 link "bug 0001" → ./bugs/0001-login.md = [bug 0001](./bugs/0001-login.md)',
    ])
  })

  it('violating-sibling-row: the upstream name in another table row does not refuse it', () => {
    expect(outcome('violating-sibling-row')).toEqual([
      'work/notes.md:6 link "bug 0001" → ./bugs/0001-login.md = [bug 0001](./bugs/0001-login.md)',
    ])
  })

  it('violating-renumbered: a number from another numbering, said only in prose, is still fixed', () => {
    // The accepted residual (plan 0550, Decision 3): this row is wrong, and the fix cannot see it.
    expect(outcome('violating-renumbered')).toEqual([
      'work/notes.md:7 link "Bug 0001" → ./bugs/0001-login.md = [Bug 0001](./bugs/0001-login.md)',
    ])
  })
})
