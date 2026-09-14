---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** every class-level body rule now searches the code each member
of a class runs — method, constructor and accessor bodies, every parameter's default value,
property initializers (including arrow-function properties) and static blocks (bug 0300). It
searched method, constructor and accessor bodies only, so a read in a field initializer, a static
field, a parameter default or a static block passed.

Affected: `classes(p).should().contain(…)`, `.notContain(…)` and `.useInsteadOf(…)`, and the class
variants built on them — `noEval`, `noFunctionConstructor`, `noProcessEnv`, `noConsoleLog`,
`noConsole` and `noJsonParse` in `rules/security`, `noGenericErrors` and `noTypeErrors` in
`rules/errors`, `noTypeAssertions` and `noNonNullAssertions` in `rules/typescript`, and the
class-must-call rule in `rules/architecture`.

A green class rule may report findings in those positions, and a `contain` rule may now pass where a
call sat in a field initializer. Decorators and docstrings are still not searched, so a `comment()`
rule keeps reading bodies, not documentation.
