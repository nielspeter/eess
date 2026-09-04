# Bug 0255: an exclusion directive inside a table cell is silently inert

## Status

- **State:** Draft — measured, not built.
- **Severity:** Medium — a well-formed sanction that does nothing and says
  nothing. The author sees the violation still firing and gets no explanation,
  so the natural next move is to delete the content rather than sanction it. The
  gate stays correct; the escape hatch is what fails, silently.
- **Origin:** self-found · review of
  [0249](./fixed/0249-most-of-work-is-outside-every-corpus-root.md), where
  removing a pointer from a table was the only option that worked — and doing it
  split the table (see that record's own fallout).
- **Reported:** 2026-09-04

## Symptom

`<!-- eess-exclude <rule-id>: reason -->` grants the **next line** only. Inside a
GFM table there is nowhere to put it that both works and leaves the table intact.

**Measured 2026-09-04**, four placements against a live `work/` document
carrying a pointer that reds:

| placement                                       | suppressed?             | table survives?           |
| ----------------------------------------------- | ----------------------- | ------------------------- |
| own line, immediately above a **prose** pointer | yes                     | n/a                       |
| own line, one blank line above                  | no                      | n/a                       |
| **trailing inside the table cell**              | **no — and no warning** | yes                       |
| own line **inside the table**                   | yes                     | **no — splits the table** |

The third row is the defect. The directive is well-formed, correctly spelled,
names a real rule id, and is inert. Nothing tells the author it cannot work
there — not a malformed-directive warning, not an unused-exclusion report.

The fourth row is the trap that follows from it: the placement that _does_ work
turns one table into a table plus a paragraph of pipe characters. GFM stops
seeing a table, and `prettier --check` passes, because a headerless pipe block is
just a paragraph with nothing to align. That is not hypothetical — it is exactly
what happened while fixing 0249, and no gate caught it.

## Reproduction

```markdown
| Rule | Raw                                                                          | Disposition |
| ---- | ---------------------------------------------------------------------------- | ----------- |
| a    | `src/nope.ts:12` <!-- eess-exclude corpus/pointers-resolve: illustrative --> | x           |
```

`npm run check:corpus` → the pointer violation fires. The directive is not
reported as unused, misplaced or malformed.

## Root cause

Two mechanisms that are each individually right:

- the directive's scope is **next-line**, deliberately narrow so a sanction
  cannot silently cover a region;
- markdown tables put every cell on one physical line, so "the next line" is the
  next table row.

Neither is wrong. The gap is that their intersection has no feedback: an
exclusion that matches no violation is not surfaced, so a directive in a place
it can never apply is indistinguishable from one whose violation was fixed.

## Fix (not built)

The cheap, high-value half: **report a directive that never applied.** An unused
exclusion is worth surfacing on its own merits — it is how a stale sanction
outliving its violation gets found — and it makes this defect self-announcing
rather than silent. That is one report channel, no new syntax, and it is the
piece that turns "inert" into "told you".

The expensive half — making a same-line or in-cell sanction actually work — is a
scope change to the directive and should not be taken just for tables. Decide it
separately, and only if the report above shows people reaching for it.

Not in scope, and worth saying: widening the scope to a region is already
available as `eess-exclude-start` / `eess-exclude-end`, which does work around a
table.

## Verification

- [ ] A directive that applies to no violation is reported, with its file, line
      and rule id.
- [ ] Asserted on a directive inside a table cell specifically, since that is the
      placement with no other feedback.
- [ ] A `check:nonvacuity` row, or the report is a claim rather than a check.
- [ ] The report does not fire on `eess-exclude-start`/`-end` regions that
      legitimately cover a violation-free span.

## Related

- [0249](./fixed/0249-most-of-work-is-outside-every-corpus-root.md) — hit this
  while removing a pointer from `work/dogfood-coverage.md`; the removal split the
  table, which review caught and the commit repaired.
- [0254](./fixed/0254-an-ambiguous-pointer-passes-and-is-counted-as-grounded.md) —
  many of the pointers an author would want to sanction are bare filenames in
  tables, which is where this does not work.
