import type { Root, Nodes } from 'mdast'
import type { MdDocument } from './document.js'

/** A markdown link occurrence within a document (before doc back-reference). */
export interface MdLinkRef {
  /** Raw URL as written, e.g. `./other.md#section` or `https://example.com`. */
  readonly url: string
  /** Link text. */
  readonly text: string
  /** 1-based line in the source document. */
  readonly line: number
  /** True for `scheme:` / protocol-relative URLs (http, https, mailto, //…). */
  readonly external: boolean
  /**
   * Char offset span of the URL within the document source, for autofix
   * (plan 0066). Present only when the URL is locatable in the raw source
   * (plain paths; percent-encoded/entity URLs may be absent) — a fix is emitted
   * only when the exact span is known.
   */
  readonly urlStart?: number
  readonly urlEnd?: number
}

// A URL is external if it has a scheme (`https:`, `mailto:`) or is protocol-relative.
const EXTERNAL_RE = /^([a-z][a-z0-9+.-]*:|\/\/)/i

function textOf(node: Nodes): string {
  if ('value' in node && typeof node.value === 'string') return node.value
  if ('children' in node) return node.children.map((c) => textOf(c)).join('')
  return ''
}

/**
 * Collect inline markdown links (`[text](url)`) from a document tree. Links
 * inside fenced code are not parsed as `link` nodes by mdast, so they are
 * naturally excluded.
 */
export function collectLinks(root: Root, source?: string): MdLinkRef[] {
  const out: MdLinkRef[] = []
  const visit = (node: Nodes): void => {
    if (node.type === 'link') {
      // Locate the URL's exact char span in the source (for autofix). The link
      // node's raw text is `[text](url …)`; the URL is the last occurrence of
      // `node.url` within it (a URL in the link text would come earlier). If the
      // source form differs from the decoded `node.url`, leave the span absent —
      // no fix is emitted without an exact span.
      let urlStart: number | undefined
      let urlEnd: number | undefined
      const startOff = node.position?.start.offset
      const endOff = node.position?.end.offset
      if (source !== undefined && startOff !== undefined && endOff !== undefined) {
        const raw = source.slice(startOff, endOff)
        const rel = raw.lastIndexOf(node.url)
        if (rel >= 0) {
          urlStart = startOff + rel
          urlEnd = urlStart + node.url.length
        }
      }
      out.push({
        url: node.url,
        text: textOf(node),
        line: node.position?.start.line ?? 0,
        external: EXTERNAL_RE.test(node.url),
        urlStart,
        urlEnd,
      })
    }
    if ('children' in node) {
      for (const child of node.children) visit(child)
    }
  }
  visit(root)
  return out
}

/** A link with its owning document attached — the element the builders and conditions operate on. */
export interface MdLink extends MdLinkRef {
  readonly doc: MdDocument
}
