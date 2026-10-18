# Bug 0473: `.expectNonEmpty()` is unread on eess-ts builders other than `RuleBuilder`

## Status

- **State:** Draft — recorded 2026-10-18 from PR #236's review (testing). Read from the source; no red test yet.
- **Severity:** Low — the declaration changes no verdict on these builders, which is silent, but each
  of them already reports an empty selection by its own means; no false green is measured.
- **Origin:** self-found · PR #236's review, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

Bug 0467 made eess-ts read `.expectNonEmpty()` on a `.notExist()` rule, through the shared runner.
Several `TerminalBuilder` subclasses inherit the method but select by their own means:

- `SliceRuleBuilder`;
- `SmellBuilder`;
- `GraphqlRuleBuilder`;
- `TsconfigBuilder`;
- the pair builder;
- `CrossProjectBuilder`.

On these builders the flag has no reader that changes a verdict. A caller who declares it is told
nothing about whether it means anything there.

## Fix

Decide per builder whether the declaration has a meaning. Where it has none, refuse it with a
`TypeError`, as the `.expectEmpty()`/`.expectNonEmpty()` contradiction is refused, rather than
accepting it silently.

## Verification

- [ ] Red first: `.expectNonEmpty()` on one such builder over an empty selection changes nothing and says nothing
- [ ] Green: each builder either reads it or refuses it

Deferred: none
