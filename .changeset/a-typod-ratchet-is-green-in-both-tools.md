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

**The finding's own `Fix:` line is corrected too, and that is a second change.** Restoring
the syntactic route gave the cardinality branch a second way in, and its remedy had been
written for the first: a glob broken in every project was being told to _"widen the tsconfig
include"_ — which no `include` can satisfy — beside a cause saying to remove the `./`. On a
finding that no `.warn()`, `.excluding()`, comment, baseline or diff-aware mode can suppress,
that first branch is the one an agent acts on. Three things change in the output:

- **the remedy is chosen by the diagnosis, not the rule shape.** A broken glob now reads
  `Correct the selector — this rule has not been enforcing anything. Do not delete it.`
  The tsconfig is offered only where the tsconfig is actually the lever.
- **the `Fix:` line names the edit.** It now carries the cause with it, so a `./` glob's
  fix line spells the change (`"./src/x/**" -> "**/src/x/**"`) instead of only saying that
  one is needed.
- **the scope clause is keyed on the glob text alone.** A syntactically broken glob reads
  _"can never match anything in **any** project"_. **This wording changes for
  non-cardinality rules too** — in 0.10.0 they said "in this project" for such a glob,
  which understates a fault that holds everywhere. If you match on that sentence, it moved.
  No rule changes verdict, and these findings never enter a baseline.

Neither cardinality remedy ever offers deletion, and that is pinned in both directions.
