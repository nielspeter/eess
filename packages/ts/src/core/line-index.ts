import { SyntaxKind } from 'ts-morph'
import type { Node, SourceFile } from 'ts-morph'
import { registerCacheReset } from '@nielspeter/eess'

/**
 * The per-file line index behind `linesOfCode`.
 *
 * **Why this is in `core/` and not beside `linesOfCode` in `helpers/`.** It is a
 * cache over ts-morph state, and this package already has three of those —
 * `element-cache.ts`, `descendant-cache.ts`, `module-edges.ts` — each of which
 * registers a reset and drops per-file entries on `onModified`. The first cut of
 * this index lived in `helpers/`, followed neither convention, and reintroduced
 * the exact defect the other three exist to document. Caches live here, next to
 * their siblings, where the convention is visible.
 */

/**
 * Comment kinds ts-morph surfaces as ordinary leaves in `getChildren()`.
 *
 * The compiler treats these as trivia and omits them; ts-morph deliberately does
 * not, which is useful everywhere else and is exactly what `linesOfCode` must
 * undo. Measured: without this set a body of 4 code lines and 3 comment lines
 * counted 7.
 */
const NON_CODE_KINDS = new Set([
  SyntaxKind.SingleLineCommentTrivia,
  SyntaxKind.MultiLineCommentTrivia,
])

/**
 * Count the lines of a node that actually carry code.
 *
 * Physical source lines, excluding comments and blank lines. A line holding only
 * `}` still counts — it is a source line; this is not a statement count.
 *
 * **Why not the span.**
 * [Bug 0170](../../../../work/bugs/0170-linesofcode-counts-comments-so-documentation-reads-as-size.md):
 * this was `end - start + 1`, which measures documentation as size. In this repo
 * that put two rules in direct conflict — `eess/jsdoc-on-public-methods` requires
 * a doc block on every public method, and `eess/max-class-lines` then counted
 * those blocks, so satisfying the first rule broke the second. Measured across
 * this source, six of nine class findings and two of four method findings were
 * comment lines alone.
 *
 * The old docstring justified the span by saying it "avoids the fragility of
 * text-based comment stripping". That reason is sound and it is why this counts
 * TOKENS rather than matching comment syntax in text: comments are trivia, so
 * they are never tokens, and they drop out structurally. Nothing is stripped.
 *
 * Comments have to be skipped by hand even so: ts-morph does not hide them the
 * way the compiler's own tree does — `getChildren()` hands back
 * `SingleLineCommentTrivia` and `MultiLineCommentTrivia` as ordinary leaves, and
 * JSDoc as a child node. JSDoc is the sharpest of the three, because
 * `getStartLineNumber()` excludes it while `getChildren()` returns it, so
 * counting it made an element measure LARGER than its own span —
 * `complexity.test.ts` pins against that as a corpus-wide invariant.
 */
/**
 * Character offset of the first character of each line, ascending.
 *
 * Measured, this is the whole performance story. Walking every token in this
 * repo's source costs 99ms and reading their POSITIONS costs 21ms — but asking
 * ts-morph for their line NUMBERS costs 523ms, five times the walk. `getStart()`
 * returns a number the AST already holds; `getStartLineNumber()` resolves it
 * against the file's text on every call.
 *
 * So positions come from the AST and the offset-to-line mapping is done here,
 * against a table built once per file. That mapping is pure arithmetic over
 * newline offsets — it is not text-based comment detection, which would be
 * genuinely fragile (a regex literal containing `//` cannot be told from a
 * comment without parsing). Deciding what is a comment stays the AST's job.
 */
let lineStartsByFile = new WeakMap<SourceFile, readonly number[]>()

function lineStartsOf(sourceFile: SourceFile): readonly number[] {
  const cached = lineStartsByFile.get(sourceFile)
  if (cached !== undefined) return cached

  const text = sourceFile.getFullText()
  const starts: number[] = [0]
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === NEWLINE) starts.push(i + 1)
  }
  lineStartsByFile.set(sourceFile, starts)
  return starts
}

const NEWLINE = 10

/**
 * The 1-based line holding a character offset.
 *
 * The count of line starts at or before the offset IS the line number, because
 * the table begins with 0 for line 1.
 */
function lineAt(lineStarts: readonly number[], pos: number): number {
  return countUpTo(lineStarts, pos)
}

/**
 * Every line of a source file that carries at least one token, ascending.
 *
 * Computed once per file and cached. Per-subject walking re-visited a method's
 * tokens for every enclosing rule — `maxClassLines` walks the class, then
 * `maxMethodLines` walks each method inside it.
 *
 * Dropped when the file is modified, via the listener in {@link watchOnce}.
 * **Object identity is not enough here and never was.** A `SourceFile`'s
 * identity SURVIVES an edit — `module-edges.ts` measured it, `descendant-cache.ts`
 * records the same trap one level down, and the first cut of this index asserted
 * the opposite and shipped the third instance of it.
 *
 * The failure is not "returns the previous number". Positions come from the AST
 * and stay fresh while the table goes stale, so the two are read against each
 * other and the answer corresponds to nothing: measured, a class that grew from
 * 5 code lines to 8 reported 6.
 */
let codeLinesByFile = new WeakMap<SourceFile, readonly number[]>()
const watched = new WeakSet<SourceFile>()

/**
 * Join `resetProjectCache()`, the documented consumer escape hatch.
 *
 * **This registration is UNPROVEN, and saying so is the point.** Measured:
 * emptying this callback leaves all 3,523 `packages/ts` tests green. That is not
 * an oversight to fix with a cleverer test — it follows from what the
 * registration is FOR. Correctness is already carried by the per-file
 * `onModified` listener in {@link watchOnce}, which fires on every mutation path
 * (and which IS proven — removing it reddens two rows in `complexity.test.ts`).
 * What this adds is **memory reclamation on an explicit reset**: a consumer done
 * with a large project can drop the tables without waiting for the `WeakMap` keys
 * to become unreachable.
 *
 * A property with no observable correctness signature cannot have a break class,
 * and this file's own rule two functions down — "a redundant guard is an
 * unprovable one" — is why that is recorded here rather than left to look
 * tested. Do not add a test that calls `resetProjectCache()` and asserts the next
 * measurement is correct: it is correct either way, and such a row would pass
 * over a deleted callback, which is worse than no row at all.
 */
registerCacheReset(() => {
  lineStartsByFile = new WeakMap<SourceFile, readonly number[]>()
  codeLinesByFile = new WeakMap<SourceFile, readonly number[]>()
})

/**
 * Register the per-file invalidation listener, once.
 *
 * Not once per cache miss: a watch session re-evaluating rules would otherwise
 * accumulate a listener per rule execution. Both maps drop together, because the
 * same edit invalidates both.
 *
 * The closure reads `lineStartsByFile` / `codeLinesByFile` as **live bindings**
 * rather than capturing them, which is what keeps invalidation working after
 * `registerCacheReset` replaces the maps — `descendant-cache.ts` records that
 * capturing by value made a post-reset edit invisible and passed the suite.
 *
 * `onModified` fires on every mutation path that matters here — measured:
 * `addMethod`, `replaceWithText`, and `createSourceFile(path, text,
 * { overwrite: true })`, which is the fixture shape this repo's own guidance
 * prescribes and the one that returned a wrong number for every case after the
 * first.
 */
function watchOnce(sourceFile: SourceFile): void {
  if (watched.has(sourceFile)) return
  watched.add(sourceFile)
  sourceFile.onModified(() => {
    lineStartsByFile.delete(sourceFile)
    codeLinesByFile.delete(sourceFile)
  })
}

function codeLinesOf(sourceFile: SourceFile): readonly number[] {
  const cached = codeLinesByFile.get(sourceFile)
  if (cached !== undefined) return cached

  const lineStarts = lineStartsOf(sourceFile)
  const lines = new Set<number>()
  const visit = (current: Node): void => {
    if (NON_CODE_KINDS.has(current.getKind())) return
    // JSDoc spans many kinds; the prefix is what they share.
    if (current.getKindName().startsWith('JSDoc')) return

    const children = current.getChildren()
    if (children.length === 0) {
      addTokenLines(lines, lineStarts, current)
      return
    }
    for (const child of children) visit(child)
  }
  visit(sourceFile)

  const sorted = [...lines].sort((a, b) => a - b)
  codeLinesByFile.set(sourceFile, sorted)
  return sorted
}

/**
 * Mark every line a leaf token occupies. Multi-line tokens exist — a template
 * literal, a long string — and every line they cover is code.
 */
function addTokenLines(lines: Set<number>, lineStarts: readonly number[], token: Node): void {
  const first = lineAt(lineStarts, token.getStart())
  // `getEnd()` is exclusive, so the last character is one before it. Clamped,
  // because a zero-width node has `getEnd() === getStart()`.
  const last = lineAt(lineStarts, Math.max(token.getStart(), token.getEnd() - 1))
  for (let line = first; line <= last; line++) lines.add(line)
}

/** How many entries of an ascending array are `<= value`. */
function countUpTo(sorted: readonly number[], value: number): number {
  let low = 0
  let high = sorted.length
  while (low < high) {
    const mid = (low + high) >>> 1
    // `?? -Infinity` satisfies noUncheckedIndexedAccess without a non-null
    // assertion (ADR-005); `mid` is always in range, so it never applies.
    if ((sorted[mid] ?? -Infinity) <= value) low = mid + 1
    else high = mid
  }
  return low
}

export function countCodeLines(node: Node): number {
  const sourceFile = node.getSourceFile()
  // ONE registration, here rather than in each accessor. Both maps drop on the
  // same event, so a call in either accessor made the other's redundant — and a
  // redundant guard is an unprovable one: removing either alone left the suite
  // green. At the single entry, removing it reddens the invalidation tests.
  watchOnce(sourceFile)
  const lineStarts = lineStartsOf(sourceFile)
  const lines = codeLinesOf(sourceFile)
  const first = lineAt(lineStarts, node.getStart())
  const last = lineAt(lineStarts, Math.max(node.getStart(), node.getEnd() - 1))
  return countUpTo(lines, last) - countUpTo(lines, first - 1)
}
