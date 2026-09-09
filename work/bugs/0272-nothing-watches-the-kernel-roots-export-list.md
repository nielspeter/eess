# Bug 0272: nothing watches the kernel root's export list

## Status

- **State:** Draft — measured during plan 0263 Phase 5, filed rather than
  absorbed because the fix is a new enforcement mechanism, not a repair.
- **Priority:** Medium
- **Found by:** the Phase 5 build, measuring whether ADR-014's
  `throwIfViolations` row could honestly go `gated`.

## Symptom

A symbol added to — or restored to — `packages/core/src/index.ts` is caught by
no gate and no test. The kernel root is ADR-011's public API, and its membership
is unwatched.

`packages/ts` does not have this problem. Its published surface is enumerated in
`packages/ts/tests/matrix/vacuity-classification.ts`, asserted **both
directions** by `packages/ts/tests/matrix/vacuity-matrix.test.ts`: an export in
neither list fails, and a classification row with no matching export fails too.

## Repro — measured 2026-09-09

Phase 5 removed `throwIfViolations` from three barrels. Re-adding it:

| sabotage                                                | result                                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| re-added to `packages/ts/src/index.ts` (and the kernel) | **caught** — the matrix reds with `.:throwIfViolations`                                  |
| re-added to `packages/core/src/index.ts` **only**       | **not caught** — 48 of 48 matrix tests pass, `check:surface` green, `check:family` green |

`check:surface` is the near miss and it is worth stating why it does not close
this. It binds every exported symbol to a documentation mention, so an
UNDOCUMENTED kernel addition does red it. `throwIfViolations` specifically slips
through because `docs/presets.md` names it legitimately, as a call the
`noVerdictOutsideRules` preset forbids. A gate that reads "is this name written
down in docs/" cannot tell a documented export from a documented prohibition.

`check:family` is silent for a different reason: `family/re-export-complete`
obliges a re-export only for kernel symbols a dialect's own source imports, and
no dialect imports this one.

## Why it was filed and not fixed

The fix is a checked-in census of the kernel root's ~101 exports, asserted
bidirectionally — the shape `packages/ts` already proves works. That mechanism
would red on every legitimate kernel root addition, by design, which is a real
change to how the kernel surface evolves and belongs in a decision record rather
than in a phase scoped to deleting an alias. ADR-011 is the natural home for the
clause.

## Consequence while open

ADR-014's `throwIfViolations` row is split rather than marked `gated` whole: the
`eess-ts` half is gated by the matrix, the kernel half is `pending` and points
here. A single `gated` row would have read as covering both.

## Verification ledger

- [ ] A decision recorded for whether the kernel root's membership is frozen
      (ADR-011 amendment, or an explicit "no").
- [ ] If yes: the census, asserted both directions, with a vacuity arm proving
      the scan reads the real root.
- [ ] ADR-014's split rows reconciled to whatever the decision says.
