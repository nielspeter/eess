# Bug 0661: `check-ledger.mjs` exits on a second list

## Status

- **State:** Draft — found 2026-11-27 while fixing
  [bug 0548](./fixed/0548-check-corpus-exits-on-a-second-list.md); no red test yet.
- **Severity:** Medium — no rule is known to escape today; every receipt member is also in the
  terminal path's list. A check added to the receipt and not to the list exits 1 under
  `--format json` and 0 on the command CI runs.
- **Origin:** self-found · the same defect as [bug 0548](./fixed/0548-check-corpus-exits-on-a-second-list.md), on the ledger gate, 2026-11-27.
- **Reported:** 2026-11-27

## Symptom

`scripts/check-ledger.mjs` decides its exit twice. With `--format json` it exits on the verdict of
the receipt it builds (`scripts/check-ledger.mjs:139`, exit at `:178`). Without it, the command CI
runs, it exits on `violations` (`:151`), a hand-kept list of the same findings, and the emitter's
(`:281`). The two lists are kept equal by hand, as `check-corpus.mjs`'s were before [bug 0548](./fixed/0548-check-corpus-exits-on-a-second-list.md).

## Fix

[Bug 0548](./fixed/0548-check-corpus-exits-on-a-second-list.md)'s: one verdict read by both exits, the terminal list derived from it, and the ledger rows
in `scripts/check-nonvacuity.mjs` that run the terminal path only for its exit code run once, with
one row proving the terminal exit statement.

## Verification

- [ ] Red first: a receipt member left out of `violations` exits 0 on the terminal path.
- [ ] Both exits read one verdict.
- [ ] The ledger rows' second run removed where it asserts only the exit, with one terminal row.
