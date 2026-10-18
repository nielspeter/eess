---
'@nielspeter/eess': minor
'@nielspeter/eess-ts': patch
'@nielspeter/eess-mermaid': patch
---

An absence rule (a `notExist()`, or any condition the kernel marks as satisfied by an empty selection) whose selector is broken is now red, even when it declares `.expectEmpty()` (bug 0460). Builders answer a new protected hook, `cardinalitySelectorFault()`, which is inert by default; eess-md's builders answer it. New on `@nielspeter/eess/internal` for dialect authors: `notExistCondition`, `globTextFault`, `globTextCorrection` and the `SelectorFault` type. No root export changes.

A condition marked as asserting cardinality (a returned `notExist()`, a `correspondence` side) is now frozen. Assigning to one was never supported: `notExist().evaluate = () => []` kept the empty-selection exemption on a condition that checked nothing (bug 0462).

eess-ts's `syntacticFault` now reads the kernel's glob-text rules; its signature and results are unchanged.
