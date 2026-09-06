# Bug 0243: `no-unused-exports` counts a barrel re-export as a use, so a symbol nothing calls reads as live

## Status

- **State:** Draft — measured against the shipped source; no red test yet.
- **Severity:** Medium — not a false green about the code under test. It is a
  gate that reports coverage of a property it does not check, which is the same
  class as an unreachable finding: the rule says "internal exports must be used"
  and passes symbols nothing uses. Three bug records were filed one at a time for
  instances of it before anyone asked why the rule missed them.
- **Origin:** self-found · investigating whether
  [0241](./fixed/0241-archconfigerror-has-no-reader.md)'s closing question was a
  policy decision or a measurable gap. It was the second.
- **Reported:** 2026-09-04

## Symptom

`eess/no-unused-exports` (`arch.internal.rules.ts:134`) asserts that a module
under `packages/*/src` exports nothing unreferenced, excluding the entry points,
_"because entry-point exports exist for consumers; internal ones must be used"_.

It misses a symbol whose **only** reference is a barrel re-export.
`presetConstructsNothingViolation` was defined in
`packages/core/src/preset-dispatch.ts` and referenced by exactly one other
file — `packages/core/src/internal.ts`, which re-exported it. (Both were deleted
2026-09-06 under plan 0235 Phase 0; the measurement below is as of filing.) The rule sees a
reference and passes. Nothing calls it.

That is bug [0190](./fixed/0190-the-preset-constructs-nothing-finding-cannot-fire.md)'s
whole subject, and the shape of [0178](./0178-the-kernels-dead-glob-finding-cannot-fire.md)
and of 0241. Three records for three instances of one uncovered predicate.

## Measured, 2026-09-04

`packages/core/src/internal.ts` exports **89** symbols. Classifying each by
whether anything references it outside its own defining module and the barrel:

| bucket                                                  | count |
| ------------------------------------------------------- | ----- |
| referenced by a sibling dialect — the surface's purpose | 70    |
| referenced elsewhere inside `packages/core` only        | 8     |
| referenced only by tests or scripts                     | 7     |
| **referenced by nothing at all**                        | **4** |

The four with no caller anywhere: `ApplyResult`, `Describable`,
`SharedCliConfig`, `isSilent`.

The middle two buckets are the interesting ones and are **not** defects:

- **8 used only inside core.** Live code; what is questionable is the
  `/internal` export, not the symbol. ADR-011 clause 2 says `/internal` is
  family plumbing for the dialects, so exporting something no dialect imports
  puts a symbol on a published surface for nobody.
- **7 referenced only by tests.** Legitimate and deliberate — `presetConstructsNothingViolation`
  is here, exercised by `packages/core/tests/preset-dispatch.test.ts`, which is
  exactly why 0190 could say the constructor exists while nothing produces it in
  a real run. A rule must not red these, and that is the hard half.

## Why the entry-point exclusion is right, and why it does not settle this

The rule excludes entry points because "referenced by another file in this
package" is the wrong question for a published surface. That reasoning holds for
the public root `index.ts`: strangers call it, so no in-repo reference proves
nothing.

It does **not** hold identically for `/internal`. ADR-011 clause 2 makes the
sibling dialects its consumers, and all five are in this repo. An adopter _can_
reach it — the ADR-011 changeset tells them how, calling it "the honest cost of
reaching plumbing" — so this is the boundary's own definition of dead rather
than proof of no caller on earth. Removing one is a break the changeset names,
which is the process that already exists.

## The clause to decide

> A symbol on `@nielspeter/eess/internal` that no sibling dialect imports is not
> family plumbing. Either something uses it, or it does not belong on that
> surface.

Tier 1 — statically decidable from the import graph, which `eess-ts` already
walks for this very rule.

## Break class

A fix must fail when:

1. A symbol is exported from `internal.ts` and imported by no dialect —
   `ApplyResult` today.
2. And it must **not** fire for: a symbol a dialect imports (70 of the 89); one
   whose only consumer is a test, which is a deliberate seam (7); or anything on
   the public root, where the question is undecidable.

(2) is the whole difficulty. A rule that reds the test-only seven would be
telling this repo to delete the accessor that lets `preset-dispatch.test.ts`
exercise a finding constructor — the opposite of what 0190 wants.

## Fix

Narrow the predicate rather than widen the rule: **a re-export is not a use.**
Scoped to `/internal`, a symbol needs at least one reference that is not an
`export … from` line, in a dialect. Tests count as a use, and saying so
explicitly is better than leaving it to the graph.

Cheapest honest first step, if the full rule proves fiddly: assert the count.
Four is the current number of no-caller-anywhere symbols, and a ratchet that may
only shrink turns an unbounded question into a bounded one — the same device
`KNOWN_FAIL_OPEN` uses in the vacuity matrix.

## Verification

- [ ] Red test: a symbol exported from `internal.ts` with no dialect import reds
      the rule, asserted by rule id.
- [ ] Green in both exempt directions: a dialect-imported symbol and a
      test-only symbol each stay silent, asserted separately — a rule that
      reddened the second would break the seam 0190 depends on.
- [ ] The public root is untouched: `index.ts` exports are still out of scope.
- [ ] The four current instances are named by the run, or the ratchet records
      them as declared debt rather than silence.

## Related

- [0190](./fixed/0190-the-preset-constructs-nothing-finding-cannot-fire.md),
  [0178](./0178-the-kernels-dead-glob-finding-cannot-fire.md),
  [0241](./fixed/0241-archconfigerror-has-no-reader.md) — the three instances.
  This record is the predicate they share.
- [0220](./0220-nothing-requires-a-public-symbol-to-be-documented.md) — the
  public root's half of the same territory, where the instrument is
  export-to-doc rather than export-to-use.
