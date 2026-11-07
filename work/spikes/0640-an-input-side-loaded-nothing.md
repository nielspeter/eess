# Spike 0640: an input side loaded nothing

Measured 2026-11-07, for the second bundle of High false greens the maintainer asked for ("lets
bundle High bugs [that] make eess report green when it shouldn't"). Time-boxed to about an hour; it
brings a design back, decided below so it can be overruled.

## The question

Three High bugs pass a check whose input never loaded:

- [bug 0477](../bugs/0477-a-correspondence-of-two-empty-sides-passes-so-two-crossvalidate-presets-pass-on-nothing.md):
  `correspondence().beComplete()` over two empty sides passes, so `diagramMatchesCode()` and
  `adrCitationsResolve()` pass on nothing;
- [bug 0584](../bugs/0584-scenario-tests-resolve-with-expect-empty-is-green-on-a-zero-file-project.md):
  `scenarioTestsResolve` and `scenariosCovered` with `expectEmpty: true` are green on a project
  with no source files;
- [bug 0594](../bugs/0594-a-stale-exemption-passes-on-a-project-with-no-source-files.md):
  `scenarioExemptionsCurrent` passes on such a project, its `examined` counted from the feature side.

0477's record leaves the fix undesigned, and 0594's records that the fix 0584 suggests (set
`sourceEmpty` on the receipt) is refused beside `examined > 0` as `emitter/contradictory-evidence`.
What one mechanism, if any, covers all three?

## Measured

`scratchpad` probe against `packages/*/dist` at `main` e651544e (v0.21.0 plus PR #326), Node
24.22.0, 32 ms in all. A tsconfig whose `include` matches no file, a diagram of `classDiagram` alone,
and a corpus root holding no document:

| case                                                                                  | result                             |
| ------------------------------------------------------------------------------------- | ---------------------------------- |
| `diagramMatchesCode(empty diagram, empty project)`                                    | examined 0, **green**              |
| `adrCitationsResolve(empty corpus, empty project)`                                    | examined 0, **green**              |
| one receipt, `sourceEmpty` beside `examined: 2`                                       | `emitter/contradictory-evidence`   |
| `mergeCollectResults([{ examined: 0, sourceEmpty }, { examined: 2 }])`                | `emitter/source-empty`, examined 2 |
| `mergeCollectResults([{ examined: 0, sourceEmpty }, { examined: 0, declaredEmpty }])` | `emitter/source-empty`             |
| one loaded, legitimately empty, declared set                                          | green                              |

The merge already holds the rule all three bugs need. [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §4's "an empty source outranks any
declaration" is checked per member (`packages/core/src/collect-result.ts:186`), so a member that
says "my source loaded nothing" reds the merged receipt whatever its siblings examined, and without
the contradiction a single receipt raises. 0594's dead end is the single receipt, not the fact.

What carries the fact today:

- md's builders override the kernel's `sourceEmpty()` (`packages/md/src/builders/corpus-rule-builder.ts:40`);
- eess-ts knows a project that loaded no file (`packages/ts/src/core/empty-project-advice.ts:75`);
- a `Selection`, the input `correspondence()` joins, carries no evidence at all
  (`packages/core/src/correspondence.ts:23`), so the join cannot tell "both sides empty because
  nothing loaded" from "both sides empty because nothing changed", which the release gate relies on
  (the comment at `packages/core/src/correspondence.ts:162`).

## Options

- **A. The side's source travels with its selection, and the kernel's merge decides.** A
  `Selection` gains an optional `sourceEmpty: true`, stamped by the dialect's `select()` from the
  fact it already holds ([ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md): the
  kernel takes the fact, not the project). `correspondence()` merges a member
  `{ examined: 0, sourceEmpty: true }` per such side into its receipt. The gherkin↔ts presets do
  the same for their test side by hand. A hand-built selection stays as it is, so the release gate
  and every adopter's own join are unchanged.
- **B. Each preset checks its inputs and reports an empty one.** Local and small, but four presets
  write the same check, the kernel's join stays fail-open for every adopter's own join, and the
  vacuity matrix's `KNOWN_FAIL_OPEN` entry for `correspondence()` stays (0477 says it should go red).
- **C. `correspondence()` over two empty selections is a finding unless declared.** Breaks the
  release gate's legitimate empty diff and every absence join an adopter built, and cannot tell an
  empty source from an empty selection either; it only moves the guess.

## Decided, 2026-11-07

**A**, by the mission's rule that a fact reaches the verdict as evidence, never as a guess
([ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md), [ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md), [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §4), and because it adds no new verdict logic: the
merge's existing rule decides, as measured above. One mechanism for the three bugs:

1. **Kernel:** `Selection.sourceEmpty?: true`; `selectMatching` takes it; `correspondence()` merges a
   source-empty member per side that carries it. Additive.
2. **Dialects:** the kernel `RuleBuilder.select()` passes `this.sourceEmpty()`; eess-ts's `select()`
   passes "the project loaded no source file"; eess-mermaid's a diagram with no class, if its
   builder can say so (to measure in the build: a diagram holding only other declarations is not
   empty).
3. **eess-crossvalidate's gherkin↔ts presets:** each merges a test-side member when the project
   loaded no source file. `scenarioExemptionsCurrent` then reds as 0594 asks; the other two red
   under `expectEmpty` as 0584 asks.
4. **The finding names its source.** `emitter/source-empty` says "a source", generically; the build
   decides whether it takes the side's label (`diagram class`, `TS class`) without a second finding
   id.

Built as the three bugs' fix, on one branch, with the matrix's `KNOWN_FAIL_OPEN` entries for
`correspondence()` and both presets removed (each must then go red in `check:vacuity`).

## Corrections

None yet.
