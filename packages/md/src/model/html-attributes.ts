import type { Nodes } from 'mdast'
import { decodeNamedCharacterReference } from 'decode-named-character-reference'

/**
 * The one reader of HTML tags and attributes in eess-md (plan 0580, D1 to D10; gated by the arch rule
 * `md/one-html-attribute-reader`). It answers "which tags does this HTML hold, and what are their
 * attributes?" for every builder that needs it (`mentions()` today, `links()` next), so no two readers
 * disagree about what an `<a href>` is.
 *
 * Two grammars, each where a renderer uses it:
 *
 * - **Inside an `html` node, the WHATWG tokenizer's tag states** (HTML §13.2.5): micromark never
 *   tokenized the tags inside an HTML block, and a browser reads them this way. So an attribute name
 *   is any run up to whitespace, `/`, `>` or `=` (`@click` is one), a missing space between attributes
 *   is accepted, an unquoted value runs to whitespace or `>` (`<a href=docs/>` reads `docs/`), the
 *   first of two attributes wins, a valueless attribute is `""`, and a `<` inside a quoted value is
 *   text. Comments and bogus comments (`<!…>`, CDATA included, and `<?…>`) are cut out.
 * - **Inside a paragraph, heading or table cell, CommonMark's open tag (§6.6)**, the grammar GitHub
 *   uses for inline HTML. A tag micromark refused (an unquoted value holding `/`, line 573 of
 *   micromark-core-commonmark's lib/html-text.js) is text in mdast and is found here, whole, from the
 *   source.
 *
 * Values are decoded after the tag is tokenized, as CommonMark decodes a reference: `&name;`, `&#N;`
 * and `&#xH;`, each with its `;`. A legacy reference without its `;` (`&amp"`), which a browser also
 * decodes, is kept as written. The scan is linear: no nested quantifier.
 */

/** One attribute of a tag, as the tokenizer read it. */
interface HtmlAttribute {
  /** Lower-cased, as HTML compares attribute names. */
  readonly name: string
  /** Decoded; `""` for a valueless attribute. */
  readonly value: string
  /** The quote it was written in, if any. */
  readonly quote: '"' | "'" | undefined
  /** 1-based line of the attribute's name. */
  readonly line: number
}

/** A start tag the tokenizer finished. */
interface HtmlStartTag {
  /** Lower-cased. */
  readonly name: string
  /** In source order; a repeated name keeps its first. */
  readonly attributes: readonly HtmlAttribute[]
  /** 1-based line of the tag's `<`. */
  readonly line: number
}

/** An end tag the tokenizer finished. */
interface HtmlEndTag {
  readonly name: string
  readonly line: number
}

/**
 * Why a tag the tokenizer entered never ended (plan 0580, R3): the node ended inside it. `split-tag`
 * when a blank line ended the node while the tag's text so far could still close after it (outside a
 * quoted value, or inside one that holds no `>` yet); `unterminated` in every other case.
 */
type UnfinishedCause = 'split-tag' | 'unterminated'

/** A tag the tokenizer entered and the node ended inside. */
interface HtmlUnfinishedTag {
  readonly name: string
  readonly line: number
  readonly cause: UnfinishedCause
}

/** What an `html` node holds, in source order within each list. */
interface HtmlRead {
  readonly starts: readonly HtmlStartTag[]
  readonly ends: readonly HtmlEndTag[]
  /** Unfinished tags that are reported. */
  readonly unfinished: readonly HtmlUnfinishedTag[]
  /**
   * Unfinished tags inside a GFM tagfilter element whose end tag the node holds (D5): its content is
   * often a program, so a tag it cannot finish is not reported.
   */
  readonly silenced: readonly HtmlUnfinishedTag[]
}

/** The element names GFM's tagfilter shows as text (GFM §6.11), so they never switch the tokenizer's state. */
const TAGFILTER = new Set([
  'title',
  'textarea',
  'style',
  'xmp',
  'iframe',
  'noembed',
  'noframes',
  'script',
  'plaintext',
])

const isSpace = (c: string | undefined): boolean =>
  c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f'
/** CommonMark's whitespace for an open tag (§6.6): space, tab and a line ending; no form feed. */
const isMdSpace = (c: string | undefined): boolean =>
  c === ' ' || c === '\t' || c === '\n' || c === '\r'
const isAsciiAlpha = (c: string | undefined): boolean =>
  c !== undefined && c.length === 1 && /[A-Za-z]/.test(c)

/** A character reference at `at`, with its `;`, decoded; `undefined` when there is none. */
function referenceAt(
  text: string,
  at: number,
): { readonly decoded: string; readonly length: number } | undefined {
  const m = /^&(?:#([0-9]{1,7})|#[xX]([0-9a-fA-F]{1,6})|([A-Za-z][A-Za-z0-9]{1,31}));/.exec(
    text.slice(at, at + 40),
  )
  if (m === null) return undefined
  const [whole, dec, hex, name] = m
  if (name !== undefined) {
    const decoded = decodeNamedCharacterReference(name)
    return decoded === false ? undefined : { decoded, length: whole.length }
  }
  const code = dec !== undefined ? Number.parseInt(dec, 10) : Number.parseInt(hex ?? '', 16)
  const safe = code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) ? 0xfffd : code
  return { decoded: String.fromCodePoint(safe), length: whole.length }
}

/** `text` with each character reference decoded, as CommonMark decodes one: only with its `;`. */
// eess-exclude eess/no-unused-exports: consumed by the test suite; the build tsconfig this gate reads excludes tests, so `src` is the only usage it can see
export function decodeReferences(text: string): string {
  let out = ''
  for (let i = 0; i < text.length; ) {
    const ref = text[i] === '&' ? referenceAt(text, i) : undefined
    if (ref === undefined) {
      out += text[i] ?? ''
      i++
    } else {
      out += ref.decoded
      i += ref.length
    }
  }
  return out
}

/**
 * Where a comment or bogus comment that starts at `at` ends (exclusive), as the HTML tokenizer ends
 * it, or `undefined` when none starts there (D2). A comment ends at `<!-->` and `<!--->` (an abrupt
 * empty comment), or at the first `-->` or `--!>` after `<!--`, or with the text. A bogus comment is
 * `<!…`, `<?…`, or `</` before anything but a letter, and runs to the next `>`.
 */
function commentEnd(text: string, at: number): number | undefined {
  if (text[at] !== '<') return undefined
  if (text.startsWith('<!--', at)) {
    if (text.startsWith('<!-->', at)) return at + 5
    if (text.startsWith('<!--->', at)) return at + 6
    for (let k = at + 4; k < text.length; k++) {
      if (text.startsWith('-->', k)) return k + 3
      if (text.startsWith('--!>', k)) return k + 4
    }
    return text.length
  }
  const next = text[at + 1]
  const bogus = next === '!' || next === '?' || (next === '/' && !isAsciiAlpha(text[at + 2]))
  if (!bogus || next === undefined) return undefined
  const close = text.indexOf('>', at + 2)
  return close === -1 ? text.length : close + 1
}

/** Whether `text` holds an end tag `</name` (any case) followed by whitespace, `/`, `>` or its end. */
function holdsEndTag(text: string, name: string): boolean {
  const lower = text.toLowerCase()
  for (let k = lower.indexOf(`</${name}`); k !== -1; k = lower.indexOf(`</${name}`, k + 1)) {
    const after = lower[k + 2 + name.length]
    if (after === undefined || isSpace(after) || after === '/' || after === '>') return true
  }
  return false
}

/**
 * Tokenize the value of one `html` node (D1, D5). `firstLine` is the node's first line;
 * `endedByBlankLine` says whether a blank line, and not the end of the document or of a container,
 * ended it, which tells `split-tag` from `unterminated`.
 */
// eess-exclude eess/no-unused-exports: consumed by the test suite; the build tsconfig this gate reads excludes tests, so `src` is the only usage it can see
export function tokenizeHtml(
  value: string,
  firstLine: number,
  endedByBlankLine: boolean,
): HtmlRead {
  const starts: HtmlStartTag[] = []
  const ends: HtmlEndTag[] = []
  const unfinished: HtmlUnfinishedTag[] = []
  const silenced: HtmlUnfinishedTag[] = []
  /** Tagfilter elements open at this point, each with whether the node holds its end tag after it. */
  const open: { readonly name: string; readonly closes: boolean }[] = []

  let line = firstLine
  let i = 0
  const n = value.length
  /** Advance one character, counting lines. */
  const step = (): void => {
    if (value[i] === '\n') line++
    i++
  }
  const skipSpace = (): void => {
    while (i < n && isSpace(value[i])) step()
  }

  while (i < n) {
    if (value[i] !== '<') {
      step()
      continue
    }
    // A comment or a bogus comment (CDATA included) is cut out (D2).
    const cut = commentEnd(value, i)
    if (cut !== undefined) {
      while (i < cut) step()
      continue
    }
    const isEnd = value[i + 1] === '/'
    const nameAt = isEnd ? i + 2 : i + 1
    if (!isAsciiAlpha(value[nameAt])) {
      step() // `<` not followed by a tag name is text.
      continue
    }
    const tagLine = line
    while (i < nameAt) step()
    let name = ''
    while (i < n && !isSpace(value[i]) && value[i] !== '/' && value[i] !== '>') {
      name += (value[i] ?? '').toLowerCase()
      step()
    }
    const attributes: HtmlAttribute[] = []
    const seen = new Set<string>()
    let finished = false
    /** Set when the node ends inside a quoted value: whether that value holds a `>` so far. */
    let inQuote: { readonly gtSoFar: boolean } | undefined
    while (i < n) {
      skipSpace()
      if (i >= n) break
      const c = value[i]
      if (c === '>') {
        step()
        finished = true
        break
      }
      if (c === '/') {
        step() // A `/` not before `>` is read past, as the tokenizer's self-closing state does.
        continue
      }
      // An attribute name: any run up to whitespace, `/`, `>` or `=`; a leading `=` is part of it.
      const attrLine = line
      let attr = ''
      if (c === '=') {
        attr += '='
        step()
      }
      while (
        i < n &&
        !isSpace(value[i]) &&
        value[i] !== '/' &&
        value[i] !== '>' &&
        value[i] !== '='
      ) {
        attr += (value[i] ?? '').toLowerCase()
        step()
      }
      let raw = ''
      let quote: '"' | "'" | undefined
      const before = { i, line }
      skipSpace()
      if (value[i] === '=') {
        step()
        skipSpace()
        const q = value[i]
        if (q === '"' || q === "'") {
          quote = q
          step()
          const close = value.indexOf(q, i)
          if (close === -1) {
            raw = value.slice(i)
            inQuote = { gtSoFar: raw.includes('>') }
            while (i < n) step()
            break
          }
          raw = value.slice(i, close)
          while (i <= close) step()
        } else {
          while (i < n && !isSpace(value[i]) && value[i] !== '>') {
            raw += value[i] ?? ''
            step()
          }
        }
      } else {
        // No `=`: a valueless attribute; what follows the spaces is the next attribute.
        i = before.i
        line = before.line
      }
      if (inQuote !== undefined) break
      if (!seen.has(attr)) {
        seen.add(attr)
        attributes.push({ name: attr, value: decodeReferences(raw), quote, line: attrLine })
      }
    }
    if (finished) {
      if (isEnd) {
        ends.push({ name, line: tagLine })
        for (let at = open.length - 1; at >= 0; at--) {
          if (open[at]?.name !== name) continue
          open.splice(at)
          break
        }
      } else {
        starts.push({ name, attributes, line: tagLine })
        if (TAGFILTER.has(name)) {
          const closes = holdsEndTag(value.slice(i), name)
          open.push({ name, closes })
        }
      }
      continue
    }
    // The node ended inside this tag. Only a start tag is reported: an unfinished end tag is no link.
    if (isEnd) continue
    const inside = open.some((o) => o.closes)
    const couldClose = inQuote === undefined || !inQuote.gtSoFar
    const cause: UnfinishedCause = endedByBlankLine && couldClose ? 'split-tag' : 'unterminated'
    const tag = { name, line: tagLine, cause }
    if (inside) silenced.push(tag)
    else unfinished.push(tag)
  }
  return { starts, ends, unfinished, silenced }
}

/**
 * Whether a blank line, and not a container or the end of the document, ended the node: the line
 * after it holds nothing once `depth` blockquote markers are stepped over, and a line ending closes it.
 */
function endedByBlankLineIn(node: Nodes, source: string | undefined, depth: number): boolean {
  const end = node.position?.end.offset
  if (source === undefined || end === undefined) return false
  let k = end
  if (source[k] === '\r') k++
  if (source[k] !== '\n') return false
  k++
  for (let d = 0; d < depth; d++) {
    while (source[k] === ' ' || source[k] === '\t') k++
    if (source[k] !== '>') break
    k++
  }
  while (source[k] === ' ' || source[k] === '\t') k++
  if (source[k] === '\r') k++
  return source[k] === '\n'
}

/**
 * Tokenize an mdast `html` node (D1). `depth` is the number of blockquotes around it, so a blank
 * line inside a quote (`>`) is read as one. Without its source, an unfinished tag is `unterminated`.
 */
export function readHtmlNode(node: Nodes, source?: string, depth = 0): HtmlRead {
  if (node.type !== 'html') return { starts: [], ends: [], unfinished: [], silenced: [] }
  return tokenizeHtml(
    node.value,
    node.position?.start.line ?? 0,
    endedByBlankLineIn(node, source, depth),
  )
}

/** A tag's attribute by name, in any letter case. */
// eess-exclude eess/no-unused-exports: consumed by the test suite; the build tsconfig this gate reads excludes tests, so `src` is the only usage it can see
export function attributeOf(tag: HtmlStartTag, name: string): HtmlAttribute | undefined {
  const want = name.toLowerCase()
  return tag.attributes.find((a) => a.name === want)
}

/** Whether `tag` opens an HTML link: an `<a>` or an `<area>` with an `href` (plan 0580, R1). */
export function isLinkStart(tag: HtmlStartTag): boolean {
  return (tag.name === 'a' || tag.name === 'area') && attributeOf(tag, 'href') !== undefined
}

/**
 * Whether an `html` node holds nothing a reader sees: only comments and bogus comments, and spaces
 * (D2). Replaces the two one-comment patterns that `phrasing.ts` and `section-holds.ts` kept.
 */
export function isOnlyComment(value: string): boolean {
  let rest = value
  let any = false
  for (;;) {
    rest = rest.replace(/^\s+/, '')
    if (rest === '') return any
    const cut = commentEnd(rest, 0)
    if (cut === undefined) return false
    rest = rest.slice(cut)
    any = true
  }
}

/** How a tag start in a paragraph, heading or table cell reads under CommonMark's open tag (D7). */
type InlineTagStart =
  | { readonly kind: 'not-a-tag'; readonly line: number }
  | { readonly kind: 'no-href'; readonly line: number; readonly name: string }
  | {
      readonly kind: 'unquoted-slash'
      readonly line: number
      readonly name: string
      /** Every attribute whose unquoted value holds a `/`. */
      readonly attributes: readonly string[]
    }
  | { readonly kind: 'refused-tag'; readonly line: number; readonly name: string }

/** An attribute as §6.6 reads it: its raw value, and whether it was quoted. */
interface InlineAttribute {
  readonly name: string
  readonly raw: string
  readonly quoted: boolean
}

/**
 * What a tag micromark refused is, by its attributes (R3): no `href`, an unquoted value holding `/`
 * (each such attribute named), or a refusal no Measured row explains.
 */
// eess-exclude eess/no-unused-exports: consumed by the test suite; the build tsconfig this gate reads excludes tests, so `src` is the only usage it can see
export function inlineKind(
  attributes: readonly InlineAttribute[],
):
  | { readonly kind: 'no-href' }
  | { readonly kind: 'unquoted-slash'; readonly attributes: readonly string[] }
  | { readonly kind: 'refused-tag' } {
  if (!attributes.some((a) => a.name === 'href')) return { kind: 'no-href' }
  const slashed = attributes.filter((a) => !a.quoted && a.raw.includes('/')).map((a) => a.name)
  return slashed.length > 0
    ? { kind: 'unquoted-slash', attributes: slashed }
    : { kind: 'refused-tag' }
}

/** §6.6's attribute name and unquoted value. */
const ATTR_NAME = /[A-Za-z_:][A-Za-z0-9_.:-]*/y
const UNQUOTED = /[^"'=<>`\s]+/y

/**
 * Apply CommonMark's open tag (§6.6) to `text` at `at`, a `<`. Returns the tag's name and its
 * attributes with their raw values and whether each was quoted, and the index after its `>`, or
 * `undefined` when it is not one. Spaces include line endings; `text` has its container prefixes
 * already stepped over.
 */
function openTagAt(
  text: string,
  at: number,
):
  | {
      readonly name: string
      readonly attributes: readonly InlineAttribute[]
      readonly end: number
    }
  | undefined {
  if (at < 0 || text[at] !== '<') return undefined
  let i = at + 1
  const nameMatch = /[A-Za-z][A-Za-z0-9-]*/y
  nameMatch.lastIndex = i
  const nm = nameMatch.exec(text)
  if (nm === null) return undefined
  const name = nm[0].toLowerCase()
  i += nm[0].length
  const attributes: InlineAttribute[] = []
  const spaces = (): number => {
    const s = i
    while (i < text.length && isMdSpace(text[i])) i++
    return i - s
  }
  for (;;) {
    const gap = spaces()
    const c = text[i]
    if (c === '>') return { name, attributes, end: i + 1 }
    if (c === '/' && text[i + 1] === '>') return { name, attributes, end: i + 2 }
    if (gap === 0) return undefined // an attribute must follow whitespace
    ATTR_NAME.lastIndex = i
    const an = ATTR_NAME.exec(text)
    if (an === null) return undefined
    i += an[0].length
    const afterName = i
    spaces()
    if (text[i] !== '=') {
      i = afterName
      attributes.push({ name: an[0].toLowerCase(), raw: '', quoted: false })
      continue
    }
    i++
    spaces()
    const q = text[i]
    if (q === '"' || q === "'") {
      const close = text.indexOf(q, i + 1)
      if (close === -1) return undefined
      attributes.push({ name: an[0].toLowerCase(), raw: text.slice(i + 1, close), quoted: true })
      i = close + 1
      continue
    }
    UNQUOTED.lastIndex = i
    const uv = UNQUOTED.exec(text)
    if (uv === null) return undefined
    attributes.push({ name: an[0].toLowerCase(), raw: uv[0], quoted: false })
    i += uv[0].length
  }
}

/** An inline container: the node kinds whose inline content GFM parses as one run (D7). */
type InlineContainer = Extract<Nodes, { type: 'paragraph' | 'heading' | 'tableCell' }>

/** The source spans of the `text` nodes under `node`, in order. Image alt, titles and URLs are no nodes. */
function textSpans(node: Nodes, out: [number, number][] = []): [number, number][] {
  if (node.type === 'text') {
    const s = node.position?.start.offset
    const e = node.position?.end.offset
    if (s !== undefined && e !== undefined) out.push([s, e])
    return out
  }
  if ('children' in node) for (const child of node.children) textSpans(child, out)
  return out
}

/**
 * The container's source with each line's container prefix stepped over: leading spaces, then up to
 * `depth` blockquote markers (`>` and one optional space), so a tag that continues on the next line of
 * a quoted paragraph reads as it renders (D7, D8). Built once per container; `at[k]` is the index in
 * `text` of source offset `from + k`, or -1 for a stepped-over prefix character.
 */
function containerText(
  source: string,
  from: number,
  to: number,
  depth: number,
): { readonly text: string; readonly at: readonly number[] } {
  let text = ''
  const at: number[] = new Array<number>(Math.max(0, to - from)).fill(-1)
  for (let i = from; i < to; ) {
    const c = source[i] ?? ''
    at[i - from] = text.length
    text += c
    i++
    if (c !== '\n') continue
    for (let d = 0; d < depth; d++) {
      while (i < to && (source[i] === ' ' || source[i] === '\t')) i++
      if (source[i] !== '>') break
      i++
      if (source[i] === ' ' || source[i] === '\t') i++
    }
    while (i < to && (source[i] === ' ' || source[i] === '\t')) i++
  }
  return { text, at }
}

/**
 * Every tag start in an inline container that micromark left as text (D7), classified. A start is a
 * literal `<a` or `<area` (any case, then whitespace, `/` or `>`) inside a `text` node's source span,
 * after an even number of `\`. `depth` is the number of blockquotes around the container.
 */
function inlineTagStarts(
  container: InlineContainer,
  source: string,
  depth: number,
): InlineTagStart[] {
  const from = container.position?.start.offset
  const end = container.position?.end.offset
  const firstLine = container.position?.start.line
  if (from === undefined || end === undefined || firstLine === undefined) return []
  let built: { readonly text: string; readonly at: readonly number[] } | undefined
  const out: InlineTagStart[] = []
  // Lines are counted forward once: starts are visited in source order.
  let counted = from
  let line = firstLine
  /** The index in the container's text up to which a tag already found reaches: a start inside it is its value. */
  let consumed = -1
  for (const [s, e] of textSpans(container)) {
    for (let at = source.indexOf('<', s); at !== -1 && at < e; at = source.indexOf('<', at + 1)) {
      if (!/^<(?:a|area)(?:[\s/>]|$)/i.test(source.slice(at, at + 6))) continue
      let slashes = 0
      while (source[at - 1 - slashes] === '\\') slashes++
      if (slashes % 2 === 1) continue
      for (; counted < at; counted++) if (source[counted] === '\n') line++
      built ??= containerText(source, from, end, depth)
      const index = built.at[at - from] ?? -1
      if (index < consumed) continue
      const tag = openTagAt(built.text, index)
      if (tag === undefined) {
        out.push({ kind: 'not-a-tag', line })
        continue
      }
      consumed = tag.end
      const kind = inlineKind(tag.attributes)
      out.push(
        kind.kind === 'unquoted-slash'
          ? { kind: 'unquoted-slash', line, name: tag.name, attributes: kind.attributes }
          : { kind: kind.kind, line, name: tag.name },
      )
    }
  }
  return out
}

/** Every inline tag start in a document (D7): each paragraph, heading and table cell, at its blockquote depth. */
// eess-exclude eess/no-unused-exports: consumed by the test suite; the build tsconfig this gate reads excludes tests, so `src` is the only usage it can see
export function inlineTagStartsOf(root: Nodes, source: string): InlineTagStart[] {
  const out: InlineTagStart[] = []
  const walk = (node: Nodes, depth: number): void => {
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'tableCell') {
      out.push(...inlineTagStarts(node, source, depth))
      return
    }
    if ('children' in node) {
      const inner = node.type === 'blockquote' ? depth + 1 : depth
      for (const child of node.children) walk(child, inner)
    }
  }
  walk(root, 0)
  return out
}
