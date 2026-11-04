import type { Nodes } from 'mdast'
import { tagIsLanguage } from './code-block-tag.js'
import { isOnlyComment } from './html-attributes.js'
import { linksOf } from './links.js'
import { extractPointers } from './pointers.js'
import { unreadLinksIn, type MdUnreadLink } from './unread-link.js'
import type { MdDocument } from './document.js'
import { contains, type MdSectionElement } from './sections.js'

/**
 * Plan 0522 (proposal 017 block 14): what a section holds. Each reads the section's lines from its
 * heading through `endLine`, subsections included, so a block in the next section never counts; a
 * link or a pointer in the heading's own text counts, as `inSections` places it.
 */
export type SectionHolding =
  | { readonly kind: 'content' }
  | { readonly kind: 'code block'; readonly lang?: string }
  | { readonly kind: 'list item' }
  | { readonly kind: 'link' }
  | { readonly kind: 'code pointer' }

const lineOf = (n: { readonly position?: { readonly start: { readonly line: number } } }): number =>
  n.position?.start.line ?? 0

/**
 * The section's lines, its heading line included, as `contains` reads them: a link or a pointer in a
 * heading's text is in that heading's section, the answer `inSections` gives (PR #252).
 */
const inBody = contains

/** The lines a document's list items, links and pointers sit on, read once per document. */
interface HeldLines {
  readonly listItems: readonly number[]
  readonly links: readonly number[]
  readonly pointers: readonly number[]
  readonly unreadLinks: readonly MdUnreadLink[]
}
const HELD = new WeakMap<MdDocument, HeldLines>()

function heldLines(doc: MdDocument): HeldLines {
  const known = HELD.get(doc)
  if (known !== undefined) return known
  const listItems: number[] = []
  const walk = (n: Nodes): void => {
    if (n.type === 'listItem') listItems.push(lineOf(n))
    if ('children' in n) for (const c of n.children) walk(c)
  }
  walk(doc.root)
  const fresh = {
    listItems,
    // The picked reading's links only: a section's structure comes from that reading, and a link
    // only the other one holds must not make a section hold a link its reader never sees (spike 0613).
    links: linksOf(doc)
      .filter((l) => l.onlyWhere === undefined)
      .map((l) => l.line),
    pointers: extractPointers(doc.text, doc.root).map((p) => p.line),
    unreadLinks: unreadLinksIn(doc),
  }
  HELD.set(doc, fresh)
  return fresh
}

/** Does the section hold what `h` names? */
export function holds(s: MdSectionElement, h: SectionHolding): boolean {
  const doc = s.doc
  switch (h.kind) {
    case 'content':
      return doc.root.children.some(
        (n) =>
          inBody(s, lineOf(n)) &&
          n.type !== 'heading' &&
          n.type !== 'thematicBreak' &&
          !(n.type === 'html' && isOnlyComment(n.value)),
      )
    case 'code block':
      return doc.codeBlocks.some(
        (b) => inBody(s, b.line) && (h.lang === undefined || tagIsLanguage(b.lang, h.lang)),
      )
    case 'list item':
      return heldLines(doc).listItems.some((line) => inBody(s, line))
    case 'link':
      return heldLines(doc).links.some((line) => inBody(s, line))
    case 'code pointer':
      return heldLines(doc).pointers.some((line) => inBody(s, line))
  }
}

/**
 * The HTML links eess-md cannot read that decide whether a section holds a link (plan 0580, R6): none
 * when it holds a read link, since one is enough; else every unread one in it, each of which might be
 * the link it holds. Only `link` is decided by them; every other holding ignores them.
 */
export function undecidingLinks(s: MdSectionElement, h: SectionHolding): readonly MdUnreadLink[] {
  if (h.kind !== 'link' || holds(s, h)) return []
  return heldLines(s.doc).unreadLinks.filter((u) => inBody(s, u.line))
}

/** How a finding or a description names it: `a code block tagged "mermaid"`. */
export function holdingText(h: SectionHolding): string {
  switch (h.kind) {
    case 'content':
      return 'content'
    case 'code block':
      return h.lang === undefined ? 'a code block' : `a code block tagged "${h.lang}"`
    case 'list item':
      return 'a list item'
    case 'link':
      return 'a link'
    case 'code pointer':
      return 'a code pointer'
  }
}
