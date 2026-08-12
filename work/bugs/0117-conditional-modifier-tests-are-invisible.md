# Bug 0117: `it.skipIf(cond)('…')` and `it.runIf(cond)('…')` are invisible to `adrCitationsResolve` — 0105's symptom, one shape narrower

## Status

- **State:** Draft — reproduced end to end against the built `md-ts.js`; no red
  test yet. `0008-not-tests.md` currently pins the behaviour as _expected_, which
  this bug proposes to change.
- **Severity:** Medium — **false red.** A citation to a real, statically-titled
  test resolves to nothing. It can only add violations, never hide one.
- **Origin:** self-found · testing review of
  [0105](./fixed/0105-md-ts-drops-modifier-forms.md)'s fix
- **Reported:** 2026-08-12

## Symptom

`it.skipIf(isCI)('a conditionally skipped guarantee', …)` is a documented Vitest
API with a static, citable title. An ADR citing it reports:

```
cited it() "it('a conditionally skipped guarantee')" has no matching test
```

`it.skip('…')` in the same file resolves. `it.runIf(…)` behaves identically to
`skipIf`.

## Reproduction

Measured against the real call model:

| source                         | `getName()`       | root              | reaches the grammar?                           |
| ------------------------------ | ----------------- | ----------------- | ---------------------------------------------- |
| `it.skip('…')`                 | `it.skip`         | `it`              | yes → resolves                                 |
| `it.skipIf(true)('…')` (outer) | `it.skipIf(true)` | `it.skipIf(true)` | no                                             |
| `it.skipIf(true)` (inner)      | `it.skipIf`       | `it`              | yes, but enriched to bare `it.skipIf` — no `(` |

## Root cause

Exactly 0105's shape, one level deeper. The callee of the outer call is itself a
**CallExpression**, so `fromCallExpression` takes its `else` branch and
`methodName` becomes the whole `it.skipIf(true)` text — never `it`. The inner
call does pass the root-callee guard, but its argument 0 is a boolean, so
`getName({ withArgument: 0 })` declines to enrich and returns bare `it.skipIf`,
which the anchored grammar rejects for want of a `(`.

Both fences reject it, so — as with 0105 — fixing it needs both.

## Why it matters

The cost is small (a downstream project cannot cite a conditionally-skipped
test) but the **record-keeping cost is not**. 0105's changeset explained the
remaining exclusions as "a templated title has no static text to cite". That is
true of `it.each(…)(…)` and false here: `skipIf` has static text and is still
out. Shipping a rationale that does not cover the residue is how the next
inbound report arrives as a duplicate. The changeset was corrected to name this
case before merge; this record is the other half of that correction.

## Fix

Recognise a call whose callee is a call whose own root is `it`:

```ts
// sketch — the outer call, whose callee is `it.<modifier>(…)`
const callee = call.getNode().getExpression()
// if callee is itself a CallExpression with root `it`, take argument 0 of the OUTER call
```

Doing this without reaching for ts-morph in the bridge package is the design
question, and it may want [0114](./0114-string-literal-lexis-lives-outside-the-engine.md)'s
accessor first — `ArchCall` currently offers no way to ask "what is the callee of
this call, structurally" beyond `getNode()`, which is the engine leak 0114 is
about.

Decide alongside: `it.each(…)(…)` has the same _structure_ and must stay
excluded for a different reason (no static title). So the rule cannot be "any
call-of-an-`it`-call"; it is "…whose argument 0 is a string literal", which is
0114's accessor again.

Sequence after 0114. Until then `0008-not-tests.md` pins the current behaviour,
so a fix cannot land silently.

## Verification

- [ ] Red test written first: an ADR citing `it('a conditionally skipped
guarantee')` resolves against `it.skipIf(cond)('…')`. Fails today.
- [ ] `it.runIf` likewise.
- [ ] `it.each(…)(…)` still does **not** resolve — the row moves out of
      `0008-not-tests.md` only for `skipIf`/`runIf`.
- [ ] `npm run validate` green.

Deferred: none.
