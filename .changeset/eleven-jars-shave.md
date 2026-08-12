---
'@nielspeter/eess-crossvalidate': patch
---

Fix `it('…')` title capture ending at any quote character rather than the one
that opened the string (bug 0104). A single-quoted title containing a backtick —
``it('catches `HACK` inside a body')`` — was truncated at that backtick, so
distinct titles collapsed onto one key and a citation to a renamed test still
resolved against a different test that shared the truncated prefix.

Affects `adrCitationsResolve` (md↔ts) and `scenarioTestsResolve` /
`scenariosCovered` (gherkin↔ts), which now share one title grammar. Titles
delimited by `"` or `` ` ``, and escaped delimiters inside a title, round-trip
unchanged. No API change.
