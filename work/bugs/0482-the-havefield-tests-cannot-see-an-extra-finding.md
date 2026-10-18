# Bug 0482: the `haveField` tests cannot see an extra finding

## Status

- **State:** Draft — recorded 2026-10-18 from plan 0469's review verification.
- **Severity:** Low — no wrong verdict is known; a regression that adds a configuration finding to
  a `haveField` rule would pass the suite.
- **Origin:** self-found · plan 0469's review, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

The suite's `said()` helper (`packages/md/tests/builders/have-field.test.ts:16`) keeps only
findings with `line > 0`, so a configuration finding at line 0 beside an expected list is filtered
out before the assertion. Six cases are also unpinned: an alias (with `region`, and in a conflict
message, which names `spec.label`), an empty value under `oneOf`, a `split` that yields only empty
values, a CRLF record, `.excluding()` against a selector finding, and "it carries no wrapped label".

## Fix

Assert the whole result (or assert separately that no line-0 finding is present), and add a test for
each unpinned case.

## Verification

- [ ] Red first: a sabotage that adds a line-0 finding to a `haveField` rule leaves the suite green
- [ ] Green: the same sabotage reds the suite; the six cases each have a test

Deferred: none
