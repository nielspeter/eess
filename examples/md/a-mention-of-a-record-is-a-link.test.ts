/**
 * A mention of a record is a link (plan 0539): every place a record names another one, by this
 * corpus's own spelling, sits in a link, so the link is checked and can be followed. The pattern and
 * the keys are this corpus's: bugs and plans numbered with four digits, under `records/bugs/` and
 * `records/plans/`. A record naming itself is not a mention of another record. A fenced example is not
 * read; inline code is, so backticks do not hide a mention.
 *
 * Presence only: which file the link points at is not judged here.
 */
import {
  areSelfMentions,
  corpus,
  mentions,
  not,
  type MdDocument,
  type MdMention,
} from '@nielspeter/eess-md'
import { describe, expect, it } from 'vitest'
import { fixture } from './fixture.js'

const NAME = 'a-mention-of-a-record-is-a-link'

const RECORD = /\b(?<kind>bug|plan)\s+(?<n>\d{4})\b/gi

const mentionKey = (m: MdMention): string | undefined => {
  const { kind, n } = m.groups
  return kind === undefined || n === undefined
    ? undefined
    : `${kind.toLowerCase()}:${String(Number(n))}`
}

const documentKey = (d: MdDocument): string | undefined => {
  const m = /^records\/(bug|plan)s\/(\d{4})-[^/]+\.md$/.exec(d.relPath)
  return m?.[1] === undefined || m[2] === undefined ? undefined : `${m[1]}:${String(Number(m[2]))}`
}

const rule = (cwd: string): ReturnType<typeof mentions> =>
  mentions(corpus({ cwd, roots: ['records/**'] }), { pattern: RECORD })
    .that()
    .satisfy(not(areSelfMentions({ mention: mentionKey, document: documentKey })))
    .should()
    .beLinked()
    .because('a record named by a link is checked and can be followed; a bare number is neither')

describe('a mention of a record is a link', () => {
  it('clean: every mention of another record is a link', () => {
    const v = rule(fixture(NAME, 'clean')).violations()
    expect(v).toHaveLength(0)
    // The bug names the plan and the plan names the bug; titles and the fenced example are not counted.
    expect(v.examined).toBe(2)
  })

  it('violating-plain-mention: a record named in plain text is reported at its line', () => {
    const v = rule(fixture(NAME, 'violating-plain-mention')).violations()
    expect(v).toHaveLength(1)
    const [finding] = v
    expect(finding?.element).toBe('records/plans/0002-export.md:3')
    expect(finding?.message).toBe('"bug 0001" is not a link')
    expect(() => rule(fixture(NAME, 'violating-plain-mention')).check()).toThrow(
      /Architecture violation/,
    )
  })

  it('violating-inline-code: backticks do not hide a mention', () => {
    const v = rule(fixture(NAME, 'violating-inline-code')).violations()
    expect(v).toHaveLength(1)
    const [finding] = v
    expect(finding?.element).toBe('records/plans/0002-export.md:3')
    expect(finding?.message).toBe('"bug 0001" is in inline code, not a link')
  })
})
