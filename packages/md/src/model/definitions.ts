import type { Nodes, Root } from 'mdast'

/** A link reference definition, `[label]: url`, as a reference-style link reads it (bug 0558). */
export interface MdLinkDefinition {
  /** The definition's label, with escapes and entities decoded, as mdast's `label` holds it. */
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
 * closing `]:` (a `\]` inside the label is escaped, not the close), spaces or tabs and at most one
 * line ending, and an optional `<`. Only there can the destination be; a title or the label
 * holding the same text is never it.
 */
function destinationStart(raw: string): number | undefined {
  let i = 1
  while (i < raw.length && raw[i] !== ']') i += raw[i] === '\\' ? 2 : 1
  if (raw[i + 1] !== ':') return undefined
  i += 2
  let lineEndings = 0
  while (i < raw.length && /\s/.test(raw.charAt(i))) {
    if (raw[i] === '\n' && ++lineEndings > 1) return undefined
    i++
  }
  return raw[i] === '<' ? i + 1 : i
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
      if (source !== undefined && start !== undefined && end !== undefined && node.url !== '') {
        const raw = source.slice(start, end)
        const at = destinationStart(raw)
        // The destination ends where the URL does: at the end, a space or a `>`, never inside it.
        const after = raw.charAt(at === undefined ? 0 : at + node.url.length)
        if (
          at !== undefined &&
          raw.startsWith(node.url, at) &&
          (after === '' || /[\s>]/.test(after))
        ) {
          urlStart = start + at
          urlEnd = urlStart + node.url.length
        }
      }
      out.set(node.identifier, {
        label: node.label ?? node.identifier,
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
