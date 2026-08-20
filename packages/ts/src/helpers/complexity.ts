import { SyntaxKind, Node } from 'ts-morph'
import type { ClassDeclaration, SourceFile } from 'ts-morph'

/** Decision-point SyntaxKinds that increment cyclomatic complexity */
const DECISION_KINDS = new Set([
  SyntaxKind.IfStatement,
  SyntaxKind.ConditionalExpression,
  SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
  SyntaxKind.CatchClause,
  SyntaxKind.CaseClause,
])

/** Logical operator tokens that add branching */
const LOGICAL_OPERATORS = new Set([
  SyntaxKind.AmpersandAmpersandToken, // &&
  SyntaxKind.BarBarToken, // ||
  SyntaxKind.QuestionQuestionToken, // ??
])

/**
 * Calculate cyclomatic complexity (McCabe) for a function body.
 *
 * Accepts the body Node directly (from ArchFunction.getBody(),
 * MethodDeclaration.getBody(), etc.).
 *
 * Complexity = 1 + number of decision points.
 * Returns 1 for an undefined/empty body (one path through).
 */
export function cyclomaticComplexity(body: Node | undefined): number {
  if (!body) return 1

  let complexity = 1

  for (const descendant of body.getDescendants()) {
    if (DECISION_KINDS.has(descendant.getKind())) {
      complexity++
    }

    // Count logical operators in binary expressions
    if (Node.isBinaryExpression(descendant)) {
      const opKind = descendant.getOperatorToken().getKind()
      if (LOGICAL_OPERATORS.has(opKind)) {
        complexity++
      }
    }
  }

  return complexity
}

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
const lineStartsByFile = new WeakMap<SourceFile, readonly number[]>()

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
 * A `WeakMap` keyed on the SourceFile, so a project that drops a file drops its
 * entry. Safe because eess only ever READS a project: ts-morph replaces node
 * objects when a file's text changes, so a stale array cannot be reached
 * through a live SourceFile. A consumer that manipulates source and re-measures
 * in one process is outside that assumption — nothing in this package does.
 */
const codeLinesByFile = new WeakMap<SourceFile, readonly number[]>()

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

export function linesOfCode(node: Node): number {
  const sourceFile = node.getSourceFile()
  const lineStarts = lineStartsOf(sourceFile)
  const lines = codeLinesOf(sourceFile)
  const first = lineAt(lineStarts, node.getStart())
  const last = lineAt(lineStarts, Math.max(node.getStart(), node.getEnd() - 1))
  return countUpTo(lines, last) - countUpTo(lines, first - 1)
}

/**
 * Count the number of methods on a class.
 */
export function methodCount(cls: ClassDeclaration): number {
  return cls.getMethods().length
}
