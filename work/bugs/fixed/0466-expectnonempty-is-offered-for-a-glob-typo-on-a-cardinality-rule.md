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

- **eess-ts refuses the combination.** It reports a finding that the rule can never pass, on both paths
  ([bug 0467](./0467-eess-ts-expectnonempty-does-nothing.md)). In eess-ts every cardinality-marked
  condition is a `.notExist()`.
- **The kernel gets only the docstring route.** Its cardinality mark also covers `correspondence()`,
  where `.expectNonEmpty()` is a meaningful claim, so refusing there needs plan 0456's
  `notExistCondition`.
- **Both docstrings** now say the combination can never pass on a `.notExist()` rule, and point a
  ratchet's author to a positive rule over the same population.
- **One residual, recorded as [bug 0474](../0474-the-kernels-expectnonempty-finding-ranks-and-advises-wrong.md).**
  The kernel's own finding on that shape still offers "fix the selection".

## Verification

- [x] done-otherwise: a characterisation test, not a red-first one. A docstring cannot be red-tested.
      `packages/core/tests/expect-non-empty-on-not-exist.test.ts` pins what the docstring now says,
      through the kernel's public `RuleBuilder`: an empty selection gives the declaration's finding,
      and a non-empty selection gives the condition's.
- [x] Green: the docstrings state what the declaration means on a `.notExist()` rule, and eess-ts
      reports the combination as a finding.
- [ ] deferred→bug 0474 — the kernel's finding on a `.notExist()` rule still offers "fix the selection"

Deferred: bug 0474
