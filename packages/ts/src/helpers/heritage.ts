import type { ClassDeclaration, Decorator, ExpressionWithTypeArguments } from 'ts-morph'

/**
 * Heritage and decorator names, as written and as resolved (bug 0296).
 *
 * The predicates compared the clause as written, so a base written through an aliased
 * import, a namespace member or a mixin call was missed. Each check here keeps the written
 * comparison — a namespace-qualified name and a base the checker cannot resolve still match
 * exactly as before — and adds the name the checker resolves the clause to. That only ever
 * adds matches. Only the DIRECT clause is read: a grandchild is not a direct child, which is
 * bug 0295's question, not this one.
 */

/** Whether a heritage clause (`implements X`, an interface's `extends X`) resolves to `name`. */
export function clauseResolvesTo(clause: ExpressionWithTypeArguments, name: string): boolean {
  return clause.getType().getSymbol()?.getName() === name
}

/** Whether `cls` names `className` as its direct base, as written or as resolved. */
export function extendsByName(cls: ClassDeclaration, className: string): boolean {
  const clause = cls.getExtends()
  if (clause === undefined) return false
  return (
    clause.getExpression().getText() === className || cls.getBaseClass()?.getName() === className
  )
}

/** Whether `cls` names `interfaceName` in its own `implements` clause, as written or as resolved. */
export function implementsByName(cls: ClassDeclaration, interfaceName: string): boolean {
  return cls
    .getImplements()
    .some(
      (clause) =>
        clause.getExpression().getText() === interfaceName ||
        clauseResolvesTo(clause, interfaceName),
    )
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
