# Bug 0466: `.expectNonEmpty()` is offered for a glob typo on a cardinality rule, where it can never pass

## Status

- **State:** Draft — recorded 2026-10-18 from PR #235's fifth review (product). Read from the source;
  no red test yet.
- **Severity:** Low — the advice turns a rule permanently red, which is loud, not silent; but it sends
  an author to a remedy that cannot work.
- **Origin:** self-found · PR #235's fifth review, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

The docstring of `expectNonEmpty()` (`packages/core/src/terminal-builder.ts:74-86`) recommends it for a
`.notExist()`-shaped rule "over an accidentally-emptied corpus (a glob typo, a temporarily-missing
folder)". On such a rule the declaration means the selection must be non-empty, and the condition means
every selected element is a finding. So the rule reds when it selects something and reds when it
selects nothing: it can never be green. The docstring does not say so, and an author following it to
guard a ratchet against a typo gets a rule that can only fail.

## Fix

The docstring says what the declaration is for on a cardinality rule (asserting that the selection is
never empty, which is the opposite of a ratchet) and points a ratchet's author to a positive guard rule
beside it, as plan 0457's example does. If the combination has no legitimate use, it becomes a
configuration finding instead.

## Verification

- [ ] Red first: `docs(c).that().resideInFolder('guides/**').should().notExist().expectNonEmpty()` is red
      over a corpus with and without documents under `guides/`
- [ ] Green: the docstring states it, or the combination is reported as a configuration finding

Deferred: none
