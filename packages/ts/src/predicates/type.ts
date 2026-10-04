import {
  Node,
  type ExpressionWithTypeArguments,
  type InterfaceDeclaration,
  type TypeAliasDeclaration,
  type TypeNode,
} from 'ts-morph'
import type { Predicate } from '@nielspeter/eess'
import type { TypeMatcher } from '../helpers/type-matchers.js'
import { clauseResolvesTo, interfaceChainReaches } from '../helpers/heritage.js'

/**
 * Union type representing both interface and type alias declarations.
 * Used as the element type for TypeRuleBuilder.
 */
export type TypeDeclaration = InterfaceDeclaration | TypeAliasDeclaration

/**
 * Matches only InterfaceDeclaration elements.
 *
 * @example
 * types(project).that().areInterfaces()  // only interfaces, not type aliases
 */
export function areInterfaces(): Predicate<TypeDeclaration> {
  return {
    description: 'are interfaces',
    test: (element) => Node.isInterfaceDeclaration(element),
  }
}

/**
 * Matches only TypeAliasDeclaration elements.
 *
 * @example
 * types(project).that().areTypeAliases()  // only type aliases, not interfaces
 */
export function areTypeAliases(): Predicate<TypeDeclaration> {
  return {
    description: 'are type aliases',
    test: (element) => Node.isTypeAliasDeclaration(element),
  }
}

/**
 * Matches types that have a property with the given name.
 * Works for both interfaces (direct properties) and type aliases
 * (resolved type properties).
 *
 * @example
 * types(project).that().haveProperty('sortBy')
 */
export function haveProperty(name: string): Predicate<TypeDeclaration> {
  return {
    description: `have property "${name}"`,
    test: (element) => {
      const type = getResolvedType(element)
      return type.getProperty(name) !== undefined
    },
  }
}

/**
 * Matches types that have a property whose type satisfies the given matcher.
 * Resolves through type aliases, Partial<>, Pick<>, etc.
 *
 * @example
 * types(project).that().havePropertyOfType('sortBy', isString())
 */
export function havePropertyOfType(name: string, matcher: TypeMatcher): Predicate<TypeDeclaration> {
  return {
    description: `have property "${name}" of matching type`,
    test: (element) => {
      const propType = getPropertyType(element, name)
      if (propType === undefined) return false
      return matcher(propType)
    },
  }
}

/**
 * Matches interfaces that extend the given type name, directly or through another interface
 * (bug 0295, ADR-017) — at each level as written, or through an aliased import or a namespace
 * member.
 * For type aliases, checks if the type text references the name.
 *
 * @example
 * types(project).that().extendType('BaseConfig')
 */
export function extendType(name: string): Predicate<TypeDeclaration> {
  return {
    description: `extend type "${name}"`,
    test: (element) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const clauseRegex = new RegExp(`^${escaped}(\\b|$|<)`)
      const clauseNames = (ext: ExpressionWithTypeArguments) =>
        clauseRegex.test(ext.getText()) || clauseResolvesTo(ext, name)
      if (Node.isInterfaceDeclaration(element)) {
        return interfaceChainReaches(element, clauseNames)
      }
      // For type aliases, test the printed type. For most aliases that prints as the alias's own
      // name, which is why `{ bar: BaseConfig }` does not match — not the word boundary. It also
      // matches a module path and some generic arguments (bug 0384).
      const typeText = element.getType().getText()
      const nameRegex = new RegExp(`\\b${escaped}\\b`)
      // The printed type is the alias's own name for most aliases, so an intersection — the
      // alias shape most likely to mean "extends" — never matched (bug 0376). The type node
      // is read as well: kept beside the printed-type test, so what matched before still does.
      return nameRegex.test(typeText) || intersectionNames(element.getTypeNode(), name, clauseNames)
    },
  }
}

// --- Internal helpers ---

/**
 * Whether an alias's type node is an intersection with a member that names `name` — as
 * written, as resolved (an aliased import), or through the member interface's own `extends`
 * chain (ADR-017). Parentheses and nested intersections are looked through. Only an
 * intersection is read: a member of a union, or a property of an object type, does not make
 * the alias extend it.
 */
function intersectionNames(
  node: TypeNode | undefined,
  name: string,
  clauseNames: (ext: ExpressionWithTypeArguments) => boolean,
): boolean {
  if (node === undefined) return false
  if (Node.isParenthesizedTypeNode(node)) {
    return intersectionNames(node.getTypeNode(), name, clauseNames)
  }
  if (!Node.isIntersectionTypeNode(node)) return false
  return node.getTypeNodes().some((member) => {
    // A nested intersection always arrives parenthesised: the parser flattens `A & B & C`.
    if (Node.isParenthesizedTypeNode(member)) {
      return intersectionNames(member, name, clauseNames)
    }
    if (!Node.isTypeReference(member)) return false
    if (member.getTypeName().getText() === name) return true
    const symbol = member.getType().getSymbol()
    if (symbol?.getName() === name) return true
    return (symbol?.getDeclarations() ?? []).some(
      (d) => Node.isInterfaceDeclaration(d) && interfaceChainReaches(d, clauseNames),
    )
  })
}

/**
 * Resolve a TypeDeclaration to its ts-morph Type.
 */
function getResolvedType(element: TypeDeclaration) {
  return element.getType()
}

/**
 * Get the Type of a named property on a TypeDeclaration.
 *
 * Uses getTypeAtLocation() to resolve in context, which is critical
 * for Partial<T>, Pick<T, K>, and other mapped types.
 */
function getPropertyType(element: TypeDeclaration, name: string) {
  const type = getResolvedType(element)
  const prop = type.getProperty(name)
  if (prop === undefined) return undefined

  // getTypeAtLocation resolves the property type in the context of the declaration.
  // Without this, Partial<StrictOptions>['sortBy'] would not resolve correctly.
  return prop.getTypeAtLocation(element)
}
