import type { Root, Nodes } from 'mdast'
import type { MdDocument } from './document.js'

/** A `path.ext:line[-end]` code pointer occurrence within a document. */
export interface MdPointerRef {
  /** The cited path, e.g. `server/routers/admin.ts` or `[id].vue`. */
  readonly path: string
  /** First referenced code line. */
  readonly startLine: number
  /** Last referenced code line (== startLine when no range). */
  readonly endLine: number
  /** Verbatim pointer text, e.g. `admin.ts:493-495`. */
  readonly raw: string
  /** 1-based line in the source document where the pointer appears. */
  readonly line: number
  /** Char offset span of the `path` portion within the document source (for autofix, plan 0066). */
  readonly pathStart: number
  readonly pathEnd: number
}

/** Code file extensions a pointer may target. */
const CODE_EXT = 'ts|tsx|js|mjs|cjs|vue|json|sql|sh|ya?ml'
// `path.ext:line` or `path.ext:start-end`. Path class includes `[` `]` so Nuxt
// dynamic routes like `[id].vue` match. Backticks aren't in the class, so
// `` `admin.ts:493` `` delimits naturally.
const POINTER_RE = new RegExp(
  String.raw`([A-Za-z0-9_./\[\]-]+\.(?:${CODE_EXT})):(\d+)(?:-(\d+))?`,
  'g',
)

/** Line ranges [start,end] of fenced/indented code blocks (inline code kept). */
function fencedRanges(root: Root): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  const visit = (node: Nodes): void => {
    if (node.type === 'code' && node.position) {
      ranges.push([node.position.start.line, node.position.end.line])
    }
    if ('children' in node) {
      for (const child of node.children) visit(child)
    }
  }
  visit(root)
  return ranges
}

/**
 * Extract code pointers from a document. Pointers inside fenced/indented code
 * are ignored (illustrative, not live claims); pointers in prose and inline
 * code are collected.
 */
export function extractPointers(text: string, root: Root): MdPointerRef[] {
  const ranges = fencedRanges(root)
  const inFence = (line: number): boolean => ranges.some(([s, e]) => line >= s && line <= e)
  const out: MdPointerRef[] = []
  const lines = text.split('\n')
  let lineStartOffset = 0
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1
    const lineText = lines[i]
    if (lineText === undefined) continue
    if (!inFence(lineNo)) {
      for (const m of lineText.matchAll(POINTER_RE)) {
        const path = m[1]
        const startStr = m[2]
        if (path === undefined || startStr === undefined || m.index === undefined) continue
        const startLine = Number(startStr)
        const endLine = m[3] !== undefined ? Number(m[3]) : startLine
        // The match begins with the path (group 1), so its doc offset is the
        // line's start offset plus the match index.
        const pathStart = lineStartOffset + m.index
        out.push({
          path,
          startLine,
          endLine,
          raw: m[0],
          line: lineNo,
          pathStart,
          pathEnd: pathStart + path.length,
        })
      }
    }
    lineStartOffset += lineText.length + 1 // + the '\n'
  }
  return out
}

/** A pointer with its owning document attached — the element the builders and conditions operate on. */
export interface MdPointer extends MdPointerRef {
  readonly doc: MdDocument
}
