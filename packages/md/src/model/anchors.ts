import type { Nodes } from 'mdast'
import GithubSlugger from 'github-slugger'
import { ArchConfigError } from '@nielspeter/eess'
import type { MdDocument } from './document.js'
import { attributeOf, readHtmlNode } from './html-attributes.js'
import { lineCount } from './line-count.js'

/**
 * How a renderer turns a document into the anchors a link's fragment can reach (bug 0136, spike
 * 0574 decision 1). The rule is the **linking** document's renderer's, since a reader stays in one
 * renderer. eess-md names one renderer, as the default: {@link githubAnchors}, github.com's. Any
 * other is the caller's to pass, through `LinkResolveOptions.anchors`.
 */
export interface AnchorRule {
  /** The renderer's name, as a finding names the rule that judged a fragment. */
  readonly name: string
  /**
   * Each heading's id, from every heading's text in document order, at any depth: list in, list
   * out, so the renderer's numbering of a repeated heading and an explicit `{#id}` live here. A
   * result of another length is a configuration error. It must give the same ids for the same
   * headings: a document's anchors are cached per rule. The text is eess-md's reading of the
   * heading: its text and inline code, without raw HTML, an image's alt or a break.
   */
  readonly ids: (headings: readonly string[]) => readonly string[]
  /** Other fragments an anchor also answers to (GitHub's `user-content-` form); none if absent. */
  readonly aliases?: (id: string) => readonly string[]
  /** Whether the renderer keeps attribute `attribute` of HTML element `element` as an anchor. */
  readonly keepsHtmlAnchor: (element: string, attribute: string) => boolean
  /**
   * The page the host shows for a directory, by file name (GitHub's: `README.md`), against which a
   * fragment on a directory link is judged (bug 0575). Absent: such a fragment is not judged.
   */
  readonly directoryPage?: string
}

/**
 * github.com's renderer's rule, the default (spike 0574 decision 1). Heading ids are
 * `github-slugger`'s, which mirrors GitHub's: lowercased, punctuation removed, spaces to `-`, a
 * repeated id numbered `-1`, `-2`. GitHub answers to every id under `user-content-` too. Of raw
 * HTML it keeps `id` and `name` on `<a>` as anchors, the reading that fails closed while what its
 * sanitizer keeps elsewhere is not measured (spike 0574 section 7).
 */
export const githubAnchors: AnchorRule = {
  name: 'GitHub',
  ids: (headings) => {
    const slugger = new GithubSlugger()
    return headings.map((h) => slugger.slug(h))
  },
  aliases: (id) => [`user-content-${id}`],
  keepsHtmlAnchor: (element, attribute) =>
    element === 'a' && (attribute === 'id' || attribute === 'name'),
  directoryPage: 'README.md',
}

/**
 * What a fragment found in its target (spike 0574 decision 3): an anchor, none (with the anchors
 * nearest to it), or a percent-encoding that does not decode. The fragment is as the link writes
 * it, without its `#`.
 */
export type FragmentVerdict =
  | { readonly kind: 'found' }
  | {
      readonly kind: 'absent'
      readonly fragment: string
      /** The rule that judged it, by its `name`. */
      readonly rule: string
      /** Up to three anchors nearest to the fragment, one differing only in letter case first. */
      readonly nearest: readonly string[]
      /** An anchor that differs from the fragment only in letter case, if one does. */
      readonly caseOnly?: string
      /**
       * The HTML element and attribute (`id` or `name`) the fragment names, when the rule does not
       * count that attribute of that element as an anchor: the rule's choice, not the author's slip.
       */
      readonly uncounted?: { readonly element: string; readonly attribute: string }
    }
  | { readonly kind: 'malformed'; readonly fragment: string }
  /** A line fragment (`#L5`, `#L5-L9`, `#L5C3`) past the file's last line, or a column past its line. */
  | {
      readonly kind: 'out-of-range'
      readonly fragment: string
      /** How many lines the file has. */
      readonly lines: number
      /** The line, and the column with that line's length, that is out of range. */
      readonly line: number
      readonly column?: { readonly column: number; readonly length: number }
    }
  /** A fragment this rule cannot judge (bug 0575): ADR-021's class, an unsuppressable finding. */
  | {
      readonly kind: 'not-judged'
      readonly fragment: string
      readonly reason: NotJudgedReason
      /** The file the fragment would be read in, when it is not the link's own target (a directory's page). */
      readonly file?: string
      /** The page the rule names for a directory, for `no-directory-page`. */
      readonly page?: string
    }

/**
 * Why a fragment is not judged: its target is a file the corpus ignores; a text file that is not
 * Markdown, with a fragment that is not a line; a file that is not text, which has no lines; a
 * directory without the page the rule names for it, or a rule that names none; a file that cannot be
 * read; or the linking document itself, when the corpus did not load it.
 */
export type NotJudgedReason =
  | 'ignored'
  | 'not-markdown'
  | 'not-text'
  | 'no-directory-page'
  | 'no-page-rule'
  | 'unreadable'
  | 'not-loaded'

/**
 * A document's anchors under one rule: every form a fragment can reach, the ids alone, and the HTML
 * ids and names the rule does not count, by the element that holds them.
 */
interface AnchorSet {
  readonly reachable: ReadonlySet<string>
  readonly ids: readonly string[]
  readonly uncounted: ReadonlyMap<string, { readonly element: string; readonly attribute: string }>
}

/** Cached per rule, then per document, so two rules over one corpus never answer for each other. */
const cache = new WeakMap<AnchorRule, WeakMap<MdDocument, AnchorSet>>()

/** A heading's text as a renderer reads it for its id (spike 0574 decision 2). */
function headingText(node: Nodes): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value
  if (
    node.type === 'html' ||
    node.type === 'image' ||
    node.type === 'imageReference' ||
    node.type === 'break' ||
    node.type === 'footnoteReference'
  )
    return ''
  return 'children' in node ? node.children.map(headingText).join('') : ''
}

function anchorsOf(doc: MdDocument, rule: AnchorRule): AnchorSet {
  let byDoc = cache.get(rule)
  if (byDoc === undefined) {
    byDoc = new WeakMap()
    cache.set(rule, byDoc)
  }
  const known = byDoc.get(doc)
  if (known !== undefined) return known
  const headings: string[] = []
  const html: string[] = []
  const uncounted = new Map<string, { readonly element: string; readonly attribute: string }>()
  const walk = (node: Nodes): void => {
    if (node.type === 'heading') headings.push(node.children.map(headingText).join(''))
    if (node.type === 'html') {
      // Finished tags only, and never one inside a comment: the tokenizer reads a comment as one.
      for (const tag of readHtmlNode(node, 'no-source').starts) {
        for (const attribute of ['id', 'name']) {
          const value = attributeOf(tag, attribute)?.value
          if (value === undefined || value === '') continue
          if (rule.keepsHtmlAnchor(tag.name, attribute)) html.push(value)
          else if (!uncounted.has(value)) uncounted.set(value, { element: tag.name, attribute })
        }
      }
    }
    if ('children' in node) for (const child of node.children) walk(child)
  }
  walk(doc.root)
  const headingIds = rule.ids(headings)
  if (headingIds.length !== headings.length) {
    throw new ArchConfigError(
      'anchors',
      `anchors: the ${rule.name} rule gave ${String(headingIds.length)} ids for the ` +
        `${String(headings.length)} headings of ${doc.relPath}; it must give one id per heading, in order.`,
    )
  }
  const ids = [...headingIds, ...html]
  const reachable = new Set<string>()
  for (const id of ids) {
    reachable.add(id)
    for (const alias of rule.aliases?.(id) ?? []) reachable.add(alias)
  }
  const built: AnchorSet = { reachable, ids, uncounted }
  byDoc.set(doc, built)
  return built
}

/** Edit distance, for naming the anchors nearest to a dead fragment. */
function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      next.push(Math.min((row[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1, (row[j - 1] ?? 0) + cost))
    }
    row = next
  }
  return row[b.length] ?? 0
}

function nearestTo(fragment: string, ids: readonly string[], rule: AnchorRule): string[] {
  // A near miss of an alias (`#user-content-instal`) is compared as the id it aliases.
  const bare = aliasBase(fragment, ids, rule)
  const lower = bare.toLowerCase()
  const caseOnly = ids.filter((id) => id !== bare && id.toLowerCase() === lower)
  // A short fragment is near too much to name: at most one edit under four characters.
  const limit = bare.length < 4 ? 1 : Math.max(2, Math.floor(bare.length / 3))
  const close = [...new Set(ids)]
    .filter((id) => !caseOnly.includes(id))
    .map((id) => ({ id, d: distance(lower, id.toLowerCase()) }))
    .filter((x) => x.d <= limit)
    .sort((x, y) => x.d - y.d || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
    .map((x) => x.id)
  return [...new Set(caseOnly), ...close].slice(0, 3)
}

/** `fragment` without the prefix of an alias form the rule gives, or `fragment` as it is. */
function aliasBase(fragment: string, ids: readonly string[], rule: AnchorRule): string {
  const probe = ids[0] ?? 'x'
  for (const alias of rule.aliases?.(probe) ?? []) {
    const at = alias.indexOf(probe)
    const prefix = at > 0 ? alias.slice(0, at) : ''
    if (prefix !== '' && fragment.startsWith(prefix)) return fragment.slice(prefix.length)
  }
  return fragment
}

/**
 * Judge `fragment` (as written, without its `#`) against `doc`'s anchors under `rule` (spike 0574
 * decisions 2 and 3). It is percent-decoded and compared exactly, letter case included; an empty
 * fragment and `top` in any letter case name the top of the page, as HTML says, and are found.
 * Total: a malformed escape is a verdict, never a thrown `URIError`.
 */
export function judgeFragment(
  fragment: string,
  doc: MdDocument,
  rule: AnchorRule,
): FragmentVerdict {
  let decoded: string
  try {
    decoded = decodeURIComponent(fragment)
  } catch (error: unknown) {
    void error
    return { kind: 'malformed', fragment }
  }
  if (decoded === '' || decoded.toLowerCase() === 'top') return { kind: 'found' }
  const anchors = anchorsOf(doc, rule)
  if (anchors.reachable.has(decoded)) return { kind: 'found' }
  const nearest = nearestTo(decoded, anchors.ids, rule)
  const caseOnly = nearest.find((id) => id.toLowerCase() === decoded.toLowerCase())
  const uncounted = anchors.uncounted.get(decoded)
  return {
    kind: 'absent',
    fragment,
    rule: rule.name,
    nearest,
    ...(caseOnly === undefined ? {} : { caseOnly }),
    ...(uncounted === undefined ? {} : { uncounted }),
  }
}

/** `#L5`, `#L5-L9` and `#L5C3-L9C2`, GitHub's line fragments, or `undefined` for any other. */
const LINE_FRAGMENT = /^L(\d+)(?:C(\d+))?(?:-L(\d+)(?:C(\d+))?)?$/

/** Whether `fragment` (as written, without its `#`) is a line fragment. */
export function isLineFragment(fragment: string): boolean {
  return LINE_FRAGMENT.test(fragment)
}

/**
 * Judge a line fragment against `text`, the file's source (bug 0575, spike 0574 decision 4): each
 * line within the file, as `lineCount` counts lines for a pointer (bug 0561), and each column within
 * its line. `undefined` when `fragment` is not a line fragment.
 */
export function judgeLine(fragment: string, text: string): FragmentVerdict | undefined {
  const m = LINE_FRAGMENT.exec(fragment)
  if (m === null) return undefined
  const sourceLines = text.split('\n')
  const lines = lineCount(text)
  const points: { readonly line: number; readonly column?: number }[] = [
    { line: Number(m[1]), ...(m[2] === undefined ? {} : { column: Number(m[2]) }) },
  ]
  if (m[3] !== undefined)
    points.push({ line: Number(m[3]), ...(m[4] === undefined ? {} : { column: Number(m[4]) }) })
  for (const p of points) {
    if (p.line < 1 || p.line > lines) return { kind: 'out-of-range', fragment, lines, line: p.line }
    const length = (sourceLines[p.line - 1] ?? '').replace(/\r$/, '').length
    if (p.column !== undefined && (p.column < 1 || p.column > Math.max(length, 1)))
      return {
        kind: 'out-of-range',
        fragment,
        lines,
        line: p.line,
        column: { column: p.column, length },
      }
  }
  return { kind: 'found' }
}
