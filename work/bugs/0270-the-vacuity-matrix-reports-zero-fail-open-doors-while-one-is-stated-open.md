# Bug 0270: `check:vacuity` reports zero fail-open doors while one is stated open

## Status

- **State:** Draft — found by a release/operations review of PR #118, verified
  against the classification source.
- **Severity:** Medium — an instrument that answers the wrong question with a
  reassuring number. Not a false green in a _rule_; a false green in the gate
  whose entire job is auditing which published doors can pass without evidence.
- **Origin:** self-found · devops review of PR #118 (plan 0263 Phase 2)
- **Reported:** 2026-09-07

## Symptom

`npm run check:vacuity` prints, at HEAD:

```
✓ vacuity matrix — 22 exports probed (11 builders + 6 presets + 5 emitters),
  0 tracked KNOWN_FAIL_OPEN entries, 0 unaccounted fail-open
```

At the same commit, the repo ships **two** exported `collectViolations`
functions — `packages/core/src/index.ts` and `packages/ts/src/index.ts` — which
are documented, in their own docstrings and in `docs/core-concepts.md`, as
bypassing the evidence gate. Plan 0263 Phase 2 states that residual deliberately
rather than closing it, and ADR-014's ceiling row names both.

So the changelog tells an adopter "four doors closed, one stated open" while the
CI line an operator reads says no fail-open door exists.

## Root cause

Both symbols sit in `NOT_CHECKS` in
`packages/ts/tests/matrix/vacuity-classification.ts` — the bucket for "nothing
you can call `.check()` on". That is literally true of both (one returns an
array, the other throws), so nothing is misfiled by the list's own rule. The
problem is that the rule sorts by _shape_ and the headline sorts by _risk_:
`0 unaccounted fail-open` reads as a statement about every published door, and
its denominator is only the constructors the matrix probes.

`KNOWN_FAIL_OPEN` in `packages/ts/tests/matrix/vacuity-matrix.test.ts` is the
register built for exactly this — named, dated, expiring debt — and it holds one
unrelated entry. The case it was designed for is not in it.

`.:checkAll`'s entry has a second problem, and this branch caused it: `checkAll`
became an emitter door with a gate in plan 0263 Phase 2, so "nothing you can
call `.check()` on" is now the wrong reason for excluding it, even though the
exclusion may still be right.

## Why it matters

`docs/manifesto.md` and ADR-009 both rest on the claim that eess does not report
a pass it cannot justify. `check:vacuity` is the instrument that audits that
claim about eess's own surface. An audit whose scope is narrower than its summary
line is the same shape as a rule that examined nothing and reported green — the
defect the matrix exists to find, in the matrix.

## A second instance, measured 2026-09-08

`EMITTER_PROBES` has no falsifier of its own. A QA sabotage matrix on plan 0263
Phase 3 deleted the sixth entry — the one covering `emitter/source-empty` — and
**nothing reddened**: `check:vacuity` simply reported 22 exports instead of 23,
`check:nonvacuity`, `check:corpus` and `check:crossval` all stayed green.

That is the same shape as the headline symptom, one layer in: the matrix's
summary line is a count of what it happened to probe, and shrinking the probe set
shrinks the denominator rather than failing. Phase 3's own fixture asserts its
case list against the kernel's `EMITTER_IDS` in both directions for exactly this
reason; `EMITTER_PROBES` has no equivalent, so an emitter id can lose its probe
silently.

Whichever fix this record takes should cover it: the probe set is derivable from
`EMITTER_IDS` the same way, and asserting that correspondence is cheaper than
maintaining the list by hand.

## Fix

Not decided. The cheapest honest shape is two moves:

1. Add both `collectViolations` symbols to `KNOWN_FAIL_OPEN` as dated entries
   pointing at [proposal 011](../proposals/011-core-name-the-evidence-gate.md)
   ask C, so the summary line reads `2 tracked` instead of `0` and the debt
   expires on a version like every other entry.
2. Re-reason `.:checkAll` — either probe it as an emitter door, or keep it
   excluded with a reason that is true after Phase 2.

The larger question — whether the matrix should classify by shape or by "can
this return a verdict" — is the real design decision and should be argued before
either move is made permanent.

## Verification

- [ ] Red test first: with the entries added, removing one makes the audit red
      rather than silently shrinking the denominator.
- [ ] `check:vacuity`'s summary line distinguishes "probed and non-vacuous" from
      "not probed".
- [ ] `.:checkAll`'s exclusion reason is true of the code after plan 0263.

Deferred: none.

## Related

- [Proposal 011](../proposals/011-core-name-the-evidence-gate.md) — ask C owns
  the decision about `collectViolations` itself; this record is about the
  instrument that cannot see it.
- [Plan 0263](../plans/0263-adr-014s-residual-enforcement-rows.md) — Phase 2
  stated the residual and made `.:checkAll`'s exclusion reason stale.
- [0268](./0268-doctor-gives-a-clean-bill-to-a-builder-that-enforces-nothing.md)
  and [0269](./fixed/0269-eess-mermaids-check-door-greenlights-a-builder-that-enforces-nothing.md)
  — the other two doors Phase 2 measured and filed rather than closed.
