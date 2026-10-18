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
reader in the preset. A blank label is refused. Two findings close the silent pass:

- **`ledger/state-under-another-label`**, per record. The record has no state line under the labels
  in force, but a label in its header, wrapped or plain, holds a value from the state vocabulary
  (`**Status:** Done`, `Status: Done`). With default options this names 0002 and 0005 in the table above, where
  before nothing was said. It keys on the caller's own vocabulary, so a stateless document's labels
  (`**Status:** draft-mail`) stay quiet.
- **`ledger/no-readable-state`**, once per call, when no examined document carries a state line in
  any form. It sits in the header rule itself, so an empty lane still gets one zero-examined finding,
  not two. Its remedy is built from the options in force:
  - narrow the corpus to the record folders;
  - otherwise, pass the label the records use;
  - a `## Status:` heading is not a label this preset reads (plan 0468 owns that form).

The Fix asked that the finding apply "only to the lanes the caller declares". The preset has no lane
list, so each call is a lane. A caller whose single call covers record and non-record folders gets
no lane finding. A call over non-record folders only is reported, and the remedy is to narrow it.

Four existing tests asserted that a stateless single document passes. They now assert its one
finding. This is the flagged break. The `check:nonvacuity` rows
`corpus/ledger/{state-under-another-label,no-readable-state}` guard both findings at the gate tier.

Residuals, each recorded:

- **A record that writes its state as a heading** (`## Status: Done`) gets no finding when other
  records in the call are readable: [bug 0476](./0476-honestyatclose-reads-no-heading-form-state-and-says-nothing-beside-readable-records.md).
- **A non-record document** with no state line, whose header holds a state word under a label
  (`**Questions:** Open`), is reported. It is loud, not silent, and its remedy names `boardFiles`.
  A test row pins it.
- **Both labels in one header**, when the caller names both, resolve to whichever comes first,
  silently. Plan 0469's conflict finding is the home for that shape.

## Verification

- [x] Red first: the five-record table above, through the public preset (`packages/md/tests/rules/ledger-reads-the-callers-label.test.ts`). With default options 0002 and 0005 got no finding on main.
- [x] Green: every record is pinned by `[rule, record]`, with default options, with `aliases: ['Status']`, and with `label` together with `aliases`. Each finding has a `check:nonvacuity` row.
- [x] done-otherwise: each call is a lane, since the preset has no lane list (Resolution). A stateless folder beside records gives no finding, and a stateless-only call gives one, with "narrow the corpus" as its remedy.
- [ ] deferred→bug 0476 — a heading-form state beside readable records is still silent

Deferred: bug 0476
