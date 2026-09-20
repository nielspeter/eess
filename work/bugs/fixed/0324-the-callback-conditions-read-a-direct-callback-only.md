# Bug 0324: the callback conditions read a direct callback only

## Status

- **State:** Fixed — the callback conditions take their callbacks from `extractCallbacks`, the
  definition `within()` already used, and that definition now reads through the wrappers the
  function collector reads a variable's initializer through. Red test first.
- **Severity:** High — **false green, with `call()`.** `notHaveCallbackContaining(call('legacy'))`
  passes `use({ handler: () => legacy(1) })`, a method shorthand in the same place, and a callback
  behind parentheses. An options object with a handler in it is an ordinary way to pass a callback,
  and the builder's own example is `notHaveCallbackContaining(call('db.query'))`
  (`packages/ts/src/builders/call-rule-builder.ts:55`). No shipped rule or preset uses the callback
  conditions, so the gap is in rules adopters write. ADR-010's `examined` counts the calls a rule
  selected, not the callbacks it searched, so such a rule is green with a non-zero denominator while
  it cannot fire.
- **Origin:** self-found · the enforcement review of
  [0323](./0323-the-call-conditions-search-below-the-root.md)'s fix.
- **Reported:** 2026-09-19 · **Fixed:** 2026-09-20 (PR #147)

## Symptom

`notHaveCallbackContaining` and `haveCallbackContaining` took an argument as a callback only when
`getFunctionBody` returned a body for it (`packages/ts/src/conditions/call.ts:129` and `:161`, on `main`
at d592d60), and `getFunctionBody` answered only for an arrow function or a function expression
(`packages/ts/src/helpers/body-traversal.ts:489` on `main` at d592d60; deleted in PR #147).

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

The callback conditions and `within()` decided what a callback is in two places. `within()` uses
`extractCallbacks` (`packages/ts/src/helpers/callback-extractor.ts:40`), which also takes
function-valued properties and method shorthands of an object-literal argument. The callback
conditions used `getFunctionBody`, which read the argument alone. **Neither read a callback behind
parentheses:** `within()` given `use((() => legacy(1)))` examines nothing, and beside another callback,
`use(() => 1); use((() => legacy(1)))`, it passes.

_Correction, 2026-09-19:_ this record first said the enforcement review measured `within()` finding the
parenthesized shape. That count of 1 was ADR-010's "examined 0 subjects" finding, not a match — found by
the method review, which read the message rather than the count.

## Fix

**Ruled: one definition of a callback, and it is `extractCallbacks`.** The conditions read an
argument's body themselves (`getFunctionBody`) while `within()` used the extractor, and two readers
of one concept is the cause rather than a detail of it — so `getFunctionBody` is deleted, not
widened. The conditions now call `extractCallbacks`, which answers the record's two open questions
by inheritance: an object literal is searched **three levels** deep, as `within()` has searched it,
and a **named reference** is still not resolved, as it is not for `within()`. Both limits are pinned
by a test and written in `docs/calls.md` rather than left to be discovered.

**Parentheses are read where the collector already read them.** `extractCallbacks` reads each
argument through `throughWrappers` — parentheses, `as`, `<T>`, `satisfies` and `!` — the list
`functionValueOf` uses for a variable's initializer (bugs 0306, 0315), now shared rather than
copied. That is what closes the parenthesized shape for `within()` too, which this record measured
examining nothing.

**The callbacks read before the fix come first.** A match's identity is numbered within its
enclosing declaration, so a newly reachable callback on an earlier argument would otherwise take the
ordinal a baseline accepted on a later one. Ordered as `findMatchesInEach` orders the roots bug 0323
made it test.

Measured, one call per shape, `call('legacy')`, before and after:

| Statement                                      | `notHaveCallbackContaining` | after | `haveCallbackContaining` reports missing | after |
| ---------------------------------------------- | --------------------------- | ----- | ---------------------------------------- | ----- |
| `use({ handler: () => legacy(1) });`           | 0                           | 1     | yes                                      | no    |
| `use({ handler() { return legacy(1) } });`     | 0                           | 1     | yes                                      | no    |
| `use((() => legacy(1)));`                      | 0                           | 1     | yes                                      | no    |
| `use(((() => legacy(1)) as Fn));`              | 0                           | 1     | yes                                      | no    |
| `use({ opts: { handler: () => legacy(1) } });` | 0                           | 1     | yes                                      | no    |
| `use(() => legacy(1));`                        | 1                           | 1     | no                                       | no    |
| `use(legacy(1));`                              | 0                           | 0     | yes                                      | yes   |
| `use(handler);` — a named reference            | 0                           | 0     | yes                                      | yes   |
| a callback four object literals deep           | 0                           | 0     | yes                                      | yes   |

`within()` was measured over the same shapes: it reported the object-literal ones before and after,
and the parenthesized and `as` shapes only after — before, it examined nothing and said so through
ADR-010.

## Related

- [0323](./0323-the-call-conditions-search-below-the-root.md) — the same conditions, a
  different cause: the root of what they searched was never tested.

## Verification

- [x] reproduced and pinned —
      `packages/ts/tests/conditions/callback-conditions-read-a-direct-callback-only.test.ts` ·
      `it('KNOWN GAP — notHaveCallbackContaining misses a callback in an object literal or in parentheses')`
      and
      `it('KNOWN GAP — haveCallbackContaining reports a call whose callback is in an object literal as missing it')`.
- [x] each pin goes red when the sabotage run above collects the callbacks inside an argument (the
      sabotage run of 0323's PR, row R11).
- [x] a ruling on where a callback is looked for, for the callback conditions and `within()` — see
      **Fix**: the extractor's definition, for both, with its two limits named.
- [x] the fix, with the two tests asserting the fixed behaviour —
      `packages/ts/tests/conditions/callback-conditions-read-every-callback.test.ts` ·
      `it('reports a callback in an options object, a method shorthand and one behind a wrapper')`
      and `it('takes the same callbacks as satisfying a requirement')`. The KNOWN-GAP file is
      replaced, as 0323's was. Three more tests pin what the ruling decided:
      `it('agrees with within(), which reads the same definition')`,
      `it('still does not resolve a callback a name refers to, or one nested deeper than three levels')`
      and `it('numbers a newly read callback after the one read before it')`.
- [x] `docs/calls.md` updated — `haveCallbackContaining` names what is read and the two shapes that
      are not.
- [x] a changeset — `.changeset/searches-read-every-shape.md`, a breaking `minor` for
      `@nielspeter/eess-ts`: a green callback rule may now report.
- [x] Sabotage matrix over the two test files this PR adds, sources restored by sha256 and verified,
      the tree unchanged. R0, as built: nothing red. R5, the extractor reading no wrapper: three
      tests red. R6, the conditions reading a direct callback only — the behaviour before this fix: three red,
      the order test among them. R7, a newly read callback numbered first: the order test red.
- [x] `npm run validate` green.

Deferred: none.
