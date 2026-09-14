---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** a class body rule that forbids something now reads all the code a class
runs (bug 0307). One that requires something is unchanged, and still reads only its members' code.

- `classes(p).should().notContain(…)` and `classNotContain`, and the banned half of
  `.useInsteadOf(…)` and `classUseInsteadOf`, now also read every decorator expression — on the
  class, its members, accessors and parameters — computed member names and the `extends`
  expression. `@Module({ path: process.env.X })`, `extends Mixin(Base, process.env.X)` and
  `extends (Base as any)` used to pass.
- `classes(p).should().contain(…)` and `classContain`, and the replacement half of
  `useInsteadOf`, are unchanged: they still read member code only — bodies, parameter defaults,
  property initializers and static blocks — so a decorator, a computed name or the `extends` expression — `@Inject(getRepositoryToken(User))`
  included — does not satisfy a must-contain rule like `classMustCall(/Repository/)`. The line is
  drawn by position: a call in member code still does, a DI lookup such as
  `private users = inject(getRepositoryToken(User))` included.

Affected, because they are built on those conditions: `noEval`, `noFunctionConstructor`,
`noProcessEnv`, `noConsoleLog`, `noConsole` and `noJsonParse` in `rules/security`; `noGenericErrors`
and `noTypeErrors` in `rules/errors`; `noTypeAssertions` and `noNonNullAssertions` in `rules/typescript`; and the `dataLayerIsolation` preset's
`preset/data/typed-errors` rule.

A green must-not-contain rule may report findings in those positions, including a name in `extends` that a broad `expression()` matcher matches, and a comment trailing a
decorator or `extends` (`@ApiProperty() // TODO`) under a `comment()` rule. `implements` is type-only and docstrings are not code,
so neither is read.

For every member, the walk reads what it read before this release first and anything new after, so a
finding a baseline accepted keeps its identity — also beside a getter and its setter, or a static and
an instance member of one name.
