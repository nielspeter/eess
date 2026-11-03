# Bug 0607: `mergeCollectResults` says a bare member leaves no evidence

## Status

- **State:** Draft — measured 2026-11-03 on `main` at 1a2c1817 against `packages/core/dist`; no red
  test yet.
- **Severity:** Low — a wrong docstring, not wrong behaviour. The merge fails closed. But the doc
  ships in the `.d.ts`, and it led an adopter to read a correct result as a defect.
- **Origin:** inbound · a consuming project, 2026-11-03.
- **Reported:** 2026-11-03

## Symptom

The docstring says a member with no evidence "poisons the merge … so the result carries no evidence
either and the emitter says so" (`packages/core/src/collect-result.ts:128-130`). Measured,
`mergeCollectResults([collectResult([], { examined: 5 }), []])`:

- returns a receipt: `hasEvidence` is `true` and `examined` is `0`;
- already carries `emitter/no-receipt`: the merge reports it, not the emitter;
- through `reportViolations` it prints that finding and throws `ArchRuleError`.

The adopter read `hasEvidence: true` as the merge accepting the bare member.

## Root cause

The code comment at `packages/core/src/collect-result.ts:135-139` records the change: the merge
reports the bare member itself rather than returning an evidence-free value for the emitter to catch.
The docstring above the function was not updated.

## Fix

Reword the bullet to what the merge does: a member with no evidence is reported as
`emitter/no-receipt` on a receipt with `examined: 0`, so the healthy members' counts cannot carry it.

## Verification

- [ ] The docstring states the measured behaviour.
- [ ] A test pins it, if none does: a bare member yields `emitter/no-receipt` and `examined: 0`.
- [ ] A changeset naming `@nielspeter/eess` (`.d.ts` text changes).
- [ ] `npm run validate` green.

Deferred: none
