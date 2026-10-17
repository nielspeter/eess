# Bug 0465: a corpus root that matches no file is dropped silently

## Status

- **State:** Draft — found while reworking plan 0456 and recorded 2026-10-18 at PR #235's third
  review (method, enforcement). Reproduced on main's build by the round-four method review: a two-root
  corpus with one mistyped root loads 1 document and raises nothing. No red test yet; plan 0456 plans
  a test pinning today's behaviour.
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
like other configuration findings (whose appended note is itself wrong for this case: [bug 0461](./0461-the-dedupe-note-says-one-option-for-any-repeated-config-finding.md)), so a rule file with ten rules over one corpus shows it once. Whether
a root may declare that matching nothing is intended is decided against ADR-018 (a string that names
code resolves, or the rule says why not). The fix reds corpora that pass today: a flagged eess-md break
with a migration line (remove or correct the dead root). Not plan 0456's scope (a change to `corpus()`, not to a selector); plan
0456 pins today's behaviour with a test, so this fix turns that test red on purpose.

## Verification

- [ ] Red first: the two-root corpus above loads with no finding
- [ ] Green: it reports `gudies-ref/**` as matching no file; a two-root corpus whose roots both match
      stays green

Deferred: none
