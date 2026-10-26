import {
  ArchConfigError,
  type ArchFix,
  type ArchViolation,
  type Condition,
  type Selection,
} from '@nielspeter/eess'
import { matchSelections } from '@nielspeter/eess/internal'
import type { MdMention } from '../model/mentions.js'
import { mentionContext } from '../model/mention-context.js'
import { fixesThatKeepTheDocument, linkKey, type CheckedFix } from '../model/fix-check.js'
import { EXTERNAL_RE } from '../model/links.js'
import { isRepoPath, relativeLinkPath } from '../model/resolve-link.js'
import { mdViolation } from '../model/violation.js'

const LINK_IT =
  'Link it to what it names. If it quotes an example rather than naming something, move the example into a fenced code block, which is not read.'
const LINK_CODE =
  'Put a link around it, or, if it quotes an example rather than naming something, move the example into a fenced code block, which is not read.'

/** A `beLinked()` fix's configuration finding (plan 0550): nothing would be fixed, and nothing hides it. */
export const MENTION_FIX_CONFIG = 'md/mention-fix-config'

/**
 * How `beLinked()` fixes a plain mention (plan 0550): link it to the one record that holds its key.
 * Every part is the caller's (ADR-022): the records, from every source the corpus names, and how a
 * mention and a record are keyed.
 */
export interface MentionFix<R> {
  /** Every record a mention could name, from every source, as one selection. */
  readonly records: Selection<R>
  /** The key a mention names (`undefined` for none) and the key a record is. Keep digits as written. */
  readonly key: {
    readonly mention: (m: MdMention) => string | undefined
    readonly record: (r: R) => string
  }
  /** Where a record lives: a repository path, written relative to the mention, or an absolute URL. */
  readonly target: (r: R) => string
  /**
   * How this corpus names another project, read in the text around a mention: a match refuses the
   * fix. Required: a corpus that names no other project passes a pattern that matches nothing, `/(?!)/`.
   */
  readonly foreign: RegExp
}

/** `beLinked()`'s options. */
export interface BeLinkedOptions<R> {
  /** A fix for a plain mention, when exactly one record holds its key (plan 0550). */
  readonly fix?: MentionFix<R>
}

/** What `beLinked()` checks of a fix when it is called: Node imports a rule file without checking types (ADR-015). */
function checkedFix<R>(fix: MentionFix<R>): RegExp {
  // Read as `unknown`: an untyped caller's object can lack any field the type promises.
  const records: unknown = Reflect.get(fix, 'records')
  const key: unknown = Reflect.get(fix, 'key')
  const fault = (what: string): never => {
    throw new ArchConfigError('beLinked', `beLinked: the fix's ${what}`)
  }
  if (
    typeof records !== 'object' ||
    records === null ||
    !Array.isArray(Reflect.get(records, 'elements'))
  ) {
    fault(
      'records must be a selection, { elements, label, identify }, of the records a mention names',
    )
  }
  if (
    typeof key !== 'object' ||
    key === null ||
    typeof Reflect.get(key, 'mention') !== 'function' ||
    typeof Reflect.get(key, 'record') !== 'function'
  ) {
    fault('key must hold two functions, mention and record, that key a mention and a record alike')
  }
  if (typeof Reflect.get(fix, 'target') !== 'function')
    fault("target must be a function giving a record's path or URL")
  const foreign: unknown = Reflect.get(fix, 'foreign')
  if (!(foreign instanceof RegExp)) {
    return fault(
      `foreign must be a RegExp naming how this corpus names another project; got ` +
        `${foreign === undefined ? 'nothing' : typeof foreign}. A corpus that names no other ` +
        `project passes /(?!)/, which matches nothing.`,
    )
  }
  const copy = new RegExp(foreign.source, foreign.flags.replace(/[gy]/g, ''))
  if (copy.test('')) {
    fault(
      `foreign ${String(foreign)} matches the empty string, so it would refuse every fix. ` +
        'Write a pattern that needs at least one character.',
    )
  }
  return copy
}

/**
 * The link destination for `target`, or why it cannot be written. A URL is written as it is and a
 * repository path relative to the mention's document; either goes in `<…>` when a space or a
 * parenthesis would end it early. What no destination form keeps (`<`, `>`, `\`, a line break, and
 * in a path `#` or `?`, which would start a fragment or a query) is refused.
 */
function destinationOf(
  target: string,
  from: string,
): { readonly dest: string } | { readonly refused: string } {
  const url = EXTERNAL_RE.test(target)
  if (/&[#A-Za-z0-9]+;/.test(target)) {
    return {
      refused: `its target "${target}" holds an entity, which a link destination would decode`,
    }
  }
  if (/[<>\\\n]/.test(target) || (!url && /[#?]/.test(target))) {
    return { refused: `its target "${target}" cannot be written as a link destination` }
  }
  if (!url && !isRepoPath(target)) {
    return { refused: `its target "${target}" is not a path inside the repository` }
  }
  const dest = url ? target : relativeLinkPath(from, target)
  return { dest: /[\s()]/.test(dest) ? `<${dest}>` : dest }
}

/**
 * Plan 0539: every selected mention sits in a link. Presence only: which file the link points at is
 * not judged here, so a link to the wrong record is linked. A mention in inline code is a finding with
 * its own message, since inline code is read: wrapping a number in backticks does not hide it.
 *
 * Plan 0550: with `fix`, a plain mention whose key exactly one record holds carries an `ArchFix`
 * linking it there. Anything else is refused, and the finding says why: no record or several, a key
 * that is `undefined`, inline code, an inexact `span`, a `!` or `]` before it, a bracket in it,
 * `foreign` in the text around it, or a target that cannot be written (a `|` in a table cell, a
 * character no link destination keeps, a path outside the repository).
 */
export function beLinked<R>(options: BeLinkedOptions<R> = {}): Condition<MdMention> {
  const fix = options.fix
  const foreign = fix === undefined ? undefined : checkedFix(fix)
  return {
    description: 'be linked',
    evaluate: (mentions, ctx) => {
      const plain = mentions.filter((m) => m.link === undefined)
      const keys = new Map<MdMention, string | undefined>()
      if (fix !== undefined) for (const m of mentions) keys.set(m, fix.key.mention(m))
      const config = fix === undefined ? [] : configFindings(fix, mentions, keys, ctx)
      const repairs =
        fix === undefined || foreign === undefined || config.length > 0
          ? undefined
          : repairsFor(fix, foreign, plain, keys)
      const findings = plain.map((m) => {
        const text = m.text.replace(/\s+/g, ' ')
        const repair = repairs?.get(m)
        const why =
          repair !== undefined && 'refused' in repair ? ` — not fixed: ${repair.refused}` : ''
        return mdViolation({
          element: `${m.doc.relPath}:${String(m.line)}`,
          file: m.doc.file,
          line: m.line,
          message:
            (m.inCode ? `"${text}" is in inline code, not a link` : `"${text}" is not a link`) +
            why,
          sourceText: m.doc.text,
          ...(repair !== undefined && 'fix' in repair ? { fix: repair.fix } : {}),
          context: { ...ctx, suggestion: ctx.suggestion ?? (m.inCode ? LINK_CODE : LINK_IT) },
        })
      })
      return [...config, ...findings]
    },
  }
}

type Repair = { readonly fix: ArchFix; readonly url: string } | { readonly refused: string }

/** An odd run of backslashes right before `at` escapes the character there. */
function oddBackslashesBefore(text: string, at: number): boolean {
  let n = 0
  while (text[at - 1 - n] === '\\') n++
  return n % 2 === 1
}

/** Each plain mention's fix, or why it has none. */
function repairsFor<R>(
  fix: MentionFix<R>,
  foreign: RegExp,
  plain: readonly MdMention[],
  keys: ReadonlyMap<MdMention, string | undefined>,
): Map<MdMention, Repair> {
  const keyed = plain.filter((m) => keys.get(m) !== undefined)
  const { pairs } = matchSelections(keyed, fix.records.elements, {
    leftKey: (m) => keys.get(m) ?? '',
    rightKey: fix.key.record,
  })
  // One record listed twice, under one target, is one record: the same link either way.
  const holders = new Map<MdMention, Map<string, R>>()
  for (const p of pairs) {
    const byTarget = holders.get(p.left) ?? new Map<string, R>()
    byTarget.set(fix.target(p.right), p.right)
    holders.set(p.left, byTarget)
  }
  const out = new Map<MdMention, Repair>()
  for (const m of plain) {
    out.set(m, repairOf(fix, foreign, m, keys.get(m), [...(holders.get(m)?.values() ?? [])]))
  }
  return keptByTheDocument(out)
}

/** Each document's fixes, kept only where writing them leaves the same document with its mentions linked. */
function keptByTheDocument(repairs: Map<MdMention, Repair>): Map<MdMention, Repair> {
  const byDoc = new Map<MdMention['doc'], (CheckedFix & { readonly m: MdMention })[]>()
  for (const [m, r] of repairs) {
    if (!('fix' in r)) continue
    const list = byDoc.get(m.doc) ?? []
    list.push({ m, fix: r.fix, link: linkKey(r.url, m.text) })
    byDoc.set(m.doc, list)
  }
  for (const [doc, list] of byDoc) {
    const kept = fixesThatKeepTheDocument(doc.root, doc.text, list)
    for (const { m, fix } of list) {
      if (!kept.has(fix)) {
        repairs.set(m, { refused: 'a link here would change the document around it' })
      }
    }
  }
  return repairs
}

function repairOf<R>(
  fix: MentionFix<R>,
  foreign: RegExp,
  m: MdMention,
  key: string | undefined,
  candidates: readonly R[],
): Repair {
  if (key === undefined) return { refused: 'its key names no record' }
  if (m.inCode) return { refused: 'it is in inline code' }
  // Exactly one record, or no fix: two are a choice, none is nothing to link to.
  if (candidates.length !== 1) {
    return {
      refused:
        candidates.length === 0
          ? `no record holds ${key}`
          : `${String(candidates.length)} records hold ${key}: ${candidates.map((r) => fix.target(r)).join(', ')}`,
    }
  }
  const record = candidates[0]
  if (record === undefined) return { refused: `no record holds ${key}` }
  const span = m.span
  if (span === undefined) {
    return {
      refused:
        'its text in the source is not the mention as written (an entity, emphasis or line break in it, or an "&" before it that may be an entity)',
    }
  }
  if (/[[\]]/.test(m.text)) return { refused: 'a bracket in it would end the link text' }
  if (/^[*_~]|[*_~\\]$/.test(m.text)) {
    return { refused: 'it starts or ends with a mark the link would change: "*", "_", "~" or "\\"' }
  }
  const before = m.doc.text[span.start - 1]
  if (before === '!') return { refused: 'it follows "!", so a link would be an image' }
  if (/[*_~]/.test(before ?? '') || /[*_~]/.test(m.doc.text[span.end] ?? '')) {
    return { refused: 'it touches "*", "_" or "~", whose emphasis a link beside it would change' }
  }
  if (oddBackslashesBefore(m.doc.text, span.start)) {
    return { refused: 'it follows a backslash, which would escape the link' }
  }
  if (before === ']')
    return { refused: 'it follows "]", so a link would join the brackets before it' }
  const around = mentionContext(m.doc, m.line)
  const named = around.texts.find((t) => foreign.test(t))
  if (named !== undefined) {
    return {
      refused: `another project is named around it: "${named.replace(/\s+/g, ' ').slice(0, 60)}"`,
    }
  }
  const target = fix.target(record)
  if (around.inTable && target.includes('|')) {
    return { refused: 'its target holds "|", which would end its table cell' }
  }
  const written = destinationOf(target, m.doc.relPath)
  if ('refused' in written) return written
  const dest = written.dest
  return {
    url: dest.startsWith('<') ? dest.slice(1, -1) : dest,
    fix: {
      file: m.doc.file,
      start: span.start,
      end: span.end,
      replacement: `[${m.text}](${dest})`,
      describe: `${m.doc.relPath}:${String(m.line)} link "${m.text}" → ${dest}`,
    },
  }
}

/** One finding per run when the fix could link nothing, so `.warn()` and exclusions cannot hide it. */
function configFindings<R>(
  fix: MentionFix<R>,
  mentions: readonly MdMention[],
  keys: ReadonlyMap<MdMention, string | undefined>,
  ctx: { readonly rule: string; readonly because?: string; readonly docs?: string },
): ArchViolation[] {
  const label = fix.records.label
  // No file: a configuration finding is the rule's, which the runner places on its rule file.
  const finding = (message: string, suggestion: string): ArchViolation => ({
    rule: ctx.rule,
    ruleId: MENTION_FIX_CONFIG,
    element: `${ctx.rule}: beLinked fix over ${label}`,
    file: '',
    line: 0,
    message,
    suggestion,
    ...(ctx.because !== undefined ? { because: ctx.because } : {}),
    ...(ctx.docs !== undefined ? { docs: ctx.docs } : {}),
    bypassFilters: true,
  })
  const records = fix.records.elements
  if (records.length === 0) {
    return [
      finding(
        `the fix's records, "${label}", hold no record, so no mention can be fixed`,
        'Pass the records your mentions name, from every source the corpus names.',
      ),
    ]
  }
  const recordKeys = new Set(records.map((r) => fix.key.record(r)))
  const mentionKeys = mentions.map((m) => keys.get(m))
  if (mentionKeys.some((k) => k !== undefined && recordKeys.has(k))) return []
  const sampleMention = mentionKeys.find((k) => k !== undefined)
  const [sampleRecord] = recordKeys
  return [
    finding(
      `no mention's key meets a record's: the mentions give ${sampleMention === undefined ? 'no key at all' : `"${sampleMention}"`}, ` +
        `the records "${label}" give "${sampleRecord ?? ''}"`,
      'Make key.mention and key.record produce the same key for a mention and the record it names.',
    ),
  ]
}
