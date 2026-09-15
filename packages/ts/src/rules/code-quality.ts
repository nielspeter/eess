import { Node, SyntaxKind } from 'ts-morph'
import type { ClassDeclaration } from 'ts-morph'
import type { Condition, ConditionContext } from '@nielspeter/eess'
import type { ArchViolation } from '@nielspeter/eess'
import { createViolation } from '../core/violation.js'
import { searchClassBody } from '../helpers/body-traversal.js'
import type { ExpressionMatcher } from '../helpers/matchers.js'

/**
 * All public methods must have JSDoc comments.
 *
 * Methods with no explicit scope or scope 'public' are checked.
 * Private and protected methods are skipped.
 *
 * @example
 * import { requireJsDocOnPublicMethods } from '@nielspeter/eess-ts/rules/code-quality'
 *
 * classes(p).that().areExported()
 *   .should().satisfy(requireJsDocOnPublicMethods())
 *   .because('public API must be documented')
 *   .check()
 */
export function requireJsDocOnPublicMethods(): Condition<ClassDeclaration> {
  return {
    description: 'have JSDoc on all public methods',
    evaluate(elements: ClassDeclaration[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const cls of elements) {
        for (const method of cls.getMethods()) {
          const scope = method.getScope()
          const isPublic = scope === undefined || String(scope) === 'public'
          if (isPublic && method.getJsDocs().length === 0) {
            violations.push(
              createViolation(
                method,
                `${cls.getName() ?? '<anonymous>'}.${method.getName()} is public but has no JSDoc`,
                context,
              ),
            )
          }
        }
      }
      return violations
    },
  }
}

/**
 * Classes must not have public non-static mutable fields.
 *
 * Static readonly fields (constants) are allowed.
 * Use private fields with getters/setters instead.
 *
 * @example
 * ```typescript
 * import { noPublicFields } from '@nielspeter/eess-ts/rules/code-quality'
 *
 * classes(p).that().resideInFolder('src/domain/')
 *   .should().satisfy(noPublicFields())
 *   .because('encapsulate state behind methods')
 *   .check()
 * ```
 */
export function noPublicFields(): Condition<ClassDeclaration> {
  return {
    description: 'have no public mutable fields',
    evaluate(elements: ClassDeclaration[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const cls of elements) {
        for (const prop of cls.getProperties()) {
          // An ECMAScript `#private` field FIRST, because `getScope()` cannot see
          // it: `#name` carries no TypeScript accessibility modifier, so the scope
          // reads `'public'` and the field was reported. That is a false positive
          // whose remedy — "use private + getter/setter" — is strictly backwards:
          // `#` is private at RUNTIME, while `private` is erased at compile time.
          // Measured on `ArchRuleError.#violations` (plan 0165).
          if (Node.isPrivateIdentifier(prop.getNameNode())) continue
          const scope = prop.getScope()
          if (scope !== undefined && String(scope) !== 'public') continue
          // `readonly` is not mutable — which is what this rule is named for.
          // It previously accepted only `static readonly`, so a public
          // `readonly` INSTANCE field was reported with the remedy "use private
          // + getter/setter": advice that removes nothing (the field already
          // cannot be reassigned) and that the rule's own description does not
          // support. Measured on `DiffFilter.baseBranch` (plan 0165).
          if (prop.isReadonly()) continue

          violations.push(
            createViolation(
              prop,
              `${cls.getName() ?? '<anonymous>'}.${prop.getName()} is a public field — use private + getter/setter`,
              context,
            ),
          )
        }
      }
      return violations
    },
  }
}

/**
 * No member code of a class may contain magic numbers: method, constructor and accessor bodies,
 * parameter defaults, property initializers and static blocks (bug 0306). Decorators, computed member
 * names and `extends` are not read: a number in `@Max(150)` or `@Column({ precision: 12 })` is named by the
 * decorator that takes it, and reading them would report every validation and ORM field.
 *
 * Numbers 0, 1, -1, 2, 10, 100 are allowed by default.
 * Configure with options.allowed to customize.
 *
 * A number that is the whole value of one of the class's own properties or its members' parameter
 * defaults, a default inside a destructured parameter included, is named by it, and is not reported
 * — read through a sign, parentheses, `as`, `<T>`,
 * `satisfies` and `!`, so `static readonly LIMIT = 5000 as const` is named too.
 *
 * A finding names the member the number sits in — `Class.method`, `Class.constructor`,
 * `Class.static` for a static block — so a number in a method keeps the message it always had.
 *
 * @example
 * import { noMagicNumbers } from '@nielspeter/eess-ts/rules/code-quality'
 *
 * classes(p).that().haveNameEndingWith('Service')
 *   .should().satisfy(noMagicNumbers())
 *   .because('extract constants for readability')
 *   .warn()
 *
 * // Custom allowed list
 * classes(p).should().satisfy(noMagicNumbers({ allowed: [0, 1, -1, 200, 404] })).warn()
 */
export function noMagicNumbers(options?: { allowed?: number[] }): Condition<ClassDeclaration> {
  const allowedSet = new Set(options?.allowed ?? [0, 1, -1, 2, 10, 100])
  const magicNumberIn = (cls: ClassDeclaration): ExpressionMatcher => ({
    description: 'magic number',
    syntaxKinds: [SyntaxKind.NumericLiteral],
    matches: (node) =>
      Node.isNumericLiteral(node) &&
      !allowedSet.has(node.getLiteralValue()) &&
      !isNamedValue(node, cls),
  })

  return {
    description: 'have no magic numbers in member code',
    evaluate(elements: ClassDeclaration[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const cls of elements) {
        for (const literal of searchClassBody(cls, magicNumberIn(cls), 'member-code')
          .matchingNodes) {
          if (!Node.isNumericLiteral(literal)) continue
          // The value, not the text: `5_000` is 5000, in the message and against the allowed list.
          const value = literal.getLiteralValue()
          violations.push(
            createViolation(
              literal,
              `${memberLabel(cls, literal)} contains magic number ${String(value)} — extract to a named constant`,
              context,
            ),
          )
        }
      }
      return violations
    },
  }
}

/**
 * A number that is the whole value of one of the class's own declarations — a property's initializer,
 * a member's parameter default, or a binding element's default in a member's destructured parameter
 * (bug 0309) — is named by that declaration: `private timeout = 5000`, `retry(attempts = 3)`,
 * `retry({ attempts = 3 } = {})`, `static readonly LIMIT = -5000 as const`. It is not reported. A
 * number inside a larger initializer or default still is, and so is one in a function or class nested
 * inside a member: the method walk before bug 0306 reported those, and they are not the class's names.
 */
function isNamedValue(literal: Node, cls: ClassDeclaration): boolean {
  let value: Node = literal
  let parent = value.getParent()
  while (parent !== undefined && leavesValueUnchanged(parent)) {
    value = parent
    parent = value.getParent()
  }
  if (Node.isPropertyDeclaration(parent)) {
    return parent.getInitializer() === value && parent.getParent() === cls
  }
  if (Node.isParameterDeclaration(parent)) {
    return parent.getInitializer() === value && isOwnParameter(parent, cls)
  }
  if (Node.isBindingElement(parent)) {
    return parent.getInitializer() === value && isOwnParameter(patternOwner(parent), cls)
  }
  return false
}

/** Whether a node is a parameter of one of the class's own members, not of a function nested in one. */
function isOwnParameter(node: Node | undefined, cls: ClassDeclaration): boolean {
  return Node.isParameterDeclaration(node) && node.getParent()?.getParent() === cls
}

/** What a binding element destructures, through any nested patterns: a parameter, or a variable. */
function patternOwner(element: Node): Node | undefined {
  let node = element.getParent()
  while (
    Node.isObjectBindingPattern(node) ||
    Node.isArrayBindingPattern(node) ||
    Node.isBindingElement(node)
  ) {
    node = node.getParent()
  }
  return node
}

/**
 * A wrapper that leaves the value inside it unchanged: a `-` or `+` sign, parentheses, `as`, `<T>`,
 * `satisfies` or `!`. The metrics rules read a function-valued property through the same wrappers.
 */
function leavesValueUnchanged(node: Node): boolean {
  if (Node.isPrefixUnaryExpression(node)) {
    const operator = node.getOperatorToken()
    return operator === SyntaxKind.MinusToken || operator === SyntaxKind.PlusToken
  }
  return (
    Node.isParenthesizedExpression(node) ||
    Node.isAsExpression(node) ||
    Node.isTypeAssertion(node) ||
    Node.isSatisfiesExpression(node) ||
    Node.isNonNullExpression(node)
  )
}

/**
 * `Class.member` for the member of `cls` a node sits in: `Class.constructor` in a constructor,
 * `Class.static` in a static block, and the class alone for a node outside every member.
 */
function memberLabel(cls: ClassDeclaration, node: Node): string {
  const className = cls.getName() ?? '<anonymous>'
  let member: Node = node
  let parent = member.getParent()
  while (parent !== undefined && parent !== cls) {
    member = parent
    parent = member.getParent()
  }
  if (Node.isConstructorDeclaration(member)) return `${className}.constructor`
  if (Node.isClassStaticBlockDeclaration(member)) return `${className}.static`
  if (
    Node.isMethodDeclaration(member) ||
    Node.isPropertyDeclaration(member) ||
    Node.isGetAccessorDeclaration(member) ||
    Node.isSetAccessorDeclaration(member)
  ) {
    return `${className}.${member.getName()}`
  }
  return className
}
