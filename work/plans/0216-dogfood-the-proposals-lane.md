# Plan 0216: give the proposals lane a close, and gate its board

## Status

- **State:** Ready — **reopened 2026-08-23 after review.** It was marked `Done` and moved
  to `completed/` on the strength of Verification boxes that did not all hold. Five
  reviewers (architect · product · enforcement · testing · devops) each returned _request
  changes_, agreeing on four silent-pass holes, and the record's own motivating example
  turned out never to have happened. Reopening rather than filing follow-up bugs: a plan
  that shipped a gate with four ways to pass over corruption is not done, and closing it
  would have been the fake green this repo exists to refuse. `Deferred: plan 0218` (the
  acceptance-criteria rule, split out before the freeze — see _Out of Scope_).
- **Priority:** Medium — it closes a gap between what `PROPOSALS.md` states and what
  anything verifies, and the miss is measured rather than hypothetical.
- **Effort:** Medium — revised up after review. The first pass was costed Small (lane
  config, one rule, one folder, one file moved) and that was honest for what it built; it
  was not honest for what the built thing had to be. The board check is a two-sided join,
  the terminal state needed three rules the plan argued were not owed, and the harness went
  from one fixture to nine. **Still no package change and no changeset** — every primitive
  already ships.
- **Created:** 2026-08-22 · **Frozen:** 2026-08-23 · **Reopened:** 2026-08-23

## Problem

`work/proposals/` is partly gated: `check:corpus` resolves its links and pointers, enforces
the accepted-Ruling → plan linkage (bug 0141 / plan 0142), and reports malformed
`**Ruling:**` / `**Implements:**` lines; `check:ledger` reads each proposal's `State`.

Two things the lane states are checked by nothing.

**1. The lane cannot close.** `check:ledger` says so in its own words:

```
proposals  6 scanned · 6 with a readable State · 0 done
           (no terminal state — box-disposition check never runs on this lane)
```

All six read `Draft`, including 005 — ruled `Ship as-is`, its plan
[0145](./completed/0145-crossvalidate-stale-wip-detection.md) built, merged and closed. A
fully discharged proposal is indistinguishable from one filed this morning.
`PROPOSALS.md` already records this under _Known gaps in this lane_ ("No terminal
folder"), which is the lane documenting a hole rather than closing it.

**2. Board ↔ file Ruling agreement.** The board's `Ruling` column is a copy of the
operative `**Ruling:**` in the proposal, and nothing compares them. (An earlier draft
motivated this with _"006's row carried `—` while the file said `Split and sequence`"_.
**No commit carries that drift** — at `95ebf15` the row read `—` and the file had no
`Ruling` line, so they agreed; at `4d7ad72` both read `Split and sequence`. A transient
working-tree state, written up as a corpus defect. The real drift direction — a re-review
changes the file, the board keeps the old verdict — is what the rule catches, and it is
enough on its own.)

## Design, from precedent

The open questions an earlier draft of this plan reserved for the author are answered by
reading how the other lanes already work. Recorded here because the _method_ is the
finding: three "decisions" dissolved into one existing pattern.

**The terminal state names its successor.** An adopter corpus running this repo's dialects
closes its refinement lane — the closest analog to proposals, a lane for things still
being figured out — with a status line of this shape:

```
- Status: ✅ promoted → plans/025 (core) · plans/033 (saved filters) · plans/034 (export)
                        — split from one plan to three, per the house rule "one plan = one PR"
```

Not `Done`. **`promoted`, naming what it became.** That is the right token for this lane
too, and adopting it settles three things at once:

- **The terminal state exists** — `Promoted` and `Rejected`, mirroring `completed/` +
  `wont-do/` on plans and `fixed/` + `rejected/` on bugs.
- **The linkage obligation becomes intrinsic.** `Promoted` is only _writable_ when you can
  name the plans it became, and `check:corpus` already verifies those names resolve
  (`ACCEPTED_RULINGS` + `**Implements:**`). No second rule is owed.
- **The open-box blocker was never real for this path.** `scripts/check-ledger.mjs:29-41`
  sets `terminalStates: []` deliberately, because a proposal's checkboxes are Acceptance
  Criteria / Open Questions — a design checklist, not a deferral ledger. Measured: 001
  carries 29 open boxes and 002 carries 6; the other four carry none. **Both are ruled
  `Rewrite needed`.** They stay live, never promote, and their boxes never reach the
  check. A proposal's boxes travel with it into the plan it promotes to; that is what
  promotion _means_.

> **An earlier draft of this section said "the first close emits ~35 findings". That is
> false.** 35 is a lane-lifetime ceiling, not a cost anyone pays soon. 005 is the first
> close and carries **zero** boxes, so it fires nothing. Recorded rather than silently
> corrected: this plan is about conventions that go unchecked, and it mis-measured its own
> blocker twice before precedent dissolved it.

**The preset already has the shape.** `honestyAtClose` ships
`DEFAULT_DONE_FOLDERS = ['/completed/', '/fixed/', '/wont-do/', '/delivered/', '/archived/']`
and a `REFINEMENT.md` board default (`packages/md/src/rules/ledger.ts:84-87`), and
`isDoneItem` (`:200-208`) treats folder membership **or** a terminal `State:` token as
done. This lane was opted _out_ by its own config, not left out by the package. So this is
wiring, and the `Effort: Small` above is honest.

**One thing precedent does not give us.** That adopter's refinement records write
`- Status:` rather than `**State:**`, and `promoted/` is not in the preset's default
done-folders — so their lane is structurally exempt from their own gate, the same hole
this plan closes here. The _design_ is worth copying; their enforcement of it is not ahead
of ours. Said plainly so a later reader does not go looking for a mechanism that isn't
there.

## Phase 1 — the lane can close

`scripts/check-ledger.mjs`, the `proposals` lane:

| field            | today       | after                               |
| ---------------- | ----------- | ----------------------------------- |
| `states`         | `['Draft']` | `['Draft', 'Promoted', 'Declined']` |
| `terminalStates` | `[]`        | `['Promoted', 'Declined']`          |
| `doneFolders`    | `[]`        | `['/promoted/', '/declined/']`      |
| `closeInPlace`   | `true`      | removed — proposals now move        |

The comment at `:29-41` is rewritten rather than deleted: it currently argues the lane
_cannot_ have a terminal state, and that argument is what this plan falsifies. The new
comment keeps the true half (checkboxes are a design checklist, not a deferral ledger) and
records why promotion is nonetheless safe.

`promoted/` and `rejected/` are deliberately **not** added to `check:corpus`'s `frozen`
list (`scripts/check-corpus.mjs:64`, currently `completed|wont-do|fixed|archived`), so a
settled proposal keeps its links and `path:line` pointers gated. Freezing is why stale
pointers in closed records go uncaught elsewhere; this lane starts without that debt.

## Phase 2 — promote 005

`work/proposals/005-crossvalidate-stale-wip-detection.md` → `work/proposals/promoted/`,
its header token `Draft` → `Promoted`, naming plan 0145.

Four inbound links break and are repaired in the same commit —
`work/plans/completed/0142-…:191`, `work/plans/completed/0145-…:32`,
`work/bugs/fixed/0141-…:122`, and the board row. Two sit in frozen folders, so
`check:corpus` will not report them; they are fixed anyway, because a wrong link is wrong
whether or not a gate reads it.

**This migration proves nothing about the box-disposition check** — 005 has zero open
boxes, which is exactly why it is safe to move first _and_ why moving it demonstrates
nothing. The acceptance evidence is the fixture in Phase 3, not this move.

## Phase 3 — the board rule, with a fixture

In `scripts/check-corpus.mjs`, beside the existing proposal block, using
`rows`/`matchTableRows` and the already-parsed `operativeRuling`
(`scripts/lib/proposal-ruling.mjs`): **each board row's `Ruling` cell equals its file's
operative Ruling.**

- Break class: a row's `Ruling` disagreeing with its file. Fires when
  a re-review changes a file's Ruling and the board keeps the old one.
- Message names both sides — the row's value, the file's value, and the file — so the fix
  is unambiguous rather than "these disagree".
- A committed violating fixture under `scripts/nonvacuity/`, so an emptied implementation
  cannot stay green.
- The summary prints proposals examined; a run reporting zero is the failure to watch.

## Phase 4 — say it in `PROPOSALS.md`

- **Vocabulary → State table**: add `Promoted` and `Rejected`. The current table asserts
  `Draft` is "the only value a proposal's own header has ever carried" — true when written,
  false after Phase 2, and it is the kind of sentence that rots silently.
- **Known gaps → "No terminal folder"**: removed, because it is no longer true.
- The board row for 005 points into `promoted/`.

**Not owed here.** An earlier draft said `Split and sequence`'s obligation-free status was
"a policy change made in practice and never written down". It is written down — `PROPOSALS.md`
states it verbatim beside the Ruling table ("`Split and sequence` deliberately does **not**
require a plan…"). Verified by reading the file on 2026-08-23. The item is discharged, not
deferred.

## Files Changed

- `scripts/check-ledger.mjs` — the `proposals` lane's `states` / `terminalStates` /
  `doneFolders` / `closeInPlace`, and the comment above `LANES` that argued a terminal
  state was impossible here
- `scripts/check-corpus.mjs` — the board correspondence (a two-sided join), the three
  `Promoted` obligation rules, and a zero-guard on `acceptedProposalCount`
- `scripts/check-nonvacuity.mjs` — `withRewrittenFile`, an element-precise `firedOn`, and
  nine fixtures
- `scripts/lib/lane-coverage.mjs` — two docstrings that named `proposals` as the
  structurally-exempt lane, which it no longer is
- `.claude/skills/close/SKILL.md`, `kit/skills/close/SKILL.md`,
  `.claude/skills/review-proposal/SKILL.md` — the lane can close now, and no skill knew
- `work/proposals/promoted/005-crossvalidate-stale-wip-detection.md` — moved, State flipped
- `work/proposals/PROPOSALS.md` — State vocabulary, the retired gaps, the corrections
- three inbound links repaired, two of them in frozen folders no gate reads

## Verification

Every box below was measured against the built gates. **The first version of this section
was not** — see the reopening note at the end.

- [x] The board check is a **two-sided join** (`matchTableRows` + `matchSelections`), so it
      reds on all five corruptions, each attributed to its own rule id: a drifted `Ruling`
      cell (`proposal-board-ruling-drift`), a proposal with no row
      (`proposal-missing-from-board`), a row naming no real proposal
      (`proposal-board-row-unresolved`), a row with no leading number, and two files
      claiming one number (`proposal-number-duplicated`).
- [x] Three ADR-010 guards, one per way this rule can examine nothing: board document
      missing (`proposal-board-missing`), board table unreadable
      (`proposal-board-unreadable`), and every row unmatched
      (`proposal-board-examined-nothing`). The summary's affirmative clause is gated on
      **rows actually examined**, not on the finding count.
- [x] The three `Promoted` obligation rules red as specified: promoting while naming no
      owner, promoting on a `Rewrite needed`/`Reject` ruling, and promoting with a `Held`
      disposition row. Verified against real records — promoting 006 fires
      `has-held-asks` and **not** `names-no-owner`, because plans 0212/0213/0214 do declare
      `**Implements:** proposal 006`.
- [x] Ten committed fixtures, one per rule id — the harness goes **43 → 53**. Review
      measured the first pass shipping three rule ids behind one fixture, with both
      ADR-010 guards neuterable to `if (false)` while the harness stayed green.
- [x] `check:ledger` reports `proposals 6 scanned · 6 with a readable State · 1 done
(ledger-checked)`; the "(no terminal state — box-disposition check never runs on this
      lane)" parenthetical is gone. Both placement directions red one
      `ledger/state-folder-mismatch`.
- [x] `acceptedProposalCount` gained the zero-guard it never had — a pre-existing fail-open
      in the same summary line, found by devops review.
- [x] Every probe basename is `.gitignore`-covered. The first pass shipped
      `998-nonvacuity-probe-board.md`, the only probe in the harness the ignore rule missed
      (`**/__nonvacuity_probe*` is a basename prefix); under SIGKILL it survived inside a
      tracked corpus root.
- [x] **All three ADR-010 guards are fixtured**, `corpus/proposal-board-missing` included.
      An earlier version of this section left that one out as `dropped-on-purpose`, arguing
      that removing a tracked file was "a strictly larger blast radius than the
      rewrite-and-restore every other fixture uses". **That reasoning did not survive being
      checked**: `restoreAllPending()` restores by writing saved content back, which recovers
      a deleted file exactly as it recovers a mutated one — so `withRemovedFile` carries the
      identical guarantee and is twelve lines. Recorded because the gap shipped with a
      justification, and a justification that dissolves on inspection is worse than a plain
      gap: it teaches the next reader to trust the next disposition token.

## Reopened after review, and what that cost

Five reviewers ran against the first pass. All five returned _request changes_, with no
contradictions between them and three independent confirmations of the same hole. What they
found, all reproduced before acting:

1. **The board rule was one-sided.** Deleting a board row, unnumbering a row while its
   `Ruling` drifted, hiding the real board behind a decoy table, and two files claiming one
   number **all passed green**. The plan's own Phase 3 specified `rows`/`matchTableRows`;
   the code hand-rolled a `find` + `Map` + `forEach` a hundred lines below the
   `matchSelections` the same file already used.
2. **`Promoted` naming nothing was green** for four of six rulings, because the inherited
   linkage keys on the Ruling and `ACCEPTED_RULINGS` is only `Ship as-is` / `Ship with
changes`. The plan asserted "no second rule is owed" and put that in `PROPOSALS.md` as
   spec. It was owed.
3. **The two ADR-010 guards had no fixture** and could be deleted silently.
4. **Promoting with live `Held` asks was green** — `honestyAtClose` reads task boxes, and a
   disposition table is a table.

> **And the first version of the board rule examined zero rows and passed green.** It keyed
> on the row's link target, regexing for `](…)` — but `MdTable` rows are _rendered_ cell
> text, so mdast had already stripped the markup. Six rows, six skips, `✓ 0 violations`.
> The `board row(s)` denominator is the only reason it was caught, which is the argument
> for printing denominators at all.

The pattern across all four is one thing: **a convention asserted in prose and not
mechanised.** That is the defect class this plan exists to close, committed four times
inside the fix for it. Recorded here rather than in four follow-up bugs, because a plan
that closes on an untrue Verification box teaches the next reader that the box is
decoration.

## Out of Scope

- **The acceptance-criteria section rule** → split out to
  [plan 0218](./0218-gate-proposal-acceptance-criteria.md). It is the one item here that
  still turns on open decisions — exact-vs-regex matching, whether heading depth needs a
  new `eess-md` condition (a published package change), and what happens to the four
  proposals that have no such section. Splitting it is what keeps 0216 closable in one PR.
- **Pointer aboutness** — [bug 0215](../bugs/0215-pointer-gate-proves-existence-not-aboutness.md).
  Corpus-wide, not this lane, and its fix is a citation-format decision.
- **Adding `/promoted/` and `/rejected/` to `eess-md`'s `DEFAULT_DONE_FOLDERS`.** It would
  serve adopters, but it silently converts any existing `promoted/` document into a
  ledger-checked done-item — a behaviour change owing a changeset and its own record. This
  plan passes them explicitly instead.
