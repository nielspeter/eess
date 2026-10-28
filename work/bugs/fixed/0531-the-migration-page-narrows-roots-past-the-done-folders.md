# Bug 0531: the 0.15 migration page tells adopters to narrow `honestyAtClose`'s roots, which silently drops default done-folders from the close checks

## Status

- **State:** Fixed — 2026-10-20, on branch `docs/identity-split`, docs only: the page now says to
  keep every lane with a done folder, and shows how to check.
- **Severity:** Medium — a false green in an adopter's ledger, reached by following our own advice.
  Records in a dropped done folder leave every close check, and nothing reports it. It needs the
  adopter to narrow past a lane that holds closed records; the page's own example did not.
- **Origin:** inbound · adopter 1's upgrade to 0.15, 2026-10-20. Its own review caught it before it
  landed.
- **Reported:** 2026-10-20

## Symptom

[Migrating to 0.15](../../../docs/migrating-to-0.15.md), in "`honestyAtClose`: narrow the corpus
before you add a label", tells an adopter whose lanes write their state under different labels to
narrow the ledger corpus "to the lanes that write `State:`", and offers narrowing `roots` again as
the remedy for an `ignore` glob and for `ledger/no-readable-state`. It never says what narrowing
costs.

Adopter 1 followed it: it narrowed its ledger corpus to its plans and bugs lanes. Its support lane
holds `delivered/` and `archived/`, both among `honestyAtClose`'s default done folders. Every record
in them left the close checks: an open box in a delivered record no longer needs a disposition, and
nothing says the folders are unread.

## Root cause

The page, not the code. `honestyAtClose` reads a record as done when its path holds one of its done
folders (`DEFAULT_DONE_FOLDERS` in `packages/md/src/rules/ledger.ts`: `completed`, `fixed`,
`wont-do`, `delivered`, `archived`), and it reads only the corpus it is given. A done folder outside
the corpus's roots is not an error to it, so the advice to narrow needed the condition the page left
out: keep every lane that has a done folder.

Whether `honestyAtClose` should itself report a default done folder that exists under the repository
but outside its roots is adopter 1's request, recorded as input in
[proposal 017](../../proposals/017-md-blocks-to-check-a-documents-shape.md)'s "Consumer follow-up —
2026-10-20", item (a). It is not this record's fix.

## Fix

Docs only, in `docs/migrating-to-0.15.md`:

- a paragraph, "Narrowing must not drop a closed record", naming the five default done folders, what
  is lost when a root that holds one is removed, and adopter 1's case;
- a one-line check, `git ls-files '*.md' | grep -E '(^|/)(completed|fixed|wont-do|delivered|archived)/'`,
  whose every path must sit under one of the corpus's roots;
- for a lane that writes its state under another label, a second `honestyAtClose` call with that
  label, instead of dropping the lane;
- a pointer to that paragraph from the place the page first advises narrowing.

## Verification

- [x] the page says to keep every lane with a default done folder, and shows how to check
- [x] the check, run on this repository on 2026-10-20, lists 57 tracked records in `work/plans/completed/` and
      144 in `work/bugs/fixed/` (145 once this record is filed there), both under `check:ledger`'s lanes, plus 29 test-fixture files under
      `examples/`, `packages/md/tests/` and `scripts/nonvacuity/`; the page now says fixtures are
      listed and are not records
- [x] the new `ts` fence's import lines resolve: `check:docs-code` green
- [x] `check:corpus` and `format:check` green on the branch

Residual, not deferred work: the check is one an adopter must remember to run. Nothing in
`honestyAtClose` reports a done folder left outside its roots; that mechanism is adopter 1's request,
recorded as input in [proposal 017](../../proposals/017-md-blocks-to-check-a-documents-shape.md)'s "Consumer follow-up — 2026-10-20", item (a), and not planned.

Deferred: none
