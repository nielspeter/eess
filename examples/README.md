# Examples

Two kinds of example live here.

## Single-dialect templates

Architecture rule examples for common project patterns. Copy and adapt for your own project.

| Example                                                    | Description                                                                                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [rest-api.test.ts](./rest-api.test.ts)                     | REST API backend — layers, naming, body analysis, type safety                                                                                          |
| [clean-architecture.test.ts](./clean-architecture.test.ts) | Clean/Hexagonal Architecture — the dependency rule, domain isolation                                                                                   |
| [custom-rules.test.ts](./custom-rules.test.ts)             | Team-specific conventions — JSDoc enforcement, no magic numbers, no public fields                                                                      |
| [type-safety.test.ts](./type-safety.test.ts)               | Strict type safety — ban `any`, type assertions (`as`), non-null assertions (`!`), `eval`                                                              |
| [archunit-inspired.test.ts](./archunit-inspired.test.ts)   | All 7 ArchUnit categories + TypeScript extras — dependencies, containment, inheritance, decorators, layers, cycles, body analysis, type safety, naming |

These five are templates, not runnable tests — they reference project structures
(`src/domain/`, `src/services/`, etc.) that don't exist in this repo. To use one:

1. Copy it to your project's test directory
2. Adjust folder paths to match your project structure
3. Run with your test runner: `npx vitest run arch.test.ts`

They don't run here, but they are **type-checked in CI** (`npm run check:examples`,
via [`tsconfig.json`](./tsconfig.json)) against the current `@nielspeter/eess-ts` types,
so the API they demonstrate can't silently drift out of date. Executing them against
real fixture projects is a separate, deferred follow-up (plan 0091's Out of Scope) —
each currently resolves `project('tsconfig.json')` against this repo's root, which has
none, and would fail deterministically if run.

## Cross-dialect examples — executed, not just type-checked

Each of the four README-documented `@nielspeter/eess-crossvalidate` bindings has a
**checked, executing** example: green (a passing case), red (drift that fails the
build, with an actionable message), and a non-vacuity assertion proving the green
case isn't silently checking nothing.

| Example                                                                | Binding          | Fixtures                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [cross-dialect.md-gherkin.test.ts](./cross-dialect.md-gherkin.test.ts) | Markdown↔Gherkin | [fixtures/gherkin/](./fixtures/gherkin/) — `docs/bad-missing.md` is intentionally broken: it cites a scenario that isn't there                                                                                                                                                                                                                                                                                                                                         |
| [cross-dialect.md-ts.test.ts](./cross-dialect.md-ts.test.ts)           | Markdown↔TS      | [fixtures/adr/](./fixtures/adr/) — `docs/adr/0002-bad.md` is intentionally broken: it cites an `it()` that doesn't exist                                                                                                                                                                                                                                                                                                                                               |
| [cross-dialect.gherkin-ts.test.ts](./cross-dialect.gherkin-ts.test.ts) | Gherkin↔TS       | [fixtures/gherkin-ts/red/](./fixtures/gherkin-ts/red/) (a dangling path, an ambiguous suffix, a missing scenario), [fixtures/gherkin-ts/green/](./fixtures/gherkin-ts/green/) reused as the two uncovered scenarios, and [fixtures/gherkin-ts/covered/](./fixtures/gherkin-ts/covered/) (a stale `@wip` exemption) — all intentionally broken. Exercises all three README-documented exports: `scenarioTestsResolve`, `scenariosCovered`, `scenarioExemptionsCurrent`. |
| [cross-dialect.mermaid-ts.test.ts](./cross-dialect.mermaid-ts.test.ts) | Mermaid↔TS       | [fixtures/calc/](./fixtures/calc/) — `drift.mmd` is missing a real code class (code→diagram); `ghost.mmd` names a class no code has (diagram→code)                                                                                                                                                                                                                                                                                                                     |

Fixture files with a `.ts` extension that sit outside a `cross-dialect.*.test.ts`
file's own directory (e.g. `fixtures/calc/src/calc.ts`, `fixtures/gherkin-ts/**/*.cases.ts`,
`fixtures/adr/tests/example.test.ts`) are read as text by ts-morph via the
crossvalidate presets — they are intentionally **not** part of
`examples/tsconfig.json`'s `include`, so they're never checked by `tsc` and never
run by vitest as tests of their own. Several of these fixtures load under their
own strict `tsconfig.json` at runtime, via the same `project()` call the
crossvalidate preset uses to build its AST — that's a different, narrower check
than `examples/tsconfig.json`'s typecheck, not the absence of one.

## Running

```
npm run check:examples
```

runs both halves: `tsc --noEmit -p examples/tsconfig.json` type-checks everything
above (single-dialect templates included), then `vitest run --root examples` executes
only the `cross-dialect.*.test.ts` family — [`vitest.config.ts`](./vitest.config.ts)'s
`include` is what draws that line, so the five single-dialect templates stay
type-checked-only rather than failing on a `tsconfig.json` this repo's root doesn't have.
