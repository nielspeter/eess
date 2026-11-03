import type { Nodes } from 'mdast'
import GithubSlugger from 'github-slugger'
import { ArchConfigError } from '@nielspeter/eess'
import type { MdDocument } from './document.js'
import { attributeOf, readHtmlNode } from './html-attributes.js'

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
       * The HTML element whose `id` or `name` the fragment names, when the rule does not count that
       * element's attribute as an anchor: the rule's choice, not the author's slip.
       */
      readonly uncounted?: string
    }
  | { readonly kind: 'malformed'; readonly fragment: string }

/**
 * A document's anchors under one rule: every form a fragment can reach, the ids alone, and the HTML
 * ids and names the rule does not count, by the element that holds them.
 */
interface AnchorSet {
  readonly reachable: ReadonlySet<string>
  readonly ids: readonly string[]
  readonly uncounted: ReadonlyMap<string, string>
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
  const uncounted = new Map<string, string>()
  const walk = (node: Nodes): void => {
    if (node.type === 'heading') headings.push(node.children.map(headingText).join(''))
    if (node.type === 'html') {
      // Finished tags only, and never one inside a comment: the tokenizer reads a comment as one.
      for (const tag of readHtmlNode(node, 'no-source').starts) {
        for (const attribute of ['id', 'name']) {
          const value = attributeOf(tag, attribute)?.value
          if (value === undefined || value === '') continue
          if (rule.keepsHtmlAnchor(tag.name, attribute)) html.push(value)
          else if (!uncounted.has(value)) uncounted.set(value, tag.name)
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
