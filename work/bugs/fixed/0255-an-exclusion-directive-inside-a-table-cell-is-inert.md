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

## What review found

Seven lenses. Two Criticals, both real, and both in the half of the fix that was
added late.

**The no-id report was unscoped, and its advice was actively harmful.** It named
each directive's own rule id and told the reader to add `.rule({ id: <that id> })`
— but from inside one rule's run there is no way to know that id is unclaimed.
Product and enforcement independently reproduced the same case: a directive
correctly waiving `other/rule`, in a file where an id-less rule also fired,
produced advice to claim `other/rule` for the id-less rule. Nothing enforces id
uniqueness, so following it would collide two rules onto one id. The sibling
branch had a scoping filter _and_ a CONTROL test; this one had neither, and the
asymmetry had no witness. It now states the fact, once per file, and prescribes
no id.

**The core of the fix had no test, and the CONTROL written to guard it was
vacuous.** Deleting the `spent` tracking makes every _working_ directive report
"suppressed nothing" — and all six tests stayed green, because the CONTROL's
regex looked for "never applied", "declares no id" and "matched zero", none of
which that report emits. Testing measured it: the mutation produced two bogus
warnings against legitimately-working directives in this repo's own corpus.

**Then the same mistake a third time, found by my own sabotage run.** The CONTROL
for "a directive for a different rule is not reported" grepped for the _other_
rule's id — but the report names the _running_ rule, so that string never appears
even when the scoping is removed. Three commits, three assertions written against
strings the implementation does not emit. The pattern is always the same, and
noticing it is worth more than the three fixes.

**The fixture covered one cause of two.** Deleting the entire no-id block left
`corpus/exclusion-inert` green — on the cause this record calls the worse one.
`corpus/exclusion-inert/no-id` now covers it, and is honest that it is
module-level: every gate here calls `.rule({ id })`, so there is no id-less
production caller to probe.

**One Critical rejected.** Method reported the fixture count as 76 → 77 rather
than 74 → 75, measured from `gates.length`. That array includes two self-check
rows the harness deliberately excludes from its denominator — its own comment
says counting them "would inflate the denominator — the exact over-claim this
harness exists to prevent". The printed figure is the harness's self-report and
is what the record cites.

Also from review: `packages/ts/src/core/orphan-exclusions.ts` documented this
exact gap as one it could not close and estimated the cost at "a parse per file
per rule"; the fix came in under that estimate and left the docstring claiming a
gap that no longer exists. Corrected, and narrowed to what that module still
uniquely covers — a directive in a file that produced no violation, which the
enforcement path structurally never reads.

### The Critical that came last, and mattered most

Architecture and devops, independently: **the fix never reached `eess-ts`.**
`packages/ts/src/core/execute-rule.ts` is a full independent fork of the kernel's
`applyFilters` — `terminal-builder.ts` imports from the local copy, not from
`@nielspeter/eess` — and it still carried `if (ctx.metadata?.id && result.length > 0)`
verbatim. Zero hits for either new diagnostic. There was even a passing test in
that package certifying the old behaviour, with a comment reading "applyFilters
never stamps or scans".

So the fix was real for `eess-md`, `eess-mermaid` and `eess-gherkin`, and absent
from the dialect adopters actually install — while the commit message, the
changeset and `docs/violation-reporting.md` all said "eess now prints…" with no
scoping. A false green on this record's own terms.

This is a named, recurring defect class, not bad luck:
[plan 0188](../../plans/0188-unify-the-duplicated-engine-modules.md) lists
`execute-rule` among 27 duplicated modules and records three prior incidents of
a fix landing on one copy while nothing noticed; ADR-012 documents the same
shape one layer down. `check:family`, `check:arch` and `check:nonvacuity` all
pass either way — they check re-exports and one-sided behaviour, not cross-copy
parity, exactly as 0188 warns. **This would have been the fourth incident.** Both
diagnostics are now in both copies, the ts side has its own test, and its stale
comment says what changed.

### And one the probe itself reopened

Devops: `check:integrity`'s leftover-probe sweep matches on **file** basename,
but `withProbeDir` puts the prefix on the **directory**. Measured: two leftover
probe directories present, `check:integrity` exit 0, `git status` silent because
`.gitignore` covers them — [bug 0231](./0231-a-killed-nonvacuity-run-leaves-an-invisible-probe-that-reds-other-gates.md)'s
blind spot, reopened by the fixtures that adopted `withProbeDir` (including one
already on `main`). The sweep now walks directories too, through its own walker:
the first attempt changed the shared one and broke the source-text scan with
`EISDIR`, which is why there are two.

### A fourth vacuous assertion, caught by sabotage rather than by review

The test added for the reason-free case asserted `/reason/i`, which matched other
text and passed under the very mutation it existed to catch. Tightened to the
literal the warning emits. That is four across four commits, and the only one
found before review — which is the direction it needs to keep moving.

## Verification

- [x] A directive that applies to no violation is reported, with its file, line
      and rule id — asserted on all three, not on the presence of any warning.
- [x] Asserted on a directive inside a table cell specifically: the
      `check:nonvacuity` row plants exactly that shape.
- [x] `check:nonvacuity` rows `corpus/exclusion-inert` (production script) and
      `corpus/exclusion-inert/no-id` (module-level, because no gate here runs
      without an id). Two rows because review measured that one covered one
      cause: deleting the whole no-id block left the first row green. It asserts **both** halves — the diagnostic is printed _and_ the
      violation still fires — because a change that made the in-cell directive
      genuinely suppress would satisfy a diagnostic-only check by accident.
      Sabotage-measured: dropping the report takes the diagnostic count to 0.
- [x] The report does not fire on `eess-exclude-start`/`-end` regions covering a
      violation-free span. **It holds by construction** — a clean file is never
      parsed — and is asserted rather than assumed, alongside a test pinning the
      other side of the boundary (a stale region in a file that _did_ fail is
      reported, on purpose).
- [x] The second cause — no `.rule({ id })` — is reported **without prescribing
      an id**, because a directive in the file may belong to another working
      rule. Pinned by a test that asserts the borrowed id is absent while the
      report still fires, and by the fixture, which fails if either half breaks.
- [x] Every assertion is against a string the implementation actually emits.
      Three were not, across three commits; the sabotage matrix that found the
      third is in the record above.
- [x] `packages/ts/src/core/orphan-exclusions.ts` no longer claims a gap this
      closed, and says what it still uniquely covers.
- [x] **Both copies of `applyFilters` carry both diagnostics** — the kernel's and
      `eess-ts`'s fork — each with its own test, and the ts test that certified
      the old behaviour says what changed. A fix in one copy only is this repo's
      named recurring defect (plan 0188); it would have been the fourth.
- [x] `check:integrity` names a leftover probe **directory**, not only a probe
      file. Measured both ways: clean exits 0, a planted directory exits 1 and is
      named.

Deferred: none.

## Related

- [0249](./0249-most-of-work-is-outside-every-corpus-root.md) — hit this
  while removing a pointer from `work/dogfood-coverage.md`; the removal split the
  table, which review caught and the commit repaired.
- [0254](./0254-an-ambiguous-pointer-passes-and-is-counted-as-grounded.md) —
  many of the pointers an author would want to sanction are bare filenames in
  tables, which is where this does not work.
