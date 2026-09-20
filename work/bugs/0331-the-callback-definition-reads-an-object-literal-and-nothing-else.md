# Bug 0331: the shared callback definition reads an object literal and nothing else

## Status

- **State:** Draft — measured on PR #147's build and pinned by a test that asserts each silent
  shape beside the ones that are read. The fix is not decided.
- **Severity:** Medium — **false green.** `notHaveCallbackContaining(call('legacy'))` passes
  `use([() => legacy(1)])`, and an array of handlers is the ordinary Express idiom —
  `app.get('/x', [authenticate, handler])` — which `docs/calls.md` uses as its own example. It also
  passes a getter-held handler and a callback held by a name. `within()` reads the same nothing, so
  both readers of the one definition are blind together. No shipped rule or preset uses the callback
  conditions, so the gap is in rules adopters write.
- **Origin:** the enforcement review of PR #147, 2026-09-20, which measured the shapes the "one
  definition" ruling of [0324](./fixed/0324-the-callback-conditions-read-a-direct-callback-only.md)
  does not reach.
- **Reported:** 2026-09-20

## Symptom

Measured on PR #147's build, `call('legacy')`, one call per shape:

| Statement                                      | `notHaveCallbackContaining` | `within()` |
| ---------------------------------------------- | --------------------------- | ---------- |
| `use([() => legacy(1)]);`                      | **0**                       | **none**   |
| `use({ get handler() { return legacy(1) } });` | **0**                       | **none**   |
| `use(handler);` — a name                       | **0**                       | **none**   |
| `use({ a: { b: { c: { handler: … } } } });`    | **0**                       | **none**   |
| `use({ handler: () => legacy(1) });`           | 1                           | reports    |
| `use({ handler: (() => legacy(1)) as Fn });`   | 1                           | reports    |
| `use((() => legacy(1)));`                      | 1                           | reports    |

## Root cause

`extractCallbacks` (`packages/ts/src/helpers/callback-extractor.ts:37`) reads an argument through
the wrappers and then asks two questions: is it a function, or is it an object literal holding one
(`collectObjectLiteralFunctions`, `packages/ts/src/core/object-literal-functions.ts:50`). An array
literal is neither, so its elements are never looked at; a getter is a `GetAccessorDeclaration`,
which the object-literal walk does not collect
(`packages/ts/src/core/object-literal-functions.ts:71`); a name needs the type checker, which that
module deliberately does not use; and the walk stops at three object literals
(`packages/ts/src/core/object-literal-functions.ts:38`).

The limits are deliberate and now shared — 0324 made the conditions and `within()` read one
definition — which is what makes them worth a record: a limit two readers share is a limit an
adopter meets twice.

## Fix

Not decided. The array case is the one with a named idiom behind it, and it is a small extension of
the same walk: an array literal's elements, read through the wrappers, with the same depth budget.
A getter is a judgement — `{ get handler() { … } }` holds a function that runs on ACCESS, not on
call, so whether a "callback" rule should read it is a ruling, not an oversight. A name is a
type-checker question and is the one limit that costs something real to close.

Whatever is decided, `docs/calls.md` must name the limits exactly: it now says "two shapes",
measured at four.

## Related

- [0324](./fixed/0324-the-callback-conditions-read-a-direct-callback-only.md) — the ruling that made
  the two readers share one definition; this record is that definition's edge.
- [0332](./0332-the-callback-conditions-carry-no-callback-level-denominator.md) — why a rule over
  these shapes goes green rather than reporting that it examined nothing.

## Verification

- [x] reproduced and pinned —
      `packages/ts/tests/conditions/callback-conditions-read-every-callback.test.ts` ·
      `it('still does not read a name, a collection, a getter, or past three object literals')`,
      which asserts the silent shapes beside the ten that are read, so it cannot pass over a
      definition that reads nothing.
- [ ] a ruling per shape: an array element, a getter, a name
- [ ] the fix, with the pinned shapes inverted
- [ ] `docs/calls.md` naming the limits that remain
- [ ] a changeset
- [ ] `npm run validate` green.

Deferred: none.
