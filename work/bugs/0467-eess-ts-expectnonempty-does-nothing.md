# Bug 0467: eess-ts's `.expectNonEmpty()` does nothing

## Status

- **State:** Draft — recorded 2026-10-18 from PR #235's sixth enforcement review; reproduced here on
  main's build. No red test yet.
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

## Verification

- [ ] Red first: the second row above passes today
- [ ] Green: it reds naming the declaration; the kernel and eess-ts give the same verdict on the
      same rule shape

Deferred: none
