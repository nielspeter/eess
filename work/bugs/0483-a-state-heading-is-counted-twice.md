# Bug 0483: a `## State:` heading is counted twice by `check:corpus`

## Status

- **State:** Draft — recorded 2026-10-18 from [plan 0469](../plans/completed/0469-havefield-a-document-has-a-value.md)'s review; not yet reproduced.
- **Severity:** Low — the build reds either way; the summary's count overstates the findings.
- **Origin:** self-found · [plan 0469](../plans/completed/0469-havefield-a-document-has-a-value.md)'s review, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

A live record whose State is written as a heading (`## State: Done`) is reported by both
`corpus/state-present` (`scripts/check-corpus.mjs:336`), whose `haveField` reads the bold form only,
and the per-lane rule `corpus/state-in-vocabulary-<lane>` (`scripts/check-corpus.mjs:309`), which
reports a label in a form it does not read. That is one cause and two findings, and the gate's
summary counts both.

## Fix

One of the two rules owns the cause; the other leaves it out.

## Verification

- [ ] Red first: a live record with `## State: Done` yields two findings for one line
- [ ] Green: one finding, from the rule that owns it

Deferred: none
