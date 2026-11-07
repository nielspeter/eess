---
'@nielspeter/eess-crossvalidate': minor
'@nielspeter/eess-gherkin': minor
---

**Breaking (@nielspeter/eess-crossvalidate, @nielspeter/eess-gherkin):** more presets report an input that loaded nothing instead of passing over it, even under `expectEmpty: true` (bug 0642, the rest of spike 0640's mechanism).

- `scenarioCitationsResolve` over a corpus or a feature set that loaded nothing; `scenarioTestsResolve`, `scenariosCovered` and `scenarioExemptionsCurrent` over a feature set that loaded no feature file (they already reported an empty project); `tableErAgree` and `embeddedDiagramsMatchCode` over a corpus with no document.
- `files()` marks its selection `sourceEmpty: true` when the tree it walked held no file at all (an empty or missing `cwd`), so a correspondence over it reports the empty source. A glob that matches nothing in a loaded tree is unchanged (bug 0644).
- eess-gherkin: a feature set that loaded no feature file is an empty source. `scenarios(set).select()` carries `sourceEmpty: true`, so a correspondence over it reports it; and a rule over it (`.check()`, `.warn()`, `.violations()`) reports it as an unsuppressable finding, even with `.expectEmpty()`, where it passed. A feature file with no scenario yet is a loaded source, as before.

To migrate: a run that turns red here was passing over an input that never loaded; check each input the preset takes (the corpus roots, the feature roots, the `cwd`) and fix the one that loaded nothing, not the declaration.
