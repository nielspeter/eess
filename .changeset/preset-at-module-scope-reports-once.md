---
'@nielspeter/eess-ts': patch
---

A preset enforcing at module scope no longer prints its findings twice — bug 0203.

`recommended(p)` in a rule file emitted its violations and then threw. Under
`eess-ts check` the CLI collected the same violations off that throw and reported
them again: one violation, two blocks, two contradicting counters — **with no flags
involved**. Measured, 13 violation blocks of which 6 were exact duplicates, under a
summary line claiming `1 violation`.

This is what a rule file carried over from `@nielspeter/ts-archunit` produces on the
first `eess-ts check`, since its `recommended()` took no `report` option at all.

`deliver()` and `checkAll()` now do what `.check()` already did: enforce, throw, and
let an aggregating caller do the reporting.

**Suppression lasts as long as the run, not the process.** Aggregation is declared
by `eess-ts check` for the duration of its own run and restored afterwards, so a
preset or a `checkAll()` used **outside** that run — in a test file, or by an
embedder — prints exactly as before. That scoping is part of this release: the
declaration used to be a latch nothing reset, which was invisible while only
`.check()` read it and would have silenced a preset called anywhere later in the
same process.

The throw is unchanged in every case — the caller still learns the run failed, and
the violations still ride the error, which is what the CLI collects and reports.

**Only the default (throwing) mode.** `report: 'warn'` and `report: 'return'` are
explicit choices about emission and are untouched — and `'warn'`'s violations do not
ride a throw, so suppressing them would lose them.

A consequence worth knowing: because the CLI is now the only thing reporting these
findings, `--baseline` and `--changed` finally apply to them.

**Warn-severity findings are unaffected by the suppression.** `checkAll()` throws
only the error-severity subset, so its warn findings ride no throw — they are still
written, and `check` says its filters did not reach them. Suppressing them too would
have deleted them, which an early version of this change did.

`eess-ts check`'s "this file stopped evaluating" remedy also names
`report: 'builders'` now. It previously offered only "move its rules into an array
export", which is a no-op for `export default [...recommended(p)]` — already an
array export, and still enforcing at module scope because the spread evaluates
first.
