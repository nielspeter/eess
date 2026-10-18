# Bug 0465: a corpus root that matches no file is dropped silently

## Status

- **State:** Fixed — 2026-10-18, in PR #236 (with bugs 0467, 0466 and 0444).
- **Severity:** High — a silent pass: a mistyped root in a multi-root corpus removes that root's
  documents from every rule over the corpus, without a word.
- **Origin:** self-found · plan 0456's rework, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

`corpus({ roots: ['guides/**', 'gudies-ref/**'] })` loads the documents under `guides/`, so it is
not an empty source, and the mistyped second root contributes nothing and is reported nowhere. A
rule over the corpus then judges half of what its author named. Plan 0456 makes an empty corpus a
finding, which catches a single mistyped root; it does not catch one of several.

## Fix

`corpus()` records a root that matches no file in the repository as a source fact on the corpus, and
every rule over it reports that fact through its own receipt (ADR-008, ADR-013, ADR-014), deduplicated
like other configuration findings (whose appended note is itself wrong for this case: [bug 0461](../0461-the-dedupe-note-says-one-option-for-any-repeated-config-finding.md)), so a rule file with ten rules over one corpus shows it once. Whether
a root may declare that matching nothing is intended is decided against ADR-018 (a string that names
code resolves, or the rule says why not). The fix reds corpora that pass today: a flagged eess-md break
with a migration line (remove or correct the dead root). Not plan 0456's scope (a change to `corpus()`, not to a selector); plan
0456 pins today's behaviour with a test, so this fix turns that test red on purpose.

## Resolution

`corpus()` refuses with an `ArchConfigError` naming every dead root, instead of the source fact on
each rule's receipt that the Fix above planned. The receipt route was measured against the kernel's
deduplication: the key includes the rule id, so ten rules over one corpus would report the root ten
times, and collapsing them needs a kernel change. A refusal is one finding for one authored mistake,
on every door that loads a corpus, as eess-md already does for a half-declared vocabulary (bug 0284).

It fires only when another root does load. A first version refused every dead root. The
non-vacuity gate measured that this broke four fixtures that build an all-empty corpus on purpose,
to test the empty-source report. Loading nothing at all stays that report (ADR-010 §3; plan 0456).
Sabotage rows: switching the refusal off turns two rows red.

## Verification

- [x] Red first: the two-root corpus above loads with no finding (`packages/md/tests/corpus-dead-root.test.ts`, red on main)
- [x] done-otherwise: green, by refusal rather than a receipt finding (Resolution): it reports the dead root as matching no file; a two-root corpus whose roots both match
      stays green

Deferred: none
