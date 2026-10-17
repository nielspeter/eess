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

Freeze a condition when it is marked (`marksAssertsCardinality`), so no exempt object can change; this
fixes all five copies at once. Planned in [plan 0456](../plans/0456-kernel-notexist-and-dead-glob.md)
(coordinator's decision after its second review, 2026-10-18: nothing in `packages/*/src` mutates a
marked condition, so it ships as a kernel minor without a break marker).

## Verification

- [ ] Red first: the replaced `notExist()` above passes over an empty selection
- [ ] Green: assigning `evaluate` on a returned `notExist()` throws, so the exemption only ever
      belongs to the condition as shipped; a plain no-op condition over the same empty selection still reds

Deferred: none
