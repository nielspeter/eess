---
'@nielspeter/eess-md': minor
---

**Breaking:** `corpus()` now judges the `frozen` globs you pass it (bug 0499). One that can never match a path under `cwd` (a leading `/`, a `../` segment, a `./` after the first) is refused with an `ArchConfigError` that gives the corrected glob, and one that marks none of the documents the corpus loaded is refused, naming it. Before, either emptied `areFrozen()`, so an absence rule such as `taskItems(c).that().areOpen().satisfy(inDocuments(areFrozen())).should().notExist()` was green with nothing examined. A corpus that loads no document is left to the empty-source report, as a dead root is.

New: `corpus({ expectEmptyFrozen })` names frozen globs that mark nothing on purpose, such as a lifecycle folder with no record yet. Each name must be one of `frozen`, and the declaration expires: once its glob marks a document, `corpus()` refuses until you drop it from `expectEmptyFrozen`.

To migrate: correct a faulted glob as the message says. For a lifecycle glob whose folder holds no record yet (`'**/wont-do/**'` before anything is filed there), name it in `expectEmptyFrozen`. Do not remove it: removed, a record filed there later is read as live, and an absence rule over the frozen documents never sees it, which is the false green this fix closes. Writing the default list out makes it yours, and it is judged; the omitted default is not, so if you passed `frozen: ['**/completed/**', '**/archived/**']` and lack one of those folders, omit `frozen` or declare the missing one.
