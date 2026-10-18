# Bug 0444: `honestyAtClose` reads only `State:`, and a corpus that writes `Status:` gets no placement check and no finding saying so

## Status

- **State:** Fixed — 2026-10-18, in PR #236 (with bugs 0467, 0466 and 0465).
- **Severity:** High — a false green on the gate's own claim. Two of three adopter corpora that use
  this preset write `Status:` in most lanes, so its state-to-folder half never runs for them, and the
  preset reports nothing about it.
- **Origin:** inbound · reported by two adopter monorepos (unnamed) in their feedback on proposal 017,
  verified here.
- **Reported:** 2026-10-16

## Symptom

`honestyAtClose` reads a record's state with one fixed label, `State`
(`packages/md/src/rules/ledger.ts:151`), and its options offer no other. A record written with
`**Status:**` has no readable state, so neither direction of the placement check runs on it, and the
preset says nothing. `ledgerStats` counts `withReadableState`, but the verdict never refuses on it.

Reproduced on a scratch corpus of five plans:

| record | header                           | folder       | finding                                |
| ------ | -------------------------------- | ------------ | -------------------------------------- |
| 0001   | `**Status:** Done`, one open box | `completed/` | the open box only                      |
| 0002   | `**Status:** Done`               | live         | **none**                               |
| 0003   | `**State:** Done`, one open box  | `completed/` | the open box                           |
| 0004   | `**State:** Done`                | live         | "State: Done but not in a done-folder" |
| 0005   | `**Status:** Draft`              | `completed/` | **none**                               |

`ledgerStats` reported `scanned: 5, withReadableState: 2, unreadableState: 0`: the last counts only a record whose `State:` label was found with a value it cannot read (`packages/md/src/rules/ledger.ts:782`), so the three `Status:` records count nowhere. Not live in this repository: no plan, bug or proposal here writes `Status:` without `State:` (measured). Records 0002 and 0005 are the same
defects 0004 is reported for, written with the other label. The box check, which keys on the folder,
still runs.

## Root cause

The label is a constant, not an option, and an unreadable state is skipped rather than counted
against the verdict. ADR-010: a check that examined nothing is not a pass.

## Fix

A label option, with aliases, read through the shared label grammar; and a finding when a lane's
records have no readable state (as `expectEmptyHeaders` already does for an empty lane). The default
stays `State`, so no caller's labels change; but a corpus that passes today because its state half
never ran will red, so this ships as a flagged break with a migration line ("pass `label`, or declare
the lane"). Proposal 017's block 5 generalises the placement half; this fix does not wait for it.

The "no readable state" finding applies only to the lanes the caller declares (the preset's `lanes`
option), never to every folder under a root. An adopter runs its ledger over folders that carry no
state (UI extractions, mail drafts, index files), and those must stay quiet (proposal 017, "Consumer
follow-up — 2026-10-18").

## Resolution

`honestyAtClose` and `ledgerStats` take `label` (default `State`) and `aliases`, threaded through every
reader in the preset. A new finding, `ledger/no-readable-state`, is raised once per call when the
call examined records and none carries a state line under the label in force. A record whose only
state line is in code, or behind an unclosed fence, already gets its own finding, so it does not
also count toward this one. Four existing tests asserted that a single stateless document passes;
they now assert that this lane finding is their one finding. This is the flagged break.

## Verification

- [x] Red first: the five-record corpus above, through the public preset (`packages/md/tests/rules/ledger-reads-the-callers-label.test.ts`, red on main)
- [x] done-otherwise: green, with sabotage rows instead of `check:nonvacuity` fixtures. Ignoring the label turns the 0002/0005 row red, and switching the lane finding off turns its row red
- [x] done-otherwise: `honestyAtClose` has no lane list, since each call is a lane. A stateless folder beside records that carry a state gives no finding (the mixed-lane row)

Deferred: none
