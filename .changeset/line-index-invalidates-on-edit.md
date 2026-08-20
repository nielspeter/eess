---
'@nielspeter/eess-ts': patch
---

`linesOfCode` no longer returns a stale measurement after an in-process edit (bug 0173).

The per-file line index was cached on a `WeakMap<SourceFile, …>` with no
invalidation, on the stated reasoning that ts-morph replaces node objects when a
file's text changes. It does not — a `SourceFile`'s object identity survives an
edit, which this repo had already measured and written down twice elsewhere.

The failure was not "returns the previous answer", which would at least be a
number that once meant something. Positions come from the AST and stay fresh
while the line table goes stale, so the two were read against each other: a class
that grew from 5 code lines to 8 measured **6**.

It bites hardest in the fixture pattern this project's own guidance prescribes —
`createSourceFile(path, text, { overwrite: true })` — where every case after the
first measured the first case's file. A rule author tuning thresholds against
those numbers was tuning against nothing, with no signal that anything was wrong.

The index now lives beside the other `SourceFile`-keyed caches and follows their
convention: reachable from `resetProjectCache()`, and an `onModified` listener
per file that drops it. If you call `linesOfCode` against a project you mutate,
you no longer need to rebuild the project to get a true answer.
