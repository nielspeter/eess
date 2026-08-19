import { Node } from 'ts-morph'
import type { ArchViolation } from '@nielspeter/eess'
import { generateCodeFrame } from '@nielspeter/eess'

/**
 * The ts-morph half of violation construction — plan 0165 Phase 2.
 *
 * Everything here takes a `Node`, which is why it cannot live in the kernel:
 * `@nielspeter/eess` is engine-independent by charter (ADR-007), and the five
 * dialects that sit on it have no AST in common. The pure half — the
 * `ArchViolation` shape itself, `severityFor`, `remedyRepeatsMessage`,
 * `byCodepoint`, `subjectOf` and the identity-collision machinery — is the
 * kernel's, and there is now exactly ONE copy of it at runtime rather than two.
 * Two copies is not a tidiness complaint: Phase 1 measured a comment-suppression
 * registry written by one and read by the other.
 */

/**
 * Check if a node is a named declaration and return its name, or undefined.
 * Constructors return "constructor" since they have no getName().
 */
function getNodeName(node: Node): string | undefined {
  if (Node.isConstructorDeclaration(node)) return 'constructor'
  if (
    Node.isClassDeclaration(node) ||
    Node.isFunctionDeclaration(node) ||
    Node.isInterfaceDeclaration(node) ||
    Node.isTypeAliasDeclaration(node) ||
    Node.isEnumDeclaration(node) ||
    Node.isMethodDeclaration(node) ||
    Node.isGetAccessorDeclaration(node) ||
    Node.isSetAccessorDeclaration(node) ||
    Node.isPropertyDeclaration(node) ||
    Node.isVariableDeclaration(node)
  ) {
    return node.getName()
  }
  return undefined
}

/**
 * Check if a node is a structural member that should appear in
 * qualified element names (e.g., "ClassName.methodName").
 * Returns the member name, or undefined to skip.
 */
function getStructuralName(node: Node): string | undefined {
  if (Node.isConstructorDeclaration(node)) return 'constructor'
  if (
    Node.isMethodDeclaration(node) ||
    Node.isGetAccessorDeclaration(node) ||
    Node.isSetAccessorDeclaration(node) ||
    Node.isPropertyDeclaration(node)
  ) {
    return node.getName()
  }
  // Arrow/function expressions: check if assigned to a named variable
  if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
    const parent = node.getParent()
    if (parent && Node.isVariableDeclaration(parent)) {
      return parent.getName()
    }
  }
  return undefined
}

/**
 * Check if a node is a top-level architectural boundary where
 * the ancestor walk should stop.
 */
function isTopLevelDeclaration(node: Node): boolean {
  return (
    Node.isClassDeclaration(node) ||
    Node.isInterfaceDeclaration(node) ||
    Node.isTypeAliasDeclaration(node) ||
    Node.isEnumDeclaration(node) ||
    Node.isFunctionDeclaration(node)
  )
}

export function getElementName(node: Node): string {
  const directName = getNodeName(node)
  if (directName !== undefined) return directName
  return enclosingScopeName(node) ?? node.getKindName()
}

/**
 * The structural name of the nearest ENCLOSING declaration — always an ancestor
 * walk, never the node's own name.
 *
 * Split out of `getElementName`, which returns the node's own name when it has
 * one and only walks ancestors otherwise. That difference is invisible until
 * something needs "what encloses this?" rather than "what is this called?", and
 * then it is a defect: a metric identity built on `getElementName` as if it were
 * a scope left method-shorthand object-literal functions (`{ build() {} }`)
 * unqualified, because a `MethodDeclaration` has its own name — so two factories
 * each returning `{ build() {} }` shared one identity while the arrow spelling
 * of the same code did not.
 *
 * Returns `undefined` when no named declaration encloses the node, which is a
 * real answer — a literal passed as a call argument at module level has no scope
 * — and not a value to substitute a kind name for.
 */
export function enclosingScopeName(node: Node): string | undefined {
  // Walk up ancestors collecting structural names: method/constructor/accessor
  // at the member level, class/function at the top level. Skips variables,
  // properties, and expressions — those are implementation detail.
  const parts: string[] = []
  let current: Node | undefined = node.getParent()
  while (current) {
    // Top-level declarations: collect name and stop
    if (isTopLevelDeclaration(current)) {
      const name = getNodeName(current)
      if (name !== undefined) parts.unshift(name)
      break
    }
    // Structural members: collect name and keep walking to find the parent class
    const memberName = getStructuralName(current)
    if (memberName !== undefined) {
      parts.unshift(memberName)
    }
    current = current.getParent()
  }

  return parts.length > 0 ? parts.join('.') : undefined
}

/**
 * Get the absolute file path for a ts-morph Node.
 */
export function getElementFile(node: Node): string {
  return node.getSourceFile().getFilePath()
}

/**
 * Get the start line number for a ts-morph Node.
 */
export function getElementLine(node: Node): number {
  return node.getStartLineNumber()
}

/**
 * Create an ArchViolation from a ts-morph Node and context.
 *
 * Convenience function used by all condition implementations to produce
 * consistent violation objects.
 */
export function createViolation(
  node: Node,
  message: string,
  context: {
    rule: string
    because?: string
    suggestion?: string
    ruleId?: string
    docs?: string
  },
): ArchViolation {
  const line = getElementLine(node)
  const sourceText = node.getSourceFile().getFullText()
  return {
    rule: context.rule,
    ruleId: context.ruleId,
    element: getElementName(node),
    file: getElementFile(node),
    line,
    message,
    because: context.because,
    suggestion: context.suggestion,
    docs: context.docs,
    codeFrame: generateCodeFrame(sourceText, line),
  }
}
