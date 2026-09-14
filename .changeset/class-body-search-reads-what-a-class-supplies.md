---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** the class body conditions — `classes(p).should().contain(…)`,
`.notContain(…)` and `.useInsteadOf(…)` — now also search what a class supplies outside its members,
which runs when the class is defined: the arguments of decorators on the class, its members,
accessors and parameters (every call of a decorator factory chain), computed member names, and the
arguments of calls in `extends` (bug 0307). `@Module({ path: process.env.X })` and
`extends Mixin(Base, process.env.X)` used to pass `noProcessEnv`.

Affected, because they are built on those conditions: `noEval`, `noFunctionConstructor`,
`noProcessEnv`, `noConsoleLog`, `noConsole` and `noJsonParse` in `rules/security`; `noGenericErrors`
and `noTypeErrors` in `rules/errors`; `noTypeAssertions` and `noNonNullAssertions` in
`rules/typescript`; `classMustCall` in `rules/architecture`; and the `dataLayerIsolation` preset's
`preset/data/typed-errors` rule.

A green `notContain` rule may report findings in those positions. A `contain` rule may now pass where
the call sits in a decorator argument (`@Wrap(validate())`). The decorator or base class itself is
not searched — it is wiring, which `haveDecorator()` and `extend()` select on — so `@Validate()` alone
does not satisfy `classMustCall(/validate/i)`. `implements` is type-only and not searched.

A new finding is numbered after the findings its declaration already had, so a finding a baseline
accepted keeps its identity.

A limit, stated rather than filed: a forbidden call used as the base or decorator itself —
`extends (eval('Base'))` — is not reported, because the wiring is not searched.
