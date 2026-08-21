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

- `check:vacuity` — **red**, not green. Read against the stale build it reported
  every preset as `config-finding`; against a fresh one all five are
  **fail-open**, because upstream's presets RETURN builders where eess's threw.
  Same root cause as `check:baseline` below — ADR-008's `report`. **Phase 3.**
  (This one was misread twice: the Phase 1 close repeated the stale reading.
  Three stale-`dist` misreadings in one plan is the lesson, not the individual
  slip — see the rule at the end of this section.)
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

**The rule, since this cost three misreadings:** `check:crossval`,
`check:baseline` and `check:vacuity` import the BUILT `@nielspeter/eess-ts`.
Never read one without `npm run build` immediately before it, and state the build
in the record. A stale `dist` does not fail — it answers confidently about code
that is no longer there, which is the failure mode this whole plan is about,
committed by the instrument instead of the subject.

Two further lessons: a gate that reads `dist` is
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

`prettier --write` on 7 of the 8 files. Byte-identity with upstream was already
gone — Phase 1 changed 20+ source files — so what it would have bought is now
bought by git, while a permanently-red `format:check` would keep
`npm run validate` from ever passing.

The eighth is the finding: `tests/fixtures/module-edge-forms/src/forms.ts` is
fixture data whose **layout is the property under test** —
`tests/core/module-edges-forms.test.ts` asserts the line number of every
import/export form in it, including that a statement's line differs from its
literal's line. Prettier collapsed a multi-line form, moved the lines, and
reddened three tests that had been green. Reverted and added to
`.prettierignore` with that reason. A fixture is data, not code, and a
formatter is exactly the tool that cannot tell the difference.

Phase 1 also cleared the corpus-side breakage the copy caused:
[bug 0160](../bugs/0160-within-creates-an-import-cycle-and-nothing-watches-for-cycles.md)'s
code pointer into the old `helpers/` location of `within.ts` (the file moved to
[`packages/ts/src/builders/within.ts`](../../packages/ts/src/builders/within.ts))
and the three ADR citations in
[ADR-006](../../adr/006-framework-rules-architecture.md) and
[ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md) — **still open**,
carried into Phase 2 rather than closed here, because two of the three cited
tests moved into files the kernel re-split will move again.

### Phase 2 — re-split the kernel · **DONE (with a named remainder)**

`eess-ts` imports `@nielspeter/eess` again. **30 modules moved into the kernel**;
`packages/ts/src/core` went from 57 files to 27, `packages/core/src` from 46 to
49, and **89 of eess-ts's 127 source files** now import the kernel — against
**zero** at the baseline.

| criterion (as written before the work)                            | result                                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `eess-ts` imports the kernel in a stated non-zero number of files | **89 of 127**                                                               |
| `check:family` green on a non-zero count                          | green — and it found **37 real violations** on the way, having been vacuous |
| `check:family` reds when a dialect's kernel imports are emptied   | sabotage-proven, and wired into `check:nonvacuity` as a standing probe      |
| `check:arch`'s `kernel-no-engine-deps` green                      | green                                                                       |
| `packages/core` imports ts-morph in zero files                    | zero                                                                        |
| `standalone-surface.test.ts` passes                               | passes                                                                      |

`.select()` came back with it — a kernel `RuleBuilder` method upstream never had,
which `@nielspeter/eess-crossvalidate` is built entirely on. Restoring it took
crossvalidate from **33 failing tests and 4 files that would not typecheck** to
**77/77 green**, and fixed four of the eight non-vacuity probes that were failing
at the Phase 1 close.

#### How the split was done

`violation.ts` was the unlock. It is the taint root — 25 of the 37 tainted files
depended on ts-morph only through it — and it splits cleanly: the `ArchViolation`
shape, `severityFor`, `remedyRepeatsMessage`, `byCodepoint`, `subjectOf` and the
identity-collision machinery are pure; `getElementName`, `enclosingScopeName`,
`getElementFile`, `getElementLine` and `createViolation` take a `Node`. Pure half
to the kernel (plus eess's own `ArchFix`), ts-morph half kept in the dialect,
and the tainted count fell 37 → 26 in one move.

The rest was mechanical, in three waves — 19 files, then `violation.ts`, then 11
more — each wave measured, built and run before the next.

#### Four findings

**1 — a basename is not a module.** The rewriter matched imports by last path
segment, so moving `core/errors.ts` also rewrote every import of
`rules/errors.ts` — a completely different module — and broke seven files. The
tool now matches by RESOLVED PATH. Recorded because the mistake is invisible in
review: both lines read `from './errors.js'`.

**2 — the family gate was vacuous, and is now not.** It went green at the
baseline **because** `packages/ts/src` imported nothing from the kernel: zero
imports, zero required re-exports, `0 === 0`. With the imports back it reported
37 genuine gaps. It now carries its own vacuity guard — an unsuppressable
finding when a package's kernel-import set is empty, whose message says so — and
`check:nonvacuity` gained a probe that empties a dialect's whole `src/` and
requires the gate to red. The three probes that existed all injected a _missing
re-export_, so every one of them assumed the imports were still there; none
could have caught the state this plan itself created.

**3 — two exclusion lists synced by a comment.** `scripts/lib/family-re-exports.mjs`
and `standalone-surface.test.ts` held the same list twice, kept in step by a
comment saying so and a guard that scraped the sibling's source text. Phase 2
grew one of them by 47 names — exactly when such a pair drifts. They are now one
module (`scripts/lib/kernel-surface.mjs`), and the old sync guard was replaced,
not deleted, by one that asserts the single-source property in both directions.

**4 — my own exclusion list disarmed two live probes.** Adding `UNSUPPRESSABLE`
and `byCodepoint` to the kernel-private list made the family rule skip them —
and those were the exact symbols two `check:nonvacuity` probes inject. Both went
`bad → exit 0`. The harness caught it, which is the entire reason it exists; the
probes now inject `collectViolations` and `diffAware`, which no list excludes.

#### The rule Phase 2 settled

**Moving a module's home must not change eess-ts's public API.** All 47 names
`standalone-surface.test.ts` newly reported were `packages/ts/src/core/`
internals — never exported from `src/index.ts`, unreachable by any consumer.
Publishing them because a file changed package would be a worse outcome than the
gap the test looks for. Verified mechanically against `packages/ts/src/index.ts`
at `119ba6d`. The five names that DID need re-exporting (`Selection`,
`ElementInfo`, `RuleBuilderLike`, `EdgeCoverage`, `GlobLeaf`) are types in
eess-ts's own public signatures — which is the gate working exactly as intended.

#### What Phase 2 did NOT do, and why it stops here

**27 ts-morph-tainted modules remain duplicated** between `packages/core/src`
and `packages/ts/src/core` — including the whole builder stack (`rule-builder`,
`terminal-builder`, `execute-rule`) and `exclusion-comments`, `project-relative`,
`path-universe`, `disk-set`, `combinators`. Unifying them is not a move; it needs
two design decisions this plan has no mandate to make on its own:

- **a project abstraction for the kernel.** The copied `terminal-builder` touches
  `ArchProject` in only a handful of places, so the coupling is thin — but the
  kernel currently has _no_ project concept at all (`PathUniverse` is its pure
  stand-in), and giving it one constrains all five dialects forever.

  **Re-measured 2026-08-21, and both numbers here were stale — in the direction
  that makes this decision smaller, not larger.** This bullet said "1298 lines"
  and "5 places"; the file is **917 lines** and touches `ArchProject` in **3**
  (`import type`, `getProject()`, `zeroSubjectsViolation(project)`).

  Where it went, traced rather than guessed — a first draft of this note
  attributed the shrink to `408c8e0`, which accounts for 32 lines of it:

  | commit                                                    | lines |
  | --------------------------------------------------------- | ----- |
  | `76d849f` refactor(0166): split the assertion guard       | 1353  |
  | `67d6cf0` **lift the vacuity machinery out of both** …    | 935   |
  | `0893477` split TerminalBuilder into declaration/terminal | 949   |
  | `408c8e0` make the RuleDeclaration seam real              | 917   |

  `67d6cf0` is the one that matters, and its subject says **"out of _both_
  TerminalBuilders"** — the duplication has already been narrowed once by work
  that treated the two copies as a pair. That is evidence the remainder is
  tractable, not just smaller.

  The count is left out of the prose above on purpose now: a line count in a plan
  is a number nothing re-derives, which is exactly how this one went stale inside
  its own paragraph about measuring rather than arguing.

- **a pluggable tokenizer for `exclusion-comments`.** The copied version blanks
  string literals with a real ts-morph tokenizer (bug 0154's fix); the kernel's
  does a regex scan. The other four dialects have no TS AST, so the kernel needs
  an injection point rather than a choice between the two.

Both are ADR-shaped, not plan-shaped, per this repo's own rule that a binding
design decision belongs in `adr/` and not buried in a plan. That is the next
step and it is **not** Phase 3's — Phase 3 restores dropped capabilities and can
proceed independently.

The duplication that Phase 1 measured actually breaking — module-level state in
`execute-rule.ts`, read by one copy and written by the other — is still live in
those 27. `src/cli/import-rule-module.ts` keeps it from firing by loading rule
files natively wherever it can; that is a containment, not a fix.

### Phase 3 — restore eess's own additions · **DONE**

| gate                      | at the Phase 2 close  | now                                      |
| ------------------------- | --------------------- | ---------------------------------------- |
| `check:vacuity`           | ✗ 5 presets fail-open | **green** — all five `config-finding`    |
| `check:baseline`          | ✗ crashed             | **runs**; 11 real findings (below)       |
| `check:nonvacuity`        | ✗ 4 probes            | **green — 0 failing** (was 8 at Phase 1) |
| `check:family`            | green                 | green                                    |
| typecheck · lint · format | clean                 | clean                                    |

**`report` (ADR-008).** Restored on all five presets, additively and by overload:
naming a mode returns `ArchViolation[]`, omitting it returns the un-executed
`RuleBuilderLike[]`. That keeps all 26 preset test files working — a bare union
made every `.violations()` call site an error, measured. Two ordering facts are
load-bearing and stated in the code: the reporting overload is declared FIRST
(because `Parameters<typeof preset>[1]` reads the LAST signature, and several
tests type their options helper that way), and the builder overload takes the
options type PLAIN — an `& { report?: undefined }` intersection made a _variable_
of the options type match neither overload.

**`--fix` (plan 0066).** CLI flags, `CheckArgs`, and the apply path restored;
proved end to end on a real edit — dry run leaves the file untouched, `--apply`
writes it. Worth recording: **no eess-ts rule has ever produced an `ArchFix`.**
The only producer is `eess-md`'s link autofix, run through this CLI, so the CLI
plumbing _is_ the whole capability.

**`havePathMatching` — the premise was wrong.** It was never dropped. Upstream
has it, byte-identical including eess's plan-0148 workspace-root behaviour, in
`predicates/identity.ts` rather than `predicates/module.ts`. The only real defect
was eess's test importing the old path. I restored a duplicate into `module.ts`
first; three separate guards caught it — `api/no-single-glob-predicates` (whose
rule text names this predicate as legitimately single-glob and scopes itself
around `identity.ts` for exactly that reason), the path-glob census, and the
primitive scan. Duplicate removed, test repointed.

#### The correction Phase 3 owes Phase 2

Phase 2 excluded 47 kernel exports from `standalone-surface.test.ts` on the
stated ground that _"none of these was reachable from eess-ts before the move"_,
verified against `119ba6d`. **`119ba6d` is the Phase 1 close — after the copy had
already dropped them.** The damaged state was used as the definition of normal,
which is circular, and it is the same error this plan exists to correct, made
inside the plan.

Re-measured against `3b851d2`, the last commit before the copy: **34 of the 47
were public.** All 34 are now re-exported, along with 12 more the copy dropped
that no list had noticed — 46 in total. The exclusion set is down to **13**
names eess-ts genuinely never published.

The rule that survives: _removing a published export is a breaking change, so
the burden of justification sits on the removal._ And the reference point for
"what was normal" is the last commit **before** the damage, never after it.

#### The one thing Phase 3 did NOT decide

ADR-008's Decision text says a preset **returns violations** and defaults to
**emit-then-throw**. The adopted engine returns un-executed builders and runs
nothing until asked — arguably a stronger form of caller-owns-reporting, and
what all 26 preset test files assert. Phase 3 restored the `report` option so
the ADR's mechanism exists again, but **did not change the default**, because
changing a documented default is an ADR amendment and not a plan's call to make
quietly. ADR-008 currently describes a default that no longer holds. Recommended
next step: amend ADR-008 to record the builder-returning default, or rule that
the default must change back — either way, in `adr/`, not here.

#### What `check:baseline` now says

It no longer crashes; it reports **11 real violations**, all one rule:
`no-silent-catch` in the copied source. Those are genuine findings against eess's
own `recommended` preset and they belong to the same unowned bucket as
`check:arch`'s 204 — see below.

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
- **Phase 2:** **Done.** `check:family` green on 89 importing files and red when
  a dialect's kernel imports are emptied (standing `check:nonvacuity` probe);
  `standalone-surface.test.ts` passes; `packages/core` imports ts-morph in zero
  files; `kernel-no-engine-deps` green.
- **Phase 3:** **Done.** `check:vacuity` green (5/5 presets `config-finding`),
  `check:baseline` runs, `check:nonvacuity` at 0 failing probes (was 8),
  typecheck/lint/format clean, and the pre-copy public export surface is restored
  in full — measured against `3b851d2`, not against the post-copy baseline.
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
- [x] Phase 2 — re-split the kernel: 30 modules moved, 89 of 127 eess-ts source
      files import the kernel (was 0), `check:family` green **and** non-vacuous,
      `standalone-surface` passes, `.select()` restored (crossvalidate 77/77).
      27 ts-morph-tainted modules stay duplicated — `deferred→ADR` (a kernel
      project abstraction + a pluggable exclusion-comment tokenizer), named in
      Phase 2's own section.
- [x] Phase 3 — `report` restored on all five presets (additive, by overload),
      `--fix` restored and proved end to end, `havePathMatching` found to have
      never been dropped (only relocated). 46 published exports the copy dropped
      are back; the Phase 2 exclusion list is corrected from 47 to 13 and its
      circular justification is recorded. `check:vacuity`, `check:baseline` and
      `check:nonvacuity` all fixed — nonvacuity is at **0** failing probes.
      `deferred→ADR` — ADR-008's stated preset DEFAULT (emit+throw) no longer
      matches the engine (return builders); restoring the option did not, and
      should not, silently change a documented default.

Deferred: **three ADR-shaped decisions**, none of them a plan's to make —
(1) a project abstraction for the kernel and (2) a pluggable exclusion-comment
tokenizer, which the 27 still-duplicated modules wait on (Phase 2 says why each
is a decision rather than a move); and (3) ADR-008's preset default, which the
adopted engine no longer matches (Phase 3).

Also unowned by any phase, and stated plainly rather than left implied: **204
`check:arch` violations and 11 `check:baseline` findings** — the copied source
under eess's own conventions (missing JSDoc, unused exports, non-null
assertions, silent catches). Measured identical before and after Phases 2 and 3,
so no phase caused them and no phase claims them. This plan's Success definition
requires them fixed or ruled; that work needs either a fourth phase or an
explicit deferral, and it is the user's call which.
