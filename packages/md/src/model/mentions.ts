import { ArchConfigError } from '@nielspeter/eess'
import type { Root } from 'mdast'
import type { MdDocument } from './document.js'
import { phrasingOf, type UnreadCause } from './phrasing.js'

/**
 * Mentions (plan 0539): every match of the caller's pattern in a document's phrasing runs. eess-md
 * fixes no pattern, lane or key (ADR-022): the pattern is the caller's, and its named captures ride
 * on each element. The match runs over a run's joined text, so a mention split by emphasis or by a
 * soft break (a `\n` in the text) is one match, when the caller's pattern allows the break.
 */

/** A match of the caller's pattern in a document's text. */
export interface MdMentionRef {
  /** 1-based line of the match's first character. */
  readonly line: number
  /** The matched text, as joined from the run (a soft break is a `\n`). */
  readonly text: string
  /** The pattern's named captures; a group that did not take part is absent. */
  readonly groups: Readonly<Record<string, string>>
  /** Any part of the match sits in inline code. */
  readonly inCode: boolean
  /** The link holding the match's last character, if any. */
  readonly link?: { readonly url: string }
}

/** A mention: a match of the caller's pattern in a document's text, with its document. */
export type MdMention = MdMentionRef & { readonly doc: MdDocument }

/** A match in text a reader sees but no run holds, with the reason it is not read. */
export interface UnreadMentionRef {
  readonly line: number
  readonly text: string
  readonly groups: Readonly<Record<string, string>>
  readonly cause: UnreadCause
}

/** A match in text no rule can read, with its document. */
export type MdUnreadMention = UnreadMentionRef & { readonly doc: MdDocument }

const GLOBAL = new WeakMap<RegExp, RegExp>()

/**
 * A private global copy of the caller's pattern, made once per pattern, so `matchAll` reads every
 * match and no `lastIndex` is shared with the caller's object. `y` is dropped: a sticky match
 * anchored at each run's start is not what a mention is.
 */
function globalCopy(re: RegExp): RegExp {
  const known = GLOBAL.get(re)
  if (known !== undefined) return known
  const copy = new RegExp(re.source, re.flags.replace(/[gy]/g, '') + 'g')
  GLOBAL.set(re, copy)
  return copy
}

/** Refuse a pattern that can match nothing at all: it would find a mention between every two characters. */
export function validateMentionPattern(re: RegExp, owner: string): void {
  if (new RegExp(re.source, re.flags.replace(/[gy]/g, '')).test('')) {
    throw new ArchConfigError(
      owner,
      `${owner}: the pattern ${String(re)} matches the empty string, so every position in every ` +
        `document would be a mention. Write a pattern that needs at least one character.`,
    )
  }
}

function groupsOf(m: RegExpMatchArray): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(m.groups ?? {}))
    if (value !== undefined) out[name] = value
  return out
}

function* matches(text: string, re: RegExp, owner: string): Generator<RegExpMatchArray> {
  for (const m of text.matchAll(globalCopy(re))) {
    if (m[0].length === 0) {
      throw new ArchConfigError(
        owner,
        `${owner}: the pattern ${String(re)} matched an empty string at offset ${String(m.index)} ` +
          `of "${text.slice(0, 40)}", so it cannot say where a mention is. Write a pattern that ` +
          `needs at least one character.`,
      )
    }
    yield m
  }
}

/** Every mention of `pattern` in one document, read and unread. */
export function collectMentions(
  root: Root,
  pattern: RegExp,
): { readonly mentions: MdMentionRef[]; readonly unread: UnreadMentionRef[] } {
  const owner = 'mentions'
  const { runs, unread: unreadText } = phrasingOf(root)
  const mentions: MdMentionRef[] = []
  for (const run of runs) {
    const segs = run.segments
    let joined = ''
    const starts: number[] = []
    for (const s of segs) {
      starts.push(joined.length)
      joined += s.text
    }
    const at = (offset: number): number => {
      let i = 0
      while (i + 1 < starts.length && (starts[i + 1] ?? Infinity) <= offset) i++
      return i
    }
    for (const m of matches(joined, pattern, owner)) {
      const index = m.index ?? 0
      const a = at(index)
      const b = at(index + m[0].length - 1)
      const first = segs[a]
      const last = segs[b]
      if (first === undefined || last === undefined) continue
      const before = first.text.slice(0, index - (starts[a] ?? 0))
      const line = first.line + (before.match(/\n/g)?.length ?? 0)
      mentions.push({
        line,
        text: m[0],
        groups: groupsOf(m),
        inCode: segs.slice(a, b + 1).some((s) => s.inCode),
        ...(last.link ? { link: last.link } : {}),
      })
    }
  }
  const unread: UnreadMentionRef[] = []
  for (const u of unreadText) {
    for (const m of matches(u.text, pattern, owner)) {
      const before = u.text.slice(0, m.index ?? 0)
      unread.push({
        line: u.line + (before.match(/\n/g)?.length ?? 0),
        text: m[0],
        groups: groupsOf(m),
        cause: u.cause,
      })
    }
  }
  return { mentions, unread }
}
