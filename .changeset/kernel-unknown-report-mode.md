---
'@nielspeter/eess': patch
'@nielspeter/eess-ts': patch
'@nielspeter/eess-crossvalidate': patch
---

A preset given a `report` mode other than `'throw'`, `'return'` or `'warn'` now throws `ArchConfigError` naming the value (bug 0508). It used to print the violations and pass, so a JavaScript rule file or a mode read from config that misspelt `'throw'` exited 0 over real violations. Omitting `report`, or passing `undefined` or `null`, still means `'throw'`.

- eess-ts's presets (`recommended`, `agentGuardrails` and the rest) refuse the same way, and their message lists `'builders'` beside the other three, since they take it too.
- eess-crossvalidate's bindings that finish through the kernel's `finishPreset` (`scenarioTestsResolve`, `scenariosCovered`, `scenarioExemptionsCurrent`, `scenarioCitationsResolve`, `tableErAgree`) refuse a misspelt mode the same way.

TypeScript already rejected these values, so a caller whose rule file type-checks sees no change.
