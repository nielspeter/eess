# Bug 0462: a `notExist()` whose `evaluate` is replaced keeps its exemption

## Status

- **State:** Draft — recorded 2026-10-18; found while drafting plan 0456 and reproduced here.
- **Severity:** Low — it takes a deliberate edit to a returned condition; the result is the forgery
  `packages/core/src/cardinality.ts` exists to prevent.
- **Origin:** self-found · plan 0456's drafting, 2026-10-17.
- **Reported:** 2026-10-18

## Symptom

`marksAssertsCardinality` (`packages/core/src/cardinality.ts:72`) records the condition object in a
`WeakSet`, so the key cannot be forged, but the object itself stays mutable. Reproduced on main
through eess-ts's public entry, with a selection that matches nothing (`classes(p).that()
.haveNameMatching(/^NoSuchClassXyz$/)`):

| condition                                  | result                               |
| ------------------------------------------ | ------------------------------------ |
| `{ description: 'x', evaluate: () => [] }` | red: "This rule examined 0 subjects" |
| `notExist()` with `evaluate = () => []`    | pass; `Object.isFrozen` is `false`   |

So any no-op condition can be exempted from the empty-selection gate (ADR-010) by assigning it into a
returned `notExist()`, the one-line escape `cardinality.ts`'s docstring describes for the symbol it
replaced. All five `notExist` copies (four in eess-ts, one in eess-mermaid) share it.

## Fix

Freeze a condition when it is marked, so the exempt object cannot change. Plan 0456's kernel
`notExist` is frozen; the five existing copies are fixed here or by their migration onto it.

## Verification

- [ ] Red first: the replaced `notExist()` above passes over an empty selection
- [ ] Green: assigning `evaluate` throws, and the rule still reds

Deferred: none
