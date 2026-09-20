import { Node, SyntaxKind } from 'ts-morph'
import type { Identifier } from 'ts-morph'

/**
 * Reading a global through the bindings a file spells out (bug 0305).
 *
 * The security rules read a name at the site of use — `eval(…)`, `console.log(…)`,
 * `process.env.A` — which misleads them both ways. A global bound to a local name first
 * (`const ev = eval`, `const { log } = console`, `import { env } from 'node:process'`) is missed:
 * a false GREEN on an ordinary refactor. A local declaration that keeps a global's name
 * (`function Function(…) {}`, `const console = {…}`, a parameter called `process`) is reported as
 * the global: a false RED on code that touches no global at all.
 *
 * **The ruling this implements.** A name is read through its binding, as far as the file spells it:
 *
 * - **no declaration, or an ambient one** — `declare function eval`, a `.d.ts`, the lib — the name
 *   IS the global. That is the common case, and the one that must not change.
 * - **a local bound to a global expression** — `const ev = eval`, `const { log } = console`,
 *   `import { env } from 'node:process'` — reads as what it is bound to, through as many hops as
 *   the file spells out (`const ev = eval; const ev2 = ev`).
 * - **anything else local** — a function, a class, a parameter, a variable holding something else —
 *   is NOT the global, and nothing is reported for it.
 * - **a binding that cannot be resolved** falls back to the name as written. A missing type
 *   definition must never turn a rule off (ADR-009): an unresolvable name errs toward reporting.
 *
 * A `let` is read through its initializer like a `const`. It can be reassigned later, so the answer
 * is not certain — and for a prohibition the uncertain direction to take is the one that reports.
 */

/** The modules whose exports are the `process` global's members (`import { env } from …`). */
const PROCESS_MODULES: ReadonlySet<string> = new Set(['process', 'node:process'])

/** What an alias declaration is bound to: a node to resolve in turn, plus the path taken from it. */
interface AliasSource {
  readonly node: Node
  readonly suffix: readonly string[]
}

/**
 * The dotted global chain an expression denotes, following bindings, or `undefined` when it denotes
 * a local that is not a global.
 *
 * `chainOf` — the caller's reader for a dotted name — is passed in rather than imported, so this
 * module owns the binding question while `security.ts` keeps the one definition of what a name
 * chain is (bug 0308's matchers).
 */
export function globalChainOf(
  node: Node,
  chainOf: (node: Node) => string | undefined,
  seen: ReadonlySet<Node> = new Set(),
): string | undefined {
  const chain = chainOf(node)
  if (chain === undefined) return undefined
  const root = rootIdentifierOf(node)
  // No identifier to resolve — fail-closed, the name as written.
  if (root === undefined) return chain

  const declarations = root.getSymbol()?.getDeclarations() ?? []
  // Unresolvable, declared nowhere, or ambient: the global itself. `declare function eval(…)`,
  // `lib.dom.d.ts` and `@types/node` all land here, which is why the ordinary case is unchanged.
  if (declarations.length === 0 || declarations.every(isAmbient)) return chain

  const rest = chain.split('.').slice(1)
  for (const declaration of declarations) {
    if (seen.has(declaration)) continue
    const imported = importedProcessMember(declaration)
    if (imported !== undefined) return [imported, ...rest].join('.')
    const source = aliasSourceOf(declaration)
    if (source === undefined) continue
    const base = globalChainOf(source.node, chainOf, new Set([...seen, declaration]))
    if (base === undefined) return undefined
    return [base, ...source.suffix, ...rest].join('.')
  }
  // A local declaration that is not bound to a global: a shadow, and not the global's name.
  return undefined
}

/**
 * Whether a declaration is ambient — in a `.d.ts`, or under a `declare` in a source file.
 *
 * The `declare` keyword sits on the STATEMENT, not on the declaration inside it: for
 * `declare const process: {…}` the `VariableDeclaration` has no keyword and its `VariableStatement`
 * has. Asking the declaration alone read the global `process` as a local and took the
 * `process.env` control to 0 — measured, before this walk replaced it.
 */
function isAmbient(declaration: Node): boolean {
  if (declaration.getSourceFile().isDeclarationFile()) return true
  for (const node of [declaration, ...declaration.getAncestors()]) {
    if (Node.isAmbientable(node) && node.hasDeclareKeyword()) return true
  }
  return false
}

/**
 * `process.<name>` when a declaration imports a member of the `process` module — the one binding
 * whose source is not in this file, and the reason `import { env } from 'node:process'` reaches the
 * environment under a name that was never `process`.
 */
function importedProcessMember(declaration: Node): string | undefined {
  if (!Node.isImportSpecifier(declaration)) return undefined
  const module = declaration.getImportDeclaration().getModuleSpecifierValue()
  if (!PROCESS_MODULES.has(module)) return undefined
  return `process.${declaration.getName()}`
}

/** What a local declaration is bound to, when that is another expression in the file. */
function aliasSourceOf(declaration: Node): AliasSource | undefined {
  if (Node.isVariableDeclaration(declaration)) {
    const initializer = declaration.getInitializer()
    return initializer === undefined ? undefined : { node: initializer, suffix: [] }
  }
  // `const { log } = console` / `const { env: e } = process`, at any depth.
  if (Node.isBindingElement(declaration)) {
    const property = declaration.getPropertyNameNode() ?? declaration.getNameNode()
    if (!Node.isIdentifier(property)) return undefined
    const outer = patternSourceOf(declaration)
    return outer === undefined
      ? undefined
      : { node: outer.node, suffix: [...outer.suffix, property.getText()] }
  }
  return undefined
}

/** The expression a binding pattern destructures, walking out through nested patterns. */
function patternSourceOf(element: Node): AliasSource | undefined {
  const owner = element.getParent()?.getParent()
  if (owner === undefined) return undefined
  if (Node.isVariableDeclaration(owner)) {
    const initializer = owner.getInitializer()
    return initializer === undefined ? undefined : { node: initializer, suffix: [] }
  }
  if (Node.isBindingElement(owner)) {
    const property = owner.getPropertyNameNode() ?? owner.getNameNode()
    if (!Node.isIdentifier(property)) return undefined
    const outer = patternSourceOf(owner)
    return outer === undefined
      ? undefined
      : { node: outer.node, suffix: [...outer.suffix, property.getText()] }
  }
  return undefined
}

/** The identifier a dotted name chain starts from. */
function rootIdentifierOf(node: Node): Identifier | undefined {
  let current: Node | undefined = node
  while (current !== undefined) {
    if (Node.isIdentifier(current)) return current
    if (
      Node.isPropertyAccessExpression(current) ||
      Node.isElementAccessExpression(current) ||
      Node.isAsExpression(current) ||
      Node.isSatisfiesExpression(current) ||
      Node.isNonNullExpression(current) ||
      Node.isTypeAssertion(current)
    ) {
      current = current.getExpression()
      continue
    }
    if (Node.isParenthesizedExpression(current)) {
      const inner: Node = current.getExpression()
      const isComma: boolean =
        Node.isBinaryExpression(inner) &&
        inner.getOperatorToken().getKind() === SyntaxKind.CommaToken
      current = isComma && Node.isBinaryExpression(inner) ? inner.getRight() : inner
      continue
    }
    return undefined
  }
  return undefined
}
