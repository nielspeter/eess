import type { Nodes } from 'mdast'
import { tagIsLanguage } from './code-block-tag.js'
import { linksOf } from './links.js'
import { extractPointers } from './pointers.js'
import type { MdDocument } from './document.js'
import type { MdSectionElement } from './sections.js'

/**
 * Plan 0522 (proposal 017 block 14): what a section holds. Each reads the section's lines after its
 * heading through `endLine`, subsections included, so a block in the next section never counts.
 */
export type SectionHolding =
  | { readonly kind: 'content' }
  | { readonly kind: 'code block'; readonly lang?: string }
  | { readonly kind: 'list item' }
  | { readonly kind: 'link' }
  | { readonly kind: 'code pointer' }

const lineOf = (n: { readonly position?: { readonly start: { readonly line: number } } }): number =>
  n.position?.start.line ?? 0

/** After the heading, through `endLine`. */
const inBody = (s: MdSectionElement, line: number): boolean => s.line < line && line <= s.endLine

const HTML_COMMENT = /^\s*<!--[\s\S]*-->\s*$/

/** The lines a document's list items, links and pointers sit on, read once per document. */
interface HeldLines {
  readonly listItems: readonly number[]
  readonly links: readonly number[]
  readonly pointers: readonly number[]
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
    links: linksOf(doc).map((l) => l.line),
    pointers: extractPointers(doc.text, doc.root).map((p) => p.line),
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
          !(n.type === 'html' && HTML_COMMENT.test(n.value)),
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
