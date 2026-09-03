# Plan 0235: the emitter takes a receipt, not an array

## Status

- **State:** Draft — the decision is made ([ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md),
  Accepted 2026-09-03); this is its build. Eligible for the freeze now that the
  floor cannot move; stays Draft until it goes through `/plan-ready`.
- **Priority:** High — the ROADMAP's own definition: closes a gap between what
  eess claims and what it checks. ADR-010 says an evidence-free pass is
  unrepresentable; at the emitter it is one line, measured in the field as
  three inert gates in a week, written by an agent told to use eess properly.
- **Effort:** Medium — a signature change on two kernel emitters and one
  per-rule step, one compatibility alias removed, the emitters' return type
  widened to the receipt, one configuration finding wired (already written —
  bug 0190) and one new generic one for the hand-assembler, a migration of every
  emitter call in this repo (each a one-line honesty gain), and the gates that
  turn ADR-014's `pending` rows into `gated`. Lands as **one** PR: no phase
  below is shippable alone, and a half-migrated emitter is worse than none.
- **Created:** 2026-09-03
- **Builds:** ADR-014. Proposal 009's Ask A, **reshaped** — its disposition row
  names this plan. Closes [bug 0190](../bugs/0190-the-preset-constructs-nothing-finding-cannot-fire.md)
  and [bug 0206](../bugs/0206-deliver-bypasses-the-kernel-finisher-on-the-default-path.md)
  by construction.

## Problem

`finishPreset(violations: ArchViolation[])` and
`reportViolations(violations: ArchViolation[])` take a bare array.
`reportViolations`'s second line is `if (violations.length === 0) return`. A
consumer who imports eess's types, eess's printer and eess's corpus loader — and
no `RuleBuilder` — can hand either emitter an empty array from a loop that
examined nothing, and eess prints green.

ADR-014 records the decision: **evidence is required at every seam where a
verdict leaves eess.** The emitters take the evidence shape every terminal
already produces — `CollectResult`'s `{ violations, examined }`
(`packages/core/src/terminal-builder.ts:39`) — and a value with no evidence, or
evidence of zero without a declaration, is a configuration finding. The device
is a **required field, not a registry**: the measured failure was an honest
mistake, not forgery, and against that target _unomittable_ is the whole
requirement. It also keeps ADR-010 §2's cap on kernel registries untouched.

This plan is the work. It is deliberately not the guardrail preset rule
(proposal 009's Ask C) — that is an opt-in lint an adopter may never enable, and
it ships separately. This is the contract.

## What exists, measured

**The finding is already written.** `presetConstructsNothingViolation`
(`packages/core/src/preset-dispatch.ts:106`) has no call site — bug 0190's whole
subject. Its triggering fact, "zero examined at the emitter", becomes the
emitter's input under ADR-014. The constructor either fires from it or is deleted;
0190's own closure condition, now decidable.

**The evidence already exists at every producing site.** Counted, each one:

| site                                                                                                                             | what it holds when it calls the emitter                                                                                             | the receipt it can hand over                                                      |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| kernel `executeCheck` / `executeWarn` (`packages/core/src/execute-rule.ts:217`)                                                  | the filtered array of a terminal whose `CollectResult` was already gated by `evidencedViolations()`                                 | the terminal's own `examined`, threaded one call further                          |
| kernel `finishPreset` → `reportViolations` (`packages/core/src/report.ts:83`)                                                    | whatever the caller passed                                                                                                          | the same receipt, forwarded                                                       |
| `eess-ts` `deliver()` (`packages/ts/src/presets/shared.ts:427`)                                                                  | `builders: RuleBuilderLike[]` — it **holds the builders**, the fact 0190 says the kernel cannot see                                 | the sum of each builder's `examinedUnits()`                                       |
| the four synthetic builders in `shared.ts` (`:127`, `:199`, `:265`, `:321`)                                                      | `{ violations: () => [...] }` — a `RuleBuilderLike` with no `examinedUnits`                                                         | `examinedUnits: () => 1` — each genuinely examined the preset's own configuration |
| six `eess-crossvalidate` presets (`md-gherkin.ts:144`, `gherkin-ts.ts:166,244,312`, `md-mermaid-er.ts:168`, `md-mermaid.ts:157`) | a hand-assembled array over documents / scenarios / fences it iterated                                                              | the count it iterated — every one already computes it for its stats               |
| two `eess-md` presets (`adr.ts:148`, `ledger.ts:580`)                                                                            | an array assembled from `dispatchRule` calls over builders it constructed                                                           | the receipt `dispatchRule` now returns, summed                                    |
| kernel `dispatchRule` (`packages/core/src/preset-dispatch.ts:37`)                                                                | `builder.rule(meta).violations()` — the builder, which has `examinedUnits()` in every family                                        | `{ violations, examined }` instead of a bare array; `Dispatchable.rule()` says so |
| kernel `throwIfViolations` (`packages/core/src/preset-dispatch.ts:137`)                                                          | a bare array, forwarded to `finishPreset` — the seam with the lock removed                                                          | nothing: removed, with its rows in `docs/api-reference.md:566-567`                |
| two scripts that wrap a preset (`check-baseline.mjs:60` · `check-guardrails.mjs:56`)                                             | a preset's `report: 'return'` result, plus a `filesScanned` it counted **before** the preset ran — diagnosis, per ADR-010 §1        | the preset's receipt, passed through; `filesScanned` stays in the summary line    |
| three scripts that hand-assemble (`check-corpus.mjs:764` · `check-ledger.mjs:166` · `check-release.mjs:377`)                     | a hand-assembled array, and the count of units its own checks iterated (`totalChecked`, `doneCount`, the packages the diff touched) | the units its assertions ran over — never the documents or files it loaded        |

Not a migration site, and worth stating so nobody "fixes" it: the
undocumented-exclusion push at `packages/core/src/execute-rule.ts:171` builds a
literal **inside `applyFilters`** — pipeline output, evidenced by the terminal
that called it.

**The dialect has a path that never reaches the emitter.** Bug 0206:
`deliver()` throws `ArchRuleError` itself when `callerAggregates()`, bypassing
`finishPreset` (`shared.ts:441-444`). Under ADR-014 that branch must carry the
same evidence or route through the emitter; leaving it is a seam the ADR names
and does not cover.

**The vacuity matrix scores the wrong thing for this case, correctly.**
`scripts/vacuity-matrix.mjs` `classify()` returns `fail-open` when a preset
thunk does not throw, and its own comment says a preset that constructs nothing
"must stay detectable" via `presetConstructsNothingViolation`. After this plan
that case throws a `bypassFilters` finding and scores `config-finding`. The
comment and the probe both need to say so.

## Implementation

### Phase 1 — red first

Tests that fail today, before any signature changes:

- `packages/core/tests/report.test.ts`: `finishPreset` and `reportViolations`
  each handed a value with no `examined` (a bare array, from JavaScript's point of
  view) produce the configuration finding; handed `examined: 0` with no
  declaration and no violations, the same; handed `examined: 0` with
  `expectEmpty: true`, nothing. Asserts the finding's **rule id**, not that
  something threw.
- The same file, the cases ADR-014 §4 and §5 add: a value carrying one
  `bypassFilters` finding and `examined: 0` comes out carrying exactly that one
  (a terminal's own finding is never found twice); under `report: 'return'` the
  finding is **in the returned receipt**; under `warn` it is written; the value
  handed back is the value handed in plus that finding. And `dispatchRule`'s
  result carries `examined`, while the root has no `throwIfViolations`.
- `packages/ts/tests/presets/`: under a run-level aggregating caller, a preset
  whose builders sum to zero examined throws an `ArchRuleError` **carrying the
  finding** — nothing emitted, the finding rides the throw (bug 0206's bypass,
  measured closed rather than assumed).
- Remedy-remediates fixtures (ADR-009 rule 2's behavioural corollary): for each
  cause the emitter names — no evidence field, `sourceEmpty`, zero examined with
  empty violations — apply the stated remedy and assert the finding clears. The
  kernel's message for the third names the hand-assembler's remedy, never a
  preset's options; `deliver()`'s names the preset's.
- A `scripts/nonvacuity/` fixture: a script that hand-assembles an empty array and
  calls `finishPreset` must exit red naming the finding — registered as its own
  row in `scripts/check-nonvacuity.mjs`'s `gates` table, per the one-row-per-check
  doctrine recorded under `GATE_FOR`.

### Phase 2 — the retype

- `finishPreset` and `reportViolations` take `{ violations, examined, sourceEmpty? }`
  — `CollectResult`'s shape by name, so a terminal's output flows through
  unchanged. Not a new type.
- `PresetReportOptions` gains `expectEmpty?: boolean`: the hand-assembler's
  declaration, with ADR-010 §3's semantics (it expires the day the set is not
  empty; an empty source still outranks it).
- A runtime guard for callers TypeScript cannot reach: a value without a numeric
  `examined` is the configuration finding, emitted through the same emitter.
  `reportViolations` stays literally what ADR-008 says — it never throws and never
  filters violations; it emits the finding as it emits any other.
- **The finding is about a pass, produced before delivery is chosen.** It fires
  on zero examined with empty violations and no declaration; a value that
  already carries a finding passes through untouched (ADR-014 §4). It is
  appended to the receipt's violations before `report` is read, so it is in the
  returned value, rides the throw, and is written under `warn` (ADR-014 §5).
- **The emitters hand the receipt back.** `finishPreset`'s return type, and
  therefore every preset's under `report: 'return'`, becomes the receipt — the
  input plus the finding when produced. ADR-008's `ArchViolation[]` return is
  amended, not contradicted: the violations are still there, one field deeper.
- **Two findings, two owners.** `presetConstructsNothingViolation` fires from
  `deliver()` when its builders sum to zero and produced nothing — the preset
  plumbing is the only party that knows a preset's name and options, so it
  names that remedy and hands over a value already carrying it. The kernel
  emitter gets a **new** generic finding with the hand-assembler's remedy (fix
  the selection, or declare `expectEmpty`), and never names a preset's options.
  The first draft of this plan claimed the constructor's message "is already
  right for the case"; it is right for a preset and wrong for `check-corpus`,
  which has no options to enable — ADR-009 rule 2's exact prohibition.
- **`dispatchRule` returns the receipt.** `Dispatchable.rule(m)` gains
  `examinedUnits(): number` on its result — every family's builders already have
  it — and the function returns `{ violations, examined }`.
- **`throwIfViolations` is deleted**, with its `docs/api-reference.md` row. Its
  body is one call to `finishPreset`; a retyped alias would be a second name for
  the same seam.
- **No new `WeakSet`.** `packages/core/src/cardinality.ts` stays the sole home of
  the kernel-bound registries ADR-010 §2 caps.

### Phase 3 — the migration, each site stating what it examined

In the order the table above lists them, so the kernel is honest before the
dialects are asked to be:

1. `executeCheck` / `executeWarn` thread the terminal's `examined` through.
2. `deliver()` sums `examinedUnits()` across its builders and hands the receipt
   to `finishPreset`. The `callerAggregates()` branch (0206) carries the same
   receipt on the `ArchRuleError` it throws, or routes through the emitter with
   `report: 'return'` — whichever leaves no path evidence-free.
3. The four synthetic builders gain `examinedUnits: () => 1`. Their
   `bypassFilters: true` and their specific remedies are untouched — that was the
   review's condition for this being honest rather than a workaround.
4. The six crossvalidate presets pass the count they iterated.
5. The two `eess-md` presets sum the receipts `dispatchRule` now returns.
6. The two scripts that wrap a preset pass the preset's receipt through and
   count nothing themselves — their `filesScanned` is a count of what was loaded
   before the preset ran, which ADR-010 §1 classes as diagnosis, and it stays in
   the summary line as exactly that.
7. The three scripts that hand-assemble pass the units their own checks
   iterated. Where a script prints several numbers (`check-corpus` prints checks
   _and_ documents), it passes the one its assertions ran over — the checks —
   never the documents it loaded.

Every site is one line. None loses a finding. The measure of "done" for this
phase is not that it compiles — it is that a reviewer can read each site and
say what number it handed over and why that number is the honest one.

### Phase 4 — the gates that make ADR-014 `gated`

- The non-vacuity row from Phase 1, green.
- A rule in `arch.internal.rules.ts`: every `finishPreset` / `reportViolations`
  call under `packages/*/src/**` and `scripts/**` passes the evidence shape —
  the dogfood form of Ask C. Anchored `(^|\.)` on the callee, so
  `import * as eess` then `eess.finishPreset(...)` cannot walk around it; the
  consuming project measured its own first version failing exactly there. Paired
  with `onlyHaveTypeImportsFrom` for the edge kinds `call()` does not model.
  Scoped by **binding** (the file holds a runtime edge to the emitter — a fact
  the compiler answers), never by searching shell strings for what is wired as a
  gate — the consuming project cut that rule after two review rounds produced
  nine holes, and its lesson is on this record so it is not re-learned here.
- A rule in `arch.internal.rules.ts`: no module under `packages/core/src` other
  than `cardinality.ts` constructs a `WeakSet`.
- `scripts/vacuity-matrix.mjs`: the constructs-nothing comment and a probe that
  hand-assembles `[]` and expects `config-finding`.
- ADR-014's Enforcement table: each row's Status moved to `gated` with the
  mechanism's real path and, where it is a test, its `it('…')` title cited
  exactly.
- ADR-008 gains an amendment section, in the form of its 2026-08-22 one, naming
  the three statements ADR-014 §6 supersedes: the `ArchViolation[]` return, the
  retained `throwIfViolations`, and "existing call sites are unaffected". Its
  Enforcement row "Presets return violations, don't force emission" cites the
  `report: return` case, which now asserts the receipt.
- `docs/api-reference.md:566-567`: `dispatchRule`'s signature row updated,
  `throwIfViolations`'s removed.
- Changeset: `@nielspeter/eess` **minor** (a break on 0.x), marked `**Breaking**`,
  **naming** `-ts`, `-md`, `-mermaid`, `-gherkin`, `-crossvalidate` in the same
  changeset — bug 0185's class, and `check:release` blocks on it.

## Out of scope — each with its home

- **The published guardrail preset rule** (009's Ask C for adopters): its own
  plan. It is the belt to this plan's braces, opt-in, and independently
  closable; holding this plan on it would couple a contract to a lint.
- **A catch-all `.excluding()` turning a rule off** —
  [bug 0233](../bugs/0233-an-exclusion-that-suppresses-every-violation-is-silent.md).
  Same failure class, different seam (the filter, not the emitter).
- **The two crossvalidate presets that return `void`** —
  [bug 0097](../bugs/0097-crossval-presets-bypass-caller-owns-reporting.md). They
  finish through a builder's `.check()`, so they already pass the terminal seam
  and never reach the emitter; ADR-014 does not touch them. Their gap is
  ADR-008's, not ADR-010's.
- **Detecting a wrong `examined`.** ADR-014's stated ceiling. A caller who types
  `examined: 500` over a loop that skipped everything has lied in writing; this
  plan makes that the only way left to be wrong.
- **Unifying the two `applyFilters`** —
  [plan 0188](./0188-unify-the-duplicated-engine-modules.md). This plan threads
  `examined` through the kernel's; 0188 decides whether the fork survives.

## Success definition

- A hand-assembled empty array handed to either emitter is a configuration
  finding, in a test and in a non-vacuity fixture that asserts its rule id.
- `presetConstructsNothingViolation` has a call site, and bug 0190 closes.
- Every emitter call in this repo passes `examined`, and each one's number is
  the count its own assertions ran over, or a preset's receipt passed through —
  never a count of what was loaded — reviewable line by line.
- A terminal's own configuration finding arrives at the emitter once; the
  finding is present under every delivery mode, including the aggregating throw.
- The kernel root has no `throwIfViolations`; `dispatchRule` returns the receipt;
  ADR-008 carries the amendment.
- No `WeakSet` was added to the kernel; a rule says so.
- ADR-014's Enforcement table has no `pending` row; every mechanism it names
  runs in `validate`.
- `npm run validate` green from a run that **reached the last step** — stated
  because bug 0126 records that a truncated chain looks the same.
- The consuming project's four-gate shape — types, printer, loader, no builder —
  fails to compile against the released kernel.

## Progress ledger

- [ ] Phase 1 — both red tests written and measured red
- [ ] Phase 2 — the retype; 0190's constructor fires from `examined: 0`
- [ ] Phase 3 — every site migrated, each number reviewed as the honest one; 0206's bypass closed
- [ ] Phase 4 — the gates; ADR-014 rows `gated`; ADR-008 amended; api-reference rows; changeset names all five dialects
- [ ] `/close` — 0190 and 0206 moved to `fixed/` in this PR, not after

Deferred: none.
