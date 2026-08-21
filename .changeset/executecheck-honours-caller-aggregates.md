---
'@nielspeter/eess-ts': patch
---

`.check()` at module scope no longer prints its own report when the CLI is
aggregating — bug 0201.

`executeCheck` called `writeReport` unconditionally, one line before it threw. So a
rule file that calls a terminal at module scope printed its findings **before**
`eess-ts check` could see them, and no CLI-side filter could act on that output:
not `--baseline`, not `--changed`. Measured against a matching baseline: four
already-accepted violations printed as failures.

It now honours `callerAggregatesReports`, exactly as `executeWarn` always has.

**Nothing changes for a `.check()` outside the CLI.** The flag defaults to `false`
and only `eess-ts check` sets it, so a `.check()` in a test file — where there is
no aggregator — prints exactly as before. The violations are not lost when it stays
quiet either: they ride the thrown `ArchRuleError`, which is what the CLI collects
and filters.

**Still open, and the CLI says so rather than hiding it.** A _preset_ called
without `report: 'builders'` emits through the kernel's `finishPreset`, which has
no such flag to honour — so that path still prints before the CLI can filter. When
it happens, `check` now reports it by name and gives the remedy instead of failing
in silence. Tracked separately.
