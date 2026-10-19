---
'@nielspeter/eess': patch
'@nielspeter/eess-ts': patch
---

A preset given a `report` mode other than `'throw'`, `'return'` or `'warn'` now throws `ArchConfigError` naming the value (bug 0508). It used to print the violations and pass, so a JavaScript rule file or a mode read from config that misspelt `'throw'` exited 0 over real violations. Omitting `report`, or passing `undefined` or `null`, still means `'throw'`. eess-ts's presets (`recommended`, `agentGuardrails` and the rest) refuse the same way, since they finish through the kernel; `'builders'` is unchanged.

TypeScript already rejected these values, so a caller whose rule file type-checks sees no change.
