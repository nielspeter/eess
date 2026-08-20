---
'@nielspeter/eess-ts': none
---

`noConsole` and `noJsonParse` gain the tests that can falsify them — bug 0186.

**Declared `none` because nothing a consumer can observe changes.** Both rules'
implementations are untouched; what ships is a fixture and nine tests. The bump
is declined deliberately rather than guessed — `check:release` counts any file
under `packages/ts/` as a change, and tests are changes.

Worth stating even though it ships no version: both rules were exported,
documented public API that **no test exercised**. Gutting either so it could
never report left all 3510 tests green. `noConsoleLog` and `noEval` covered the
shared `classNotContain` plumbing; each rule's own discriminating matcher —
which is the entire contribution it makes — was pinned by nothing.
