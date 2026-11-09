import { ArchConfigError } from '@nielspeter/eess'
import type { Root } from 'mdast'
import type { MdDocument } from './document.js'
import {
  phrasingOf,
  type PhrasingLink,
  type PhrasingSegment,
  type UnreadCause,
} from './phrasing.js'
import type { LinkTarget } from './resolve-link.js'

/**
 * Mentions (plan 0539): every match of the caller's pattern in a document's phrasing runs. eess-md
 * fixes no pattern, lane or key (ADR-022): the pattern is the caller's, and its named captures ride
 * on each element. The match runs over a run's joined text, so a mention split by emphasis or by a
 * soft break (a `\n` in the text) is one match, when the caller's pattern allows the break.
 */

/** A match of the caller's pattern in one document's tree, as `collectMentions` reads it. */
export interface MdMentionMatch {
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
  /**
   * Under `keepBackticks` (plan 0647): the names of the pattern's groups whose whole capture lies
   * inside one inline-code span, between its backticks. Absent without the opt-in, so a reading that
   * did not ask cannot be mistaken for one in which no group is code.
   */
  readonly codeGroups?: readonly string[]
}

/** How a document's text is read for mentions (plan 0647). */
export interface MentionReading {
  /**
   * Run the pattern over the text with inline code's backticks kept, as `MdMentionLink.text` reads
   * a link's text, and say which groups lie wholly inside one code span (`codeGroups`).
   */
  readonly keepBackticks?: boolean
}

/** Where a mention sits in its document's source, as 0-based offsets, end exclusive (plan 0550). */
export interface MdMentionSpan {
  readonly start: number
  readonly end: number
}

/** The link a mention sits in, and where it points (plan 0549). */
export interface MdMentionLink {
  readonly url: string
  /**
   * The link's whole text, joined as a heading's is, so it compares with a title: inline code keeps
   * its backticks, an image adds nothing, the ends are trimmed. Not `links()`'s `MdLinkRef.text`,
   * which drops the backticks.
   */
  readonly text: string
  /** Where the link resolves, as `links()` resolves it (`resolveLink`), with the rule's resolve options. */
  readonly target: LinkTarget
  /**
   * Where the mention starts in `text`, in characters. Absent in three cases: the mention begins
   * before the link (`plan [0070](…)`); it sits in the link's title; or the link holds inline HTML
   * or a hard line break, whose text this walk and `text` join differently, so no place in `text`
   * is known. Absent never means a place: read it as "not known to start in `text`".
   */
  readonly offset?: number
}

/** A match of the caller's pattern in a document's text, with the link it sits in. */
export interface MdMentionRef extends Omit<MdMentionMatch, 'link'> {
  /** The link holding the match's last character, if any. */
  readonly link?: MdMentionLink
  /**
   * The match's place in the source, present only when the source there is the matched text: no
   * escape, entity, emphasis, inline code edge or line break inside it. A fix can only write here.
   */
  readonly span?: MdMentionSpan
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
/** The same copy with the `d` flag, for a reading that needs each group's range (plan 0647). */
const GLOBAL_INDICES = new WeakMap<RegExp, RegExp>()

/**
 * A private global copy of the caller's pattern, made once per pattern, so `matchAll` reads every
 * match and no `lastIndex` is shared with the caller's object. `y` is dropped: a sticky match
 * anchored at each run's start is not what a mention is.
 */
function globalCopy(re: RegExp, indices = false): RegExp {
  const cache = indices ? GLOBAL_INDICES : GLOBAL
  const known = cache.get(re)
  if (known !== undefined) return known
  const flags = re.flags.replace(/[gyd]/g, '') + 'g' + (indices ? 'd' : '')
  const copy = new RegExp(re.source, flags)
  cache.set(re, copy)
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

function* matches(
  text: string,
  re: RegExp,
  owner: string,
  indices = false,
): Generator<RegExpMatchArray> {
  for (const m of text.matchAll(globalCopy(re, indices))) {
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

/** A match as the walk finds it: the link it sits in, shared by its mentions, and its offset there. */
type FoundMention = Omit<MdMentionMatch, 'link'> & {
  readonly link?: PhrasingLink
  readonly offset?: number
  readonly span?: MdMentionSpan
}

/** Every mention of `pattern` in one document, read and unread. */
export function collectMentions(
  root: Root,
  pattern: RegExp,
  reading: MentionReading = {},
): { readonly mentions: MdMentionMatch[]; readonly unread: UnreadMentionRef[] } {
  const { mentions, unread } = findMentions(root, pattern, undefined, reading)
  return {
    mentions: mentions.map((m) => ({
      line: m.line,
      text: m.text,
      groups: m.groups,
      inCode: m.inCode,
      ...(m.link ? { link: { url: m.link.url } } : {}),
      ...(m.codeGroups ? { codeGroups: m.codeGroups } : {}),
    })),
    unread,
  }
}

/**
 * Where a match starts in its link's text, or `undefined` when it does not start there. The link's
 * segments are joined as its text is (`headingName`: inline code in backticks, ends trimmed); a link
 * whose segments do not join to that text (inline HTML inside it) gives no offset.
 */
function offsetInLink(
  segs: readonly PhrasingSegment[],
  starts: readonly number[],
  a: number,
  b: number,
  index: number,
): number | undefined {
  const link = segs[b]?.link
  if (link === undefined || segs[b]?.title === true) return undefined
  let k = b
  while (k > 0 && segs[k - 1]?.link === link) k--
  if (a < k) return undefined
  let joined = ''
  let at: number | undefined
  for (let i = k; i < segs.length && segs[i]?.link === link; i++) {
    const s = segs[i]
    if (s === undefined) break
    const tick = s.inCode ? '`' : ''
    if (i === a) at = joined.length + tick.length + (index - (starts[i] ?? 0))
    joined += tick + s.text + tick
  }
  const lead = joined.length - joined.trimStart().length
  if (at === undefined || joined.trim() !== link.text || at < lead) return undefined
  return at - lead
}

/**
 * A match's source span: inside one segment, with no line break, starting where the walk placed its
 * first character, and the source there the matched text. The place is only as good as the walk,
 * which gives up rather than guess (`sourceOffsets`); the text check catches a walk that drifted
 * onto different bytes, not one that drifted onto the same text elsewhere.
 */
function spanOf(
  seg: PhrasingSegment,
  oneSegment: boolean,
  at: number,
  text: string,
  source: string | undefined,
): MdMentionSpan | undefined {
  if (!oneSegment || seg.offsets === undefined || source === undefined || text.includes('\n')) {
    return undefined
  }
  const start = seg.offsets[at]
  if (start === undefined || start < 0) return undefined
  const end = start + text.length
  return source.slice(start, end) === text ? { start, end } : undefined
}

/**
 * The names of the match's groups whose whole capture lies inside one code segment's text, between
 * its backticks (plan 0647). Read from the `d` flag's ranges; a group that did not capture has none.
 */
function groupsInCode(
  m: RegExpMatchArray,
  segs: readonly PhrasingSegment[],
  starts: readonly number[],
): string[] {
  const out: string[] = []
  for (const [name, range] of Object.entries(m.indices?.groups ?? {})) {
    if (range === undefined) continue
    const [from, to] = range
    const inside = segs.some((seg, i) => {
      const start = starts[i]
      return seg.inCode && start !== undefined && from >= start && to <= start + seg.text.length
    })
    if (inside) out.push(name)
  }
  return out
}

/** Every mention of `pattern` in one document, each with its link, its place in the link's text and in `source`. */
export function findMentions(
  root: Root,
  pattern: RegExp,
  source: string | undefined,
  reading: MentionReading = {},
): { readonly mentions: FoundMention[]; readonly unread: UnreadMentionRef[] } {
  const owner = 'mentions'
  const keep = reading.keepBackticks === true
  const { runs, unread: unreadText } = phrasingOf(root, source)
  const mentions: FoundMention[] = []
  for (const run of runs) {
    const segs = run.segments
    let joined = ''
    // `begins`: where each segment's region opens in `joined`, its opening backtick included under
    // `keepBackticks`, so a match is placed in the segment it starts in. `starts`: where its text
    // opens, which every offset below is measured from, as in the default reading.
    const begins: number[] = []
    const starts: number[] = []
    for (const s of segs) {
      const tick = keep && s.inCode ? '`' : ''
      begins.push(joined.length)
      starts.push(joined.length + tick.length)
      joined += tick + s.text + tick
    }
    const at = (offset: number): number => {
      let i = 0
      while (i + 1 < begins.length && (begins[i + 1] ?? Infinity) <= offset) i++
      return i
    }
    for (const m of matches(joined, pattern, owner, keep)) {
      const index = m.index ?? 0
      const a = at(index)
      const b = at(index + m[0].length - 1)
      const first = segs[a]
      const last = segs[b]
      if (first === undefined || last === undefined) continue
      const before = first.text.slice(0, Math.max(0, index - (starts[a] ?? 0)))
      const line = first.line + (before.match(/\n/g)?.length ?? 0)
      const offset = offsetInLink(segs, starts, a, b, index)
      const span = spanOf(first, a === b, index - (starts[a] ?? 0), m[0], source)
      const codeGroups = keep ? groupsInCode(m, segs, starts) : undefined
      mentions.push({
        line,
        text: m[0],
        groups: groupsOf(m),
        inCode: segs.slice(a, b + 1).some((s) => s.inCode),
        ...(last.link ? { link: last.link } : {}),
        ...(offset !== undefined ? { offset } : {}),
        ...(span !== undefined ? { span } : {}),
        ...(codeGroups !== undefined ? { codeGroups } : {}),
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
