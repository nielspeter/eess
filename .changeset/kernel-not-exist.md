---
'@nielspeter/eess': minor
'@nielspeter/eess-ts': patch
'@nielspeter/eess-mermaid': patch
---

A dialect can now report why an absence rule (a `notExist()`, or any condition the kernel marks as satisfied by an empty selection) examined nothing: a new protected hook, `cardinalitySelectorFault()`, is asked after an empty source and before `.expectEmpty()`, so a broken selector is red even when declared empty (bug 0460). It is inert by default; eess-md's builders answer it. New on `@nielspeter/eess/internal` for dialect authors: `notExistCondition`, `globTextFault`, `repoRelativeCorrection`, and the types `SelectorFault`, `NotExistOptions`, `TextBase` and `GlobTextFault`. No root export changes; the hook's return type, `SelectorFault`, is on `/internal` only, so a dialect that overrides it imports it from there.

A condition marked as asserting cardinality (a returned `notExist()`, a `correspondence` side) is now frozen. Assigning to one was never supported: `notExist().evaluate = () => []` kept the empty-selection exemption on a condition that checked nothing (bug 0462).

eess-ts's `syntacticFault` now reads the kernel's glob-text rules; its signature and results are unchanged.
