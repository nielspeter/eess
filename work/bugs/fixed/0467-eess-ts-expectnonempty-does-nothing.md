# Bug 0467: eess-ts's `.expectNonEmpty()` does nothing

## Status

- **State:** Fixed — 2026-10-18, in PR #236 (with bugs 0466, 0465 and 0444).
- **Severity:** High — a silent pass: the declaration exists to make a rule able to fail, and on a
  `notExist()` rule it changes nothing.
- **Origin:** self-found · PR #235's sixth review, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

eess-ts's `expectNonEmpty()` (`packages/ts/src/core/terminal-builder.ts:253`) sets `_requireNonEmpty`,
and the only reader of that flag is the contradiction check against `.expectEmpty()`
(`ts/src/core/terminal-builder.ts:289`). No evaluation path reads it. Over an empty selection eess-ts's rule
builder returns no finding for a cardinality condition (`packages/ts/src/core/rule-builder.ts:468-474`)
with no branch for the declaration. Reproduced on main through eess-ts's public entry, over
`packages/core/tsconfig.json`:

| rule (zero subjects)                                                        | result |
| --------------------------------------------------------------------------- | ------ |
| `functions(p).that().haveNameMatching(/^NoSuchFnXyz$/).should().notExist()` | pass   |
| the same with `.expectNonEmpty()`                                           | pass   |

Its docstring (`ts/src/core/terminal-builder.ts:245-251`) promises "the rule FAILS". Positive rules red over an
empty selection with or without it (plan 0074's default), so the declaration changes no verdict on any
eess-ts rule. The kernel's `TerminalBuilder` behaves the other way: there the declaration makes a
`notExist()` rule unable to pass ([bug 0466](./0466-expectnonempty-is-offered-for-a-glob-typo-on-a-cardinality-rule.md)).

## Fix

eess-ts reads the declaration on its empty-selection path, as the kernel does, and the two families
agree on what it means on a cardinality rule (decided with bug 0466, since the kernel's meaning makes
the combination unusable).

## Resolution

eess-ts reports `.expectNonEmpty()` on a `.notExist()` rule with its own finding: the rule can never
pass, and the only remedy is to remove the declaration (`neverPassesViolation`,
`packages/ts/src/core/vacuity-diagnosis.ts`). It is reported on both paths:

- **An empty selection:** inside the evidence floor's cardinality branch, after the empty-project,
  dead-glob and walk-budget findings, which ADR-010 §3 ranks above any declaration. The receipt no
  longer claims "declared empty" for this shape.
- **A non-empty selection:** first, beside the condition's own findings, so the author is not sent
  to fix the code and then told to delete the declaration.

On a positive rule the declaration changes nothing, as before: the empty selection is already a
finding with the right remedy (plan 0074).

This PR's review rejected two earlier versions:

- The first read the declaration on every rule. That swapped a positive rule's remedy for a wrong one,
  the defect bug 0069 recorded.
- The second used the kernel's unmet-declaration text ("fix the selection"). That remedy cannot help
  on this shape, and the empty-selection version also outranked the empty-project and dead-glob
  findings.

The kernel keeps its own behaviour, recorded as [bug 0474](../0474-the-kernels-expectnonempty-finding-ranks-and-advises-wrong.md).
eess-ts builders other than `RuleBuilder` still ignore the declaration:
[bug 0473](../0473-expectnonempty-is-unread-on-eess-ts-builders-other-than-rulebuilder.md).

## Verification

- [x] Red first: a `.notExist()` rule over zero subjects with `.expectNonEmpty()` passed on main (`packages/ts/tests/core/expect-non-empty-is-read.test.ts`).
- [x] Green: it reports that the rule can never pass, on an empty and a non-empty selection, and a dead glob still outranks it. A sabotage row that skips the floor's check turns the empty-selection row red.
- [ ] deferred→bug 0473 — the other eess-ts builders still ignore `.expectNonEmpty()`
- [ ] deferred→bug 0474 — the kernel's finding on this shape still ranks and advises wrong

Deferred: bug 0473, bug 0474
