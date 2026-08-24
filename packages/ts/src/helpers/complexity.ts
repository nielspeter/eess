import { SyntaxKind, Node } from 'ts-morph'
import { countCodeLines } from '../core/line-index.js'
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
 * Count the lines of a node that actually carry code.
 *
 * Physical source lines, excluding comments and blank lines. A line holding only
 * `}` still counts — it is a source line; this is not a statement count.
 *
 * **Why not the span.**
 * [Bug 0170](../../../../work/bugs/fixed/0170-linesofcode-counts-comments-so-documentation-reads-as-size.md):
 * this was `end - start + 1`, which measures documentation as size. In this repo
 * that put two rules in direct conflict — `eess/jsdoc-on-public-methods` requires
 * a doc block on every public method, and `eess/max-class-lines` then counted
 * those blocks, so satisfying the first rule broke the second.
 *
 * The index that answers this lives in `core/line-index.ts`, with the rest of
 * the AST caches and their invalidation — see there for why it is not here.
 */
export function linesOfCode(node: Node): number {
  return countCodeLines(node)
}

/**
 * Count the number of methods on a class.
 */
export function methodCount(cls: ClassDeclaration): number {
  return cls.getMethods().length
}
