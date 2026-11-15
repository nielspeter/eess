---
'@nielspeter/eess': minor
'@nielspeter/eess-crossvalidate': patch
---

`withSourceEmpty(loadedNothing, receipt)` on `@nielspeter/eess/internal` (plan 0652): the one owner of
the rule that an input which loaded nothing is reported once. `correspondence()` and
eess-crossvalidate's presets now use it in place of their own copies, which are removed; no finding
or receipt changes for them. Over nothing examined it keeps the receipt's own evidence (`undecided`,
`declaredEmpty`, `notRun`); beside a non-zero `examined` it returns the merge's result.
eess-crossvalidate needs this kernel version for the new internal import.
