---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** the class body conditions — `classes(p).should().contain(…)`,
`.notContain(…)` and `.useInsteadOf(…)` — now search the code each member of a class runs: method,
constructor and accessor bodies, every parameter's default value, property initializers (including
arrow-function properties) and static blocks (bug 0300). They searched method, constructor and
accessor bodies only, so a read in a field initializer, a static field, a parameter default or a
static block passed.

Affected, because they are built on those conditions: `noEval`, `noFunctionConstructor`,
`noProcessEnv`, `noConsoleLog`, `noConsole` and `noJsonParse` in `rules/security`; `noGenericErrors`
and `noTypeErrors` in `rules/errors`; `noTypeAssertions` and `noNonNullAssertions` in
`rules/typescript`; `classMustCall` in `rules/architecture`; and the `dataLayerIsolation` preset's
`preset/data/typed-errors` rule.

A green class rule may report findings in those positions, and a `contain` rule may now pass where a
call sat in a field initializer.

A trailing comment on a property (`field = 1 // TODO`) is member code too, so a `comment()` rule may
report it.

Not changed: docstrings are still not searched, and neither is code a class runs outside its
members — decorator arguments, computed member names and the `extends` expression (bug 0307). And `noSilentCatch`,
`noMagicNumbers` and the class metrics rules keep their own walk of class members (bug 0306).

Within one member the body is searched before parameter defaults, so a finding a baseline accepted
keeps its identity and a new one in a default is numbered after it.
