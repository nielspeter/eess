# Bug 0379: a case variant across the vocabulary pair drops the placement check

## Status

- **State:** Fixed — the state is read once against the whole vocabulary and compared to
  the terminal set case- and apostrophe-folded, by both checks and `ledgerStats`, through one
  helper.
- **Severity:** High — **a finding that disappears.** Not a fully silent record — its box
  findings still fire — but `ledger/state-folder-mismatch`, the check that a closed record was
  actually moved, goes quiet, and nothing says so. The board's scale rates a lost finding
  High; reach is narrow, since it needs the same token spelled differently in the two lists.
- **Origin:** enforcement review of the
  [0284](./0284-a-declared-vocabulary-disjoint-from-its-terminal-set-turns-the-gate-off.md)
  fix, recorded rather than folded in.
- **Reported:** 2026-10-04

## Symptom

Measured: one record at `work/plans/0001-a.md` with `State: Done`, not in a done-folder.

| `states`            | `terminalStates` | findings                       |
| ------------------- | ---------------- | ------------------------------ |
| `['Draft', 'Done']` | `['Done']`       | `ledger/state-folder-mismatch` |
| `['Draft', 'done']` | `['Done']`       | **none**                       |

In a done-folder the same pair gives the opposite error, a false red ("State: done but filed
in a done-folder").

## Root cause

_Line numbers below are to main before the fix._

The two paths canonicalise differently (`packages/md/src/rules/ledger.ts`):

- `isDoneItem` reads the state against `terminalStates` alone, case-insensitively, so it
  returns the terminal spelling and answers correctly (`:268`).
- `headerStateViolation` reads it against `known = [...states, ...terminalStates]` (`:300`),
  whose first match is the `states` spelling — `done` — and then asks
  `terminalStates.includes(found.state)` case-sensitively (`:315`). `done` is not `Done`, so
  the record is treated as open.

## Fix

Not decided, and either is small:

- read `terminal` through the `terminalStates` canonicaliser, as `isDoneItem` does; or
- refuse case- or glyph-variant duplicates across the pair in `resolveVocabulary`, as part of
  0284's "one coherent vocabulary" refusal.

The second also closes the false red. Measure both against the corpus before choosing.

## Decision

**Read the state once, against the whole vocabulary, then compare that one token to the
terminal set** — case and apostrophe folded. `hasTerminalState` in
`packages/md/src/rules/ledger.ts` does this, and `isDoneItem`, the placement check and
`ledgerStats` all call it, so the three cannot disagree.

**A first fix got this wrong, and review caught it (2026-10-04).** It took the record's first
option literally — read `terminal` through the terminal set, as `isDoneItem` did — and shared
that read. But `isDoneItem`'s read was itself wrong one way: the state matcher accepts prose
after a token, so against `terminalStates: ['Done']` alone, a declared non-terminal
`Done pending review` reads as `Done`. Sharing it made the placement check lose a done-folder
finding (an open record filed as done passed) and raise a false orphaned close in an active
lane — measured by enforcement and method review against the first fix. The two reads were
each wrong in one direction; agreeing on either was not the fix. The read now used is the
placement check's (whole vocabulary, longest token first) with the comparison `isDoneItem`
needed (folded, against the terminal set). This also closes the pre-existing half in
`isDoneItem`: an open `Done pending review` record's box was checked as if it were closed.

The record's second option — refuse case variants across the pair — was not measured; it was
set aside as a second breaking refusal for a defect one shared read removes. _(Stated
2026-10-04 after method review: the record asked for both to be measured.)_

`findState` stops at the first `State:` line whether or not it can read it, so the shared read
cannot skip a record's real `Draft` line and match a later `Done`. That covers reading across
lines; the multi-word case above is a misreading on the same line, which the first fix's
version of this paragraph did not consider.

The finding's message still prints the token as the whole-vocabulary read spells it — the
`states` spelling, for a case variant. It names the right line; the spelling is cosmetic and
predates this bug.

## Verification

- [x] a red test: the two-row table above, through `honestyAtClose` —
      `packages/md/tests/rules/a-case-variant-across-the-pair-keeps-the-placement-check.test.ts`
      · `it('a closed record outside a done-folder is reported, whichever list spells it in lower case')`
      and, for the false red,
      `it('a closed record inside a done-folder is not a false red under the variant')`, and
      for the case review found,
      `it('a declared multi-word state that begins with a terminal token is not read as that token')`.
      All three red against the code before this bug; against the first fix, only the third.
- [x] the fix — `hasTerminalState`, shared by both checks.
- [x] `npm run validate` green on `c9f1d1d` (exit 0, 473 s); the commit after it changes
      a test assertion, records and the changeset only.

Deferred: none.
