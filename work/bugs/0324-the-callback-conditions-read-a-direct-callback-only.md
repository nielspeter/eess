# Bug 0324: the callback conditions read a direct callback only

## Status

- **State:** Draft — confirmed and pinned by KNOWN-GAP tests. The fix is not decided.
- **Severity:** High — **false green, with `call()`.** `notHaveCallbackContaining(call('legacy'))`
  passes `use({ handler: () => legacy(1) })`, a method shorthand in the same place, and a callback
  behind parentheses. An options object with a handler in it is an ordinary way to pass a callback,
  and the builder's own example is `notHaveCallbackContaining(call('db.query'))`
  (`packages/ts/src/builders/call-rule-builder.ts:55`). No shipped rule or preset uses the callback
  conditions, so the gap is in rules adopters write. ADR-010's `examined` counts the calls a rule
  selected, not the callbacks it searched, so such a rule is green with a non-zero denominator while
  it cannot fire.
- **Origin:** self-found · the enforcement review of
  [0323](./fixed/0323-the-call-conditions-search-below-the-root.md)'s fix.
- **Reported:** 2026-09-19

## Symptom

`notHaveCallbackContaining` and `haveCallbackContaining` take an argument as a callback only when
`getFunctionBody` returns a body for it (`packages/ts/src/conditions/call.ts:129` and `:161`), and
`getFunctionBody` answers only for an arrow function or a function expression
(`packages/ts/src/helpers/body-traversal.ts:463`).

Measured with `call('legacy')`, after 0323's fix:

| Statement                                  | `notHaveCallbackContaining` | `notHaveArgumentContaining` |
| ------------------------------------------ | --------------------------- | --------------------------- |
| `use({ handler: () => legacy(1) });`       | **0**                       | 1                           |
| `use({ handler() { return legacy(1) } });` | **0**                       | 1                           |
| `use((() => legacy(1)));`                  | **0**                       | 1                           |
| `use(() => legacy(1));`                    | 1                           | 1                           |

The requirement fails the other way: `haveCallbackContaining(call('legacy'))` reports
`use({ handler: () => legacy(1) })` as missing the call.

## Root cause

The callback conditions and `within()` decide what a callback is in two places. `within()` uses
`extractCallbacks` (`packages/ts/src/helpers/callback-extractor.ts:31`), which also takes
function-valued properties and method shorthands of an object-literal argument. The callback
conditions use `getFunctionBody`, which reads the argument alone. **Neither reads a callback behind
parentheses:** `within()` given `use((() => legacy(1)))` examines nothing, and beside another callback,
`use(() => 1); use((() => legacy(1)))`, it passes.

_Correction, 2026-09-19:_ this record first said the enforcement review measured `within()` finding the
parenthesized shape. That count of 1 was ADR-010's "examined 0 subjects" finding, not a match — found by
the method review, which read the message rather than the count.

## Fix

Not decided. The callback conditions could take their callbacks from `extractCallbacks`, and unwrap
parentheses. That is a candidate, not a measured direction: the sabotage run that turned the pins below red
walked every node of each argument — keeping, at the prohibition site, a function no other function
in the argument encloses, and at the requirement site every one — which is not the fix. Two questions
for the ruling: how deep into an object literal a callback is looked for (`extractCallbacks` goes
three levels), and whether a named function reference (`use(handler)`) is in scope, which
`extractCallbacks` does not resolve either.

`docs/calls.md:158` says a callback inside an object literal or behind parentheses is not searched
yet, and points to `haveArgumentContaining`; `within()` reads the object-literal shapes but not the
parenthesized one.

## Related

- [0323](./fixed/0323-the-call-conditions-search-below-the-root.md) — the same conditions, a
  different cause: the root of what they searched was never tested.

## Verification

- [x] reproduced and pinned —
      `packages/ts/tests/conditions/callback-conditions-read-a-direct-callback-only.test.ts` ·
      `it('KNOWN GAP — notHaveCallbackContaining misses a callback in an object literal or in parentheses')`
      and
      `it('KNOWN GAP — haveCallbackContaining reports a call whose callback is in an object literal as missing it')`.
- [x] each pin goes red when the sabotage run above collects the callbacks inside an argument (the
      sabotage run of 0323's PR, row R11).
- [ ] a ruling on where a callback is looked for, for the callback conditions and `within()`
- [ ] the fix, with the two tests asserting the fixed behaviour
- [ ] `docs/calls.md:158` updated
- [ ] a changeset
- [ ] `npm run validate` green.

Deferred: none.
