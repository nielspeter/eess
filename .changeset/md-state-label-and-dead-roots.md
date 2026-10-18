---
'@nielspeter/eess-md': minor
---

**Breaking:** `honestyAtClose` reports records whose state it cannot read (bug 0444). It used to skip them, so their state/folder check never ran and nothing said so. There are two new findings:

- `ledger/state-under-another-label`: a record with no `State:` line whose header holds a state from your vocabulary under another label, such as `**Status:** Done`. Pass `aliases: ['Status']`, or `label: 'Status'`, so it is read.
- `ledger/no-readable-state`: a call in which no document has a state line at all. It is raised once per call. Usually the call covers folders that hold no records (drafts, extractions): narrow the corpus you pass to the record folders, or pass `ignore`. A heading such as `## Status: Done` is not a label this preset reads yet.

`honestyAtClose` and `ledgerStats` take `label` (default `State`) and `aliases`; a blank label is refused. `findState` takes an optional fourth argument, the label names.

**Breaking:** `corpus()` refuses a root that matches no file, or only ignored files, when another root does load (bug 0465). It throws an `ArchConfigError` naming each dead root. A mistyped root among several used to be dropped without a word, so every rule over the corpus judged less than you named. To migrate, correct the glob or remove the root. A corpus whose every root is dead still loads, and its rules report zero examined units. A root that matches files but no Markdown, such as a code glob, is not refused.
