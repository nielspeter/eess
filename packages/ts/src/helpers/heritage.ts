import { Node } from 'ts-morph'
import type {
  ClassDeclaration,
  Decorator,
  ExpressionWithTypeArguments,
  InterfaceDeclaration,
} from 'ts-morph'

/**
 * Heritage and decorator names, as written and as resolved (bug 0296).
 *
 * The predicates compared the clause as written, so a base written through an aliased
 * import, a namespace member or a mixin call was missed. Each check here keeps the written
 * comparison — a namespace-qualified name and a base the checker cannot resolve still match
 * exactly as before — and adds the name the checker resolves the clause to. That only ever
 * adds matches.
 *
 * Each check walks the chain (bug 0295, ADR-017): a grandchild of `Base` extends `Base`. At every
 * level the clause is compared as written and as resolved, so a level the checker cannot resolve
 * still matches by its text — the walk adds matches to the direct check and never removes one.
 * It stops where it cannot climb, and says nothing: a base it cannot resolve has no clauses to
 * read (bug 0373), and a class expression, an intersection or a class named in `implements`
 * is not walked (bug 0375).
 */

/** Whether a heritage clause (`implements X`, an interface's `extends X`) resolves to `name`. */
export function clauseResolvesTo(clause: ExpressionWithTypeArguments, name: string): boolean {
  return clause.getType().getSymbol()?.getName() === name
}

/** Whether `cls` names `className` as its direct base, as written or as resolved. */
function directlyExtends(cls: ClassDeclaration, className: string): boolean {
  const clause = cls.getExtends()
  if (clause === undefined) return false
  return (
    clause.getExpression().getText() === className || cls.getBaseClass()?.getName() === className
  )
}

/**
 * `cls` and every class it reaches through `extends`. There is no cycle guard because the
 * checker breaks every circular chain, leaving some class on it with no base class — measured
 * over a self-extend, a pair, a cross-file pair, a declaration merge, a JS file and an ambient
 * pair (a mixin shape ends for another reason: the walk does not climb a mixin call). A guard
 * that cannot fire is not a guard. If this ever stopped holding, the circular-chain tests would
 * fail with `RangeError: Invalid array length` when the chain array overflows — no test timeout
 * can interrupt a synchronous loop. How long that takes depends on the cycle, not on this code:
 * reviews forcing a loop measured 11 s to about 87 s for one looping shape, and a run over the
 * whole block of shapes did not finish in 200 s.
 */
function classChain(cls: ClassDeclaration): ClassDeclaration[] {
  const chain: ClassDeclaration[] = []
  for (let cur: ClassDeclaration | undefined = cls; cur !== undefined; cur = cur.getBaseClass()) {
    chain.push(cur)
  }
  return chain
}

/** The interface declarations a heritage clause resolves to; none when it does not resolve. */
function interfacesOf(clause: ExpressionWithTypeArguments): InterfaceDeclaration[] {
  return (clause.getType().getSymbol()?.getDeclarations() ?? []).filter((d) =>
    Node.isInterfaceDeclaration(d),
  )
}

/** Whether a heritage clause names `name`, as written or as resolved. */
function clauseNames(clause: ExpressionWithTypeArguments, name: string): boolean {
  return clause.getExpression().getText() === name || clauseResolvesTo(clause, name)
}

/**
 * Whether any of `clauses`, or any clause of an interface they reach through `extends`,
 * satisfies `matches`. `seen` holds the interfaces already walked, so a cycle ends the walk.
 */
function clausesReach(
  clauses: readonly ExpressionWithTypeArguments[],
  matches: (clause: ExpressionWithTypeArguments) => boolean,
  seen: Set<InterfaceDeclaration>,
): boolean {
  for (const clause of clauses) {
    if (matches(clause)) return true
    for (const iface of interfacesOf(clause)) {
      if (seen.has(iface)) continue
      seen.add(iface)
      if (clausesReach(iface.getExtends(), matches, seen)) return true
    }
  }
  return false
}

/** Whether `cls` reaches `className` through its `extends` chain, as written or as resolved. */
export function extendsByName(cls: ClassDeclaration, className: string): boolean {
  return classChain(cls).some((c) => directlyExtends(c, className))
}

/**
 * Whether `cls` reaches `interfaceName` — through its own `implements` clause, an ancestor's,
 * or an interface either one extends — as written or as resolved.
 */
export function implementsByName(cls: ClassDeclaration, interfaceName: string): boolean {
  const seen = new Set<InterfaceDeclaration>()
  const matches = (clause: ExpressionWithTypeArguments) => clauseNames(clause, interfaceName)
  return classChain(cls).some((c) => clausesReach(c.getImplements(), matches, seen))
}

/**
 * Whether an interface's `extends` chain holds a clause satisfying `matches` — the caller
 * supplies how one level is compared, and this supplies the walk.
 */
export function interfaceChainReaches(
  iface: InterfaceDeclaration,
  matches: (clause: ExpressionWithTypeArguments) => boolean,
): boolean {
  return clausesReach(iface.getExtends(), matches, new Set([iface]))
}

/**
 * The names a decorator answers to: as written, and — when it is an imported alias — the name
 * of the declaration it stands for. Only an alias symbol is asked for its target: only an alias
 * has one. (Measured: asking a same-file decorator's symbol for an aliased target did not throw
 * here, but the guard does not rely on how the checker answers a question with no answer.)
 */
export function decoratorNames(decorator: Decorator): readonly string[] {
  const written = decorator.getName()
  const symbol = decorator.getNameNode().getSymbol()
  const target = symbol?.isAlias() === true ? symbol.getAliasedSymbol()?.getName() : undefined
  return target === undefined || target === written ? [written] : [written, target]
}
