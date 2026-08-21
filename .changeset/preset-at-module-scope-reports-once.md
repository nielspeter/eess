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

**Nothing changes outside the CLI.** The flag is set only by `eess-ts check`, so a
preset or a `checkAll()` in a test file prints exactly as before. The throw is
unchanged in every case — the caller still learns the run failed, and the violations
still ride the error.

**Only the default (throwing) mode.** `report: 'warn'` and `report: 'return'` are
explicit choices about emission and are untouched — and `'warn'`'s violations do not
ride a throw, so suppressing them would lose them.

A consequence worth knowing: because the CLI is now the only thing reporting these
findings, `--baseline` and `--changed` finally apply to them.
