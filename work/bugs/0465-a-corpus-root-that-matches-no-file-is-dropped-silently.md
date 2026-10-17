# Bug 0465: a corpus root that matches no file is dropped silently

## Status

- **State:** Draft — recorded 2026-10-18 from PR #235's third review (method, enforcement); found and
  pinned while reworking plan 0456. No red test yet.
- **Severity:** Medium — a mistyped root in a multi-root corpus removes that root's documents from
  every rule over the corpus, without a word.
- **Origin:** self-found · plan 0456's rework, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

`corpus({ roots: ['guides/**', 'gudies-ref/**'] })` loads the documents under `guides/`, so it is
not an empty source, and the mistyped second root contributes nothing and is reported nowhere. A
rule over the corpus then judges half of what its author named. Plan 0456 makes an empty corpus a
finding, which catches a single mistyped root; it does not catch one of several.

## Fix

`corpus()` reports a root that matches no file in the repository, as its own finding, the way a dead
glob is reported elsewhere. Not plan 0456's scope (a change to `corpus()`, not to a selector); plan
0456 pins today's behaviour with a test, so this fix turns that test red on purpose.

## Verification

- [ ] Red first: the two-root corpus above loads with no finding
- [ ] Green: it reports `gudies-ref/**` as matching no file; a two-root corpus whose roots both match
      stays green

Deferred: none
