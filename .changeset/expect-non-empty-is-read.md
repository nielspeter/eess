---
'@nielspeter/eess-ts': minor
'@nielspeter/eess': patch
---

**Breaking (eess-ts):** `.expectNonEmpty()` is now read. It used to set a flag that nothing read, so a rule over zero subjects passed with it exactly as without it (bug 0467). A `.notExist()` rule that declares `.expectNonEmpty()` and selects nothing now reds, naming the declaration. To migrate, remove `.expectNonEmpty()` from `.notExist()` rules. On such a rule it can never pass: a selected subject fails `.notExist()`, and an empty selection fails the declaration. To catch a glob typo, add a positive rule over the same population.

The kernel's `expectNonEmpty()` docstring no longer recommends the combination as a typo guard, and says it can never pass on a `.notExist()` rule (bug 0466). The kernel's message for an unmet declaration is now shared with eess-ts, so the two say the same thing.
