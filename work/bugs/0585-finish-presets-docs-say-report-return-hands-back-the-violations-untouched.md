# Bug 0585: `finishPreset`'s docs say `report: 'return'` hands back the violations untouched

## Status

- **State:** Draft — reproduced 2026-11-01 on `packages/core/dist` at `bd78b962`; no red test yet.
- **Severity:** Low — no false verdict: the code gates every door, and the docs are what is wrong.
  The wording inverts the truth, though: a reader concludes that `report: 'return'` skips the
  evidence gate, and the root-public docstring is what an IDE shows every adopter.
- **Origin:** self-found · [proposal 011](../proposals/011-core-name-the-evidence-gate.md)'s
  review, 2026-11-01 (all three lenses); reproduced before filing.
- **Reported:** 2026-11-01

## Symptom

`finishPreset`'s docstring (`packages/core/src/report.ts:282`) says "`return` hands the violations
back untouched". Since [plan 0235](../plans/completed/0235-the-emitter-takes-a-receipt.md) that is
false whenever the gate fires: the function runs the evidence gate before it reads the mode
(`packages/core/src/report.ts:305`) and returns the gated receipt under `return`
(`packages/core/src/report.ts:306`). The gated receipt is a new array that can carry an appended
`emitter/*` finding.

`docs/api-reference.md:74` says the same in the kernel section: "`finishPreset` and
`reportViolations` take a receipt and hand the same value back." The table right below it lists
the five findings the gate appends, so the page contradicts itself.

`docs/api-reference.md:626`, the presets table row, describes `return` without saying it gates.
That row is incomplete rather than false, and it should say so when the other two are fixed.

## Reproduction

A throwaway script against `packages/core/dist` (built 2026-11-01 08:56; the last commit touching
`packages/core/src` is 2026-10-30, so the build matches the source). It calls
`finishPreset(receipt, { report: 'return' })` and compares the result with its input. 0.04 s.

```text
healthy  finishPreset(return) | same array: true | in: 0 | out: 0 | -
zero     finishPreset(return) | same array: false | in: 0 | out: 1 | emitter/pass-without-evidence
expired  finishPreset(return) | same array: false | in: 0 | out: 1 | emitter/expired-declaration
bare []  finishPreset(return) | same array: false | in: 0 | out: 1 | emitter/no-receipt
```

Only a healthy receipt comes back untouched. A zero-examined receipt, an expired declaration and a
bare array each come back as a different value with a finding the caller did not pass in.

## Root cause

The docstring and the api-reference sentence predate
[plan 0235](../plans/completed/0235-the-emitter-takes-a-receipt.md), which put the gate in front of
every mode. The code changed and the text beside it did not.

## Fix

Docs only. Say that every mode runs the evidence gate first, and that `return` hands back the gated
receipt: the input as it was when it carries evidence, or the input plus the gate's finding when it
does not ([ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §1, §4). Fix
the docstring at `packages/core/src/report.ts:282`, the sentence at `docs/api-reference.md:74`, and
add the gate to the `return` description at `docs/api-reference.md:626`.

## Verification

- [ ] The `finishPreset` docstring says `return` hands back the gated receipt.
- [ ] `docs/api-reference.md:74` no longer says "the same value".
- [ ] `docs/api-reference.md:626` says `return` runs the gate.
- [ ] A changeset naming `@nielspeter/eess` (`patch`: the docstring ships in its `.d.ts`).
- [ ] `npm run validate` green.

Deferred: none
