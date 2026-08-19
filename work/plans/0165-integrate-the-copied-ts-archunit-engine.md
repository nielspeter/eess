# Plan 0165: Integrate the copied ts-archunit engine into eess

## Status

- **State:** Draft — created 2026-08-19, off a committed baseline
  (`9489684`, branch `adopt-ts-archunit-tests`). This plan does **not** decide
  whether to copy; the copy is done and measured. It decides how the copied
  engine becomes an eess package again.
- **Priority:** High — closes the gap between what plan 0088 claimed and what
  it delivered, and does it with a success criterion that can be run rather
  than argued.
- **Effort:** Large, but genuinely phased: three items that each close on
  their own PR.
- **Created:** 2026-08-19

## Problem

[Plan 0088](./completed/0088-fold-ts-archunit-into-eess.md) set out to fold
ts-archunit's engine into eess and closed as _"all 7 phases (+4a) landed and
verified."_ It reconciled per file instead of copying — compare, keep eess's
where the two looked equivalent — and that is a mode in which a fix whose
shape is a **deletion** or a **reordering** leaves no trace to notice.

The [fold audit](../fold-audit-2026-08-19.md) measured the result by reading
upstream's 72 fixed-bug records: 11 fixes missing, 15 partial. That audit was
the wrong instrument, and this plan exists partly because a cheaper one
answered the same question far better:

| instrument                                 | cost        | found                  |
| ------------------------------------------ | ----------- | ---------------------- |
| read 72 bug records + 8 audit agents       | hours       | 9 genuine misses       |
| copy upstream's tests onto eess's src      | one command | **623 failures**       |
| copy upstream's **src and tests** together | one command | **38 engine failures** |

The third row is the finding. The 623 were never incompatibility — they were
eess-ts's accumulated distance from the engine 0088 claimed to have folded in.
With upstream's source in place, **3353 of 3419 tests pass**.

It also resolves, in one move, eight bugs filed and half-fixed on 2026-08-19 —
[0154](../bugs/0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md)
literal blanking, 0155 the assertion gate,
[0156](../bugs/0156-should-twice-silently-drops-the-first-assertion.md)
`fork()`'s condition-clear,
[0157](../bugs/0157-a-typo-in-a-preset-override-key-is-a-silent-false-green.md)
`overrideFindings`,
[0158](../bugs/0158-an-undocumented-exclusion-directive-suppresses-and-only-warns.md)
undocumented-fails-closed,
[0159](../bugs/0159-violation-identities-collide-across-distinct-findings.md)
`disambiguateIdentities`,
[0160](../bugs/0160-within-creates-an-import-cycle-and-nothing-watches-for-cycles.md)
`within()`'s restructure, and
[0161](../bugs/0161-smell-detectors-silently-miss-object-literal-functions.md)
object-literal collection — all verified present in the copied source.

## What the baseline is, precisely

Committed at `9489684`:

- `packages/ts/src` — **156 of 156** upstream files, byte-identical after name
  substitution (`ts-archunit-exclude` → `eess-exclude`,
  `@nielspeter/ts-archunit` → `@nielspeter/eess-ts`).
- `packages/ts/tests` — all **248** upstream test files plus **286** helpers
  and fixtures they import.
- **3419 tests · 3353 passing · 66 failing.**

The 66, split:

| bucket                                                                         |  count | note                                                          |
| ------------------------------------------------------------------------------ | -----: | ------------------------------------------------------------- |
| upstream tests about **its own corpus** (`docs/`, `CHANGELOG`, `package.json`) |     35 | that corpus was deliberately not copied — not engine failures |
| upstream's own tooling scans                                                   |      2 | same                                                          |
| **engine**                                                                     | **38** | this plan's Phase 1                                           |

**And the gate chain, measured at the same commit** — the test count was never the
whole baseline, and recording only the green half is the failure this plan exists
to correct:

| gate             | at `9489684`                    | root cause                                                                                            |
| ---------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `check:arch`     | ✗ **221** violations            | upstream's src under eess's `arch.internal.rules.ts`: 97 missing-JSDoc, 61 unused-export, 14 non-null |
| `check:corpus`   | ✗ 1 pointer + 3 ADR citations   | `within.ts` moved to `builders/`; three cited `it()` titles no longer exist under those paths         |
| `check:crossval` | ✗ 1                             | the same ADR-010 citation — one root cause, two gates                                                 |
| `format:check`   | ✗ **5** copied test files       | upstream formats to its own prettier config, not eess's                                               |
| `check:spec`     | ✓                               |                                                                                                       |
| `check:diagram`  | ✓                               |                                                                                                       |
| `check:ledger`   | ✓                               |                                                                                                       |
| `check:release`  | ✓                               |                                                                                                       |
| `check:family`   | ✓ — **and that is the finding** | see below                                                                                             |

### `check:family` is green because the thing it guards was deleted

`family.rules.ts` asserts each dialect re-exports every kernel symbol its own
source imports. `packages/ts/src` now imports the kernel in **zero** files
(measured; the other four dialects import it in 15 / 11 / 1 / 7). Zero imports
means zero required re-exports, so the rule passes on eess-ts by having nothing
to check — it went green _because_ the boundary was removed.

That is a fail-open in the family gate itself, and it means **"`check:family`
green" was not a valid done-criterion for Phase 2** — it was already green before
Phase 2 started. Phase 2's criterion below is restated as a positive count, and
the fail-open is Phase 2's to fix rather than route around: a family rule that
cannot distinguish "re-exports everything it imports" from "imports nothing" is
the same `0 === 0` shape ADR-009's rule 5 names.

**Two costs the baseline incurred, both deliberate and both owed back:**

1. `eess-ts` no longer imports `@nielspeter/eess`. The copied source carries
   its own `core/`, so the kernel/dialect split is **un-done for this package**
   while integration happens. The other four dialects still sit on the kernel.
2. eess's own additions that upstream lacks were dropped: ADR-008's `report`
   option, `--fix` ([plan 0066](./completed/0066-eess-deterministic-autofix.md)),
   and `havePathMatching`. The 16 eess-only test files covering them are still
   present and failing — that is how they stay visible instead of being
   quietly lost.

## Why this is a plan and not "finish the fix"

Phase 1 alone would leave eess with a working `eess-ts` that is no longer part
of the family. That is the shape plan 0088 closed in: a green suite over an
architecture nobody re-checked. The definition of done below is therefore the
**integration**, not the test count — and each phase closes on its own PR, per
this repo's own rule that an item which cannot close in one PR is wrong and
gets split.

## Implementation phases

### Phase 1 — the 38 engine failures → 0

Fix, or explicitly rule on, every engine failure in the baseline. Largest
clusters first:

- `tests/tsconfig/tsconfig.test.ts` — 9
- `tests/integration/exclusion-comments-e2e.test.ts` — 7
- `tests/core/warn-survives-the-test-runner.test.ts` — 4
- the remainder 1–2 each across conditions, `project-relative`, workspace
  roots, `diagnose`, `held-builder-is-immutable`, `preset-fanout`,
  `assertion-gate`, `vacuity-matrix`, `standalone-surface`.

Each failure gets one of two dispositions, recorded: **fixed**, or **ruled a
legitimate divergence** with the reason. A test deleted because it was
inconvenient is the failure mode this whole plan exists to correct, so no
third option.

`tests/standalone-surface.test.ts` is deliberately left to Phase 2 — it is the
kernel-boundary test, and it should fail until the boundary is back.

Phase 1 also clears the corpus-side breakage the copy caused, which is the same
work in a different lane: [bug 0160](../bugs/0160-within-creates-an-import-cycle-and-nothing-watches-for-cycles.md)'s
code pointer into the old `helpers/` location of `within.ts` (the file moved to
[`packages/ts/src/builders/within.ts`](../../packages/ts/src/builders/within.ts) —
the move the bug asked for, so the pointer is stale by success), and the
three ADR citations in
[ADR-006](../../adr/006-framework-rules-architecture.md) and
[ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md) naming `it()`
titles that upstream's test files do not carry. An ADR citation is repaired by
matching it to the test that now exists, or by retiring the clause — never by
deleting the row, for the same reason no test gets deleted here.

`format:check`'s five files are the one finding with a real choice in it:
`prettier --write` fixes them in a second, but it ends the copy's
byte-identity with upstream and so ends the ability to re-run the diff that
produced this baseline. Phase 1 decides that deliberately and records which
way — it is not a formatting chore.

### Phase 2 — re-split the kernel

`eess-ts` imports `@nielspeter/eess` again; `packages/core` stays
ts-morph-free. This is the work
[plan 0051](./completed/0051-consolidation-eess-monorepo.md) did once, redone
against a newer engine — its per-file classification is the precedent to
follow, not to reinvent.

The measured constraint from the earlier throwaway experiment: **37 of
upstream's 57 `src/core` files are transitively ts-morph-tainted**, so the
split is not a file move. The 20 transitively-clean ones are the floor, and
the rest need the same pure-part extraction `packages/core`'s own
`project-relative.ts` / `path-universe.ts` / `glob-site.ts` docstrings already
record doing.

Done when:

- `eess-ts` imports `@nielspeter/eess` in a **non-zero, stated** number of files,
  and `check:family` is green **on a non-zero re-export count** — the gate must
  print what it checked, not merely exit 0 (see the fail-open above);
- `check:arch`'s `kernel-no-engine-deps` is green with `packages/core` importing
  ts-morph in zero files;
- `standalone-surface.test.ts` passes;
- `family.rules.ts` itself fails when a dialect's kernel imports are emptied —
  proved by the non-vacuity harness, not by inspection.

### Phase 3 — restore eess's own additions

Re-apply what the wholesale replacement dropped, using the 16 eess-only test
files as the specification:

- ADR-008's `report` option on the presets;
- `--fix` (plan 0066) and its `ArchFix` model;
- `havePathMatching`.

Done when those 16 files pass and no eess capability present before `9489684`
is missing after it — asserted against the pre-baseline export surface, not
from memory.

## Out of scope

- **Upstream's corpus** — `adr/`, `bugs/`, `plans/`, `proposals/`, `docs/`,
  `spikes/`. That is [plan 0090](./0090-adopt-ts-archunit-work-corpus.md)'s
  scope, and this record is the evidence its "heritage — preserved, not
  re-audited" framing needs revising: 26 of those 72 fixed-bug records
  described defects live in the engine eess owns. Revising 0090 is not this
  plan's work, but it must not be built as written.
- **Upstream's `scripts/`, `examples/`, `packages/`, `package.json`.** Not
  copied. The export map and dependency surface are still eess-ts's, which is
  where some Phase 1 breakage may turn out to live.
- **The other four dialects' own engines.** They sit on the kernel and are
  untouched until Phase 2 restores it.
- **Retiring ts-archunit.** That is
  [plan 0100](./0100-publish-the-fold-retire-ts-archunit.md), and it now has a
  real prerequisite: this plan, not 0088.

## Test inventory

The suite is the specification, which is the point of the whole exercise.

- **Phase 1:** 38 → 0 engine failures, every one disposed as fixed or ruled.
- **Phase 2:** `check:arch`, `check:family` green; `standalone-surface.test.ts`
  passes; `packages/core` imports ts-morph in zero files.
- **Phase 3:** the 16 eess-only test files pass.
- **Throughout:** `npm run validate` green at each phase's close, and the
  non-vacuity harness still reports every fixture firing — a copied engine
  must not arrive with a quietly disarmed gate.

## Success definition

- `npm run validate` green.
- `eess-ts` imports `@nielspeter/eess` in a stated non-zero number of files; the
  kernel imports ts-morph in zero files; `check:family` green **on a non-zero
  count**, and red when a dialect's kernel imports are emptied.
- No capability present before `9489684` is missing after it.
- Every one of the baseline's 66 failures is either passing or carries a
  written ruling — none deleted.
- Every one of the baseline's **225 gate findings** (221 arch + 1 pointer + 3 ADR
  citations, the crossval one being the same root cause) is likewise fixed or
  ruled.

## Progress ledger

- [ ] Phase 1 — the 38 engine failures.
- [ ] Phase 2 — re-split the kernel.
- [ ] Phase 3 — restore `report`, `--fix`, `havePathMatching`.

Deferred: none.
