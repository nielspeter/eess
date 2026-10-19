---
'@nielspeter/eess-md': minor
---

**Breaking:** `corpus()` now judges the `frozen` globs you pass it (bug 0499). One that can never match a path under `cwd` (a leading `/`, a `../` segment, a `./` after the first) is refused with an `ArchConfigError` that gives the corrected glob, and one that marks none of the documents the corpus loaded is refused, naming it. Before, either emptied `areFrozen()`, so an absence rule such as `taskItems(c).that().areOpen().satisfy(inDocuments(areFrozen())).should().notExist()` was green with nothing examined. eess-md's default frozen globs are not judged, and a corpus that loads no document is left to the empty-source report, as a dead root is.

To migrate: correct a faulted glob as the message says, and remove a lifecycle glob whose folder holds no record yet (`'**/wont-do/**'` before anything is filed there). A document no frozen glob marks is read as live, so when that folder fills, rules over live documents (`pointers().areLive()`, `areLive()`) read it until you add the glob back.
