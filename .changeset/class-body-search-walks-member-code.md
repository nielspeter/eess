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

Not changed: docstrings are still not searched. And `noSilentCatch`,
`noMagicNumbers` and the class metrics rules keep their own walk of class members (bug 0306).

Every member body is searched before anything the walk did not read before — parameter defaults,
property initializers, static blocks — so a finding a baseline accepted keeps its identity and a new
one is numbered after it, also beside a getter and its setter, or a static and an instance member of
one name.
