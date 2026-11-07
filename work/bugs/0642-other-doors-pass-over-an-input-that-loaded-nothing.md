# Bug 0642: other doors pass over an input that loaded nothing

## Status

- **State:** Draft — measured 2026-11-07 by the enforcement review of [spike 0640](../spikes/0640-an-input-side-loaded-nothing.md)'s fix, against
  its branch's `dist`; no red test yet.
- **Severity:** High — a false green: each passes a check whose input never loaded, the shape of
  [bug 0584](./fixed/0584-scenario-tests-resolve-with-expect-empty-is-green-on-a-zero-file-project.md), on inputs that fix did not reach.
- **Origin:** self-found · the build review of [spike 0640](../spikes/0640-an-input-side-loaded-nothing.md)'s fix, 2026-11-07.
- **Reported:** 2026-11-07

## Symptom

[Spike 0640](../spikes/0640-an-input-side-loaded-nothing.md) made a side carry "my source loaded nothing" where the kernel's `select()`, eess-ts's
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

Not designed. [Spike 0640](../spikes/0640-an-input-side-loaded-nothing.md)'s mechanism applies: each dialect's `select()` and each preset carries the
fact for the input it reads (eess-gherkin over a feature set that loaded nothing; eess-md's corpus
for `tableErAgree`; `files()` over a dead glob), and `withEmptySource` reports it. eess-mermaid's
case needs a decision first: a diagram with no class is not shown to be an empty source.

## Verification

- [ ] Red first: each call above reports the empty input.
