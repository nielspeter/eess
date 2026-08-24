# Plan 0150: Close plan 0088's disclosed-but-unfiled review findings

## Status

- **State:** Ready — frozen 2026-08-16. **Freeze verification found three of
  the four remaining findings were already resolved, incidentally, by 0088's
  own later phases** — the same pattern this plan's own Problem section
  already names for `diagnose()` (resolved incidentally by unrelated plan
  0147, "untracked back to this finding until now"). Verified directly
  against the current code, not assumed from the plan's own prose:
  - **Finding 2 (`CorrespondenceBuilder.assertsCardinality()` class-wide)
    — already fixed.** `packages/core/src/correspondence.ts:155-158`
    (not `correspondence-builder.ts` — that file doesn't exist; the plan's
    original citation was stale, corrected here) scopes it per-check exactly
    as asked: `this._checks.length === 0 ? false : this._checks.every(check
=> checkAssertsCardinality(check))`. The docstring above it (lines
    141-153) cites ADR-010 directly and states the identical rationale this
    plan's own Phase 1 gave. Built by 0088 Phase 6, per
    `packages/core/tests/contract/extension-surface.test.ts`'s own docstring
    (below) dating that phase.
  - **Finding 3 (`.expectNonEmpty()` behavioral no-op) — already fixed.**
    `packages/core/src/terminal-builder.ts:254`:
    `if (this._expectEmpty === false) return [...violations,
this.unmetExpectNonEmptyViolation()]` — a real, distinct assertion, not
    silent nothing. `unmetExpectNonEmptyViolation()` (line 329) is a genuine
    violation constructor with its own message.
  - **Finding 4 (`.because()`/`.excluding()` no direct kernel test coverage)
    — already fixed.** `packages/core/tests/contract/extension-surface.test.ts`
    (new since this plan's own citation of "no `rule-builder.test.ts`" —
    confirmed that file now exists, built as "plan 0088 Phase 6") directly
    exercises the base `TerminalBuilder`/`RuleBuilder` extension surface
    against a fictional "stranger dialect," including the exact "bug 0016"
    copy-on-write independence test this plan's own Phase 3 asked for
    verbatim: `'copy() independence: a held selection is not mutated by
.because() — the "bug 0016" contract'` and `'named-selection reuse
across two branches does not leak conditions (bug 0016, RuleBuilder
side)'`.
  - **Finding 1 (`orphanExclusions()`) — still genuinely open, confirmed
    twice over.** Zero hits anywhere in `packages/*/src` (unchanged since
    this plan was drafted). Independently confirmed by unrelated plan 0147's
    own text: explicitly surveyed and **deliberately deferred a second time**
    ("`orphan-exclusions.ts` itself, which was already deferred pending
    `diagnose.ts` existing — it can be revisited now that this does, but
    wasn't attempted this batch"). Two independent plans naming the same gap
    and declining to close it is exactly the kind of item that needs its own
    home rather than a third silent deferral.

  This plan's scope narrows to that one remaining item — the three resolved
  findings are recorded above as history, not carried forward as this plan's
  own work. See Implementation for the single remaining phase.

  **Phase 4 attempted 2026-08-18 and backed out unbuilt.**
  `orphanExclusions()` was ported and wired into `doctor`, then reverted
  before commit when a three-persona review found it unusable: the port
  carried ts-archunit's soundness claim ("Sound because
  `parseExclusionComments` only ever removes directives when blanking
  literals") into a kernel whose parser does no blanking, giving a measured
  14/14 false-positive rate against this repo, and it crashed on
  mixed-dialect rule files (`doctor spec.rules.ts`). The parser gap is a live
  suppression hole in its own right and is now
  [bug 0154](../bugs/fixed/0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md)
  (`High`); **Phase 4 is blocked on it.** Three lessons owed on resume:
  1. **Port from the source's test list, not its implementation.**
     ts-archunit pairs the unit test with a **dogfood** test (its own
     `tests/archunit/arch-rules.test.ts`, in the `afterAll` block — a
     separate checkout as of 2026-08-18, so not cited as a `path:line`
     pointer) that runs the function over its own `src/` and asserts `[]` by
     identity. That test's comment records why it exists: _"We shipped
     `orphanExclusions` to catch it, and then exercised it only in its own
     unit test."_ The attempt ported the unit test and left the dogfood
     behind — repeating the exact mistake the source had already made and
     written down. Both criticals would have died on its first run.
  2. **`doctor` is not in `validate`, so a green chain is no evidence here.**
     The attempt cited "`npm run validate` green throughout" as its closing
     evidence; that run executed zero lines of the new code. Phase 4's
     acceptance must include one real invocation against this repo's corpus.
  3. **Placement.** Review's architect lens argued the audit core (union the
     declared ids → diff → advise) belongs in the **kernel**, with only
     source enumeration in eess-ts — which also dissolves the crash, since a
     kernel signature never mentions `ArchProject`. Decide this before
     rebuilding rather than restoring the eess-ts shape by default.

- **Priority:** Medium — not a live, present-day defect with a known trigger;
  a real gap that would bite whoever next needs `orphanExclusions()`'s class
  of audit (a rule with an `.excluding()` entry that no longer matches
  anything real).
- **Effort:** Small — one item, survey-then-decide (port / port-adapted /
  reject-as-superseded), matching plan 0147's own discipline throughout.
- **Created:** 2026-08-16

## Problem

Plan 0088's Phase 4 ledger entry ("Multi-agent review (2026-08-15)") recorded
five things the review found that were **not** fixed in that pass, explicitly
distinguished from the two real regressions the same review found and fixed
immediately. Four of the five still have no home:

1. **`diagnose()`/`orphanExclusions()` — partially resolved since, not tracked
   as such.** Plan 0088's Success Definition said standalone sufficiency was
   "partially met" because ts-archunit's own `diagnose()` CLI subcommand and
   `orphanExclusions()` audit mechanism were never ported — a deliberate
   scope decision (native evidence gate over mechanical port), disclosed, but
   left "deferred → not yet filed as its own eess bug/plan." **Since then,
   unrelated plan 0147 built and shipped a `diagnose()` core function
   (`packages/ts/src/core/diagnose.ts`) and a `doctor` CLI subcommand
   (`packages/ts/src/cli/commands/doctor.ts`, wired into `cli/index.ts`).**
   That closes the `diagnose()` half of the gap, incidentally, untracked back
   to this finding until now. `orphanExclusions()` specifically was never
   built anywhere — confirmed by grep, zero hits in `packages/ts/src` or
   `packages/core/src`. That half is the genuine remainder.
2. **`CorrespondenceBuilder.assertsCardinality()` is an unconditional
   class-wide `true`**, not scoped per-check the way `RuleBuilder`'s `.every()`
   treatment is. Sound today, because `beComplete()`/`preserveRelations()` are
   the only check types this builder has and both are legitimately
   absence-assertions. The first non-absence check type added to this builder
   would silently inherit an exemption it is not entitled to — a
   config-finding that should fire staying silent.
3. **`.expectNonEmpty()` is a behavioral no-op.** `_expectEmpty === false` is
   set on the builder but never read anywhere distinct from `undefined`. A
   caller who chains `.expectNonEmpty()` expecting it to assert something gets
   silent nothing, which is precisely the failure class ADR-010 exists to
   make unrepresentable, now living in ADR-010's own reference implementation.
4. **`.because()`/`.excluding()` have no direct test coverage in
   `packages/core/tests/`** — only indirect coverage via dialect-level tests.
   The 2026-08-15 testing review confirmed this by reverting each to
   mutate-in-place (the pre-fold "bug 0016" shape) and finding the full suite
   still passed.

**Findings 2, 3, and 4 above were confirmed resolved during this plan's own
freeze** — see Status for the citations. Only finding 1's remainder
(`orphanExclusions()`) is this plan's actual remaining work; the numbered
list above stays as the historical record of everything plan 0088's review
originally disclosed, not as a live task list.

## Implementation phases

### Phase 4 — `orphanExclusions()`

The one phase this plan still has. (Numbered "4" rather than renumbered to
"1" — this plan's Out of scope / Test inventory / Success definition /
Progress ledger sections all already reference it as Phase 4; renumbering
would touch every cross-reference for no benefit over keeping the original
scheme's own numbering.)

Port or natively rebuild ts-archunit's `orphanExclusions()` audit mechanism —
survey ts-archunit's own implementation first (same discipline plan 0147 used
throughout: read the live source before deciding port-verbatim vs.
port-adapted vs. reject-as-superseded), and record the ruling here rather
than assuming a port is the right shape.

**Blocked on [bug 0154](../bugs/fixed/0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md).**
See Status for the 2026-08-18 attempt and the three lessons it owes on
resume — in particular, the dogfood test is not optional, and `npm run
validate` alone cannot evidence this phase.

## Out of scope

- Anything else plan 0088's own review found and already fixed in that same
  pass (the two real regressions, the `bypassFilters` filter-survival fix,
  the `sourceEmpty` precedence wiring) — already closed, not reopened here.
- **Findings 2, 3, 4** (`CorrespondenceBuilder`'s cardinality exemption,
  `.expectNonEmpty()`, `.because()`/`.excluding()` direct kernel coverage) —
  confirmed already resolved by 0088 Phase 6 at this plan's own freeze; not
  this plan's work, not reopened here. See Status for citations.
- **Fixing bug 0154 itself.** This plan consumes that fix; it does not own
  it. The kernel parser's literal/comment blanking carries its own design
  question (the kernel cannot depend on ts-morph per ADR-002) and belongs in
  that record, not here.
- New capabilities beyond closing `orphanExclusions()`.

## Test inventory

Phase 4 lands with its own red-test-first regression, matching this
session's own discipline throughout plan 0147/0148. Additionally required,
per the 2026-08-18 attempt:

- a **dogfood** row running the audit over this repo's own source, asserting
  `[]` by identity, paired with a vacuity row pinning which files really
  carry directives;
- a fixture whose `getProject()` returns a **foreign** (non-`ArchProject`)
  object, so the mixed-dialect crash class is reachable;
- a fixture containing `eess-exclude` text that is **not** a live directive
  (inside a string literal, and inside prose), asserting zero findings;
- a CLI-level row pinning that the audit is called **once across all rule
  files**, not per file — sabotage showed the current suite cannot see that.

`npm run validate` stays green after it lands, and — because `doctor` is
outside that chain — one real invocation against this repo is part of
acceptance.

## Success definition

- `orphanExclusions()` has a recorded ruling (port / port-adapted /
  reject-as-superseded), not a silent skip.
- `npx eess-ts doctor` over this repo's own rule files reports zero findings,
  and does not crash on any of them.
- `npm run validate` green throughout.

## Progress ledger

- [x] Phase 1 — `CorrespondenceBuilder`'s cardinality exemption —
      done-otherwise: already resolved by 0088 Phase 6, confirmed at freeze.
- [x] Phase 2 — `.expectNonEmpty()` — done-otherwise: already resolved by
      0088 Phase 6, confirmed at freeze.
- [x] Phase 3 — `.because()`/`.excluding()` direct kernel coverage —
      done-otherwise: already resolved by 0088 Phase 6, confirmed at freeze.
- [ ] Phase 4 — `orphanExclusions()`. Attempted 2026-08-18, backed out
      unbuilt; blocked on bug 0154.
