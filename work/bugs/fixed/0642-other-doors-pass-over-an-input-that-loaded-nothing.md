# Bug 0642: other doors pass over an input that loaded nothing

## Status

- **State:** Fixed — 2026-11-07, on `fix/0642-other-doors`, by [spike 0640](../../spikes/0640-an-input-side-loaded-nothing.md)'s mechanism; eess-mermaid's
  case and `fromDiagram` deferred to [bug 0643](../0643-whether-a-class-diagram-with-no-class-is-an-empty-source.md), which needs a decision first.
- **Severity:** High — a false green: each passes a check whose input never loaded, the shape of
  [bug 0584](./0584-scenario-tests-resolve-with-expect-empty-is-green-on-a-zero-file-project.md), on inputs that fix did not reach.
- **Origin:** self-found · the build review of [spike 0640](../../spikes/0640-an-input-side-loaded-nothing.md)'s fix, 2026-11-07.
- **Reported:** 2026-11-07

## Symptom

[Spike 0640](../../spikes/0640-an-input-side-loaded-nothing.md) made a side carry "my source loaded nothing" where the kernel's `select()`, eess-ts's
`select()`, `adrCitationsResolve` and the gherkin↔ts test side know it. These still do not, and
pass, measured:

- `scenarioCitationsResolve(emptyCorpus, emptyFeatures, { expectEmpty: true })` returns `[]`: both
  inputs loaded nothing;
- `scenariosCovered(loadedProject, emptyFeatures, { expectEmpty: true })` and
  `scenarioTestsResolve(projectWithNoCitingTests, emptyFeatures, { expectEmpty: true })` return
  `[]`: the feature side is never asked;
- `tableErAgree(emptyCorpus, { …, expectEmpty: true })` returns `[]`;
- an adopter's own `correspondence()` over eess-gherkin's `scenarios(emptyFeatures).select()`,
  eess-mermaid's `classes(diagram('classDiagram')).select()`, `files()` with a dead glob, or
  `fromDiagram`: none sets `sourceEmpty`.

The vacuity matrix calls each preset with no options, so it cannot see the `expectEmpty` form.

## Fix

Not designed. [Spike 0640](../../spikes/0640-an-input-side-loaded-nothing.md)'s mechanism applies: each dialect's `select()` and each preset carries the
fact for the input it reads (eess-gherkin over a feature set that loaded nothing; eess-md's corpus
for `tableErAgree`; `files()` over a dead glob), and `withEmptySource` reports it. eess-mermaid's
case needs a decision first: a diagram with no class is not shown to be an empty source.

**Fixed 2026-11-07.** One owner per kind of input in `packages/crossvalidate/src/shared.ts`
(`corpusLoadedNothing`, `featuresLoadedNothing`, `projectLoadedNothing`), read by the presets through
`withEmptySource`: `scenarioCitationsResolve` (corpus, feature set), the gherkin↔ts presets (the
feature set beside the project), `tableErAgree` and `embeddedDiagramsMatchCode` (corpus). eess-gherkin's
builder says a feature set with no feature file is an empty source, so its `select()` carries it.
`files()` carries it when the tree it walked held no file at all; a glob that matches nothing in a
loaded tree stays an empty selection, by [spike 0640](../../spikes/0640-an-input-side-loaded-nothing.md)'s design (it can be the right answer, and the
kernel's dead-glob fact is a separate mechanism).

## Verification

- [x] done-otherwise — written after the fix, red under the matrix below: each call above reports
      the empty input, except the two below
      (`packages/crossvalidate/tests/an-input-side-loaded-nothing.test.ts`,
      `packages/gherkin/tests/builder.test.ts`).
- [ ] deferred→[bug 0643](../0643-whether-a-class-diagram-with-no-class-is-an-empty-source.md) — eess-mermaid's `classes(...).select()` and `fromDiagram`: what
      "a diagram loaded nothing" means is a decision, not yet made.
- [ ] dropped-on-purpose — `files()` with a glob that matches nothing in a loaded tree: an empty
      selection, which [spike 0640](../../spikes/0640-an-input-side-loaded-nothing.md) keeps green on purpose; only a tree with no file at all is an
      empty source.
- [x] The sabotage matrix, run 2026-11-07 on `fix/0642-other-doors`'s final code in a worktree with
      its own install and build (12 s), eess-gherkin rebuilt for its row, against the two test files
      above (33 s). The restored tree red 0 before and after; every mutant red:

      | mutant | gherkin | crossvalidate |
      | --- | --- | --- |
      | the gherkin↔ts presets ignore the feature side | 0 | 1 |
      | `scenarioCitationsResolve` ignores its inputs | 0 | 2 |
      | `scenarioCitationsResolve` ignores the feature side | 0 | 1 |
      | `tableErAgree` ignores its corpus | 0 | 1 |
      | `embeddedDiagramsMatchCode` ignores its corpus | 0 | 1 |
      | `files()` never stamps | 0 | 1 |
      | `files()` stamps a dead glob too | 0 | 1 |
      | eess-gherkin's builder never says its source is empty | 1 | 0 |

      _The first run's third row survived: the test emptied the corpus and the feature set together,
      so the corpus alone carried it. A test over a loaded corpus and an empty feature set pins it._

- [x] done-otherwise — `npm run validate` is CI's (ruleset 26704592); locally: crossvalidate 166,
      gherkin 14, md 1,266, core 442 and the cross-dialect examples 116 green (`npx vitest run` per
      package and `--root examples`), with `check:crossval`, `check:vacuity`, `check:family`,
      `check:arch`, `check:docs-code`, `check:surface`, `check:release`, typecheck and format
      (91 s for all of them).

Deferred: 1 — [bug 0643](../0643-whether-a-class-diagram-with-no-class-is-an-empty-source.md).
