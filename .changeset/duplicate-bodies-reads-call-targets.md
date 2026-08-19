---
'@nielspeter/eess-ts': minor
'@nielspeter/eess': patch
---

`computeSimilarity` now weighs what a body CALLS, not only its punctuation shape — bug 0169.

**Breaking (0.x — minor signals it, not a 1.0 stability claim):** `computeSimilarity`
returns a different number for the same pair of fingerprints, so
`smells.duplicateBodies()` reports a different — much smaller — set at any given
threshold. If you have baselined its findings, expect entries to disappear.

`buildFingerprint` had been collecting call targets since it was written and
nothing ever read them: the score was a longest-common-subsequence over the
`SyntaxKind` sequence alone, which measures punctuation. Codebases with a
consistent idiom were punished hardest — measured against eess's own source at
the documented defaults, it produced **218 findings**, including
`TerminalBuilder.check` ~ `TerminalBuilder.warn` at **100%** (one throws and one
does not) and a condition scored against its own negation at 97%.

The score is now the **weaker** of two axes — structural similarity and
call-target overlap — so a threshold keeps one reading: "at least this similar
on every axis measured". Call targets are the right second axis because they
survive the rename that defines a type-2 clone: copy-pasted code with renamed
variables still calls the same functions; two unrelated bodies sharing a
skeleton do not. On eess's own source this takes 218 findings to 70, and what
remains is dominated by genuine duplication.

`min` rather than a product or a mean, both measured and rejected: a product
loses a real cross-package duplicate (0.775, under the default), and a geometric
mean keeps a condition-vs-its-own-negation pair at 0.855, over it.

**Not fixed:** bodies sharing both a skeleton and their call targets still score
high, and a pair where neither body makes any call falls back to the structural
score unchanged. `duplicateBodies` remains a `.warn()` detector, not a gate.

**Migration:** if you relied on the old score, raise your `withMinSimilarity()`
threshold or re-record your baseline. Findings that vanished were near-certainly
shape collisions rather than duplicates — check a sample before assuming a
regression.

Also in this release: a file that produces a violation but cannot be re-read to
apply its `// eess-exclude` directives now says so on stderr instead of silently
dropping the waivers (an unreadable file used to fail the same way an in-memory
project does, so neither could be reported).
