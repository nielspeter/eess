# Bug 0641: the empty-source finding names no source

## Status

- **State:** Draft — found 2026-11-07 while fixing [bug 0594](./fixed/0594-a-stale-exemption-passes-on-a-project-with-no-source-files.md), by [spike 0640](../spikes/0640-an-input-side-loaded-nothing.md)'s design; no change yet.
- **Severity:** Low — no false green: the finding fails the run. It sends the author to the right
  kind of fix, not to the right file.
- **Origin:** self-found · [spike 0640](../spikes/0640-an-input-side-loaded-nothing.md)'s build, 2026-11-07.
- **Reported:** 2026-11-07

## Symptom

`emitter/source-empty` (`packages/core/src/emitter-findings.ts`, `sourceEmptyViolation()`) and the
terminal's rule-attributed form both say a source "loaded zero units before any selection ran — an
empty project, an unreadable config, or a glob resolving to nothing". They name the kinds of empty
source, not which one. [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §4 says an empty source "names the source". A preset with two
inputs, such as `scenarioExemptionsCurrent` over a feature set and a project, leaves the author to
find which input loaded nothing; eess-ts's own terminal already names the tsconfig it read
(`packages/ts/src/core/empty-project-advice.ts`).

## Fix

Not designed. A `Selection` and a receipt member could carry the source's name beside
`sourceEmpty` (the side's label, a tsconfig path), and the finding name it, without a second finding
id.

## Verification

- [ ] Red first: the finding over an empty project names its tsconfig.
