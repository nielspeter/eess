# Bug 0119: the state↔folder placement check has never examined a single real document — it looks for `State:` one heading above where every record puts it

## Status

- **State:** Fixed — the header region is the preamble **and the first section**;
  the check now reads all 55 records that carry a `State:` line, and found six
  real drifts on its first run.
- **Severity:** High — **false green.** `check:ledger` printed
  `✓ honesty at close … 0 findings` on every run of its existence while one of
  its three checks had examined nothing. It was green because it was blind.
- **Origin:** self-found · fixing [0118](./0118-ledger-gate-skips-the-bug-lane.md),
  when the four unreadable-state plans it predicted would light up did not
- **Reported:** 2026-08-12 · **Fixed:** 2026-08-12 (PR #45)

## Symptom

`honestyAtClose` located the `State:` token by scanning from the top of the
document and stopping at the first `##` heading:

```ts
for (let i = 0; i < lines.length; i++) {
  if (/^##\s/.test(lines[i] ?? '')) break // header region only
  …
}
```

The house template — for plans and bugs alike — is:

```markdown
# Plan 0060: …

## Status

- **State:** Done
```

The `State:` line is **one heading past** where the scan stops. So `stateLine`
stayed `0`, `placementViolation` returned `null`, and the check reported nothing.

Measured across every record in `work/`:

| where the `State:` line sits           | records |
| -------------------------------------- | ------- |
| before the first `##` (gate could see) | **0**   |
| after the first `##` (invisible)       | 55      |
| no `State:` line at all                | 3       |

Zero. Not "most" — none. The placement half only ever fired against the test
fixtures in `packages/md/tests/fixtures/ledger/`, which put `State:` in the
preamble and therefore encoded the one document shape the corpus does not use.

## Root cause

`headerRegion()` splits on the first `##` and was written for a frontmatter-ish
preamble. The corpus uses a `## Status` section instead. Nothing connected the
two, because the fixtures agreed with the code rather than with the corpus.

This is the deeper half of [0118](./0118-ledger-gate-skips-the-bug-lane.md).
0118's diagnosis — an unreadable state token silently disables the check — was
correct and, it turns out, unreachable: the token was never read in the first
place. Both were the same silence with two causes.

## Why it matters

The gate is in `npm run validate` and CI, and its summary line reads
`✓ honesty at close — 16 done-items across 29 plans, 0 findings`. The
done-item **count** was honest (it comes from the folder test, which worked), so
the line looked substantiated. One of the three checks behind it had never run.

That is this project's cardinal sin, committed by the gate the project ships as
its portable working-method check — `kit/` hands `honestyAtClose` to adopters as
_the_ honesty-at-close mechanism, so every adopter using the same `## Status`
template inherited a permanently-silent placement check.

The non-vacuity harness did not catch it because `check:ledger` is one of the
`no-gate-yet` waivers in `scripts/check-nonvacuity.mjs` — the exact class that
waiver exists to admit, now retired.

## Fix

Scan the preamble **and the first section** — stop at the _second_ `##`. That
covers both shapes: `State:` in a preamble (the fixtures) and `State:` under
`## Status` (the corpus).

Landed together with 0118's vocabulary work, because either alone is inert: a
readable region with a closed vocabulary silently skips unknown tokens, and a
reportable vocabulary in an unreachable region never sees one.

**Six real drifts surfaced on the first run**, every one a genuine record
inconsistency that had been invisible:

| record                 | was           | now     |
| ---------------------- | ------------- | ------- |
| `plans/completed/0051` | `BUILDABLE`   | `Done`  |
| `plans/completed/0058` | `IMPLEMENTED` | `Done`  |
| `plans/completed/0059` | `IMPLEMENTED` | `Done`  |
| `plans/completed/0060` | `IMPLEMENTED` | `Done`  |
| `bugs/fixed/0074`      | `Done`        | `Fixed` |
| `bugs/fixed/0083`      | `Done`        | `Fixed` |

The last two are the bug lane's two oldest records, written before the bug State
vocabulary existed, using the plan lane's tokens.

## Verification

- [x] Red test written first: a document whose `State:` sits under `## Status` is
      read. The existing fixtures all put it in the preamble — i.e. they encoded
      the bug — so a fixture in the corpus's real shape was added.
- [x] Both placement directions fire against the **real** corpus, not just
      fixtures: flipping an open bug to `State: Fixed` reports
      `ledger/state-folder-mismatch` (orphaned close), and flipping a record in
      `fixed/` back to `Draft` reports the stranded-in-done-folder direction.
- [x] The six drifts are corrected in this PR rather than accommodated by
      widening the vocabulary.
- [x] `check:ledger` is represented in `scripts/check-nonvacuity.mjs`, retiring
      its `no-gate-yet` waiver — by **three** rows, one per rule the preset can
      raise, with a fixture that exits 0 unless all three fire.

      The first draft of this claim was one-third true and review measured it:
      the fixture asserted only `ledger/silent-open-box`, and both its documents
      sat in `/completed/`, so they were classified done by *folder* and
      `findState` was never called. Reverting 0119 exactly, reverting 0118
      exactly, nulling `findState`, discarding the placement finding, or making
      `state-folder-mismatch` unreachable **all** left the fixture exiting 1 and
      the harness reporting the gate proven — 2 of 7 mutations caught. Retiring
      0110's waiver on a gate that could not see the code path it guards was
      0110's own finding, one level up. Now 7 of 7:

      | mutation | before | after |
      | --- | --- | --- |
      | empty all violations | caught | caught |
      | delete the `silent-open-box` branch | caught | caught |
      | revert 0119 (the region) | **OK** | caught |
      | `findState` always null | **OK** | caught |
      | revert 0118 (`unknown-state`) | **OK** | caught |
      | discard the placement finding | **OK** | caught |
      | `state-folder-mismatch` unreachable | **OK** | caught |

- [x] The denominator is computed by the preset (`ledgerStats`), not re-derived.
      The first draft re-derived it in `check-ledger.mjs` with a copy of the very
      expression this bug removed, and that copy disagreed with the preset on
      **56 of 56** records — under a header reading "reports the denominator so a
      green is provably non-vacuous". `withReadableState` is now printed on every
      run (`29 scanned · 26 with a readable State · 16 done`), so the number that
      was invisibly `0/55` cannot be invisible again.
- [x] `npm run validate` green.

Deferred: none.
