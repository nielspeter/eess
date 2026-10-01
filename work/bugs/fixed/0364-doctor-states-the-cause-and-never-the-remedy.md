# Bug 0364: `doctor` prints the cause and never the remedy, so the tool reached for first says least

## Status

- **State:** Fixed — `doctor` carries the remedy from the same table `check` uses, so the two
  cannot drift. Fixed together with
  [0363](./0363-a-remedy-that-cannot-remediate-survives-one-input-over.md): same seam,
  and fixing one alone would have grown the second hand-maintained copy both records warned
  about.
- **Severity:** Medium — **no wrong verdict, and no contradiction between the tools.**
  `doctor` does not say "remove the rule" either; it says nothing about what to do. The
  cost is that two rounds of work went into making one sentence correct, in the surface
  an adopter reads second.
- **Origin:** enforcement review of
  [0362](./0362-a-typod-ratchet-is-green-in-both-tools.md), whose own changeset
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

**As proposed, and it was the same change as 0363.** The remedy is lifted out of
`deadSelectorViolation` into `CARDINALITY_REMEDY` in `glob-diagnosis.ts`, keyed on the route
that one owner now derives. `doctor` appends it to its own advice; `check` puts it in
`suggestion`. Neither constructs it.

Only for a **cardinality** rule, deliberately: `CARDINALITY_REMEDY` is that shape's remedy,
and offering "do not delete this rule, it is what detected the gap" for a positive-assertion
rule's dead glob would be false — that one is answered by "correct the glob, or remove the
rule".

The second copy both records warned about was avoided by construction rather than by
discipline: there is one table, and a test asserts the two tools give the same remedy on each
route, so a copy would have to disagree to exist.

## Related

- [0363](./0363-a-remedy-that-cannot-remediate-survives-one-input-over.md) — the other
  half of the same boundary, and probably the same fix.
- [0362](./0362-a-typod-ratchet-is-green-in-both-tools.md) — established what the
  remedy must say.
- [0357](./0357-doctor-reports-a-healthy-ratchet-as-a-dead-glob.md) — established
  the agreement the two tools do hold.

## Verification

- [x] a red-first test — `one-owner-for-the-route-and-the-remedy.test.ts` ·
      `it('doctor carries the remedy, not only the cause')`, measured red
      (`expected 'this path exists and contains TypeScript…' to contain 'Widen the tsconfig
include'`).
- [x] the remedy owned once, not copied — one `Readonly<Record<DeadSiteRoute, string>>`,
      consulted by both tools.
- [x] the agreement extended to the remedy — `it('doctor and check give the SAME remedy on
each route')` asserts the agreement rather than either tool's wording, so a drift in
      either direction reds.
- [x] a sabotage matrix row that stops `doctor` carrying the remedy: **red**.
- [x] `npm run validate` green.

Deferred: none.
