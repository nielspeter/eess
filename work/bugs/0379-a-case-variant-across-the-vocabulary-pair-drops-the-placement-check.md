# Bug 0379: a case variant across the vocabulary pair drops the placement check

## Status

- **State:** Draft — measured; no red test yet.
- **Severity:** High — **a finding that disappears.** Not a fully silent record — its box
  findings still fire — but `ledger/state-folder-mismatch`, the check that a closed record was
  actually moved, goes quiet, and nothing says so. The board's scale rates a lost finding
  High; reach is narrow, since it needs the same token spelled differently in the two lists.
- **Origin:** enforcement review of the
  [0284](./fixed/0284-a-declared-vocabulary-disjoint-from-its-terminal-set-turns-the-gate-off.md)
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

## Verification

- [ ] a red test: the two-row table above, through `honestyAtClose`
- [ ] the fix
- [ ] `npm run validate` green.

Deferred: none.
