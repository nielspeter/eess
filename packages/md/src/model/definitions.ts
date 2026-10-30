import type { Nodes, Root } from 'mdast'
import { destinationAt, writtenAt } from './destination.js'

/** A link reference definition, `[label]: url`, as a reference-style link reads it (bug 0558). */
export interface MdLinkDefinition {
  /**
   * The definition's label as the source writes it, escapes and entities kept (`[a\\*b]`), so a
   * finding names text the author can find; mdast's `label` where the source cannot be read.
   */
  readonly label: string
  /** 1-based line of the definition. */
  readonly line: number
}

/** A definition's URL and where it sits in the source. */
interface DefinitionSite extends MdLinkDefinition {
  readonly url: string
  /** Char offsets of the URL in the source, present only where it is written as `url` reads. */
  readonly urlStart?: number
  readonly urlEnd?: number
}

/**
 * Where a definition's destination starts in its raw text, or `undefined`: after the label's
 * closing `]:` (a `\]` inside the label is escaped, not the close). Only there can the destination
 * be; a title or the label holding the same text is never it.
 */
function destinationStart(raw: string): number | undefined {
  const close = labelClose(raw)
  if (close === undefined || raw[close + 1] !== ':') return undefined
  return destinationAt(raw, close + 2)
}

/** The index of the `]` that closes a definition's label (a `\\]` inside it is escaped). */
function labelClose(raw: string): number | undefined {
  let i = 1
  while (i < raw.length && raw[i] !== ']') i += raw[i] === '\\' ? 2 : 1
  return i < raw.length ? i : undefined
}

/**
 * Every link reference definition in `root`, by the parser's `identifier`: the label normalized as
 * the CommonMark spec says ("perform the Unicode case fold"), so `[ẞ]` finds `[SS]`, and the first
 * of several matching definitions is the one used, as the spec says. The URL's span is set only
 * where the source writes the destination exactly as `url` reads it (no escape, no entity), so a
 * fix over it never rewrites a title or a label.
 */
export function definitionsOf(root: Root, source: string | undefined): Map<string, DefinitionSite> {
  const out = new Map<string, DefinitionSite>()
  const walk = (node: Nodes): void => {
    if (node.type === 'definition' && !out.has(node.identifier)) {
      const start = node.position?.start.offset
      const end = node.position?.end.offset
      let urlStart: number | undefined
      let urlEnd: number | undefined
      let label = node.label ?? node.identifier
      if (source !== undefined && start !== undefined && end !== undefined) {
        const raw = source.slice(start, end)
        const close = labelClose(raw)
        if (raw.startsWith('[') && close !== undefined) label = raw.slice(1, close)
        const at = destinationStart(raw)
        if (at !== undefined && writtenAt(raw, at, node.url)) {
          urlStart = start + at
          urlEnd = urlStart + node.url.length
        }
      }
      out.set(node.identifier, {
        label,
        line: node.position?.start.line ?? 0,
        url: node.url,
        urlStart,
        urlEnd,
      })
    }
    if ('children' in node) for (const child of node.children) walk(child)
  }
  walk(root)
  return out
}
