# Plan 0216: the proposals lane states conventions it does not check

## Status

- **State:** Draft — the primitives all ship; what is missing is rules. **Widened
  2026-08-23** to absorb the one surviving item from a withdrawn lifecycle draft: this lane
  has no terminal state and no done-folder, so it cannot close. That draft proposed a whole
  lifecycle, was measured wrong in enough places to be withdrawn rather than revised, and its
  other two checks were already this plan's. It never became a file and holds **no number** —
  `npm run next-number` still hands out 0218.
- **Priority:** Medium — it closes a gap between what `PROPOSALS.md` requires and what
  anything verifies, and the miss is measured rather than hypothetical.
- **Effort:** Small **for the board-agreement rule** — it is wiring in
  `scripts/check-corpus.mjs` beside the linkage check that already reads this lane, with no
  package change. The other two are not costed yet and this plan says so rather than
  averaging them: the acceptance-criteria rule is Small only if it stays script-local, and
  Medium if the honest answer is a depth-aware condition in `eess-md` (a published package);
  the terminal-token half touches `scripts/check-ledger.mjs` and is gated on the decision
  below. **Build the board rule first** — it is the only one with no open decision.
- **Created:** 2026-08-22

## Problem

`work/proposals/` is partly gated already: `check:corpus` resolves its links and pointers,
enforces the accepted-Ruling → plan linkage (bug 0141 / plan 0142), and reports malformed
`**Ruling:**` / `**Implements:**` lines; `check:ledger` reads each proposal's `State`.

Two conventions the lane _states_ are checked by nothing, and both were violated this month
by the most recent proposal:

1. **Acceptance criteria.** `PROPOSALS.md` requires, per capability, the break class **and
   how non-vacuity is kept**. Proposal 006 **as submitted** delivered the first — a per-type
   break-class table — and omitted the second entirely: zero occurrences of "non-vacuity",
   "fixture", "examined", "tier" or "warn". Precision matters here, because it is what the
   rule has to key on.

   **And the convention has never once been met in the shape the template prescribes.**
   Measured across the whole lane:

   | proposal      | heading                          | depth                                              |
   | ------------- | -------------------------------- | -------------------------------------------------- |
   | 001           | `## Acceptance Criteria`         | 2 — capital C                                      |
   | 002           | `## Acceptance Criteria`         | 2 — capital C                                      |
   | 003, 004, 006 | none                             | —                                                  |
   | 005           | `### Acceptance criteria (…)` ×4 | 3, all inside superseded Rewrite/Appendix sections |

   `PROPOSALS.md:229` writes it lower-case. **No proposal matches that string.** So the
   honest framing is not "001's lesson committed twice" — it is that the template and the
   corpus have never agreed, which is a stronger reason to gate it and a different rule.

2. **Board ↔ file agreement.** The board's `Ruling` column is a copy of the operative
   `**Ruling:**` in the proposal. Nothing compares them, and 006's row carried `—` while
   the file said `Split and sequence`.

## Approach

Both are expressible with primitives `@nielspeter/eess-md` already exports — `docs`,
`haveSection`, `rows`, `matchTableRows`, `haveTableRowsSatisfying` — and `check:corpus`
already parses the Ruling via `scripts/lib/proposal-ruling.mjs` (`operativeRuling`,
`declaredImplements`). This is wiring, not capability.

- **Acceptance criteria section.** Three things this plan must settle rather than inherit:
  - **Matching, and it is not free.** `haveSection(string)` is exact equality (`matchName`,
    `packages/md/src/model/query.ts`), so the template's own lower-case casing matches
    **0 of 6**. A `RegExp` gives case-insensitivity for nothing — but **depth does not
    exist at this seam**: `hasSection` reads `s.name` only and never `s.depth`, though the
    model carries it (`packages/md/src/model/document.ts:10`). So "level-2 heading" needs
    either a script-local `definePredicate` or a depth-aware condition in `eess-md`.

    The second is the dogfooding answer — a family that cannot state its own lane
    convention in its own dialect is the finding — but it changes a published package and
    means this plan is **not** "wiring, not capability". Pick one and re-cost accordingly.

    Do **not** use a bare substring: measured, it matches 005 on four `###` headings inside
    superseded Rewrite/Appendix sections — a forged membership suppressing a red. (An
    earlier draft also claimed it matches 006 "on a mention inside its own review". It does
    not: `hasSection` iterates headings only, and 006's occurrence is inline code in a
    paragraph, which no heading rule can see. Corrected here rather than quietly.)

  - **What it asserts, honestly.** A heading rule proves _a heading exists_. "Did the author
    state a break class and how non-vacuity is kept" is Tier 4 and this plan will not pretend
    to check it. The structural version worth having is section **plus a table with named
    columns** — `haveTableRowsSatisfying` is the primitive, and it is how the ADR Enforcement
    table is already gated. That is still Tier 1, but it cannot be satisfied by a bare
    heading with three words under it. **Say in the rule's `because` what it does not prove.**
  - **Migration, and it is a denominator decision.** 4 of 6 proposals would red on day one.
    Both options have a consequence this plan must state, not just pick:
    - _Gate forward from a date_ — the rule examines **zero** proposals on day one. Under
      ADR-010 zero examined units is a configuration finding unless declared, so this needs
      an explicit `.expectEmpty()`-shaped declaration or it is the "0 checks scanned" green
      this repo treats as a red flag.
    - _Fix 001/002's casing and grandfather 003–006_ — the real denominator is 2 of 6, and
      the summary line must print that honestly rather than "6 proposals scanned".

    Deferring the choice means the first green run is blocked on proposal 006 growing a
    section its own review says it cannot write until Ask B leaves Held.

- **Board agreement.** Each board row's Ruling cell equals the file's operative Ruling, and
  a proposal with a `## Review` section is not still listed as unreviewed.

## Files Changed

- `scripts/check-corpus.mjs` — two rules beside the existing proposal block
- `scripts/nonvacuity/` — a violating fixture per rule
- `work/proposals/PROPOSALS.md` — say that these are now enforced
- `scripts/check-ledger.mjs` — **terminal-token half only**: the `proposals` lane's `states`,
  `terminalStates` and `doneFolders` (`:60-67`), plus the comment at `:29-41` that records
  why they were empty. Named here because the folded item changes a file the original three
  bullets never touched.
- `packages/md/src/` — **only if** the acceptance-criteria rule resolves to a depth-aware
  condition rather than a script-local predicate. Listed as conditional on purpose; that is
  the open decision, and resolving it toward `eess-md` makes this a package release.

## Verification

- [ ] Red first: a proposal with no acceptance-criteria section reds; one with it passes.
- [ ] A board row whose Ruling disagrees with its file reds, and the message names both.
- [ ] Both rules have a committed violating fixture in `scripts/nonvacuity/`, so an emptied
      implementation cannot stay green.
- [ ] The gate reports a denominator — proposals examined — so a dead glob is visible.
      Six proposals today; a run reporting zero is the failure to watch.

## A fourth item, folded in: the lane has no way to close

The withdrawn lifecycle draft proposed a whole lifecycle for this lane — six states, a
`settled/` folder, a `/propose` skill and three gates. Review measured it wrong in enough places that
it was withdrawn rather than revised, and **its checks 2 and 3 were this plan's already**.
What survives is one item, and one blocker that has to be settled before it can be built.

**The gap, measured.** `check:ledger` reports it in its own words:

```
proposals  6 scanned · 6 with a readable State · 0 done
           (no terminal state — box-disposition check never runs on this lane)
```

All six proposals read `Draft`, including 005 — ruled `Ship as-is`, its plan 0145 built and
closed. A fully discharged proposal is indistinguishable from one filed this morning. The
sibling lanes both have a terminal state and a done-folder; this one has neither:

| lane          | author  | promote            | build         | close    | terminal folder |
| ------------- | ------- | ------------------ | ------------- | -------- | --------------- |
| plans         | `/plan` | `/plan-ready`      | `/plan-build` | `/close` | `completed/`    |
| bugs          | `/bug`  | —                  | red→green     | `/close` | `fixed/`        |
| **proposals** | none    | `/review-proposal` | —             | **none** | **none**        |

**The blocker, and it is why that draft was wrong to call this a config change.**
`scripts/check-ledger.mjs` sets `terminalStates: []` for this lane **deliberately**, and says
why: _"a proposal's own checkboxes are Acceptance Criteria / Open Questions, a design
checklist, not a deferral ledger, and running the box-disposition check against them would
be a false-positive machine (001 alone carries 31 open boxes of that shape)."_

Measured today: **001 carries 29 open boxes, 002 carries 6; the other four carry none.**

> **An earlier draft of this section said "the first close emits ~35 findings". That is
> false.** 35 is a lane-lifetime ceiling, not a cost anyone pays soon. 005 is the named first
> close and carries **zero** boxes, so it fires nothing. 001 and 002 are both ruled
> `Rewrite needed` — they are live, never terminal, and their boxes never reach the check at
> all. Only 002's six could ever fire, and only if it goes terminal with them still open.
> Recorded rather than silently corrected, for the same reason as the block quote below: this
> plan is about conventions that go unchecked, and it mis-measured its own blocker twice.

So the blocker is real but **latent**. It still has to be settled — a terminal token with no
answer for those boxes is a decision deferred into the first author who trips it — but it does
not gate the acceptance-criteria rules above, which is why those stay buildable now. Review also measured that marking a proposal `Settled` with `Held` rows
standing produces **zero** findings, because `honestyAtClose` reads GFM task items and a
disposition table is a table. So the naive version lands a terminal state whose honesty
nothing checks _and_ fires the wrong check on the wrong boxes.

- [ ] **Settle this before building — and two of the three candidates are not real options.** - _Scope the box-disposition check to a ledger region_, so acceptance criteria fall
      outside it. The only candidate that both closes the lane and can still go red. - _Add a terminal token and leave `terminalStates` empty_ — **rejected: its break class
      is empty.** `isDoneItem` (`packages/md/src/rules/ledger.ts:205-207`) stays false for
      every proposal, so the lane remains structurally exempt from the vacuity guard and
      `check:ledger` keeps printing "box-disposition check never runs" over a corpus where
      proposals now close. It is also incoherent with the next bullet: `isDoneItem` returns
      `true` on **folder membership before it ever reads `terminalStates`**, so adding a
      done-folder makes the empty list dead config. - _Close in place_ — already the status quo: `scripts/check-ledger.mjs:64` sets
      `closeInPlace: true`. It decides nothing.

      Listed in full because a Draft should show the options it rejected; the first is the
      answer unless someone falsifies it.

- [ ] Then: one terminal token and a done-folder. `work/README.md:26-29` already carries the
      vocabulary — `Draft` · `Ready` · `Done` · `Won't-do`, the last two terminal — so this
      lane adopts `Done` rather than coining a word, and `states: ['Draft']`
      (`scripts/check-ledger.mjs:65`) widens with it. 005 moves into the folder: fully
      dispatched, one closed owner, zero open boxes.

      **And that migration proves nothing about the check.** 005's zero open boxes are exactly
      why it is safe to move first _and_ why moving it cannot show the box-disposition check
      works — it examines nothing. The acceptance evidence has to be a committed fixture in
      `scripts/nonvacuity/` carrying a terminal proposal with an undisposed box. Moving 005 is
      the migration, not the test.

**Deliberately not folded in.** The withdrawn draft's six states (four of them derivable from the operative
Ruling and the owners' states), its plan-or-bug owner widening (zero denominator — no bug
record declares `**Implements:**`, and every one of 006's accepted rows names a plan), and
its `/propose` skill. Each was justified by a single case, and two of its three justifying
counts did not reproduce.

## The third rule, and it is the one the lane most needs

`Split and sequence` creates **no downstream obligation** — `ACCEPTED_RULINGS` in
`scripts/lib/proposal-ruling.mjs:54` deliberately excludes it, and its comment names that as
"the one place the policy is decided". Proposal 006 is the first proposal ruled that way,
and it was split into three plans in the same change, each declaring `**Implements:**`.

So the gate reports `6 total · 1 accepted` and 006 is not the 1.

> **A previous draft of this plan claimed "deleting plans 0212/0213/0214 tomorrow leaves
> every gate green". That is false and was measured wrong.** Deleting 0214 in a worktree
> reds `corpus/broken-links` in six places, because the disposition table's owner cells are
> markdown links. The residual gap is narrower and is what this rule should target: nothing
> proves a `Split and sequence` proposal produced _any_ plan, and nothing requires the owner
> cell to be a link rather than prose. Recorded rather than silently corrected — a plan
> proposing a gate on a mis-measured gap is the shape this repo files bugs about.

That is a policy change made in practice and never written down. This plan owes either:

- a rule that a `Split and sequence` proposal's disposition table has an owner per accepted
  row and that each owner resolves to a real record; **or**
- an explicit decision that `Split and sequence` stays obligation-free, recorded in
  `PROPOSALS.md` beside the ruling table.

Either is fine. Silence is what is not, in a plan whose whole subject is conventions this
lane states and does not check.

## Out of Scope

- **Pointer aboutness** — [bug 0215](../bugs/0215-pointer-gate-proves-existence-not-aboutness.md).
  It affects the whole corpus, not this lane, and its fix is a citation-format decision.
- Retro-fitting acceptance criteria onto proposals 001–006. The rule should apply going
  forward or the plan owes a migration; decide before building.
- Whether a `Held` row needs a machine form. But `Held` and `Accepted, reshaped` are **new
  lane vocabulary introduced by a review section**, and `PROPOSALS.md`'s Vocabulary documents
  only `State` and the six `Ruling` values. This plan adds a short `Disposition` sub-section
  there naming the four values — that is documentation, not a gate, and it is in scope
  precisely because the lane's spec was open on the operating table when the word was coined.
