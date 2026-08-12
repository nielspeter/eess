---
'@nielspeter/eess-crossvalidate': patch
---

`adrCitationsResolve` now sees tests written in modifier form (bug 0105). It
filtered on the full callee text, and eess-ts names a modifier call by its whole
member expression — so every `it.skip(…)`, `it.only(…)` and `it.concurrent(…)`
definition was discarded before its title was read, and an ADR citing one was
reported as citing a test that does not exist.

The failure landed hardest on the case the mechanism is most useful for: a
skipped test is the record of a known gap, and an ADR citing one is a project
being honest about what is not yet enforced.

The citation side already accepted these forms, so `it.skip('…')` written in a
Mechanism cell now resolves too. `it.each(…)(…)` and `describe(…)` remain
outside — a templated title has no static text to cite.

Unchanged: md↔ts still accepts `it` only, not the `test` alias. Widening it would
change what an ADR is allowed to cite, which is a contract question for the
enforcement table rather than a parser fix.
