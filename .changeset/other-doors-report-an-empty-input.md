---
'@nielspeter/eess-crossvalidate': minor
'@nielspeter/eess-gherkin': minor
---

**Breaking (@nielspeter/eess-crossvalidate):** more presets report an input that loaded nothing instead of passing over it, even under `expectEmpty: true` (bug 0642, the rest of spike 0640's mechanism).

- `scenarioCitationsResolve` over a corpus or a feature set that loaded nothing; `scenarioTestsResolve`, `scenariosCovered` and `scenarioExemptionsCurrent` over a feature set that loaded no feature file (they already reported an empty project); `tableErAgree` and `embeddedDiagramsMatchCode` over a corpus with no document.
- `files()` marks its selection `sourceEmpty: true` when the tree it walked held no file at all (a wrong `cwd`), so a correspondence over it reports the empty source. A glob that matches nothing in a loaded tree is still an empty selection, which can be the right answer.
- eess-gherkin: `scenarios(set).select()` carries `sourceEmpty: true` when the feature set loaded no feature file, so a correspondence over it reports the empty source.

To migrate: a run that turns red here was passing over an input that never loaded; check each input the preset takes (the corpus roots, the feature roots, the `cwd`) and fix the one that loaded nothing, not the declaration.
