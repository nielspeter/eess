# Bug 0466: `.expectNonEmpty()` is offered for a glob typo on a `notExist()` rule, where it can never pass

## Status

- **State:** Fixed — 2026-10-18, in PR #236 (with bugs 0467, 0465 and 0444).
- **Severity:** Low — the advice turns a rule permanently red, which is loud, not silent; but it sends
  an author to a remedy that cannot work.
- **Origin:** self-found · PR #235's fifth review, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

This is the kernel's `TerminalBuilder`; eess-ts's copy behaves the other way and never reds
([bug 0467](./0467-eess-ts-expectnonempty-does-nothing.md)). The docstring of `expectNonEmpty()`
(`packages/core/src/terminal-builder.ts:74-86`) recommends it for a
`.notExist()`-shaped rule "over an accidentally-emptied corpus (a glob typo, a temporarily-missing
folder)". On such a rule the declaration means the selection must be non-empty, and the condition means
every selected element is a finding. So the rule reds when it selects something and reds when it
selects nothing: it can never be green. The docstring does not say so, and an author following it to
guard a ratchet against a typo gets a rule that can only fail.

## Fix

The docstring says what the declaration is for on a cardinality rule (asserting that the selection is
never empty, which is the opposite of a ratchet) and points a ratchet's author to a positive guard rule
beside it, as plan 0457's example does. If the combination is to become a configuration finding
instead, it keys on a `notExist()` condition, not on the cardinality mark: `correspondence()`'s checks
carry that mark too (`packages/core/src/correspondence.ts:111`, `:125`), and `.expectNonEmpty()` is a
meaningful claim there.

## Resolution

The docstring route, not a configuration finding. Refusing the combination needs the kernel to
recognise a `notExist()` condition, which arrives only with plan 0456's `notExistCondition`. Both the
kernel's and eess-ts's docstrings now say the combination can never pass, and point a ratchet's
author to a positive rule over the same population.

## Verification

- [x] done-otherwise: a characterisation test, not red first. A docstring cannot be red-tested, so `packages/core/tests/expect-non-empty-on-not-exist.test.ts` pins through the kernel's public `RuleBuilder` what the new docstring says (empty selection: the declaration's finding; non-empty: the condition's). The box's original wording: a rule on eess-md's `docs()` with a cardinality-marked
      condition from `@nielspeter/eess/internal` and `.expectNonEmpty()`, over a corpus with no
      document under `guides/`, gives the declaration's finding while the docstring says nothing of
      it (the test asserts the docstring's text, which the fix changes)
- [x] Green: the docstring states what the declaration means on a `notExist()` rule, or the
      combination is reported as a configuration finding

Deferred: none
