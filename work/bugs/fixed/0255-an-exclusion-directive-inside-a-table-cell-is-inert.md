# Bug 0255: an exclusion directive inside a table cell is silently inert

## Status

- **State:** Fixed — a directive that cannot apply now prints why, with the
  remedy. Two causes, one report channel; the expensive half (changing the
  directive's scope) is still not taken and still should not be.
- **Severity:** Medium — a well-formed sanction that does nothing and says
  nothing. The author sees the violation still firing and gets no explanation,
  so the natural next move is to delete the content rather than sanction it. The
  gate stays correct; the escape hatch is what fails, silently.
- **Origin:** self-found · review of
  [0249](./0249-most-of-work-is-outside-every-corpus-root.md), where
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

## A second cause, found before this was built

Filed for the table-cell case. Reviewing [0254](./0254-an-ambiguous-pointer-passes-and-is-counted-as-grounded.md),
an adopter lens found the same symptom by a different route: **a chain with no
`.rule({ id })` has no rule id, and a comment matches a violation by rule id.**
So `pointers(c).that().areLive().should().resolve().check()` — the form
`packages/md/README.md` itself showed — could never honour a sanction. Worse
than the table case: the whole exclusion scan was gated on having an id, so the
file was not even parsed. Nothing could have noticed.

That one is _provably_ inert rather than merely unmatched, which is why it gets a
remedy naming the exact call to add rather than a hedge.

## Fix

**The precedent was already in the same function.** `applyFilters` has warned
since bug 0044 that an `.excluding()` pattern matching zero violations "may be
stale after a rename". Comment directives had no equivalent. This gives them the
one the chain form already had — no new syntax, no scope change.

Two reports, both stderr:

- **No rule id** — names the directive's file and line and the exact
  `.rule({ id: '...' })` to add.
- **Suppressed nothing** — names the directive and says why it may be out of
  reach (next-line scope; inside a table that is the next row), pointing at
  `eess-exclude-start`/`-end` for a region.

Scoped to the running rule's own id, so a file carrying directives for several
rules does not report each one once per rule.

**Why stderr and not a finding.** The violation the directive failed to cover is
already firing, so the build is red and the author is looking at it. The
diagnostic explains why their waiver did nothing. This is the weight the file's
own doctrine already assigns the `malformed` case, for the same reason. An
`undocumented` directive is different — it _applies_, so it hides a real finding,
and that one is promoted to an unsuppressable violation.

**The expensive half is still not taken, and still should not be.** Making a
same-line or in-cell sanction actually work is a scope change to the directive.
Widening to a region is already available as `eess-exclude-start`/`-end`, which
works around a table. Decide the scope change separately, and only if this report
shows people reaching for it.

**One boundary, pinned rather than left to be discovered.** Directives are only
read in files that already produced a violation — the gate that keeps this cheap.
So a sanction in a clean file is never seen, which is what makes the "does not
fire on a violation-free region" requirement below hold _by construction_ rather
than by a special case. The other side of that line is reported: a region
covering nothing in a file that did fail is a stale sanction, by the same
reasoning as a stale `.excluding()` pattern.

## Verification

- [x] A directive that applies to no violation is reported, with its file, line
      and rule id — asserted on all three, not on the presence of any warning.
- [x] Asserted on a directive inside a table cell specifically: the
      `check:nonvacuity` row plants exactly that shape.
- [x] `check:nonvacuity` row `corpus/exclusion-inert` over the production script
      (74 → 75). It asserts **both** halves — the diagnostic is printed _and_ the
      violation still fires — because a change that made the in-cell directive
      genuinely suppress would satisfy a diagnostic-only check by accident.
      Sabotage-measured: dropping the report takes the diagnostic count to 0.
- [x] The report does not fire on `eess-exclude-start`/`-end` regions covering a
      violation-free span. **It holds by construction** — a clean file is never
      parsed — and is asserted rather than assumed, alongside a test pinning the
      other side of the boundary (a stale region in a file that _did_ fail is
      reported, on purpose).
- [x] The second cause found in review — no `.rule({ id })` — is reported with
      the exact call to add, and `docs/violation-reporting.md` now documents both
      causes where the prerequisite is stated.

Deferred: none.

## Related

- [0249](./0249-most-of-work-is-outside-every-corpus-root.md) — hit this
  while removing a pointer from `work/dogfood-coverage.md`; the removal split the
  table, which review caught and the commit repaired.
- [0254](./0254-an-ambiguous-pointer-passes-and-is-counted-as-grounded.md) —
  many of the pointers an author would want to sanction are bare filenames in
  tables, which is where this does not work.
