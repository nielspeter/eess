---
'@nielspeter/eess-md': patch
---

Document how to resolve a citation form `adrEnforcement` does not know.

The preset's citation check recognises a backticked file path and an `it('…')`
title. A Mechanism cell citing a rule id from your own architecture tool matches
neither, and three places — the docs page, this README and the preset's own
docstring — said "compose your own gate" without showing how. A consuming project
read all three, concluded the dialect could not do it, and wrote fifty lines of
its own.

The compose path is two primitives that already ship: `rows()` over the Mechanism
column, and `correspondence().beComplete({ direction: 'both' })` against the set
you hold. The docs page gains the worked recipe; `adrEnforcement`'s docstring and
the README point at it. No code changes. The docstring ships in the published
types, which is why this is a patch rather than `none`.
