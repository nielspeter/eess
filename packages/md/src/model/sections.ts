import type { Nodes } from 'mdast'
import { headingName, type MdDocument, type MdSection } from './document.js'
import { matchName } from './name-match.js'
import { isNearMiss } from './label.js'
import { lineCount } from './line-count.js'
import { frontMatterNotRead } from './prose.js'

/**
 * A section (plan 0496): a heading at the top level of a document, and the lines it governs. Named
 * `MdSectionElement`, not `MdSection`, because the released `MdSection` (an entry of
 * `MdDocument.sections`) already holds the plain name; md's other pairs give the element the plain
 * name and the model the suffix (`MdLinkRef`/`MdLink`, `MdTaskItemRef`/`MdTaskItem`).
 *
 * What a section is, is what `doc.sections` holds: an ATX or setext heading at the document's top
 * level (a setext heading's `line` is its text line). A heading inside a list item, a blockquote or
 * a footnote definition is not a section, and neither is an `<h2>` in an HTML block or a `#` line in
 * a fence. Parent and subsections are not fields: a section's subsections are the other sections it
 * `contains`.
 */
export interface MdSectionElement extends MdSection {
  readonly doc: MdDocument
  /** The headings that enclose it, outermost first, as `MdTable.sectionPath` and `MdLink.sectionPath` record them. */
  readonly sectionPath: readonly string[]
  /** The last line it governs: the line before the next heading at its depth or shallower, else the document's last line. */
  readonly endLine: number
}

/** How `haveSection` reads a section (plan 0496). */
export interface HaveSectionOptions {
  /** The heading level the section must have (1 to 6). Without it, any level counts. */
  readonly depth?: number
}

const INDEX = new WeakMap<MdDocument, readonly MdSectionElement[]>()

/**
 * The document's sections, in order, with their extents. Memoised on the document object: a corpus
 * document is built once and never mutated, and two corpora with the same `relPath` stay apart.
 */
export function sectionsOf(doc: MdDocument): readonly MdSectionElement[] {
  const known = INDEX.get(doc)
  if (known !== undefined) return known
  const end = lineCount(doc.text)
  const out: { section: MdSection; sectionPath: readonly string[]; endLine: number }[] = []
  // The sections still open, outermost first: a heading closes every one at its depth or deeper.
  const open: (typeof out)[number][] = []
  for (const section of doc.sections) {
    while ((open.at(-1)?.section.depth ?? 0) >= section.depth) {
      const closed = open.pop()
      if (closed !== undefined) closed.endLine = section.line - 1
    }
    const entry = { section, sectionPath: open.map((o) => o.section.name), endLine: end }
    out.push(entry)
    open.push(entry)
  }
  const index = out.map(
    ({ section, sectionPath, endLine }): MdSectionElement => ({
      name: section.name,
      depth: section.depth,
      line: section.line,
      doc,
      sectionPath,
      endLine,
    }),
  )
  INDEX.set(doc, index)
  return index
}

/**
 * The document's sections whose heading matches `name` (a string exactly, or a `RegExp` read without
 * `g`/`y`), at `depth` when given: the one owner of how a section name is matched, read by
 * `hasSection`, a field's section region and `haveSubsection`.
 */
export function sectionsMatching(
  doc: MdDocument,
  name: string | RegExp,
  depth?: number,
): readonly MdSectionElement[] {
  return sectionsOf(doc).filter(
    (s) => (depth === undefined || s.depth === depth) && matchName(s.name, name),
  )
}

/** Is `line` inside the section: from its heading line to its `endLine`, both included? */
export function contains(
  section: Pick<MdSectionElement, 'line' | 'endLine'>,
  line: number,
): boolean {
  return section.line <= line && line <= section.endLine
}

/** The names of the sections that contain `line`, outermost first: what a link's `sectionPath` holds. */
export function sectionPathAt(doc: MdDocument, line: number): readonly string[] {
  return sectionsOf(doc)
    .filter((s) => contains(s, line))
    .map((s) => s.name)
}

/** What holds a heading that is not a section. */
type HeadingContainer = 'list item' | 'blockquote' | 'footnote definition'

/** A heading inside a container, which does not start a section. */
interface ContainedHeading {
  readonly name: string
  readonly depth: number
  readonly line: number
  /** The innermost container that holds it. */
  readonly container: HeadingContainer
}

const CONTAINED = new WeakMap<MdDocument, readonly ContainedHeading[]>()

const containerOf = (node: Nodes): HeadingContainer | undefined =>
  node.type === 'listItem'
    ? 'list item'
    : node.type === 'blockquote'
      ? 'blockquote'
      : node.type === 'footnoteDefinition'
        ? 'footnote definition'
        : undefined

/**
 * The headings that sit in a list item, a blockquote or a footnote definition, each named as a
 * section's name is (`headingName`), so the two compare equal. A third heading walk, diagnostic
 * only: it is read when a finding or the section-name scan needs it, never to decide a section.
 */
function containedHeadings(doc: MdDocument): readonly ContainedHeading[] {
  const known = CONTAINED.get(doc)
  if (known !== undefined) return known
  const out: ContainedHeading[] = []
  const walk = (node: Nodes, container: HeadingContainer | undefined): void => {
    if (node.type === 'heading' && container !== undefined) {
      out.push({
        name: headingName(node),
        depth: node.depth,
        line: node.position?.start.line ?? 0,
        container,
      })
    }
    if ('children' in node) {
      for (const child of node.children) walk(child, containerOf(child) ?? container)
    }
  }
  walk(doc.root, undefined)
  CONTAINED.set(doc, out)
  return out
}

/** A heading of the name that a rule cannot read where it looked: one cause, one note. */
interface HeadingNote {
  readonly line: number
  /** The heading's text. */
  readonly heading: string
  /** At another depth than the one asked, or inside a container. */
  readonly kind: 'depth' | 'near miss' | HeadingContainer
  readonly depth: number
  readonly note: string
}

/**
 * Why a heading of `name` that exists did not count, within lines `from`..`to` of the document: a
 * section of the name at another depth than `depth` (when one is asked), a section that misses a
 * string name only by case or spacing, and a heading of the name inside a container. One owner of the wording, read by the conditions and the section-name scan.
 */
export function headingNotes(
  doc: MdDocument,
  name: string | RegExp,
  options: { readonly depth?: number; readonly from?: number; readonly to?: number } = {},
): readonly HeadingNote[] {
  const from = options.from ?? 1
  const to = options.to ?? Number.POSITIVE_INFINITY
  const within = (line: number): boolean => from <= line && line <= to
  const notes: HeadingNote[] = []
  if (options.depth !== undefined) {
    for (const s of doc.sections) {
      if (!within(s.line) || s.depth === options.depth || !matchName(s.name, name)) continue
      notes.push({
        line: s.line,
        heading: s.name,
        kind: 'depth',
        depth: s.depth,
        note: `"${s.name}" at line ${String(s.line)} is at depth ${String(s.depth)}`,
      })
    }
  }
  // A string name's near miss by case or spacing (PR #252's enforcement review): the finding names
  // it and cites its line, so the section-name scan does not report the same heading again.
  if (typeof name === 'string') {
    for (const s of doc.sections) {
      if (!within(s.line) || !isNearMiss(s.name, name)) continue
      notes.push({
        line: s.line,
        heading: s.name,
        kind: 'near miss',
        depth: s.depth,
        note: `the heading "${s.name}" at line ${String(s.line)} differs from "${name}" only by case or spacing`,
      })
    }
  }
  for (const h of containedHeadings(doc)) {
    if (!within(h.line) || !matchName(h.name, name)) continue
    notes.push({
      line: h.line,
      heading: h.name,
      kind: h.container,
      depth: h.depth,
      note: `the heading "${h.name}" at line ${String(h.line)} is inside a ${h.container}, which does not start a section`,
    })
  }
  return notes.sort((a, b) => a.line - b.line)
}

/** A document's title (plan 0549): its first section's heading when at depth 1, as `titleFault` reads it. */
export function titleOf(doc: MdDocument): string | undefined {
  const [first] = sectionsOf(doc)
  return first !== undefined && first.depth === 1 ? first.name : undefined
}

/**
 * Plan 0522 (proposal 017 block 3): why a document has no title matching `name`, or `undefined`
 * when it has one. The title is the document's first section, a heading at its top level; it must be
 * at depth 1, and match `name` when one is given (a string exactly, or a `RegExp`, as `haveSection`
 * matches).
 */
export function titleFault(doc: MdDocument, name?: string | RegExp): string | undefined {
  const [first] = sectionsOf(doc)
  // A depth-1 heading in a container, before the first section, is the title its author meant.
  const meant = containedHeadings(doc).find(
    (h) => h.depth === 1 && (first === undefined || h.line < first.line),
  )
  const note =
    meant === undefined
      ? ''
      : `; the heading "${meant.name}" at line ${String(meant.line)} is inside a ${meant.container}, which does not start a section`
  if (first === undefined) return `no title: the document has no heading${note}`
  const title = titleOf(doc)
  if (title === undefined) {
    return `no title: the first heading, "${first.name}" at line ${String(first.line)}, is at depth ${String(first.depth)}${note}${notReadNote(doc, first.line)}`
  }
  if (name !== undefined && !matchName(title, name)) {
    return `the title "${title}" (line ${String(first.line)}) is not "${String(name)}"${notReadNote(doc, first.line)}`
  }
  return undefined
}

/**
 * Bug 0410: a heading inside a line-1 `---` block read as Markdown names why the block was not
 * front matter, wherever in the block the heading starts.
 */
function notReadNote(doc: MdDocument, line: number): string {
  const notRead = frontMatterNotRead(doc.text)
  return notRead === undefined || line > notRead.lastLine
    ? ''
    : `; it is in the line-1 \`---\` block, read as Markdown, not as front matter, because ${notRead.because}`
}
