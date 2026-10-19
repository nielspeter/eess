---
'@nielspeter/eess-gherkin': minor
---

`haveUniqueTitles` is rebuilt on the kernel's `beUniqueBy` condition (plan 0459).

**Breaking (@nielspeter/eess-gherkin):** a duplicate title now reports every scenario that carries it, not only the second and later ones, so a duplicate pair gives two findings, each naming the other. The message changes from `duplicate scenario title "X" (first at line N) — ambiguous for citation resolution` to `<file> › X has the same title as 1 other: <file>:N; titles must be unique within a feature file, or a citation of one is ambiguous`. A finding's element gains the line: `<file>:<line> › <title>`.

To migrate: `haveUniqueTitles` now reports every member of a duplicate group, each naming the others, and its element carries the line. Update tests, baselines and `.excluding()` patterns keyed on the old message, count or element. A waiver on one occurrence no longer hides the pair: rename the scenario.

Also new: the `ConditionContext` type is re-exported, so a condition written over `scenarios()` names it without a direct `@nielspeter/eess` install.
