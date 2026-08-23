---
'@nielspeter/eess-md': patch
'@nielspeter/eess-gherkin': patch
---

Document the corpus listing surface.

`corpus()` returns a `Corpus` you can inspect — `documents()`, `root`, `fileIndex` — and
`features()` returns a `FeatureSet` with `root`, `features()` and `scenarios()`. Both were
public API and documented nowhere: measured before this change, `documents()`, `root` and
`fileIndex` appeared in **0** files under `docs/` and **0** package READMEs.

This is what you reach for when a gate passes and you want to know what it passed _over_ —
a `0` from `documents().length` means the globs matched nothing, not that all is well.

No code changes; the README that ships with each package gains a section, which is why
this is a patch rather than `none`.
