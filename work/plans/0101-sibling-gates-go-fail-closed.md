# Plan 0101: Sibling gates go fail-closed — reconcile the family's dogfood gates after the fold

## Status

- **State:** Draft — created 2026-08-12 by splitting
  [plan 0089](./0089-family-standalone-sufficiency.md). 0089 carried four phases
  of which two (the re-export shake-out, the standalone fixtures) are independent
  of the fold and two (this plan's) cannot begin until
  [0088](./0088-fold-ts-archunit-into-eess.md) Phase 4 lands the folded kernel
  seam. 0089 named that itself — _"the dependency is Phase-3-scoped, not
  plan-wide"_ — but naming it is not the same as being closable: as one plan,
  Phases 1–2 would merge and Phases 3–4 would sit open behind another plan's
  phase. Split so each half closes with its own PR.
- **Priority:** High — this is where the fold's central promise reaches the rest
  of the family. Until it lands, `check:corpus` / `check:diagram` /
  `check:crossval` / `check:ledger` can still pass having examined nothing, which
  is precisely the claim-versus-check gap the fold exists to close.
- **Effort:** Medium — the work is judgement, not volume: every silent-empty
  selection the fold surfaces needs a per-case ruling, and the count is unknown
  until the seam is live.
- **Created:** 2026-08-12

## Problem

Once [0088](./0088-fold-ts-archunit-into-eess.md) Phase 4 lands
`collectWithAssertionGuard` in `@nielspeter/eess`, the rule "a check that
examined nothing cannot read as green" reaches every sibling dialect **by
inheritance, not by porting** — verified 2026-08-10: none of eess-md,
eess-mermaid, eess-gherkin, or eess-crossvalidate overrides `collectViolations`;
they consume the kernel through `RuleBuilder` / `correspondence` / their own
builders (`rows`, `docs`, `links`, `pointers`).

So the moment the fold merges, the four sibling dogfood gates start surfacing
silently-empty selections in _their_ rules — exclusions this repo currently keeps
quiet. Each one is a judgement call: declare it empty on purpose, fix the rule, or
declare it in-scope-with-reason. That is exactly the kind of decision that
deserves its own closable item rather than riding on the fold.

0088 stages this deliberately: its sibling obligation is **preservation only**
(the siblings keep compiling, their existing suites keep passing). Nothing opts
them into fail-closed. This plan is the opt-in.

## Approach

Run after 0088 Phase 4 has merged. Turn the seam on for the siblings, classify
everything it surfaces, and file the genuine defects as their own bugs rather than
absorbing them here — a surfaced defect is evidence of the fold working, and each
deserves its own ledger.

## Implementation phases

### Phase 1 — Reconcile the four sibling gates to fail-closed

Run `check:corpus` / `check:diagram` / `check:crossval` / `check:ledger` on the
folded kernel. Classify every surfaced silent-empty selection and every new
fail-closed red:

- **Legitimately empty now but will fill** → declare `.expectEmpty()` — the
  capability the fold hoists onto `TerminalBuilder`, which the siblings never had
  (eess's kernel has no `correspondence().allowEmpty` today; the conversion was
  ts-archunit-internal pre-fork). It expires: it fails the day something matches,
  so a declared emptiness cannot quietly outlive its reason.
- **A rule that should examine units but can't** → fix the rule (a dead selector,
  a wrong glob), or re-home it to in-scope-with-reason with a written reason (the
  dogfooding no-shortcuts invariant).
- **A config finding from the fold** (e.g. a correspondence call that now declares
  emptiness differently) → reconcile the call site.

**Definition of done:** all four sibling gates green on the folded kernel with
**zero baselines and zero silenced rules** — the same no-shortcuts standard 0088
holds for eess-ts. `check:nonvacuity` stays green.

### Phase 2 — File what the honesty surfaces

The fail-closed machinery reaching the siblings for the first time will surface
genuine defects: a sibling rule that examined nothing for months and passed, an
exclusion that silently matched nothing. File each as a bug in the house shape
(`work/bugs/`, next free number), **separately** from the reconciliation. Fixing
them is not this plan's work — each bug closes with its own PR, per
[`BUGS.md`](../bugs/BUGS.md#when-is-a-bug-fixed).

This phase closes when every surfaced defect has a record, not when the defects
are fixed. The distinction is what keeps this plan closable: an unknown number of
unknown bugs cannot ride inside one plan's ledger.

**Definition of done:** every surfaced defect carries a bug number and a row on
[`BUGS.md`](../bugs/BUGS.md); none is tidied away silently.

## Test inventory

- Phase 1: the four dogfood gates green on the folded kernel; `check:nonvacuity`
  green; zero baselines, zero silenced rules. The non-vacuity harness is the proof
  that "green" now means something — each gate must still fail on its committed
  violating fixture.
- Phase 2: each filed bug carries a red reproduction per the house shape. The
  count is itself the measurement — a reconciliation that surfaced _nothing_
  should be treated as suspicious (the seam did not reach the siblings), not as a
  clean bill of health.

## Files changed

- The sibling rule files and dogfood scripts touched by the reconciliation
  (`scripts/check-corpus.mjs`, `check-diagram`, `check-crossval`, `check-ledger`
  and the rule files they load) — per-case, unknown until the seam is live.
- `work/bugs/` — one record per surfaced defect, plus their `BUGS.md` rows.

## Out of scope

- **The fold itself** — [0088](./0088-fold-ts-archunit-into-eess.md).
- **Per-dialect standalone sufficiency and `check:family`** —
  [0089](./0089-family-standalone-sufficiency.md), the other half of this split.
  It is independent of the fold and can land first.
- **Fixing the defects this plan surfaces.** Filing them is the deliverable;
  fixing each is that bug's own PR.
- **Sibling engine features beyond reconciliation** — e.g. md adopting
  `terms()`/`vocabulary()`
  ([proposal 001](../proposals/001-md-corpus-rule-coverage.md)), or any dialect
  gaining new capability from the ported engine. Honest-gate _adoption_ is this
  plan; new _surface_ is a proposal.

## Success definition

- All four sibling dogfood gates run fail-closed on the folded kernel and are
  green with zero baselines and zero silenced rules.
- Every declared emptiness is `.expectEmpty()` — expiring — not a silent pass.
- Every genuine defect the honesty surfaced has its own bug record and its own
  number; none was absorbed into this plan's close.
- `npm run validate` green end-to-end.

## Progress ledger

- [ ] Phase 1 — four sibling gates reconciled to fail-closed, zero baselines
- [ ] Phase 2 — every surfaced defect filed as its own bug
