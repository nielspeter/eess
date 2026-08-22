# Plan 0216: the proposals lane states conventions it does not check

## Status

- **State:** Draft — the primitives all ship; what is missing is rules.
- **Priority:** Medium — it closes a gap between what `PROPOSALS.md` requires and what
  anything verifies, and the miss is measured rather than hypothetical.
- **Effort:** Small — rules in `scripts/check-corpus.mjs` beside the linkage check that
  already reads this lane. No new package, no kernel change.
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
  - **Matching.** `haveSection(string)` is exact equality (`matchName` in
    `packages/md/src/model/query.ts`), so the template's own casing matches **0 of 6**. Use a
    case-insensitive level-2 heading match. Do **not** use a bare substring: measured, that
    matches 005 on a superseded appendix heading and matches 006 on a mention inside its own
    review — a forged membership suppressing a red.
  - **What it asserts, honestly.** A heading rule proves _a heading exists_. "Did the author
    state a break class and how non-vacuity is kept" is Tier 4 and this plan will not pretend
    to check it. The structural version worth having is section **plus a table with named
    columns** — `haveTableRowsSatisfying` is the primitive, and it is how the ADR Enforcement
    table is already gated. That is still Tier 1, but it cannot be satisfied by a bare
    heading with three words under it. **Say in the rule's `because` what it does not prove.**
  - **Migration.** 4 of 6 proposals would red on day one. Decide now, in this plan: gate
    forward from a date, or fix 001/002's casing and grandfather 003–006 with a recorded
    reason. Deferring it means the first green run is blocked on proposal 006 growing a
    section its own review says it cannot write until Ask B leaves Held.

- **Board agreement.** Each board row's Ruling cell equals the file's operative Ruling, and
  a proposal with a `## Review` section is not still listed as unreviewed.

## Files Changed

- `scripts/check-corpus.mjs` — two rules beside the existing proposal block
- `scripts/nonvacuity/` — a violating fixture per rule
- `work/proposals/PROPOSALS.md` — say that these are now enforced

## Verification

- [ ] Red first: a proposal with no acceptance-criteria section reds; one with it passes.
- [ ] A board row whose Ruling disagrees with its file reds, and the message names both.
- [ ] Both rules have a committed violating fixture in `scripts/nonvacuity/`, so an emptied
      implementation cannot stay green.
- [ ] The gate reports a denominator — proposals examined — so a dead glob is visible.
      Six proposals today; a run reporting zero is the failure to watch.

## The third rule, and it is the one the lane most needs

`Split and sequence` creates **no downstream obligation** — `ACCEPTED_RULINGS` in
`scripts/lib/proposal-ruling.mjs:54` deliberately excludes it, and its comment names that as
"the one place the policy is decided". Proposal 006 is the first proposal ruled that way,
and it was split into three plans in the same change, each declaring `**Implements:**`.

So the gate reports `6 total · 1 accepted` and 006 is not the 1. Nothing verifies the split
happened, nothing checks the disposition table's owner column resolves, and deleting plans
0212/0213/0214 tomorrow leaves every gate green.

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
