---
'@nielspeter/eess-ts': none
---

The cardinality scan in `packages/ts/tests/tools` no longer reads `tests/__generated__`, where other
tests write probe files while the suite runs, so a full run no longer fails its two tests with nothing
changed (bug 0313). Test tooling only: nothing ships.
