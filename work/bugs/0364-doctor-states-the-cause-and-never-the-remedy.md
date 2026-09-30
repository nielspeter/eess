# Bug 0364: `doctor` prints the cause and never the remedy, so the tool reached for first says least

## Status

- **State:** Draft — found by enforcement review of bug 0362's second fix.
- **Severity:** Medium — **no wrong verdict, and no contradiction between the tools.**
  `doctor` does not say "remove the rule" either; it says nothing about what to do. The
  cost is that two rounds of work went into making one sentence correct, in the surface
  an adopter reads second.
- **Origin:** enforcement review of
  [0362](./fixed/0362-a-typod-ratchet-is-green-in-both-tools.md), whose own changeset
  says "`doctor` is what you would reach for first".
- **Reported:** 2026-09-29

## Symptom

`diagnose()` builds a dead-glob finding's `advice` from the **cause** tables only —
`ON_DISK_ADVICE` / `FAULT_ADVICE` (`packages/ts/src/core/diagnose.ts:614-623`). The
remedy sentence lives solely in `deadSelectorViolation`
(`packages/ts/src/core/vacuity-diagnosis.ts`), which is a `check`-side construction.

So for a broken ratchet:

| tool     | says why | says what to do |
| -------- | -------- | --------------- |
| `check`  | yes      | yes             |
| `doctor` | yes      | **no**          |

Bugs 0355, 0357 and 0362 spent three rounds establishing what that sentence must say for
each cause — including that it must never offer deletion, because on an unsuppressable
finding deletion is the only achievable exit. None of that reaches `doctor`.

## Root cause

Deliberate, and correct as far as it went. `deadSelectorViolation`'s docstring claims
parity between the tools for "cause and advice", and the parity that bug 0357 was about
— _do the two tools agree about whether a rule is broken_ — is real and is pinned by
`packages/ts/tests/core/doctor-and-check-agree-about-a-ratchet.test.ts`. The remedy was
never part of that contract, so nothing broke when it was improved on one side only.

It is the residual half of the class rather than a regression: the test file's own
docstring says "**the test is the agreement, not either tool's output**", and today
nothing can drift, because `doctor` carries no remedy at all to drift from.

## Fix

Not decided. The cheap shape is for `diagnose()` to read the same remedy construction
`check` does, which would mean lifting the remedy out of `deadSelectorViolation` into
something both call — the same "one owner" move bug 0363 proposes for the route, and
plausibly the same change. Worth deciding together rather than twice.

The thing to avoid is a second hand-maintained copy: `disk-set.ts` records what happened
the last time this pair grew two copies of one predicate — they disagreed about
`discovery`, `doctor` reported a dead layer glob, and the build stayed green.

## Related

- [0363](./0363-a-remedy-that-cannot-remediate-survives-one-input-over.md) — the other
  half of the same boundary, and probably the same fix.
- [0362](./fixed/0362-a-typod-ratchet-is-green-in-both-tools.md) — established what the
  remedy must say.
- [0357](./fixed/0357-doctor-reports-a-healthy-ratchet-as-a-dead-glob.md) — established
  the agreement the two tools do hold.

## Verification

- [ ] a red-first test asserting `doctor` carries a remedy for each admission route.
- [ ] the remedy owned once, not copied — the `isFaultPosition` precedent is the thing to
      not repeat.
- [ ] the existing agreement test still green, and extended to cover the remedy so the
      two surfaces cannot drift once both carry one.
