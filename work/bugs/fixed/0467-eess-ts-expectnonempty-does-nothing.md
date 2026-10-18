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

eess-ts reads the declaration on its empty-selection path, but only on a cardinality rule, the one
shape where it changes the verdict. A first version read it on every rule. Its review measured that
this swapped a positive rule's empty-selection finding, whose remedy is `.expectEmpty()`, for the
unmet-declaration text, whose remedy (remove `.expectNonEmpty()`) leaves that rule red: the wrong
remedy bug 0069 recorded. The message is the kernel's, exported behind `/internal` as
`UNMET_EXPECT_NON_EMPTY`, so the two families say the same thing. A sabotage row that skips the read
turns the test red.

## Verification

- [x] Red first: the second row above passes today (`packages/ts/tests/core/expect-non-empty-is-read.test.ts`, red on main)
- [x] done-otherwise: green, and it reds naming the declaration on a cardinality rule, the kernel's verdict there. On a positive rule eess-ts keeps its own empty-selection finding, see Resolution; the kernel and eess-ts give the same verdict on the
      same rule shape

Deferred: none
