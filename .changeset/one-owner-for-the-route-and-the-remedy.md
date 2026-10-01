---
'@nielspeter/eess-ts': patch
---

A dead-glob finding's remedy is now right on every route, and `doctor` carries it

Fixes [bug 0363](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0363-a-remedy-that-cannot-remediate-survives-one-input-over.md)
and [bug 0364](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0364-doctor-states-the-cause-and-never-the-remedy.md).

**An impossible `Fix:` line on an unsuppressable finding.** A `.notExist()` rule whose
selector names a **file** outside your project — `'**/apps/legacy/src/old**'` rather than
`'**/apps/legacy/**'` — was told to _"widen the tsconfig include"_. No `include` can make that
glob match: `resideInFolder` reads the directory portion, and the glob names a file. The
finding was right and the instruction beside it could not be carried out, which ADR-009 rule 2
calls worse than no message.

The cause was two derivations of one fact. The gate that admitted the finding asked the disk
"is there TypeScript at this path"; the message asked "did the disk decide this". Those
disagree for a glob naming a file, so the finding was admitted for one reason and explained
with another. There is now one owner — the **route** — and the admission gate, the message and
`doctor` all read it.

**`doctor` now states the remedy, not only the cause.** It is the tool you reach for first,
and three rounds of work on what that sentence must say (never offer deletion; name the lever
that actually moves) had reached only `check`. Both tools now read one table, and a test
asserts they agree on every route rather than asserting either one's wording.

**What you will see change:**

- a glob naming a file: `Correct the selector to name the DIRECTORY you mean, or use the
file-level predicate — this rule has not been enforcing anything. Do not delete it.`
- `eess-ts doctor` output for a dead cardinality glob now ends with the same remedy `check`
  gives.
- unchanged: a glob naming a **folder** that is on disk and outside your project still says
  `Widen the tsconfig include…`, because there the tsconfig really is the lever.

No rule changes verdict, and these findings never enter a baseline.
