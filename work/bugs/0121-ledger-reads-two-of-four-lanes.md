# Bug 0121: `check:ledger` reads two of four `work/` lanes — proposals carry `State:` and no lane opens them

## Status

- **State:** Ready — fix implemented, both parts verified against the real
  corpus and by a checked-in nonvacuity fixture; not yet merged, so not moved to
  `fixed/` (that move is `/close`'s job, in the same PR as the merge).
- **Severity:** Low — proposals remain a small lane, and because the lane has no
  terminal state to reach, nothing is currently mis-stated. It is the same shape
  of blindness as [0118](./fixed/0118-ledger-gate-skips-the-bug-lane.md), one
  lane over.
- **Origin:** self-found · enforcement review of 0119's fix
- **Reported:** 2026-08-12 · **Counts refreshed:** 2026-08-13

## Symptom

`scripts/check-ledger.mjs` declares two lanes, `work/plans/**` and
`work/bugs/**`. `work/` has four (counts as of 2026-08-13):

| lane                | `State:` records | scanned |
| ------------------- | ---------------- | ------- |
| `work/plans/**`     | 29               | yes     |
| `work/bugs/**`      | 47               | yes     |
| `work/proposals/**` | 4                | **no**  |
| `work/spikes/**`    | 0                | no      |

All four of `work/proposals/001`–`004` carry `**State:**` headers and are checked
by nothing. 0118's title was "`check:ledger` reads `work/plans/**` only"; the fix
made that "reads two of four", which is better and still not what the summary
line implies.

Spikes hold no markdown records at all (`work/spikes/0001-eess-over-ts-archunit/`
contains only `node_modules`), so proposals is the live gap.

**The lane has since grown and gained a board.** It was two records when this was
filed and is four now, all of them carrying a recorded ruling, plus
[`PROPOSALS.md`](../proposals/PROPOSALS.md). The board is not a substitute for the
gate — it is hand-maintained, exactly like the lane list this bug is about — but
it does settle part of the Fix's open question below.

## Root cause

The lane list is hand-maintained, and the gate reports what it _did_ scan without
reporting what it did **not** open. Same class as the gate-list drift bug
[0110](./fixed/0110-nonvacuity-gates-do-not-assert-which-rule-fired.md) fixed one
level up, where `GATE_FOR` gained a reverse check that every gate row is claimed
by some `check:*`.

## Why it matters

Small in itself. It matters because the reader of

```
plans      29 scanned · 29 with a readable State · 16 done (ledger-checked)
bugs       47 scanned · 47 with a readable State · 12 done (ledger-checked)
```

has no way to know that a third lane exists and is unread. The per-lane counts
make the gate look exhaustive precisely because they are itemised.

## Fix

Two parts, implemented 2026-08-13. The second is the one that generalises.

1. **Add a `proposals` lane** — `scripts/check-ledger.mjs`'s `LANES`, third
   entry. **Correction to this record's own original sketch:** the plan below
   assumed a two-value `State` enum (`Draft | Reviewed`, terminal on
   `Reviewed`), mirroring plans/bugs. Building it exposed that the premise was
   wrong on two counts, both found by checking the real corpus rather than
   trusting the sketch:
   - **No proposal ever writes `State: Reviewed`.** All four filed so far keep
     the literal header token `Draft` forever — reviewed or not, accepted or
     declined — with the outcome recorded as prose plus a separate `Ruling` in
     a `## Review` section, not a second `State` value.
     [`PROPOSALS.md`](../proposals/PROPOSALS.md)'s own Vocabulary section made
     this same false claim (a two-value `State` enum) and is corrected in the
     same commit as this fix — the board's "Reviewed" label is a derived,
     hand-maintained fact shown in a renamed **Status** column, not a second
     literal token.
   - **A proposal's checkboxes are not a deferral ledger.** Verified by running
     `honestyAtClose` against the real corpus with the hypothetical
     `terminalStates: ['Draft']`: **35** `ledger/silent-open-box` findings
     across **two** files — 29 in 001's Acceptance Criteria, 6 more in 002's —
     none of them carrying a "done-otherwise / deferred→ / dropped-on-purpose"
     disposition, because they're a design checklist, not a deferral ledger.
     Treating a reviewed proposal as ledger-closed would have produced exactly
     that false-positive storm on both files, not 001 alone.

   **What actually shipped:** `states: ['Draft']`, `terminalStates: []`,
   `doneFolders: []`, `closeInPlace: true`, `boardFiles: ['PROPOSALS.md',
'README.md']`. `terminalStates: []` makes `isDoneItem` always `false` for this
   lane — deliberately: nothing is "ledger-closed" the way a plan/bug is, so the
   box-disposition check never runs against proposals, and the `unknown-state`
   check (does the header carry a value this corpus declares) is the only part
   of `honestyAtClose` genuinely live for this lane. Verified: `closeInPlace`
   was in the LANES entry but silently dropped by `check-ledger.mjs`'s explicit
   `opts` object, which didn't list it — the same "documented but not wired"
   defect this repo spent this session finding elsewhere. Fixed alongside (now
   passed through for every lane).

2. **Assert the lane list against `work/`** — `scripts/lib/lane-coverage.mjs`,
   `findUncoveredLanes(workRoot, claimedTopSegments)`, called from
   `check-ledger.mjs`. Enumerates `work/`'s top-level directories; any one not
   named by a `LANES` root that carries `State:`-shaped records is reported as
   `ledger/uncovered-lane`, naming the directory and the record count. A
   records-free directory (`work/spikes/`, today) is not a finding — matching
   this record's own stated intent.

   Reuses `ledgerStats`'s label/region scanning (fenced-code stripping, the
   preamble+first-section boundary bug 0119 fixed) via an empty vocabulary
   (`states: []`), rather than re-deriving the scan — the exact re-derivation
   mistake `ledgerStats`'s own docstring warns this script against, made once
   already in this file's history.

   Factored into a separate module, not inlined, specifically so the new
   capability is provable by a permanent nonvacuity fixture rather than only
   eyeballed: `scripts/nonvacuity/bad-lane-coverage/` (four directories —
   `claimed/`, `unclaimed/`, `unclaimed-second/`, `empty-unclaimed/` — proving
   every direction, including that two independently-uncovered lanes are both
   reported, in one fixture) + `scripts/nonvacuity/bad-lane-coverage.mjs`,
   wired into `scripts/check-nonvacuity.mjs` as `corpus/ledger/uncovered-lane`.

   Also proven against the real corpus by hand: temporarily removing the
   `proposals` `LANES` entry after adding it reproduced exactly the symptom this
   bug describes — `check:ledger` silently dropped to two lanes — and the new
   reverse check caught it, naming `work/proposals` and its 4 records. Restored
   before committing.

## Review round — 2026-08-13

Reviewed by architect/enforcement/testing personas against the diff before
commit. All three ran adversarial verification, not just code reading — the
enforcement and testing reviewers independently reproduced claims by mutation
testing and A/B execution. Two findings were real and fixed here rather than
deferred:

- **`stateMatcher([])` in `packages/md/src/rules/ledger.ts` silently built an
  empty capture group** (`()`, a zero-width match firing at almost any
  position) instead of never matching. `isDoneItem`, which calls
  `findState(doc.text, terminalStates)` with `terminalStates` directly, stayed
  correct for the shipped `proposals` config only because `[].includes('')` is
  `false` by coincidence, not because `findState` reported "no known state" for
  the right reason — confirmed independently: `ledgerStats(c, {states: [],
terminalStates: []})` against the real `work/proposals/**` corpus reported
  `withReadableState: 4` (every proposal misclassified as readable-with-value-``)
  before the fix, `unreadableState: 4` (correct) after. Fixed with a one-line
  guard (`if (states.length === 0) return /(?!)/`) plus three new unit tests in
  `packages/md/tests/rules/ledger.test.ts`, one of which is a direct regression
  test for this exact miscount. Verified the new test fails without the guard
  and passes with it (reverted and restored the fix to confirm). This is a
  shared-package fix, not a script-local one — `terminalStates: []` is a
  legitimate config or the first to exercise it, but not the last.
- **The nonvacuity fixture could not detect a "report only the first uncovered
  lane" regression.** Demonstrated by mutation: adding `if (violations.length >

0. continue`after the push in`lane-coverage.mjs` left the then-single-directory
fixture's assertions unchanged. Fixed by adding a second independently-uncovered
directory (`unclaimed-second/`) and requiring both be named; re-ran the same
   mutation against the strengthened fixture and confirmed it now fails, naming
   the missed directory.

One proposed fix was attempted and reverted: making `findUncoveredLanes`
recognise a symlinked `work/` subdirectory (`entry.isSymbolicLink()` +
`statSync`) turned out not to close the gap it targeted — `corpus()`'s own
`walk()` (`packages/md/src/corpus.ts`) has the identical blindness one layer
deeper (a symlink `Dirent` is neither a directory nor a file to it, so it never
descends), so the fix would have shipped code that looked like it handled
symlinks without changing observable behaviour. Documented as an inherited,
out-of-scope limitation in `lane-coverage.mjs`'s docstring instead of claiming
a fix that isn't one.

Also corrected as part of the review: the box-count claim above was wrong (29,
not 31, plus 6 more in 002 the original claim omitted — re-verified by running
`honestyAtClose` with the hypothetical config directly), a stale `work/bugs/**`
count (46 → 47), and the `check:ledger` summary line now says explicitly when a
lane's "0 done" is structural (no terminal state, box-disposition check never
runs) rather than merely current — the enforcement reviewer's finding that an
unqualified "0" read identically to a lane that could still close on the next
commit.

Remaining minor findings not acted on, deliberately: `scripts/lib/` as a new
sibling to the existing `scripts/release-gate.mjs` extraction pattern (two
shapes for the same idea, unreconciled); `findUncoveredLanes` inheriting
`ledgerStats`'s default `boardFiles` rather than each candidate directory's own
(the safe-direction tradeoff is deliberate, now commented); `line: 1` on a
directory-scoped violation (no real line exists; the message names the
directory and count instead). None of these change observable behaviour today.

## Why proposals is not just a third instance of plans/bugs

Recorded so a future session doesn't quietly "simplify" this back to matching
the other two lanes: a proposal's closing discipline is genuinely different, not
under-specified. Plans/bugs close by moving to a done-folder or flipping a
terminal `State:` token; a proposal closes by being **ruled on**, and that
ruling is a fact this gate does not read at all (mechanizing "does `Ruling:
Ship as-is` on a proposal `LANES` entry imply it should now be Tier-4-checked
against whether a plan citing it still treats it as unbuilt" is
proposal [001](../proposals/001-md-corpus-rule-coverage.md)'s own `agree()`
rule-13 shape, not this bug's scope).

## Verification

- [x] Red test written first: adding a directory under `work/` with a `State:`
      record and no lane fails the gate. Proven twice — the permanent
      `scripts/nonvacuity/bad-lane-coverage.mjs` fixture, and by hand:
      temporarily removing the `proposals` `LANES` entry reproduced the original
      symptom and the new check caught it (see Fix, part 2).
- [x] Proposals are scanned, and the four live records report nothing:
      `proposals  4 scanned · 4 with a readable State · 0 done (no terminal
state — box-disposition check never runs on this lane)`.
- [x] The summary line names every lane, scanned or waived, so "not scanned" is
      visible rather than absent: new `lanes  3 declared · 4 work/ directories ·
0 uncovered` line.
- [x] `packages/md/src/rules/ledger.ts`'s `stateMatcher([])` fix has its own red
      test: `packages/md/tests/rules/ledger.test.ts`'s "ledgerStats reports a
      State:-shaped line as unreadable, not readable, when states is empty" —
      confirmed to fail without the guard, pass with it.
- [x] `scripts/nonvacuity/bad-lane-coverage.mjs`'s multiplicity assertion has
      its own proof: confirmed to fail (exit 0) against the
      "cap-at-first-hit" mutation, pass (exit 1) against the real code.
- [x] `npm run validate` green.

Deferred: none.
