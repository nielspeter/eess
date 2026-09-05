# Plan 0259: a README and lifecycle for the proposals lane

## Status

- **State:** Draft — the convention is genuinely undecided; this exists so the
  question has a home that can be read, not because the answer is known.
- **Priority:** Medium — `work/proposals/` has run for nine proposals and two
  full review rounds without a README. Nothing is broken; what is missing is the
  written convention every other lane has, and the absence has now been
  rediscovered three times.
- **Effort:** Low — one README plus whatever `docs/working-method.md` owes once
  the states are settled. No code.
- **Created:** 2026-09-05
- **Receives:** the deferral from
  [bug 0108](../bugs/fixed/0108-work-readme-lanes-table-lists-one-lane.md),
  which closed naming `docs/working-method.md` as the home. Review measured that
  document and found zero occurrences of "proposal" — the deferral pointed at a
  file, and a file is not an owner. This plan is the home 0108 should have named.

## Problem

`work/proposals/` is the only lane without a README. The other three each say
what states a record moves through and where it goes when it is finished;
proposals say it nowhere, and the vocabulary is spread across three places that
have already drifted from one another:

| where                              | what it says about the proposals lane                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `work/README.md`                   | lists `proposals/` with terminal subfolders `promoted/`, `declined/`                 |
| `scripts/check-ledger.mjs` `LANES` | `states: ['Draft','Promoted','Rejected']`, done-folders from `PROPOSAL_DONE_FOLDERS` |
| `docs/working-method.md`           | does not mention proposals at all — five lanes listed, this is not one               |

`declined/` (the map) and `Rejected` (the gate) are the same idea under two
words, and neither directory exists on disk. The lane the working method never
introduces is the one whose conventions are least written down.

## Open questions — the reason this is a Draft

1. **What states does a proposal move through?** `Draft → Promoted | Rejected` is
   what the ledger gate enforces today. Is `Held` a state or a per-ask
   disposition? Proposal 009 carries held asks and is not itself held.
2. **Where does a ruled-but-not-dispatched proposal live?** A `Rewrite needed`
   ruling leaves the proposal live and unpromotable. Today it sits in place with
   no terminal folder, which is correct — but unwritten.
3. **`declined/` or `rejected/`?** One word, chosen once, in the map, the gate
   and the README together.
4. **Does the lane get a board README at all, or does `PROPOSALS.md` serve?**
   Every other lane has both. Proposals has only the board.

## Out of scope

- Changing the ledger gate's vocabulary. The gate is green and correct against
  the words it uses; if this plan renames anything, that is a follow-on edit
  with its own review, not a silent rider.
- Creating `promoted/` or `declined/` on disk. A terminal folder is created when
  a lane first needs one — see `work/README.md`'s note on exactly this.

## Success

`work/proposals/README.md` exists, says what the four questions above resolve
to, and `docs/working-method.md` introduces the lane alongside its five
siblings. `work/README.md`'s row for `proposals/` agrees with both.
