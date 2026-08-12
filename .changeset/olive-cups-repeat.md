---
'@nielspeter/eess-crossvalidate': patch
---

`adrCitationsResolve` now sees tests written in modifier form (bug 0105). It
filtered on the full callee text, and eess-ts names a modifier call by its whole
member expression — so every `it.skip(…)`, `it.only(…)`, `it.concurrent(…)` and
`it.todo(…)` definition was discarded before its title was read, and an ADR
citing one was reported as citing a test that does not exist.

The failure landed hardest on the case the mechanism is most useful for: a
skipped test is the record of a known gap, and an ADR citing one is a project
being honest about what is not yet enforced.

The citation side already accepted these forms, so `it.skip('…')` written in a
Mechanism cell now resolves too.

**This can turn a passing build red.** Modifier-form definitions now count toward
ambiguity as well as toward resolution. A citation whose title exists **both**
live and skipped — `it('x')` alongside `it.skip('x')`, the ordinary shape when a
variant is parked mid-refactor — previously matched the one visible definition
and resolved; it now matches two and reports
`matches multiple tests — the correspondence is ambiguous`. That is correct under
the documented contract (a cited title must be unique), but it is new: rename or
delete the parked copy.

**Still outside, and not for one reason.** `describe(…)` is not a test.
`it.each(…)(…)` has a templated title with no static text to cite.
`it.skipIf(cond)(…)` and `it.runIf(cond)(…)` **do** have a static title and are
still not seen — their callee is itself a call, so the same shape that caused
this bug survives there; tracked separately, not fixed here. And md↔ts still
accepts `it` only, not the `test` alias: widening it would change what an ADR may
cite, and would disagree with `eess-md`'s text-level check, which is also
`it`-only.
