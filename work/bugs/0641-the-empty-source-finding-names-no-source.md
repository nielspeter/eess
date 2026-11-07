# Bug 0641: the empty-source finding names no source

## Status

- **State:** Draft — found 2026-11-07 while fixing [bug 0594](./fixed/0594-a-stale-exemption-passes-on-a-project-with-no-source-files.md), by [spike 0640](../spikes/0640-an-input-side-loaded-nothing.md)'s design; no change yet.
- **Severity:** Medium — no false green: the finding fails the run. But it breaches a clause
  [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) marks `gated` (its row "The finding names its cause, and the remedy remediates", at
  `adr/014-the-emitter-refuses-a-verdict-without-evidence.md:499`, says "`emitter/source-empty` now names the source"), and
  for a preset with two inputs it also loses which rule it came from (below). Raised from Low at
  the build review of [spike 0640](../spikes/0640-an-input-side-loaded-nothing.md)'s fix (product lens).
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

Added 2026-11-07 by that build review:

- Beside a join or a preset that examined something, the finding is `emitter/source-empty`, an
  emitter finding with no rule facts: it names neither the input nor, by its id, the rule. An
  adopter with several presets in one rule file has to bisect.
- Beside real violations, its message opens "this verdict reports success…", in a run that is red.
- A `Selection` that holds elements and carries `sourceEmpty: true` reds as `emitter/source-empty`;
  the same contradiction on a receipt is `emitter/contradictory-evidence`. It fails closed either
  way; the asymmetry is noted here.
- Either [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)'s row overclaims, or "names the source" means the kind of source and this
  record's premise is wrong. Settled by this bug's fix, not here.

## Fix

Not designed. A `Selection` and a receipt member could carry the source's name beside
`sourceEmpty` (the side's label, a tsconfig path), and the finding name it, without a second finding
id.

## Verification

- [ ] Red first: the finding over an empty project names its tsconfig.
