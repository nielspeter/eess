---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** a class body rule that forbids something now reads all the code a
class runs, and one that requires something reads only the code its members run (bug 0307).

- `classes(p).should().notContain(…)` and `classNotContain`, and the banned half of
  `.useInsteadOf(…)` and `classUseInsteadOf`, now also read every decorator expression — on the
  class, its members, accessors and parameters — computed member names and the `extends`
  expression. `@Module({ path: process.env.X })`, `extends Mixin(Base, process.env.X)` and
  `extends (Base as any)` used to pass.
- `classes(p).should().contain(…)` and `classContain`, and the replacement half of
  `useInsteadOf`, read member code only: bodies, parameter defaults, property initializers and
  static blocks. A decorator, a DI token or a base class — `@Inject(getRepositoryToken(User))` — is
  wiring, and does not satisfy a must-contain rule such as `classMustCall(/Repository/)`.

Affected, because they are built on those conditions: `noEval`, `noFunctionConstructor`,
`noProcessEnv`, `noConsoleLog`, `noConsole` and `noJsonParse` in `rules/security`; `noGenericErrors`
and `noTypeErrors` in `rules/errors`; `noTypeAssertions` and `noNonNullAssertions` in
`rules/typescript`; `classMustCall` in `rules/architecture`; and the `dataLayerIsolation` preset's
`preset/data/typed-errors` rule.

A green must-not-contain rule may report findings in those positions, including a name in `extends`
that a broad `expression()` matcher matches. `implements` is type-only and docstrings are not code,
so neither is read.

For every member, the walk reads what it read before this release first and anything new after, so a
finding a baseline accepted keeps its identity — also beside a getter and its setter, or a static and
an instance member of one name.
