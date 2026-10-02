---
'@nielspeter/eess-ts': none
---

No consumer-visible change: a test pinning why two rule shapes cannot meet

Closes [bug 0371](https://github.com/nielspeter/eess/blob/main/work/bugs/rejected/0371-can-a-cardinality-rule-have-a-dead-discovery-glob.md)
as `Rejected` — the shape it worried about cannot be constructed, so there is nothing to fix and
nothing ships.

The worry was a silence: a `.notExist()` rule whose **discovery** glob silently stopped matching
would be invisible in both of the paths that catch a dead glob, since one discards discovery sites
and the other exempts cardinality rules outright. Built through the public entry points, it cannot
happen — every builder that stamps a discovery glob answers `false` to `assertsCardinality()`, so
neither exemption engages, and the dead glob is reported as an unsuppressable finding like any
other.

What the test adds is the **reason**, pinned rather than written down: if a future builder gains
the `assertsCardinality()` override while still stamping a discovery glob, it reds instead of
reopening the hole silently. The bug record said nothing guarded that; now something does.

`none` rather than a patch because no behaviour, message, type or export moves — the only
additions are a test file and corpus records.
