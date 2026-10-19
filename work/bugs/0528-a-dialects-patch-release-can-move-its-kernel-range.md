# Bug 0528: a dialect's patch release can move its kernel range

## Status

- **State:** Draft — recorded 2026-10-19 from PR #253's devops review (items 3 and 4); measured by the
  reviewer, not yet reproduced here.
- **Severity:** Low — no fail-open was observed in the mixed tree, but nothing stops one appearing.
- **Origin:** self-found · PR #253's devops review
- **Reported:** 2026-10-19

## Symptom

eess-mermaid 0.8.1 is a patch release, and it moves its kernel dependency from `^0.7.1` to `^0.8.0`.
The kernel carries no marked break in this release, so by the documented rule the dialects take
whatever bump their own changesets give, and eess-mermaid's is a patch. An adopter with
`eess-mermaid ^0.8.0` beside `eess-ts ^0.13.1` and `eess-crossvalidate ^0.9.0`, installing without a
lockfile, receives eess-mermaid 0.8.1 without asking. That brings kernel 0.8.0 beside the 0.7.1 the
other dialects use: two kernels in one tree.

The reviewer measured that tree: published eess-ts 0.13.1, eess-md 0.11.0, eess-gherkin 0.6.0 and
eess-crossvalidate 0.9.0, with the local kernel 0.8.0 and eess-mermaid 0.8.1 tarballs.
`diagramMatchesCode` behaved as in the aligned 0.15 tree: agreement passed, drift threw 2
violations, and an empty diagram threw 2 violations. **No fail-open was observed.** The split is
still real: the kernel keeps per-copy registries, `CARDINALITY_ASSERTERS`
(`packages/core/src/cardinality.ts:40`) and `OWNERS` (`packages/core/src/owns-empty-discovery.ts:67`),
both `WeakSet`s, so a condition registered with one kernel copy is unknown to the other.

**In the same review (item 4), accepted:** kernel-not-exist freezes a condition marked as asserting
cardinality (`Object.freeze` in `packages/core/src/cardinality.ts:76`). Assigning to one now throws a
`TypeError` in ESM strict mode, where it used to succeed silently. The changeset carries no break
marker, on the ground that assigning was never supported, and ships it to eess-mermaid and eess-ts as
patch text. Recorded here so the decision is written down; no action is owed for it.

## Root cause

Nothing ties a dialect's bump to a change of its kernel range. A range change that leaves `0.x`'s
caret (`^0.7.1` to `^0.8.0`) admits a new kernel copy, and a patch is resolved without the adopter
asking.

## Fix

Undecided. Options to weigh: a dialect whose kernel range leaves its previous caret takes at least a
minor (a `check:release` rule), or the kernel's registries are shared across copies. Decide before
the next release that moves the kernel without a marked break.

## Verification

- [ ] Red test written first: a dialect whose kernel range moves past its caret on a patch bump is
      reported, or the decided alternative's test.
- [ ] `npm run validate` green.

Deferred: none
