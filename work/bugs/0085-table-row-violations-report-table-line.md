# Bug 0085: table-row violations report the table's line, not the row's

## Status

- **State:** Draft — root cause located and read directly from the source; no
  red test written yet.
- **Reported:** 2026-08-08 — self-found during the review of
  [proposal 001](../proposals/001-md-corpus-rule-coverage.md), which carries the
  defect as a constraint on future element types ("new element types must not
  inherit that") rather than as a fix.

## Symptom

Every violation from `haveTableRowsSatisfying` — the primitive `adrEnforcement`
composes, and therefore every ADR enforcement-table finding in this repo's own
`check:corpus` — points at the **table's header line** and names the row by
ordinal:

```
adr/003-fluent-builder-dsl.md (Enforcement row 4)   ← "row 4", and the line is the table's
```

An author following the diagnostic lands on the table header and counts rows by
hand. The row's real source line is known and discarded.

## Reproduction

Run `npm run check:corpus` against an ADR whose enforcement table has a bad
tier in, say, its fourth data row. The reported line is the table's start line
for every row in that table, so two violations in different rows of one table
report the same line.

## Root cause

`packages/md/src/conditions/table-rows.ts:42` sets `line: row.table.line` when
building the violation, and `packages/md/src/conditions/table-rows.ts:40`
composes the element name from `row.rowIndex + 1` — an ordinal — instead of the
row's own position.

`MdRow` already carries the right value. It is declared at
`packages/md/src/model/rows.ts:19` with the docstring _"1-based source line of
this row — the exact file:line for diagnostics"_, and it is correctly populated
at `packages/md/src/model/rows.ts:95` from the real mdast row positions
(`MdTable.rowLines`, `packages/md/src/model/document.ts:27`), which exist
precisely so a diagnostic can be exact.

So the data is present, documented as being for this purpose, and then not used
by the one condition that emits row diagnostics.

## Fix

Use `row.line` instead of `row.table.line`, and drop the `row N` ordinal from
the element name now that the line is exact — a two-token change plus the
element string.

Note this **changes the output of a shipped gate** that runs on this repo, so it
is a behaviour change, not a silent refactor: `check:corpus` line numbers move.
That is the point, but it belongs in the changelog.

## Verification

- [ ] Red test written first: two violations in different rows of one table
      assert **different** line numbers — failing before the fix, since both
      report the table's line.
- [ ] Test asserts the reported line equals the row's real source line, not an
      offset or an ordinal.
- [ ] Fix turns them green; `adrEnforcement` findings otherwise unchanged
      (same count, same messages, same rules firing).
- [ ] `npm run check:corpus` still green, with line numbers now pointing at rows.
- [ ] Changelog entry — the gate's output changes.

Deferred: none
