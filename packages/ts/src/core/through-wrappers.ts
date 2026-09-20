import { Node } from 'ts-morph'

/**
 * The value a node holds at run time, read through the wrappers that leave it unchanged —
 * parentheses, `as`, `<T>`, `satisfies` and `!`.
 *
 * **One list, every reader.** It began in `models/arch-function.ts` for a variable's initializer
 * (bugs 0306, 0315). Bug 0324 gave the callback extractor a second copy of the decision, and the
 * enforcement review of that fix measured what two copies cost: `use({ handler: (() => x) })` was
 * read by neither the callback conditions nor `functions({ includeObjectLiteralFunctions: true })`,
 * because the extractor unwrapped the ARGUMENT while the object-literal traversal tested the raw
 * property value. The unwrapping and the object-literal walk are both in `core/`, so the list lives
 * here, below both, and `models/` and `helpers/` import it rather than restating it.
 *
 * This module imports nothing but ts-morph, as its neighbour `object-literal-functions.ts` does, so
 * `models → core` and `helpers → core` both stay permitted directions.
 */
export function throughWrappers(node: Node | undefined): Node | undefined {
  let current = node
  while (
    Node.isParenthesizedExpression(current) ||
    Node.isAsExpression(current) ||
    Node.isTypeAssertion(current) ||
    Node.isSatisfiesExpression(current) ||
    Node.isNonNullExpression(current)
  ) {
    current = current.getExpression()
  }
  return current
}

/**
 * Whether a node IS one of those wrappers — the same question, derived from the same list rather
 * than restating it. A reader that must know whether a value was reached THROUGH a wrapper, to keep
 * a newly reachable finding numbered after the ones read before it, asks this.
 */
export function isValueWrapper(node: Node): boolean {
  return throughWrappers(node) !== node
}
