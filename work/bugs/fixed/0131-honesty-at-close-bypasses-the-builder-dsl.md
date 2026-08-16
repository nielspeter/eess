# Bug 0131: `honestyAtClose` builds no rule — a shipped preset that hand-iterates the corpus, invisible to every kernel mechanism present and future

## Status

- **State:** Fixed — 2026-08-16. Surveyed and spiked before touching the real
  file (per explicit direction: investigate/prove, no handwaving). Fix (1) —
  express through the builder DSL — chosen after a synthetic-fixture spike
  proved it byte-identical to the old hand-rolled output. Two separate
  six-persona `/review` rounds ran against the staged diff before commit, each
  finding real Critical issues the other round hadn't, all fixed before merge:
  - **Round 1:** a false-positive on a fresh board-only corpus, and a
    `.expectEmpty()` design that was self-referential (peeked the exact
    selection it gated, so it could never expire). Fixed with the
    `expectEmptyHeaders` option and independently-computed peeks — see Fix.
  - **Round 2** (re-reviewing round 1's fix): (a) the round-1 fix for
    `deferredLieViolations` had zero durable committed coverage — the
    non-vacuity fixture had no `deferred→<home>` box anywhere, so its only
    "protection" was this repo's own live corpus incidentally carrying one;
    (b) sabotaging the shared `isDoneItem` function — which every peek and
    every real selection in this preset ultimately trusts — produced **zero
    violations, exit 0** on the real corpus: a full, silent, whole-preset
    bypass, not a narrow gap, and the docstring's claim that `headerViolations`
    would backstop it was independently found false by two reviewers
    (`headerStateCondition` never calls `isDoneItem`). Both fixed — see Fix.
    Real implementation regression-tested against the existing 36-test
    `ledger.test.ts` suite (40 after round 1's additions), the full `packages/md`
    suite, and the real repo corpus (byte-identical: 35 plans/24 done, 55
    bugs/21 done — one more than the record's original count because this
    record's own move to `fixed/` landed mid-diff — 5 proposals/0 done, 0
    findings, before and after).
  - **Round 3** (re-reviewing round 2's fix, filed as bugs
    [0151](../0151-honesty-at-close-options-undiscoverable-past-source.md)/
    [0152](../0152-no-guardrail-against-hand-rolled-presets-recurring.md)
    for the non-Critical findings): the round-2 `doneVacuous` fix in
    `scripts/check-ledger.mjs` summed done-items **across all lanes** before
    comparing to zero — so a corruption scoped to just one lane (e.g. only
    `bugs/`) stayed completely invisible as long as another lane (`plans/`)
    still had a nonzero sum. Confirmed empirically: sabotaging `isDoneItem` to
    return `false` only for `bugs/`-lane documents left `check-ledger.mjs`
    exiting **0**, "45 done-items" (all from `plans/`), with `bugs/`'s 21 real
    done-items — and any silent-open-box/deferred-none-lie violations they
    carried — silently excluded. Also found: `doneVacuous` had zero committed
    non-vacuity coverage (same class of gap round 2 just closed for
    `hasDeferredDisposedBox`, recurring one layer up), and `--format json`/
    `--format github` emitted **completely empty output** on a `doneVacuous`
    failure (a bare boolean, never converted to an `ArchViolation`, so
    `reportViolations([])`'s "emit nothing on empty" correctly-but-silently
    applied). All three fixed — see Fix.
    Closed as
    [plan 0101](../../plans/completed/0101-sibling-gates-go-fail-closed.md) Phase 1's own
    scope, per that plan's freeze.
- **Severity:** Medium — nothing was wrong in its output before this fix;
  `check:ledger` found real violations and had caught them
  ([0118](./0118-ledger-gate-skips-the-bug-lane.md),
  [0119](./0119-placement-check-never-ran.md)). It was an ADR-003 divergence in
  a **published** preset, and its cost was that every kernel-level guarantee —
  present and future — routed around it silently.
- **Origin:** self-found · architect persona, six-persona review of
  [0127](./0127-nonvacuity-proves-a-condition-not-a-wired-rule.md) and
  [0128](../0128-enforcement-status-is-the-cell-nothing-derives.md)
- **Reported:** 2026-08-12

## Symptom

`packages/md/src/rules/ledger.ts` imported one thing from the kernel — the
reporting seam — and no builder at all:

```ts
import { finishPreset, type PresetReportOptions } from '@nielspeter/eess'
import { collectTaskItems } from '../model/task-items.js'
```

It iterated the corpus directly and hand-assembled `ArchViolation[]`. The md
dialect ships six builders — `docs`, `links`, `pointers`, `rows`, `taskItems`,
`vocabulary` — and this preset used none of them. Measured: instrumenting
`RuleBuilder.evaluate()` and `CorrespondenceBuilder.collectViolations()` and
running all eight rule-running gates, `check:ledger` contributed **0 of 44**
records.

## Reproduction

```bash
rg -c 'docs\(|links\(|rows\(|taskItems\(|pointers\(|vocabulary\(' packages/md/src/rules/ledger.ts   # was 0
rg -n '^import' packages/md/src/rules/ledger.ts                                                     # no builder
```

## Root cause

The honesty-at-close analysis is stateful across a document (find the `State:`
token, then the region, then the boxes within it) — a real constraint, but not
one that required raw iteration. The decision to hand-roll it instead of
building on `docs()`/`taskItems()` was never recorded, and nothing in the file
said why — an unrecorded ADR-003 departure in a shipped preset.

## Fix

**Chose fix (1): express it through the DSL.** Surveyed first (per the
record's own Fix section) whether the State-region analysis fits as a
predicate/condition pipeline — it does. Spiked a throwaway DSL-based prototype
against both the real corpus and a hand-built synthetic fixture covering all
four finding types, iteratively finding and fixing three distinct
`.expectEmpty()` misuse bugs in the prototype before ever touching the real
file, then proved byte-identical output (rule/file/line match) before
committing to the approach.

`honestyAtClose` (`packages/md/src/rules/ledger.ts`) now builds its three
finding classes through `docs(corpus)` and `taskItems(corpus)` — both already
`extends RuleBuilder<T, Corpus>` — instead of raw `for` loops:

- `headerViolations` — `docs(corpus).that().satisfy(notBoardFile(...)).should().satisfy(headerStateCondition(...))`.
  No computed `.expectEmpty()`: nothing in the corpus can tell "no non-board
  documents authored yet" apart from "the selector broke." A caller who knows
  the former is legitimate (a freshly-bootstrapped lane) opts in via the new
  `HonestyAtCloseOptions.expectEmptyHeaders`, which — per ADR-010 — **expires**:
  the day a real document appears, the declaration itself becomes the finding.
- `silentOpenBoxViolations` / `deferredLieViolations` — built the same way over
  `taskItems()`/`docs()`, each gated by an **independently-computed** peek, not
  a self-referential one. Three designs were tried before this one:
  1. Unconditional `.expectEmpty()` — fails the moment a done-item has real,
     correctly-disposed open boxes.
  2. Gating on `terminalStates.length === 0` alone — correct only for the
     always-structurally-empty `proposals` lane, too narrow for a plan/bug
     lane's own single-document test fixtures.
  3. Peeking each rule's own `.that()` selection via `.select()` before
     conditionally declaring `.expectEmpty()` — this shipped first, passed
     its own review round, and was caught as **Critical** by a subsequent
     six-persona `/review`: the peek and the real run filter the identical
     elements through the identical predicates with nothing in between, so
     the declaration is always self-consistent and can never expire — zero
     protection against exactly the corruption class ADR-010 exists to
     catch, verified by re-deriving it from `RuleBuilder.select()`'s own
     source, not just asserted.
  4. **Shipped:** peek `openTaskItems` once
     (`taskItems(corpus).that().areOpen()`, a purely structural filter), then
     derive each rule's own signal from that — `anyOpenBoxOnADoneItem` calls
     `isDoneItem` directly rather than through `belongsToADoneItem`, and
     `anyDeferredDisposedBoxOnADoneItem` re-tests the same
     `DEFERRED_DISPOSITION_RE` constant `hasDeferredDisposedBox` uses via a
     different traversal — so a corruption of either predicate's own body no
     longer blinds the peek that gates it. The one residual gap is corruption
     of `isDoneItem` itself, shared by all three rules (including
     `headerStateCondition`, which has no escape hatch at all) — the
     narrowest case this design can leave open, not the general one design 3
     left open. An intermediate attempt gated both rules on one coarse "any
     done item exists" signal (independent of the right predicate, but the
     wrong _scope_: most done items legitimately carry zero open boxes and
     zero deferred boxes — that's the healthy, permanent case, not a corner
     case) and false-positived on the project's own
     `fixed/green-bug-closed.md` fixture before being narrowed to design 4.

Design 4 shipped, passed its own review round, and a **second** six-persona
`/review` (re-reviewing the fix, not the original bug) found it still
incomplete in two ways, both fixed:

- **`deferredLieViolations`'s new peek had no durable committed coverage.**
  `scripts/nonvacuity/bad-ledger.mjs`'s corpus had no `deferred→<home>` box
  anywhere, so sabotaging `hasDeferredDisposedBox` to `return false` still
  left that fixture reporting "gate proven" — its only real protection was
  this repo's own live corpus incidentally carrying a deferred box, which
  would silently vanish the day that box got resolved. Fixed: added
  `completed/0005-deferred-none-lie.md` (the lying case) and
  `completed/0006-deferred-honest.md` (the clean case) to that fixture's
  corpus, added `ledger/deferred-none-lie` to its `RULES`, and registered a
  new `corpus/ledger/deferred-lie` row in `check-nonvacuity.mjs`.
- **The disclosed residual gap (`isDoneItem` corruption) was worse than
  documented, and its stated backstop didn't exist.** Design 4's own docstring
  claimed a corruption of `isDoneItem` "would likely also surface through
  `headerViolations`." Two reviewers independently proved this false by
  reading the code: `headerStateCondition` never calls `isDoneItem` — it
  recomputes the folder half of the same determination inline, so it only
  catches a corruption if a live state/folder mismatch already exists in the
  scanned corpus. Sabotaging `isDoneItem` directly against this repo's real
  corpus confirmed the consequence: **zero violations, exit 0** — every peek
  and every real selection in the preset agreed "nothing to examine,"
  simultaneously, with only a non-gating stderr warning
  (`⚠ 0 done-items scanned — vacuous`) as a trace. `honestyAtClose` itself
  can't close this generically (a corpus with zero done-items is legitimate
  on a lane's first day — the same tension `expectEmptyHeaders` exists for).
  Fixed at the caller level instead: `scripts/check-ledger.mjs` gained a hard
  failure when 0 done-items were summed across every lane. Re-sabotaged
  `isDoneItem` after the fix and confirmed `check:ledger` now exits 1. The
  docstring's claim was corrected to state the gap plainly rather than
  understate it.

**Round 3 correction: summing across lanes was itself the wrong check.** A
corruption scoped to one lane (verified: `isDoneItem` returning `false` for
`bugs/`-lane documents only) left the sum at 24 (from `plans/`, untouched) —
`doneVacuous` never tripped, and `bugs/`'s 21 real done-items, and any
violations they carried, went silently missing. Fixed by checking **each
lane independently**: `findLaneDoneVacuity` (new,
`scripts/lib/lane-coverage.mjs`, alongside the existing `findUncoveredLanes`
it's modeled on) takes each lane's own `terminalStates`/`doneItems` and
produces a real `ArchViolation` — not a side boolean — for any lane with a
real `terminalStates` vocabulary and zero done-items, unless that lane
declares `expectEmptyDone: true` (mirroring `expectEmptyHeaders`'s own
caller-declared, non-inferrable shape — this repo's own three lanes don't
need it; a `kit/`-seeded lane copying this pattern into a fresh project
would). Producing a genuine violation, merged into `violations` _before_ the
`--format json`/`github` branch, also fixed a second round-3 finding as a
direct consequence: those formats previously emitted **nothing at all** on a
`doneVacuous` failure (`reportViolations([])` correctly-but-silently
no-ops on an empty array, and the old `doneVacuous` boolean never became a
member of that array) — now they carry the same message the terminal format
does. Re-sabotaged the `bugs/`-only corruption after the fix: `plans/` still
shows 24 done, `bugs/` correctly reports the `ledger/lane-done-vacuous`
finding, in all three formats. A new non-vacuity fixture
(`scripts/nonvacuity/bad-lane-done-vacuous.mjs`, modeled on the existing
`bad-lane-coverage.mjs`) proves `findLaneDoneVacuity` fires on a vacuous lane
and correctly skips a healthy lane, a structurally-exempt lane
(`terminalStates: []`), and a lane declaring `expectEmptyDone: true` — all
in one fixture, so a regression back to summed checking can't hide behind a
healthy lane sitting next to it.

Detection logic — regexes, `findState`/`isDoneItem` helpers, messages — is
unchanged. Only the iteration mechanism changed.

## Verification

- [x] Survey first: confirmed the State-region analysis fits as a
      predicate/condition pipeline over `docs()`/`taskItems()` — fix (1) is the
      chosen resolution, not fix (2).
- [x] Spiked against a synthetic fixture and the real corpus before touching
      the real file; found and fixed three `.expectEmpty()` misuse bugs in the
      prototype first.
- [x] Six-persona `/review` run on the first shipped version before commit
      (architect, product, devops, customer, testing, enforcement — mandatory
      enforcement lens per this repo's own gate-code review convention).
      Gatekeeper-verified two Critical findings against the code directly
      before accepting them: the `headerViolations` false-positive on a
      board-only corpus (product/customer, reproduced independently), and the
      self-referential `.expectEmpty()` peek (architect/enforcement, derived
      from `RuleBuilder.select()`'s own source). Both fixed; see Fix above.
- [x] Real implementation: 40 `ledger.test.ts` tests pass (36 original + 4
      added by this fix's own review round), full `packages/md` suite passes,
      real-corpus output byte-identical to before (35 plans/24 done, 55
      bugs/21 done, 5 proposals/0 done, 0 findings).
- [x] `npm run validate` green end-to-end, including `check:release`
      (changeset `.changeset/ledger-inherits-the-evidence-gate.md` for
      `@nielspeter/eess-md`) and `check:nonvacuity` (35 fixtures, including
      the new `scripts/nonvacuity/bad-ledger-dead-selector.mjs`).
- [x] Sabotage-verified, both directions, both now caught:
  - Breaking `notBoardFile` (gates `headerViolations`) **is caught** — 3
    "examined zero units" findings across all three lanes.
  - Breaking `belongsToADoneItem` (gates `silentOpenBoxViolations`) **is now
    caught** — the independent `isDoneItem`-direct peek doesn't share the
    corruption, so `examined === 0` with no declaration throws.
  - Breaking `hasDeferredDisposedBox` (gates `deferredLieViolations`) **is
    now caught** — the independent `DEFERRED_DISPOSITION_RE`-over-`openTaskItems`
    peek doesn't share the corruption either.
- [x] Committed, not just hand-verified: `ledger.test.ts` gained a describe
      block asserting the `headerViolations` dead-selector guard fires by
      default, is suppressed by `expectEmptyHeaders`, and expires once real
      content appears; and a describe block pinning that a done item with
      nothing outstanding produces no finding (the false-positive this fix's
      own review round found and corrected). `scripts/nonvacuity/bad-ledger-dead-selector.mjs`
      proves the `headerViolations` guard through the real `check:ledger`
      gate, registered in `check-nonvacuity.mjs`'s gate-coverage map.
- [x] A second six-persona `/review` round on the fixed version found two
      further Critical issues (see Fix), both verified against the code and
      fixed before merge:
  - `scripts/nonvacuity/bad-ledger.mjs` gained a permanent `deferred→<home>`
    box (`completed/0005-deferred-none-lie.md`, plus a clean counterpart) and
    `ledger/deferred-none-lie` joined its `RULES` — re-sabotaged
    `hasDeferredDisposedBox` afterward and confirmed the fixture now correctly
    reports "gate is vacuous" (exit 0) rather than falsely reporting "gate
    proven."
  - `scripts/check-ledger.mjs` gained a hard failure on 0 done-items summed
    across every lane — re-sabotaged `isDoneItem` afterward and confirmed
    `check:ledger` now exits 1 instead of 0.
- [x] A third six-persona `/review` round — re-reviewing round 2's fix — found
      the sum-across-lanes design itself was the wrong check, plus two
      further issues, all fixed before merge (see Fix's "Round 3 correction"):
  - Re-sabotaged `isDoneItem` scoped to only the `bugs/` lane: confirmed
    `check-ledger.mjs` exited 0 (the sum stayed nonzero from `plans/`) before
    the fix, and correctly exits 1, naming the `bugs` lane specifically, after
    switching to `findLaneDoneVacuity`'s per-lane check.
  - `--format json`/`--format github` on a `doneVacuous` failure previously
    emitted empty output; confirmed they now carry the full violation payload,
    identical in shape to the terminal format's finding.
  - `scripts/nonvacuity/bad-lane-done-vacuous.mjs` (new, modeled on the
    existing `bad-lane-coverage.mjs`) proves `findLaneDoneVacuity` fires on a
    vacuous lane and correctly skips a healthy lane, a structurally-exempt
    one, and a lane declaring `expectEmptyDone: true` — registered in
    `check-nonvacuity.mjs`'s gate list and its `check:ledger` coverage map.
- [x] `npm run validate` re-run green end-to-end after all three rounds'
      fixes (`check:nonvacuity` now 37 fixtures, up from 34 before round 1).

Deferred: [0151](../0151-honesty-at-close-options-undiscoverable-past-source.md),
[0152](../0152-no-guardrail-against-hand-rolled-presets-recurring.md). Every
Critical finding across all three review rounds was fixed before merge, not
recorded as an accepted limitation — no fix is owed by _this_ record. Two
Important-tier findings (the `expectEmptyHeaders`/`honestyAtClose`
discoverability gap; no architectural guardrail against a future preset
repeating this bug's pattern) were outside this record's own scope (each
review round's job was verifying the prior round's fix, not opening new
surface) and are real, separately-closable work — given their own numbers
rather than a footnote here.
[Plan 0101](../../plans/completed/0101-sibling-gates-go-fail-closed.md) Phase 1 names
this bug's closure as in-scope and closes alongside it.
