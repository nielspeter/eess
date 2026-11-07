---
'@nielspeter/eess': minor
'@nielspeter/eess-ts': minor
'@nielspeter/eess-md': minor
'@nielspeter/eess-mermaid': minor
'@nielspeter/eess-gherkin': minor
'@nielspeter/eess-crossvalidate': minor
---

**Breaking (@nielspeter/eess):** an unsuppressable configuration finding, or a configuration error, now fails the three kernel paths that used to let it pass (bugs 0577, 0586, 0595). Each was a false green.

- A preset under `report: 'warn'` (`finishPreset`) throws every finding that carries `bypassFilters`, as a builder's `.warn()` already did. It used to print such a finding and return, so the run exited 0. Ordinary violations under `warn` are still printed and returned. Every preset in the family ends in `finishPreset`, so this reaches every dialect's presets.
- `collectViolations` rethrows anything a rule's `check()` throws that is not an `ArchRuleError`: an `ArchConfigError` such as an unknown report mode, or a bug in the rule. It used to return no violations for a rule that refused to run. It now recognises an `ArchRuleError` by its structure (`isArchRuleError`), so a second kernel copy's violations are kept instead of dropped.
- `generateBaseline` still writes the baseline for every finding it can accept, then throws an `ArchRuleError` naming each configuration finding it left out, as `eess-ts baseline` writes, prints and exits 1. It used to leave them out without a word.

To migrate: a run that turns red here was reporting green over a broken instrument; fix what the finding names. eess-ts's own `collectViolations` and `generateBaseline` are unchanged.
