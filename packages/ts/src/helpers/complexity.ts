import { SyntaxKind, Node } from 'ts-morph'
import type { ClassDeclaration } from 'ts-morph'

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
export function linesOfCode(node: Node): number {
  const lines = new Set<number>()

  const visit = (current: Node): void => {
    if (NON_CODE_KINDS.has(current.getKind())) return
    // JSDoc spans many kinds; the prefix is what they share.
    if (current.getKindName().startsWith('JSDoc')) return

    const children = current.getChildren()
    if (children.length === 0) {
      // A leaf token. Multi-line ones exist — a template literal, a long string —
      // and every line they cover is code.
      for (let line = current.getStartLineNumber(); line <= current.getEndLineNumber(); line++) {
        lines.add(line)
      }
      return
    }
    for (const child of children) visit(child)
  }

  visit(node)
  return lines.size
}

/**
 * Count the number of methods on a class.
 */
export function methodCount(cls: ClassDeclaration): number {
  return cls.getMethods().length
}
