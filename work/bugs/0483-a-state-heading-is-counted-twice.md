# Bug 0483: a `## State:` heading is counted twice by `check:corpus`

## Status

- **State:** Draft — recorded 2026-10-18 from plan 0469's review; not yet reproduced.
- **Severity:** Low — the build reds either way; the summary's count overstates the findings.
- **Origin:** self-found · plan 0469's review, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

A live record whose State is written as a heading (`## State: Done`) is reported by both
`corpus/state-present` (`scripts/check-corpus.mjs:336`), whose `haveField` reads the bold form only,
and `corpus/state-in-a-form-not-read`, the per-lane rule's report of a label in a form it does not
read (`scripts/check-corpus.mjs:309`). One cause, two findings (ADR-016's one per cause), and the
gate's summary counts both.

## Fix

One of the two rules owns the cause; the other leaves it out.

## Verification

- [ ] Red first: a live record with `## State: Done` yields two findings for one line
- [ ] Green: one finding, from the rule that owns it

Deferred: none
