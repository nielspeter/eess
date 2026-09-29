---
'@nielspeter/eess-ts': patch
---

A ratchet broken by one character reports again

Fixes [bug 0362](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0362-a-typod-ratchet-is-green-in-both-tools.md),
a regression introduced in 0.10.0.

A `.notExist()` rule whose selector reads `'./src/**'` instead of `'src/**'` reported
**nothing** — not in `check`, not in `doctor` — while the directory it names exists, is in
the project, and holds TypeScript. The same glob on a rule asserting something positive
reported normally. Only the ratchet was silent.

0.10.0 taught cardinality rules to read the filesystem, and placed that test where it also
narrowed faults that need no filesystem at all. A `'./'` segment makes a glob match nothing
in **any** project; the disk cannot have an opinion about it. Both tools now report a
syntactically broken glob on a cardinality rule, and a genuinely absent path still stays
green — that discrimination is the point, and it is pinned in both directions.

**If you upgrade and a `.notExist()` rule starts reporting a dead glob**, it was broken
before 0.10.0 too: 0.10.0 silenced the report, and this restores it. Fix the glob — the usual
cause is a leading `./`.
