# Plan 0216: give the proposals lane a close, and gate its board

## Status

- **State:** Done — built and merged 2026-08-23, all four phases, every Verification box
  measured rather than reasoned. The design was **taken from the sibling lanes and from an
  adopter corpus**, not invented: see _Design, from precedent_. `Deferred: plan 0218` (the
  acceptance-criteria rule, split out before the freeze — see _Out of Scope_).
- **Priority:** Medium — it closes a gap between what `PROPOSALS.md` states and what
  anything verifies, and the miss is measured rather than hypothetical.
- **Effort:** Small — lane config in `scripts/check-ledger.mjs`, one rule in
  `scripts/check-corpus.mjs`, one folder, one file moved. **No package change, no kernel
  change, no changeset** — every primitive already ships.
- **Created:** 2026-08-22 · **Frozen:** 2026-08-23

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
[0145](./0145-crossvalidate-stale-wip-detection.md) built, merged and closed. A
fully discharged proposal is indistinguishable from one filed this morning.
`PROPOSALS.md` already records this under _Known gaps in this lane_ ("No terminal
folder"), which is the lane documenting a hole rather than closing it.

**2. Board ↔ file Ruling agreement.** The board's `Ruling` column is a copy of the
operative `**Ruling:**` in the proposal. Nothing compares them, and 006's row carried `—`
while the file said `Split and sequence`.

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

- **The terminal state exists** — `Promoted` and `Declined`, mirroring `completed/` +
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

`promoted/` and `declined/` are deliberately **not** added to `check:corpus`'s `frozen`
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

- Break class: 006's row said `—` while the file said `Split and sequence`. Also fires when
  a re-review changes a file's Ruling and the board keeps the old one.
- Message names both sides — the row's value, the file's value, and the file — so the fix
  is unambiguous rather than "these disagree".
- A committed violating fixture under `scripts/nonvacuity/`, so an emptied implementation
  cannot stay green.
- The summary prints proposals examined; a run reporting zero is the failure to watch.

## Phase 4 — say it in `PROPOSALS.md`

- **Vocabulary → State table**: add `Promoted` and `Declined`. The current table asserts
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
  `doneFolders` / `closeInPlace` (`:60-67`) and the comment above it (`:29-41`)
- `scripts/check-corpus.mjs` — one rule beside the existing proposal block
- `scripts/nonvacuity/` — one violating fixture for that rule
- `work/proposals/promoted/005-crossvalidate-stale-wip-detection.md` — moved, State flipped
- `work/proposals/PROPOSALS.md` — State vocabulary, the retired gap, the 005 row
- `work/plans/completed/0142-…`, `work/plans/completed/0145-…`, `work/bugs/fixed/0141-…` —
  inbound links repaired

## Verification

All six measured against the built gates, not reasoned about.

- [x] Red first: four sabotage cases each red exactly this rule and restore clean — a
      changed board verdict, a blanked cell (006's real defect, reproduced), a renamed
      `Ruling` header, and every `Item` cell stripped of its leading number. The message
      names both values and the file: _"board says proposal 5's Ruling is (none) but
      work/proposals/promoted/005-….md says «Ship as-is»"_, with a `Fix:` naming the file
      as the source of truth.
- [x] Committed fixture — `corpus/proposal-board-ruling` in `scripts/check-nonvacuity.mjs`,
      taking the harness from 43 fixtures to 44. It plants a probe proposal **and** a board
      row rather than mutating a real row, so it does not hard-code whichever verdict 006
      carries today.
- [x] `check:ledger` now reports `proposals 6 scanned · 6 with a readable State · 1 done
(ledger-checked)`. The parenthetical "(no terminal state — box-disposition check
      never runs on this lane)" is gone.
- [x] Both placement directions red: a `State: Promoted` proposal left in
      `work/proposals/` and a `Draft` sitting inside `promoted/` each produce one
      `ledger/state-folder-mismatch`.
- [x] `check:corpus` green — 1209 checks across 150 documents, 0 violations; all four
      inbound links to 005 repaired, including the two in frozen folders no gate reads.
- [x] The summary prints `6 board row(s)`. **This is not decoration — it caught a real
      defect in this plan's own rule**, see below.

> **The first version of this rule examined zero rows and passed green.** It keyed on the
> row's link target, regexing for `](…)` in the `Item` cell — but `MdTable` rows are
> _rendered_ cell text, so mdast had already stripped the link markup. Six rows, six
> skips, `✓ 0 violations`. The denominator printed `0 board row(s)` and that is the only
> reason it was caught. Two consequences, both shipped: the rule now keys on the leading
> number in the cell, and a board table whose every row is skipped is itself a finding
> (`corpus/proposal-board-examined-nothing`) rather than a visible-but-passing zero.
> Recorded because a plan that ships a fail-closed gate and nearly shipped a vacuous one
> should say so.

## Out of Scope

- **The acceptance-criteria section rule** → split out to
  [plan 0218](../0218-gate-proposal-acceptance-criteria.md). It is the one item here that
  still turns on open decisions — exact-vs-regex matching, whether heading depth needs a
  new `eess-md` condition (a published package change), and what happens to the four
  proposals that have no such section. Splitting it is what keeps 0216 closable in one PR.
- **Pointer aboutness** — [bug 0215](../../bugs/0215-pointer-gate-proves-existence-not-aboutness.md).
  Corpus-wide, not this lane, and its fix is a citation-format decision.
- **Adding `/promoted/` and `/declined/` to `eess-md`'s `DEFAULT_DONE_FOLDERS`.** It would
  serve adopters, but it silently converts any existing `promoted/` document into a
  ledger-checked done-item — a behaviour change owing a changeset and its own record. This
  plan passes them explicitly instead.
