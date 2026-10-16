/**
 * Where Mermaid's line is in the block (plan 0413, spike 0428). Mermaid counts an error's line on the
 * text it has preprocessed, not on the block: it drops frontmatter with the blank lines after it,
 * collapses a multi-line directive, and removes every whole-line `%%` comment with the blank lines
 * before it. This mirrors those steps on the block while carrying each UTF-16 unit's origin line.
 *
 * The regexes are mermaid 11.17.2's, from `preprocessDiagram` in `dist/mermaid.core.mjs`: the CRLF
 * rewrite and the comment removal are its own, the frontmatter regex is `frontMatterRegex` and the
 * directive regex is `directiveRegex`. The line canary (`create-mermaid-parser.ts`) reds when an
 * installed `mermaid` stops agreeing with them.
 */

const FRONTMATTER = /^([^\S\n\r]*)-{3}\s*[\n\r](.*?)[\n\r]\1-{3}\s*[\n\r]+/s
const DIRECTIVE = /%{2}{\s*(?:(\w+)\s*:|(\w+))\s*(?:(\w+)|((?:(?!}%{2}).|\r?\n)*))?\s*(?:}%{2})?/gi
const COMMENT = /^\s*%%(?!{)[^\n]+\n?/gm
/** A line whose first non-blank text is not `%%` and that holds `%%` later: a trailing comment. */
const TRAILING_COMMENT = /^[^\S\n]*(?!%%)\S[^\n]*%%/m

interface Traced {
  readonly text: string
  /** The block line (1-based) each UTF-16 unit of `text` came from. */
  readonly origin: readonly number[]
}

function cut(traced: Traced, pattern: RegExp): Traced {
  const global = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`)
  let text = ''
  const origin: number[] = []
  let last = 0
  for (const match of traced.text.matchAll(global)) {
    text += traced.text.slice(last, match.index)
    // A loop, not a spread: a spread of a block-sized array overflows the stack (PR review, 300 KB).
    for (let i = last; i < match.index; i += 1) {
      const line = traced.origin[i]
      if (line !== undefined) origin.push(line)
    }
    last = match.index + match[0].length
    if (!pattern.global) break
  }
  return {
    text: text + traced.text.slice(last),
    origin: origin.concat(traced.origin.slice(last)),
  }
}

function trace(text: string): Traced {
  const normalised = text.replace(/\r\n?/g, '\n')
  const origin: number[] = []
  let line = 1
  for (let i = 0; i < normalised.length; i += 1) {
    origin.push(line)
    if (normalised[i] === '\n') line += 1
  }
  return { text: normalised, origin }
}

/**
 * The YAML of the block's frontmatter as Mermaid hands it to js-yaml (its indent removed from each
 * line, as `extractFrontMatter` does), or `null` when the line map reads no frontmatter.
 */
export function frontmatterYaml(text: string): string | null {
  const match = FRONTMATTER.exec(trace(text).text)
  if (match === null) return null
  const indent = match[1] ?? ''
  const body = match[2] ?? ''
  if (indent === '') return body
  return body
    .split('\n')
    .map((line) => (line.startsWith(indent) ? line.slice(indent.length) : line))
    .join('\n')
}

/** The text after Mermaid's frontmatter and directive steps, before its comment removal. */
function withoutPreamble(text: string): Traced {
  return cut(cut(trace(text), FRONTMATTER), DIRECTIVE)
}

/** The text Mermaid parses, as its four line-moving steps leave it, with each unit's origin line. */
export function mermaidPreprocessed(text: string): Traced {
  const uncommented = cut(withoutPreamble(text), COMMENT)
  const lead = uncommented.text.length - uncommented.text.trimStart().length
  return { text: uncommented.text.slice(lead), origin: uncommented.origin.slice(lead) }
}

/**
 * A function from Mermaid's 1-based line to the block's, or `null` when Mermaid's text has no such
 * line.
 */
export function mermaidLineMap(text: string): (mermaidLine: number) => number | null {
  const { text: parsed, origin } = mermaidPreprocessed(text)
  const starts: number[] = []
  if (origin[0] !== undefined) starts.push(origin[0])
  for (let i = 0; i < parsed.length - 1; i += 1) {
    const next = origin[i + 1]
    if (parsed[i] === '\n' && next !== undefined) starts.push(next)
  }
  return (mermaidLine) => starts[mermaidLine - 1] ?? null
}

/**
 * Does any line of the block carry a `%%` comment after other text? Two of Mermaid's lexers lose
 * lines after one (spike 0428 Q2), so a verdict for such a block claims no line. Read after the
 * frontmatter and directive steps, so a directive's own closing `}%%` is not a comment.
 */
export function hasTrailingComment(text: string): boolean {
  return TRAILING_COMMENT.test(withoutPreamble(text).text)
}
