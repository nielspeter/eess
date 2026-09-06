# Plan 0259: the proposals lane, said the same way in every document

## Status

- **State:** Ready — frozen 2026-09-06. **The freeze falsified this plan's own
  premise, and the plan is smaller and sharper for it.** It was drafted as "the
  convention is genuinely undecided". Measured against the corpus, three of its
  four open questions were already decided — in `PROPOSALS.md`'s own
  `## Vocabulary` section, which the Problem statement claimed said it nowhere —
  and the fourth dissolved when the premise behind it turned out to be false.
  What is left is a real, small drift: **one word, in two lines of one file**,
  plus a lane the working method never introduces. Recorded rather than edited
  away, because a plan that was wrong about what it was for is worth the same
  honesty as a gate that was wrong about what it checked.
- **Priority:** Medium — nothing is broken; what is wrong is that the corpus
  map and the lane's own board disagree about a directory name, and a stranger
  reading `docs/working-method.md` never learns the lane exists. Both are the
  drift class this repo builds gates for, in the documents that describe the
  gates.
- **Effort:** Low — three edits and no new document. **Not a README**: measured
  at the freeze, no lane in this repo has one (`work/plans/`, `work/bugs/`,
  `work/support/` and `work/proposals/` each have a board and nothing else), so
  writing one here would create the repo's only lane README and duplicate the
  `## Vocabulary` section that already answers it. No code.
- **Created:** 2026-09-05
- **Receives:** the deferral from
  [bug 0108](../bugs/fixed/0108-work-readme-lanes-table-lists-one-lane.md),
  which closed naming `docs/working-method.md` as the home. Review measured that
  document and found zero occurrences of "proposal" — the deferral pointed at a
  file, and a file is not an owner. This plan is the home 0108 should have named.

## Problem

Two documents disagree with the lane's own board about one word, and a third
never mentions the lane at all.

**`rejected/` is the settled name.** `PROPOSALS.md`'s `## Vocabulary` table says
so with its reasoning — _"`Rejected` is the bugs lane's word, deliberately:
`Won't-do` (plans) / `Rejected` (bugs) / a third synonym here would make a
stranger learn three words for one idea"_ — and the gate agrees:
`PROPOSAL_DONE_FOLDERS = ['/promoted/', '/rejected/']` in
`scripts/lib/proposal-ruling.mjs`. Neither directory exists on disk yet, which is
correct and documented: the first rejection creates it.

Three places disagree, and each needs a different fix:

| where                                | says                                              | fix                                                                 |
| ------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------- |
| `work/README.md` (two lines)         | `declined/`                                       | the live drift — change the word                                    |
| `PROPOSALS.md`'s "Known gaps" bullet | `declined/`, inside a struck-through closed entry | the board contradicts its own Vocabulary table eight sections above |
| `docs/working-method.md`             | nothing at all — zero occurrences of "proposal"   | the lane is genuinely missing from the method's own document        |

`work/plans/completed/0216-…` also says `declined/`. That one is **history and
stays**: it records what was true when it shipped, and the frozen corpus is not
rewritten to match the present.

## The four open questions, answered at the freeze

This section replaces "Open questions — the reason this is a Draft". Not one
needed a judgment call; all four were answerable from the corpus, which is why
the plan could be frozen rather than referred back.

1. **What states does a proposal move through?** `Draft → Promoted | Rejected`,
   and it is **already documented** — `PROPOSALS.md` `## Vocabulary` carries the
   three-row table with meanings and folders, plus the rule that review does not
   change State. `Held` is **not** a state: it is a per-ask disposition, with its
   own `## Disposition — per ask, inside a Ruling` section, and proposal 009
   demonstrates the distinction by carrying held asks while not itself being held.
2. **Where does a ruled-but-not-dispatched proposal live?** In place. Already
   documented in the same section: _"A proposal ruled `Rewrite needed` is still
   live work."_ The plan's own draft had already reached this answer in passing
   and then listed it as open.
3. **`declined/` or `rejected/`?** **`rejected/`** — decided, with reasoning, in
   `PROPOSALS.md`, and the gate implements it. This was never an open question;
   it was an undetected drift in `work/README.md`.
4. **Does the lane get a board README, or does `PROPOSALS.md` serve?**
   `PROPOSALS.md` serves. The question rested on "every other lane has both",
   which is **false**: measured at the freeze, no lane in `work/` has a
   `README.md`. The board is the lane's document, here as everywhere.

## Implementation

1. `work/README.md` — `declined/` → `rejected/` on both lines (the lanes table
   row and the terminal-folder sentence).
2. `work/proposals/PROPOSALS.md` — the "Known gaps" bullet that names `declined/`
   is corrected to `rejected/`, with a note that the word changed, so the file
   stops contradicting its own Vocabulary table.
3. `docs/working-method.md` — introduce the proposals lane beside its siblings:
   what a proposal is, the three states, that a review produces a Ruling and does
   not change State, and that dispatch (not review) is what closes one. Short —
   it points at `PROPOSALS.md` for the detail rather than restating it.

## Out of scope

- **Changing the ledger gate's vocabulary.** The gate is green and correct
  against the words it uses, and those words are the ones this plan makes the
  documents agree with, not the ones it changes.
- **Creating `promoted/` or `rejected/` on disk.** A terminal folder is created
  when a lane first needs one — `work/README.md`'s own note, and `PROPOSALS.md`
  says the same.
- **A `work/proposals/README.md`.** Dropped at the freeze, with the measurement
  above. If lane READMEs are ever wanted, that is one decision for four lanes,
  not a rider on this plan.
- **`Split and sequence` creating no obligation** — `PROPOSALS.md` records it as
  an open gap in this lane and it stays there; it is a gate question, not a
  vocabulary one.

## Success

`grep -rn "declined/" work/ docs/ scripts/` returns only
`work/plans/completed/0216-…`, which is history. `docs/working-method.md`
introduces the proposals lane. `check:corpus` and `check:ledger` stay green — no
gate changes, so a red would mean a document now disagrees with a mechanism it
did not before.

## Progress ledger

- [ ] `work/README.md` — the word, both lines
- [ ] `PROPOSALS.md` — the self-contradicting bullet
- [ ] `docs/working-method.md` — the lane introduced
- [ ] `/close`

Deferred: none.
