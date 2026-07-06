import type { Root, RootContent } from 'mdast'

/**
 * A heading in a markdown document.
 */
export interface MdSection {
  /** Heading text, e.g. "Enforcement" */
  readonly name: string
  /** Heading level (1 = `#`, 2 = `##`, …) */
  readonly depth: number
  /** 1-based line where the heading starts */
  readonly line: number
}

/**
 * A GFM table in a markdown document.
 */
export interface MdTable {
  /** Header cell texts, trimmed */
  readonly header: readonly string[]
  /** Body rows, each an array of trimmed cell texts */
  readonly rows: readonly (readonly string[])[]
  /**
   * 1-based source line of each body row, parallel to `rows` (real mdast
   * positions, not derived — the file:line a diagnostic points at must be
   * exact). `rowLines[i]` is the line of `rows[i]`.
   */
  readonly rowLines: readonly number[]
  /** 1-based line where the table starts */
  readonly line: number
  /** Names of the enclosing headings, outermost first (nearest section is last) */
  readonly sectionPath: readonly string[]
}

/** A fenced code block in a markdown document. */
export interface MdCodeBlock {
  /** The info-string language, e.g. `mermaid`, `typescript`, or `null`. */
  readonly lang: string | null
  /** The block's contents. */
  readonly value: string
  /** 1-based line where the fence starts. */
  readonly line: number
}

/**
 * One markdown document in the corpus — the element type of `docs()`.
 *
 * The underlying mdast `Root` is exposed for advanced use, but the dialect's
 * own abstractions (`sections`, `tables`, and — in later phases — links and
 * pointers) are the intended surface.
 */
export interface MdDocument {
  /** Absolute file path */
  readonly file: string
  /** Repo-relative path (POSIX separators), e.g. `docs/adr/0001-x.md` */
  readonly relPath: string
  /** In a frozen folder — historical record; drift is reported, never failed */
  readonly frozen: boolean
  /** Raw source text */
  readonly text: string
  readonly sections: readonly MdSection[]
  readonly tables: readonly MdTable[]
  /** Fenced code blocks (e.g. embedded `mermaid` diagrams). */
  readonly codeBlocks: readonly MdCodeBlock[]
  /** mdast root (internal / advanced) */
  readonly root: Root
}

/**
 * Recursively concatenate the text content of an mdast node. Inline code keeps
 * its backticks, because a backtick-delimited `path.ts` or `it('…')` inside a
 * table cell is a meaningful code citation, not plain prose.
 */
function nodeText(node: RootContent | Root): string {
  if (node.type === 'inlineCode' && typeof node.value === 'string') {
    return '`' + node.value + '`'
  }
  if ('value' in node && typeof node.value === 'string') return node.value
  if ('children' in node && Array.isArray(node.children)) {
    return node.children.map((c) => nodeText(c)).join('')
  }
  return ''
}

function lineOf(node: { position?: { start: { line: number } } }): number {
  return node.position?.start.line ?? 0
}

/**
 * Build an `MdDocument` from a parsed mdast `Root`.
 *
 * Walks top-level nodes once, collecting headings (as sections) and GFM tables.
 * Tables record the heading path they sit under so a rule can scope to
 * "the table in the `## Enforcement` section".
 */
export function buildDocument(args: {
  file: string
  relPath: string
  frozen: boolean
  text: string
  root: Root
}): MdDocument {
  const sections: MdSection[] = []
  const tables: MdTable[] = []
  const codeBlocks: MdCodeBlock[] = []
  // Running heading stack: index i holds the current heading at depth i+1.
  const headingStack: string[] = []

  for (const node of args.root.children) {
    if (node.type === 'heading') {
      const name = nodeText(node).trim()
      sections.push({ name, depth: node.depth, line: lineOf(node) })
      headingStack.length = node.depth - 1
      headingStack[node.depth - 1] = name
    } else if (node.type === 'table') {
      const rowsText = node.children.map((row) => row.children.map((cell) => nodeText(cell).trim()))
      const [header = [], ...rows] = rowsText
      // Real per-row source lines (header row excluded), parallel to `rows`.
      const rowLines = node.children.slice(1).map((row) => lineOf(row))
      tables.push({
        header,
        rows,
        rowLines,
        line: lineOf(node),
        sectionPath: headingStack.filter((h) => h !== undefined),
      })
    } else if (node.type === 'code') {
      codeBlocks.push({ lang: node.lang ?? null, value: node.value, line: lineOf(node) })
    }
  }

  return {
    file: args.file,
    relPath: args.relPath,
    frozen: args.frozen,
    text: args.text,
    sections,
    tables,
    codeBlocks,
    root: args.root,
  }
}
