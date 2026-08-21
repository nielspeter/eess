---
'@nielspeter/eess-ts': patch
---

`.check()` at module scope no longer prints its own report when the CLI is
aggregating — bug 0201.

`executeCheck` called `writeReport` unconditionally, one line before it threw. So a
rule file calling a terminal at module scope printed its findings **before**
`eess-ts check` could see them, and no CLI-side filter could act on that output:
not `--baseline`, not `--changed`. Measured against a matching baseline, four
already-accepted violations printed as failures.

It now honours `callerAggregatesReports`, exactly as `executeWarn` always has.

**Nothing changes for a `.check()` outside the CLI.** The flag defaults to `false`
and only `eess-ts check` sets it, so a `.check()` in a test file — where there is no
aggregator — prints exactly as before. The violations are not lost when it stays
quiet either: they ride the thrown `ArchRuleError`, which the CLI collects and
filters.

**Still open, and this release does not fix it.** A _preset_ called without
`report: 'builders'` emits through a different path, which this change does not
touch. Its most visible symptom is that each finding is **printed twice** — once by
the preset, once by the CLI — and that happens with no flags at all. Under
`--baseline` or `--changed` the printed copy is additionally unfiltered, and in that
case `check` now says so; without a filter flag it does not. Tracked separately.
