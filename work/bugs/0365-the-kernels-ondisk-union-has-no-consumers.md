# Bug 0365: the kernel declares `OnDisk`, the dialect redeclares it, and adding a member to the kernel's propagates to nothing

## Status

- **State:** Draft — found by architecture review of bug 0362's second fix.
- **Severity:** Low — **nothing is wrong today; a guarantee that reads as stronger than
  it is.** The two declarations agree, so no behaviour depends on the duplication. What
  it costs is the compile-time safety a reader would reasonably assume they have.
- **Origin:** architecture review of
  [0362](./fixed/0362-a-typod-ratchet-is-green-in-both-tools.md). Pre-existing; surfaced
  because that fix made exhaustiveness over this union load-bearing.
- **Reported:** 2026-09-29

## Symptom

`OnDisk` is declared twice:

- `packages/core/src/disk-set.ts:20`, with a docstring explaining the kernel/dialect
  split — the shape in the kernel, the materializer in the dialect, which is correct
  under [ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md).
- `packages/ts/src/core/disk-set.ts:91`, as an identical four-member union.

Nothing outside `packages/core/src/internal.ts:18` imports the kernel's. Every consumer
— `contradictsAbsence`, `ON_DISK_ADVICE`, `diagnoseGlob`, and the exhaustive pinning test
— reads the dialect's copy. So a fifth member added to the kernel's declaration changes
nothing anywhere, and the kernel's docstring describes a contract no code is held to.

## Root cause

A structural-typing coincidence doing the work of an import. The same shape is recorded
one file over about `PathUniverse`, where the dialect's comment says the kernel's type
"compiled only because the two are structurally identical today, which is a coincidence
to stop relying on rather than a contract"
(`packages/ts/src/core/vacuity-diagnosis.ts:4-9`). This is that case, un-annotated.

## Why it matters now

Bug 0362's second fix leans on exhaustiveness over this union in three places —
`contradictsAbsence`, `ON_DISK_ADVICE` and the new `isSyntacticFault`'s sibling reasoning
— each written so that a fifth member stops the build rather than falling into a default
that guesses. That protection is real, and it is one layer deep: it fires when the
**dialect's** union grows. A contributor adding walk-exhaustion to the kernel's union
(the live candidate —
[0359](./fixed/0359-a-disk-walk-that-gave-up-reports-nothing-and-now-decides-a-verdict.md))
would get no signal at all.

## Fix

Not decided, and the choice is a product one rather than a mechanical one: either the
dialect imports the kernel's type and the duplication goes, or the kernel's declaration
is removed as unused and the type is owned by the dialect that materialises it. ADR-013's
reasoning points at the first; the fact that nothing imports it points at the second.
Deciding needs the ADR-011/ADR-013 boundary read together, so it is a decision, not a
patch.

## Related

- [ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md) — the boundary
  this sits on.
- [ADR-011](../../adr/011-the-kernels-public-api-is-explicit.md) — what the kernel root
  is for.
- [0359](./fixed/0359-a-disk-walk-that-gave-up-reports-nothing-and-now-decides-a-verdict.md) —
  the change most likely to add the fifth member.

## Verification

- [ ] the direction decided and recorded against ADR-011/ADR-013.
- [ ] one declaration, with the other's consumers migrated.
- [ ] a test that a fifth member breaks the build at every exhaustive site — measured by
      adding one, not asserted.
