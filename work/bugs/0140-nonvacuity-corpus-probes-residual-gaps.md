# Bug 0140: two residual gaps in the corpus/links and corpus/pointers nonvacuity gates, narrowed but not closed by 0127

## Status

- **State:** Parked — real, narrow, and each independently judged
  non-blocking by the reviewers who found it; recorded so the paragraph
  describing them has an owner outside a closed record, not because either
  is urgent.
- **Severity:** Low — neither is a gate passing over drift present today;
  both are a smaller class of the same repo (probe/root coverage) still
  narrower than what it guards.
- **Origin:** self-found · enforcement + devops review of
  [0127](./fixed/0127-nonvacuity-proves-a-condition-not-a-wired-rule.md)'s fix
  (PR #57)
- **Reported:** 2026-08-14

## Symptom

**1 — probe concurrency surface widened.** Before 0127, `check:nonvacuity`'s
ephemeral probes lived only under `packages/core/src`. Converting
`corpus/links`/`corpus/pointers` to drive the real `scripts/check-corpus.mjs`
moved two more probes into `docs/` and `work/bugs/` — real, git-tracked
`check:corpus` roots also read by `check:fast` (this repo's own recommended
on-save loop), `check:ledger`, and `check:numbers`. `withProbe` still
writes-then-deletes within one call (milliseconds of exposure) and a hard
kill can no longer commit a leftover (`**/__nonvacuity_probe*` is
`.gitignore`d), but a `check:fast` run racing that window can observe a
transient probe and report a spurious violation against a file already gone
by the time anyone looks — a failure mode that could not happen before this
fix, on a repo whose own working pattern is many agents against one checkout.

**2 — `ROOTS` coverage is 2 of 5.** `scripts/check-corpus.mjs:29` scans five
globs (`work/plans/**`, `work/proposals/**`, `work/bugs/**`, `adr/**`,
`docs/**`); the new probes sit in only two of them (`docs/`, `work/bugs/`).
Deleting `work/plans/**`, `work/proposals/**`, or `adr/**` from `ROOTS` would
leave every nonvacuity row green — `unclassifiedRoots`
(`scripts/lib/corpus-link-routing.mjs`) guards _adding_ an unclassified root,
not _removing_ a classified one entirely.

## Root cause

Both are the same shape one level under 0127 itself: the fixture's coverage is
narrower than the surface it's meant to guard. 0127 closed the gap between
"the condition fires" and "the production script's exit code fires" for two
specific rules; it did not extend to "every root the script scans is
represented" or "no other gate can observe the probe mid-flight."

## Why it matters

Neither is a live false green — both were checked. Recorded because a
residual-risk paragraph living inside a closed (`fixed/`) bug record has no
future owner: `check:ledger`'s honesty-at-close grammar accepts any
`deferred→<home>` disposition and has no opinion on whether the home is
itself alive, so a deferral into a frozen record's own prose is honest by the
gate's letter and untracked by its spirit.

## Fix

Not proposed here — both are narrow enough that the proportionate response is
recording them, not immediately re-engineering probe placement or `ROOTS`
self-defense. If either is ever worth closing:

1. **Probe concurrency** — move corpus probes to a location outside every
   `check:corpus` root while still being real files the script would scan
   (not obviously possible without a scoped, temporary root override), or
   accept the risk and document it at the point an agent would hit it
   (`CLAUDE.md`'s `check:fast` recommendation).
2. **`ROOTS` self-defense** — a fixture that plants a probe in each of the
   five roots and asserts the resulting `linksChecked`/`pointersChecked`
   totals cross a floor, or a unit-level assertion on `ROOTS` itself
   (mirroring `bad-corpus-link-routing.mjs`'s treatment of
   `REPO_NATIVE_ROOTS`).

## Verification

- [ ] Red test written first: none — Parked, not being fixed.
- [ ] `npm run validate` green.

Deferred: none — both fix candidates above are out of scope by design (Parked),
not deferred to a home that owes work.
