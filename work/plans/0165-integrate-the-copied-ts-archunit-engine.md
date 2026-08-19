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

| gate             | at `9489684`                     | root cause                                                                                            |
| ---------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `check:arch`     | ✗ **223** violations             | upstream's src under eess's `arch.internal.rules.ts`: 97 missing-JSDoc, 61 unused-export, 14 non-null |
| `check:corpus`   | ✗ 1 pointer + 3 ADR citations    | `within.ts` moved to `builders/`; three cited `it()` titles no longer exist under those paths         |
| `check:crossval` | ✗ 1 — **understated, see below** | the same ADR-010 citation — one root cause, two gates                                                 |
| `check:baseline` | ✓ — **also understated**         | see below                                                                                             |
| `format:check`   | ✗ **8** copied files             | upstream formats to its own prettier config, not eess's                                               |
| `check:spec`     | ✓                                |                                                                                                       |
| `check:diagram`  | ✓                                |                                                                                                       |
| `check:ledger`   | ✓                                |                                                                                                       |
| `check:release`  | ✓                                |                                                                                                       |
| `check:family`   | ✓ — **and that is the finding**  | see below                                                                                             |

### Correction: two of those readings were taken against a stale `dist`

`check:crossval` and `check:baseline` import the **built** `@nielspeter/eess-ts`,
and at the time of the first reading `packages/ts/dist` still held the PRE-copy
build. Both were measuring eess's old engine while the table claimed they
measured the new one. Rebuilt, the real baseline is worse:

- `check:crossval` — **6** failing checks, not 1. Five of them are one cause:
  `.select()` does not exist on the copied builders. It is a kernel
  `RuleBuilder` method (`packages/core/src/rule-builder.ts:167`) that upstream
  never had, and `eess-crossvalidate` is built on it — so four of its five source
  files fail `tsc` too. **Phase 2**, by inheritance, when eess-ts sits on the
  kernel again.
- `check:baseline` — **crashes**, it does not pass. It calls
  `recommended(p, { report: 'return' })`; ADR-008's `report` option is one of the
  three things the copy dropped, so the preset returns builders where the script
  expects violations and the kernel's `reportViolations` dies inside
  `path.relative` on `file: undefined`. **Phase 3.**

Two lessons, both recorded rather than filed away: a gate that reads `dist` is
measuring whatever was last built, so a baseline must state when it was built;
and `reportViolations` crashing on a malformed violation is its own small
ADR-009 rule-1 defect — a gate that dies emits no findings at all, and
`ERR_INVALID_ARG_TYPE` names nothing the operator can act on. Not fixed here
(out of Phase 1's scope); worth a bug when Phase 3 lands.

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

### Phase 1 — the engine failures → 0 · **DONE**

Every engine failure fixed or ruled; none deleted. Measured at the close:
**3537 tests · 3504 passing · 30 failing + 3 load failures**, and every one of
the 33 is either upstream's own corpus (27 + 3, out of scope per below) or a
later phase of this plan (3). **Engine failures: 0.**

The real count was **29**, not the 38 the baseline table states. That table was
itself measured wrong twice over: it counted `packages/ts` under a run that also
swept sibling packages, and it counted only failing _assertions_ — a test file
that fails to LOAD reports zero of those, so four files were invisible to the
instrument that produced the 38. Both are recorded rather than quietly
corrected, because mis-measuring the thing you are measuring is the failure this
plan exists to correct.

#### Dispositions

| what                                                                   |   n | disposition                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------- | --: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/tsconfig/tsconfig.test.ts`                                      |   9 | **fixed** — one import line. eess's file is a stale duplicate of the copied `tests/config/tsconfig.test.ts` (37 cases vs 10) and imported `tsconfig` from the builder module, which never exported it. Kept, not deleted: it passes and costs nothing. |
| `tests/integration/exclusion-comments-e2e.test.ts`                     |   7 | **fixed** — bound to `src/` instead of `@nielspeter/eess`. The kernel and `packages/ts/src` carry separate copies, so `instanceof` compared a class nothing throws and `commentSuppressions()` read a registry nothing writes.                         |
| `tests/core/warn-survives-the-test-runner.test.ts`                     |   4 | **fixed** — vitest resolved through Node instead of joined onto the package root (npm hoists it in a workspace), plus the two `tsconfig.json` excludes and the `.gitignore` entry bug 0045's fix needs.                                                |
| `tests/core/project-relative.test.ts`                                  |   1 | **fixed** — eess's plan-0148 fail-CLOSED `rootOf()` restored. The copy reverted it to a fall-through that resolves a file outside every registered root to the tie-break winner: a specific, plausible, wrong answer.                                  |
| `tests/matrix/vacuity-matrix.test.ts`                                  |   1 | **fixed** — upstream's `vitest.config.ts` adopted (it excludes `tests/matrix/**`, which reads `dist`), plus `vitest.matrix.config.ts` and the `test:matrix` script. Verified green against a fresh build: 48/48, not merely removed from the run.      |
| `tests/archunit/arch-rules.test.ts` — checkout-name ban                |   1 | **fixed** — matched as a path SEGMENT. eess checks this package out at `packages/ts`, so the name is `ts`, which occurs inside `presets`, `tests` and `startsWith`: seven false positives. A CONTROL was added so the ban stays falsifiable.           |
| `tests/archunit/arch-rules.test.ts` — orphan directives                |   1 | **fixed** — `tests/fixtures/**` scoped out, narrowly, with an assertion that everything dropped is a fixture path. A directive there is a test's INPUT; the remedy offered ("delete the comment") deletes the fixture the test reads.                  |
| `tests/archunit/arch-rules.test.ts` — aliased import                   |   1 | **fixed** — `notImportFrom` exists as both a condition and a predicate, so the name genuinely conflicts. A namespace import, which is what the rule's own remedy asks for.                                                                             |
| `tests/archunit/dogfood.test.ts` + `held-builder-is-immutable`         |   2 | **fixed** — two eess-added files inside `tests/fixtures/slices` formed a second cycle under an upstream test that counts them. Moved to their own fixture project **and given the test they never had**; orphaned fixture data is not coverage.        |
| `tests/helpers/within.test.ts`                                         |   3 | **fixed** — a LOAD failure (`within.ts` moved to `builders/`, bug 0160's own fix) hiding two wording assertions. eess's file is a superset of the copied `tests/builders/within.test.ts` — it adds the `.expectEmpty()` cases — so it stays.           |
| `tests/conditions/reverse-dependency-workspace-roots.test.ts`          |   1 | **fixed** — same cross-copy `ArchRuleError` identity as the e2e file.                                                                                                                                                                                  |
| `tests/core/assertion-gate.test.ts`                                    |   1 | **fixed** — the shipped `docs:` URL pointed at upstream's site at an anchor eess's docs did not carry. The section was ported into `docs/violation-reporting.md` and the URL repointed: a violation whose docs link 404s is a lying remedy.            |
| `tests/cli/*` (init · run · explain-agent · resolve-config) + baseline |  13 | **fixed** — caused BY Phase 1: see the identity finding below. The tests pinned upstream's brand strings; they now pin eess's.                                                                                                                         |
| `tests/cli/config-cjs-project.test.ts` + `rule-file-truncation`        |   6 | **fixed** — see the loader finding below.                                                                                                                                                                                                              |
| `tests/predicates/module-workspace-roots.test.ts`                      |   2 | **deferred→Phase 3** — `havePathMatching`, one of the three eess additions the copy dropped. Left failing on purpose, which is how it stays visible.                                                                                                   |
| `tests/standalone-surface.test.ts`                                     |   1 | **deferred→Phase 2** — the kernel-boundary test. It should fail until the boundary is back.                                                                                                                                                            |

#### Three findings Phase 1 turned up that the plan did not predict

**1 — the copy shipped upstream's identity to users.** `packages/ts/src` carried
48 occurrences of `ts-archunit` across 15 files, and they were not comments: the
CLI help said `ts-archunit check`, `init` scaffolded `ts-archunit.config.ts`,
`resolve-config` looked for that filename, `explain --format agent` wrote
`<!-- ts-archunit:start -->` sentinels into the consumer's AGENTS.md, violations
carried `rule: 'ts-archunit: baseline'`, and three `docs:` URLs pointed at
upstream's documentation site. Now zero. The 13 CLI test failures above are the
consequence — upstream's tests correctly pinned upstream's names.

**2 — the rule loader was reverted from fail-closed to fail-open, tests and
all.** eess's `loadRuleFiles` throws when a rule file's default export is
malformed or contains a non-builder (plan 0061 Phase 0): a silently-dropped rule
is a green-but-empty gate. Upstream's skips it and returns `[]`. The copy
replaced the source AND the four tests that pinned the behaviour **in one
motion**, so the fail-open landed with a green suite asserting it was correct.
Nothing went red. This is the exact shape ADR-009 and ADR-010 exist to make
impossible, and it is the strongest argument in this record for why the copy
needed a phase and not a merge. Restored, with the divergence from upstream
stated in both the source and the test file.

**3 — `instanceof` across a module loader is not an identity anyone can rely
on.** Restoring eess's jiti loader (bug 0074: a `.ts` rule file must load inside
a `"type": "commonjs"` consumer project) broke two upstream behaviours at once,
because jiti keeps its own module registry:

- `instanceof ArchRuleError` was false for an error that is one, so `check.ts`
  skipped `ruleFileTruncated()` — bug 0029 reopened, silently, in a run that was
  already red for another reason. Fixed structurally with `isArchRuleError()`,
  which matches on `name` + `violations` rather than on class identity. Worth
  keeping regardless of the loader: a consumer with two copies of eess-ts on
  disk hits the same thing.
- `execute-rule.ts`'s module-level `callerAggregatesReports` flag was set on the
  CLI's copy and read on the rule file's, so every configuration finding printed
  twice. Module state has no cross-registry identity, so there is no structural
  fix.

Resolved by inverting the loader: **native `import()` first, jiti only when Node
refuses the file's module format** (`src/cli/import-rule-module.ts`). The normal
path keeps one registry and upstream's semantics; bug 0074's CJS project still
loads. The fallback is narrow — an `ArchRuleError` from a self-executing rule
file must never be retried — and it is **proved live by sabotage**: making it
throw reds `config-cjs-project.test.ts`, so it is not dead code.

#### The formatting decision, made

`prettier --write` on the 8 files. Byte-identity with upstream was already gone
— Phase 1 changed 20+ source files — so what it would have bought is now bought
by git, while a permanently-red `format:check` would keep `npm run validate` from
ever passing. Recorded here because the plan asked for a decision, not a chore.

Phase 1 also cleared the corpus-side breakage the copy caused:
[bug 0160](../bugs/0160-within-creates-an-import-cycle-and-nothing-watches-for-cycles.md)'s
code pointer into the old `helpers/` location of `within.ts` (the file moved to
[`packages/ts/src/builders/within.ts`](../../packages/ts/src/builders/within.ts))
and the three ADR citations in
[ADR-006](../../adr/006-framework-rules-architecture.md) and
[ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md) — **still open**,
carried into Phase 2 rather than closed here, because two of the three cited
tests moved into files the kernel re-split will move again.

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

- **Phase 1:** engine failures → 0, every one disposed as fixed or deferred to a
  named phase. **Done:** 3537 tests · 3504 passing; the 33 that remain are 30
  upstream-corpus (out of scope) + 3 later-phase.
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

- [x] Phase 1 — the engine failures (29 measured, not 38): 0 remaining; every one
      fixed, or deferred to a named later phase of this plan. No test deleted.
- [ ] Phase 2 — re-split the kernel.
- [ ] Phase 3 — restore `report`, `--fix`, `havePathMatching`.

Deferred: none.
