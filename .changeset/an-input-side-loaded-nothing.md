---
'@nielspeter/eess': minor
'@nielspeter/eess-ts': minor
'@nielspeter/eess-md': minor
'@nielspeter/eess-mermaid': minor
'@nielspeter/eess-gherkin': minor
'@nielspeter/eess-crossvalidate': minor
---

**Breaking (@nielspeter/eess):** a check whose input loaded nothing reports it instead of passing over nothing (spike 0640; bugs 0477, 0584, 0594).

- A `Selection` carries `sourceEmpty: true` when the source it was selected from loaded nothing at all. The kernel's and eess-ts's `select()` set it: a builder whose `sourceEmpty()` says so (eess-md's builders over an empty corpus), and an eess-ts project that loaded no source file. A hand-built selection without it is unchanged.
- `correspondence()` over such a side reports the empty source, once, as an unsuppressable finding: under the rule when the join examined nothing, as `emitter/source-empty` beside what it did examine. Two loaded sides that select nothing still pass, as an absence join over nothing does.
- eess-crossvalidate: `diagramMatchesCode` and `adrCitationsResolve` over an empty diagram, corpus or project report the empty source; they passed. `scenarioTestsResolve` and `scenariosCovered` report a project that loaded no source file even under `expectEmpty: true`, and `scenarioExemptionsCurrent` reports it beside the exemptions it counted; all three passed.

To migrate: a run that turns red here was passing over an input that never loaded; fix the project, corpus or glob it names, not the declaration.
