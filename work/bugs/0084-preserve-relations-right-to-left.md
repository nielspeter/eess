# Bug 0084: `preserveRelations` silently checks nothing in one direction

## Status

- **State:** Draft — root cause located and read directly from the source; no
  red test written yet.
- **Reported:** 2026-08-08 — self-found during the architect review of
  [proposal 001](../proposals/001-md-corpus-rule-coverage.md), which proposes
  `correspondence().agree()` as a sibling of `preserveRelations` and would have
  copied its `direction` shape.

## Symptom

`correspondence(...).should().preserveRelations({ left, right, direction: 'right-to-left' })`
returns **zero violations always**, whatever the two sides contain. The rule is
green because it inspects nothing, not because the relations are preserved.

`direction: 'both'` — which is also the **default** when `direction` is omitted
(`packages/core/src/correspondence.ts:197`) — checks only the left→right half.

This is the exact failure class `scripts/check-nonvacuity.mjs` exists to catch,
living in the kernel, in a shipped public API.

## Reproduction

No test in the suite covers a right→left relation. A red test would build a
correspondence whose **right** side declares a relation absent from its left
counterpart, assert one violation under `direction: 'right-to-left'`, and get
`[]`.

## Why ADR-010's guard does not catch it

Added 2026-09-04, from architecture review of bug 0242's fix. Worth stating
because the natural assumption is that the evidence requirement already covers
this, and it does not.

`CorrespondenceBuilder` computes its evidence as the two sides' element counts:

```ts
const examined = this.opts.left.elements.length + this.opts.right.elements.length
```

That number is a property of the SELECTIONS, not of the checks. So a
`preserveRelations({ direction: 'right-to-left' })` over two populated sides
reports `{ violations: [], examined: <non-zero> }` — a pass constructed from a
real denominator, which is exactly the shape ADR-010 accepts. The vacuity floor
sees a healthy check.

This is the distinction ADR-010 draws and this case sits on the wrong side of:
`examined` proves that elements were SELECTED, not that any predicate ran over
them. A check that inspects nothing while its selections are full is invisible to
it. Anyone extending the evidence requirement to correspondence should read this
record first.

## Root cause

`packages/core/src/correspondence.ts` has two check implementations that both
take a `Direction`, and only one of them honours it.

`completeness()` is correct — it guards each half separately:

- `packages/core/src/correspondence.ts:152` — `if (direction !== 'right-to-left')`, the left→right block
- `packages/core/src/correspondence.ts:175` — `if (direction !== 'left-to-right')`, the right→left block

`relations()` has only the first:

- `packages/core/src/correspondence.ts:197` — `const direction = spec.direction ?? 'both'`
- `packages/core/src/correspondence.ts:208` — `if (direction !== 'right-to-left')`, the left→right block

…and then returns. There is no right→left block, so the `direction` field on
`RelationSpec` (`packages/core/src/correspondence.ts:28`) is accepted, typed,
and partially ignored.

The asymmetry within one file is what makes this a bug rather than a design
choice: `beComplete` and `preserveRelations` present the same `Direction`
vocabulary to the caller, and only one honours it.

## Fix

Add the missing right→left block to `relations()`, mirroring `completeness()`:
group left counterparts by right element, then for each right element assert its
declared relations appear among its counterparts' relations.

Two things to settle while in there, both currently one-sided:

- **Violation attribution.** `relations()` emits only `o.left.identify(l)`
  (`packages/core/src/correspondence.ts:214`) — one file, one line. A right→left
  violation must identify the **right** side, and the two-sided message
  (both labels, both lines) is what proposal 001's `agree()` needs.
- **Non-vacuity.** Whatever lands must be represented in
  `scripts/check-nonvacuity.mjs`, or the next emptying goes unnoticed the same
  way.

## Verification

- [ ] Red test written first: a right→left relation violation that returns `[]`
      before the fix.
- [ ] Second red test: `direction: 'both'` (and omitted) catches a violation
      that only exists in the right→left half.
- [ ] Fix turns both green; `completeness()` behaviour unchanged.
- [ ] Right→left violations identify the **right** side's file and line.
- [ ] Represented in `scripts/check-nonvacuity.mjs`.
- [ ] Suite + `npm run validate` green.

Deferred: none
