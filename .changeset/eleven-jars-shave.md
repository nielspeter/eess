---
'@nielspeter/eess-crossvalidate': minor
---

Fix `it('…')` title capture ending at any quote character rather than the one
that opened the string (bug 0104). A single-quoted title containing a backtick —
``it('catches `HACK` inside a body')`` — was truncated at that backtick, so
distinct titles collapsed onto one key and a citation to a renamed test still
resolved against a different test that shared the truncated prefix.

Affects `adrCitationsResolve` (md↔ts) and `scenarioTestsResolve` /
`scenariosCovered` (gherkin↔ts), which now share one title grammar. Titles
delimited by `"` or `` ` `` are unaffected.

**Behaviour worth knowing:** titles are compared as **raw source text**, so a
title containing an escaped delimiter keys on the escape as written —
`it('it\'s fine')` must be cited as `it('it\'s fine')`, backslash included, not
as `it('it's fine')`. An ADR cites what the test file says, not what the string
evaluates to. One consequence: a title's raw text is your formatter's to change,
so prefer titles that need no escaping.

Adds `adrCitationStats(corpus, options)` — the md↔ts counterpart of
`scenarioTestStats`, returning `{ citations, adrs }`. `adrCitationsResolve`
reports OK when it resolves zero citations, so a gate that prints this number can
tell a clean pass from a drifted `dir`/`roots` that scanned nothing.

Citation extraction from prose is also tightened: a call whose name merely ends
in `it` (`submit('save')`, `emit('drift')`) no longer reads as a citation, and a
malformed citation can no longer swallow the next one in the same cell.
