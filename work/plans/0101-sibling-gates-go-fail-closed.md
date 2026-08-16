# Plan 0101: Sibling gates go fail-closed — reconcile the family's dogfood gates after the fold

## Status

- **State:** Ready — frozen 2026-08-16. Precondition satisfied: plan 0088
  merged to `main` 2026-08-16 (PR #67), so the folded kernel seam is genuinely
  live, not just landed on a branch. Freeze verification: confirmed directly
  that `check:corpus`'s own rule constructors (`docs()`, `links()`,
  `pointers()`, `taskItems()`, `rows()`, `terms()`) all `extends
RuleBuilder<T, Corpus>` and inherit the fold by construction — no
  `.excluding()` calls, no baseline files, anywhere in the sibling dialects.
  One real floor-crack found and resolved by folding it into Phase 1 rather
  than leaving the plan's own success bar unachievable:
  [bug 0131](../bugs/fixed/0131-honesty-at-close-bypasses-the-builder-dsl.md)
  (`check:ledger`'s `honestyAtClose` structurally cannot inherit the fold —
  confirmed by reading `packages/md/src/rules/ledger.ts` directly) is now
  explicitly this phase's own scope, not a silent gap. No other open
  question or TBD found in the text. Created 2026-08-12 by splitting
  [plan 0089](./0089-family-standalone-sufficiency.md). 0089 carried four phases
  of which two (the re-export shake-out, the standalone fixtures) are independent
  of the fold and two (this plan's) cannot begin until
  [0088](./completed/0088-fold-ts-archunit-into-eess.md) Phase 4 lands the folded kernel
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

Once [0088](./completed/0088-fold-ts-archunit-into-eess.md) Phase 4 lands
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

Run after 0088 Phase 4 has merged — **satisfied**: 0088 merged to `main`
2026-08-16 (PR #67). Turn the seam on for the siblings, classify
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

**Pre-existing gap folded into this phase, found at freeze (2026-08-16):**
`check:ledger`'s `honestyAtClose` preset (`packages/md/src/rules/ledger.ts`)
cannot inherit the fold at all — confirmed by reading it directly: it imports
only `finishPreset` from the kernel and hand-iterates the corpus with raw
`for` loops, never touching `RuleBuilder`/`TerminalBuilder`. The other three
gates' rule constructors (`docs()`, `links()`, `pointers()`, `taskItems()`,
`rows()`, `terms()`) all genuinely `extends RuleBuilder<T, Corpus>` and
inherit the fold by construction — confirmed the same way. This is exactly
[bug 0131](../bugs/fixed/0131-honesty-at-close-bypasses-the-builder-dsl.md)'s
finding, filed 2026-08-12. Without resolving it, "all four sibling gates
fail-closed" would not be an achievable bar — `check:ledger` was structurally
exempt, not passing. Bug 0131 named the two honest resolutions (express
`honestyAtClose` through the DSL if the State-region analysis fits as a
predicate/condition pipeline; or record the departure explicitly with a
compensating non-vacuity fixture if it doesn't). This phase made that
decision and implemented it — bug 0131 closes with this phase's PR, named
here rather than deferred a second time. See "Done, 2026-08-16" below for the
resolution.

**Definition of done:** all four sibling gates green on the folded kernel with
**zero baselines and zero silenced rules** — the same no-shortcuts standard 0088
holds for eess-ts. `check:nonvacuity` stays green.

**Done, 2026-08-16.** `check:corpus` / `check:diagram` / `check:crossval` needed
no reconciliation — their rule constructors already `extends
RuleBuilder<T, Corpus>` (confirmed at freeze) and were already green with zero
baselines and zero `.excluding()` calls; the fold reaches them by construction.
`check:ledger`'s `honestyAtClose` (`packages/md/src/rules/ledger.ts`) was the
one real gap, resolved by fix (1) from bug 0131: expressed through the
`docs()`/`taskItems()` builder DSL rather than raw corpus iteration, closing
bug 0131. Spiked first against a synthetic fixture before touching the real
file, per house discipline — the DSL approach was proven byte-identical to the
old hand-rolled output before being adopted.

**A first version of this fix shipped, then failed its own review.** Before
committing, a six-persona `/review` (architect · product · devops · customer ·
testing · enforcement — mandatory for a change to this repo's own gate code)
ran against the staged diff and surfaced two Critical findings, both verified
directly against the code before being accepted: (1) a corpus with only board
documents (the shape `kit/`'s own bootstrap produces on day one) false-
positived on `headerViolations`, with no way for a caller to declare it
legitimate; (2) the two done-item rules' `.expectEmpty()` was gated on a
`.select()` peek of their _own_ filtered selection — proven, from
`RuleBuilder.select()`'s own source, to be self-referential: the peek and the
real run filter identical elements through identical predicates with nothing
in between, so the declaration could never expire and provided zero
protection against the corruption class it existed to catch. Both were fixed
before merge: `headerViolations` gained an explicit, expiring
`expectEmptyHeaders` option; the two done-item rules were re-gated on
independently-computed peeks (`isDoneItem` called directly rather than via
`belongsToADoneItem`; the shared `DEFERRED_DISPOSITION_RE` constant re-tested
via a different traversal rather than via `hasDeferredDisposedBox`) — narrow
enough to still avoid false-positiving on a done item with nothing
outstanding (the common, healthy case an intermediate, coarser attempt broke),
while genuinely independent of the predicate each rule protects. Full detail
in [bug 0131](../bugs/fixed/0131-honesty-at-close-bypasses-the-builder-dsl.md)'s
own Fix/Verification sections.

Regression-tested against `ledger.test.ts` (40 tests — 36 original + 4 added by
this review round), the full `packages/md` suite, and the real repo corpus
(byte-identical violation output: 35 plans/24 done, 55 bugs/21 done, 5
proposals/0 done, 0 findings, before and after).

**Sabotage-verified, both directions, both caught.** Deliberately broke three
different predicates inside the rewritten rule:

- Sabotaging `notBoardFile` (gates `headerViolations`) — **caught**, 3
  "examined zero units" findings across all three lanes.
- Sabotaging `belongsToADoneItem` (gates `silentOpenBoxViolations`) — **caught**:
  the independent `isDoneItem`-direct peek doesn't share the corruption.
- Sabotaging `hasDeferredDisposedBox` (gates `deferredLieViolations`) — **caught**:
  the independent `DEFERRED_DISPOSITION_RE`-over-`openTaskItems` peek doesn't
  share the corruption either.

All three are genuine, new protection `honestyAtClose` never had before — the
old hand-rolled version would have silently iterated zero (or wrongly-filtered)
elements and returned `[]`, green, in every case.

**A second six-persona `/review` round — re-reviewing the fix, not the
original bug — found the round-1 fix still incomplete in two ways, both
Critical, both fixed before merge.** (1) `deferredLieViolations`'s new peek
had zero durable coverage: `scripts/nonvacuity/bad-ledger.mjs`'s corpus had no
`deferred→<home>` box anywhere, so sabotaging `hasDeferredDisposedBox` still
left that fixture reporting "gate proven" — its only real protection was this
repo's own live corpus incidentally carrying a deferred box, which would
silently vanish the day that box got resolved. Fixed: the fixture gained a
permanent deferred-box case (and a clean counterpart), `ledger/deferred-lie`
joined its `RULES`, and a new `corpus/ledger/deferred-lie` nonvacuity row.
(2) The "one residual gap" claim above (corruption of `isDoneItem`) was
independently proven, by two reviewers reading the code, to be worse than
documented: `headerStateCondition` never calls `isDoneItem` — it recomputes
the folder half of the same determination inline — so the claimed
`headerViolations` backstop only fires if a live mismatch already exists in
the corpus, which it usually doesn't. Sabotaging `isDoneItem` directly against
this repo's real corpus confirmed the consequence: **zero violations, exit
0** — every peek and every real selection agreed "nothing to examine"
simultaneously, with only a non-gating stderr warning as a trace.
`honestyAtClose` can't close this generically (a corpus can legitimately have
zero done-items on its first day — the same tension `expectEmptyHeaders`
exists for), so the fix lives at the caller level: `scripts/check-ledger.mjs`
now hard-fails on 0 done-items summed across every lane, since this repo has
carried done-items in every terminal-states lane for its entire history and
that state is never legitimate here. Re-sabotaging `isDoneItem` after the fix
confirmed `check:ledger` now exits 1. Both fixes, and the corrected docstring,
are detailed in
[bug 0131](../bugs/fixed/0131-honesty-at-close-bypasses-the-builder-dsl.md)'s
own Fix/Verification sections.

Backed by committed regression, not just hand-verification: `ledger.test.ts`
gained describe blocks for the `headerViolations` dead-selector guard (default,
`expectEmptyHeaders`-suppressed, and expiring) and for the done-item-with-
nothing-outstanding false-positive case; `scripts/nonvacuity/bad-ledger-dead-selector.mjs`
proves the `headerViolations` guard through the real `check:ledger` gate;
`bad-ledger.mjs` now proves `ledger/deferred-none-lie` against a permanent
fixture instead of an incidental one.

**A third six-persona `/review` round — re-reviewing round 2's fix — found the
`doneVacuous` sum-across-lanes design was itself the wrong check**: sabotaging
`isDoneItem` scoped to only the `bugs/` lane left the sum nonzero (from
`plans/`) and the check never tripped, silently excluding `bugs/`'s 21 real
done-items from every finding that lane could produce. Fixed by checking each
lane independently (`findLaneDoneVacuity`, `scripts/lib/lane-coverage.mjs`,
modeled on the file's own existing `findUncoveredLanes`), producing a real
`ArchViolation` per vacuous lane rather than a side boolean — which also fixed
a second round-3 finding as a direct consequence: `--format json`/`github`
previously emitted nothing at all on a `doneVacuous` failure, now carrying the
same payload the terminal format does. `scripts/nonvacuity/bad-lane-done-vacuous.mjs`
(new) proves the per-lane check fires on a vacuous lane and correctly skips a
healthy one, a structurally-exempt one, and a lane declaring
`expectEmptyDone: true` (the round-1-style escape hatch this check needed too)
— all in one fixture. Re-sabotaged the `bugs/`-only corruption after the fix
and confirmed `check:ledger` now correctly names the `bugs` lane, in all three
output formats — 37 nonvacuity fixtures total, up from 34 at round 1's start.

`npm run validate` green end-to-end, including `check:release` (changeset
`ledger-inherits-the-evidence-gate.md`, headed `Breaking` per this repo's own
precedent for this class of change, for `@nielspeter/eess-md`) and
`check:nonvacuity`.

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

**Done, 2026-08-16 — two defects surfaced, both filed.** Turning on the fold's
fail-closed seam for all four sibling gates found no pre-existing
silent-empty selection or dead selector anywhere in the real corpus:
`check:corpus` / `check:diagram` / `check:crossval` were already zero-baseline;
`check:ledger` produced the same 0-finding output before and after its
reconciliation. Per this phase's own test inventory, a reconciliation that
surfaces nothing is suspicious unless the seam is proven to have actually
reached the siblings — Phase 1's sabotage tests are that proof, and now cover
all three of `check:ledger`'s rule lanes (not just one, after this phase's own
review rounds corrected the two that were previously unprotected):
deliberately breaking `notBoardFile`, `belongsToADoneItem`, and
`hasDeferredDisposedBox` in turn were each caught by the fold's zero-examined
guard, so the seam is demonstrably live across the whole preset, not inert or
partial.

What the honesty _did_ surface came from reviewing the reconciliation's own
fix, not from the corpus: a second six-persona `/review` round found the
round-1 `check:ledger` fix left a discoverability gap
([0151](../bugs/0151-honesty-at-close-options-undiscoverable-past-source.md) —
`expectEmptyHeaders` and `honestyAtClose`'s calling convention are
undocumented past source) and a recurrence gap
([0152](../bugs/0152-no-guardrail-against-hand-rolled-presets-recurring.md) —
nothing stops a future dialect preset from repeating bug 0131's exact
pattern). Neither is a corpus finding this phase's charter asks for, but both
are genuine, separately-closable defects the honesty-at-close work itself
produced, filed rather than folded into this plan's own close — the same
`work/bugs/`, next-free-number discipline this phase's Definition of done
names.

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

- **The fold itself** — [0088](./completed/0088-fold-ts-archunit-into-eess.md).
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

- [x] Phase 1 — four sibling gates reconciled to fail-closed, zero baselines
- [x] Phase 2 — every surfaced defect filed as its own bug: zero _corpus_-surfaced
      (proven not-vacuous by Phase 1's sabotage tests, not just an absence of
      findings); two _review_-surfaced (0151, 0152), both filed
