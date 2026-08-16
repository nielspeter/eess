# Plan 0147: Copy the eess-ts-bound delta from ts-archunit into packages/ts

## Status

- **State:** Done — all 4 phases landed and independently verified;
  `npm run validate` green throughout. See Close section at the end for the
  deferral accounting.
- **Priority:** High — plan 0088's own Phase 4 text required this ("eess-ts
  (`packages/ts/`): adopt the 37 missing modules + the newer body of every
  predicate/condition/builder/smell/graphql/preset") and its Progress ledger
  marked Phase 4 **Done** without delivering it or disclosing the gap in its
  own "what is NOT fixed, left open on purpose" list — the one item that list
  should have named and didn't.
- **Effort:** Large — ~8,000 diff-lines across 95 shared files, plus a small
  number of genuinely-missing modules. Phased so `validate` stays green after
  each phase.
- **Created:** 2026-08-15

## Problem

`eess-ts` is `ts-archunit`'s fork. Plan 0088 folded the kernel-bound doctrine
(ADR-009/010, the evidence gate) back in — that work is real and shipped
(v0.3.0). It did **not** fold the other bucket Phase 1's own delta spike
measured: **eess-ts-bound** — the predicates, conditions, builders, smells,
graphql, presets, and CLI that `ts-archunit` kept accumulating after the fork.
Both buckets were in Phase 4's scope by the plan's own text; only one shipped.

Re-measured 2026-08-15 against `ts-archunit` commit `b4084c9` (v0.61.0 — same
commit the delta spike used, so the spike's numbers are current, not stale):

| Bucket                                                  | Files | Diff-lines |
| ------------------------------------------------------- | ----- | ---------- |
| eess-ts-bound, shared (`packages/ts/src/**`)            | 95    | **8,009**  |
| eess-ts-bound, never received (corrected — see below)   | 4     | ~1,065     |
| kernel-bound, never received, no ts-morph import        | ~15   | —          |
| kernel-bound, never received, imports ts-morph directly | 15    | —          |

**The "37 never-received modules" figure needs a correction before it drives
any more work.** It was computed by basename match across the whole
`ts-archunit/src` tree without checking whether the file already exists in
`eess` under a **different** path. Re-checked file-by-file this session:

- `builders/within.ts` → **already exists**, relocated to
  `packages/ts/src/helpers/within.ts` (plan 0015), fully tested (3 test
  files). Not missing.
- `helpers/baseline.ts`, `helpers/baseline-generator.ts`,
  `helpers/diff-aware.ts` → **already exist**, correctly relocated to
  `packages/core/src/` (dialect-independent — diff/baseline filtering has no
  TS-specific content), functionally equivalent and in one case ahead
  (`bypassFilters` handling ADR-010 needs that ts-archunit's own version at
  this commit doesn't carry the same way). Not missing.
- `tsconfig/index.ts` → ts-archunit's own internal barrel; eess-ts already
  exports `tsconfig()`/`TsconfigBuilder` directly from
  `tsconfig/tsconfig-builder.ts`. Not missing, just organized flatter.
- `builders/correspondence-builder.ts` (698 lines) → **not a gap, a
  duplication risk.** eess already ships a correspondence primitive —
  `packages/core/src/correspondence.ts` — built independently this session
  (not ported), generalized to an engine-neutral `Selection<T>` so it serves
  `crossvalidate`/`md` as well as `ts`, already carrying `beComplete()` /
  `preserveRelations()` / the per-check cardinality-exemption fix. Porting
  ts-archunit's TS-specific, `RuleBuilder<T>.subjects()`-bound version
  alongside it would give the package two overlapping correspondence
  mechanisms — exactly the #1 failure mode the `review-proposal` skill's own
  history warns about. **Ruling: do not port verbatim.** Phase 2 below scopes
  the real question instead: does anything `correspondence-builder.ts` does
  reach code the kernel's `correspondence()` can't, and if so is that a
  targeted addition to the kernel primitive (one mechanism, not two)?

That leaves **4** genuinely-missing eess-ts-bound modules, not 37:

| File                           | Lines | What it's missing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `conditions/match-identity.ts` | 62    | `identifyMatches()` — stable per-declaration identity for body-analysis matches, so baselines survive edits above a match instead of misattributing by line number                                                                                                                                                                                                                                                                                                                                                                              |
| `cli/rule-file-findings.ts`    | 163   | `attributeToRuleFile()` (bug-0026 class: today's `file: ''` config findings from `packages/core/src/terminal-builder.ts` render with no location in the CLI) + `ruleFileFailure()`/`failureOrViolations()` (bug-0025 class: a non-`ArchRuleError` throw from one rule file currently rethrows in `packages/ts/src/cli/commands/check.ts:51-56` and **silently drops every other rule file's already-collected findings** — reproduced against the live code, not inherited from ts-archunit's history) + `ruleFileTruncated()` (bug-0029 class) |
| `cli/commands/doctor.ts`       | 244   | A `doctor` CLI command — eess-ts's `cli/commands/` has `baseline`/`check`/`explain`/`init`, no `doctor`                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `helpers/diff-aware.ts` widen  | —     | not a new file — see Out of scope: the `baseBranch` field ts-archunit's version carries is a possible small delta on the already-ported file, not counted in the 4                                                                                                                                                                                                                                                                                                                                                                              |

The **kernel-bound never-received bucket** (~30 modules named in the delta
spike) splits on one hard constraint: **15 of them import `ts-morph` directly
in ts-archunit** (`cache-registry`, `descendant-cache`, `element-cache`,
`empty-project-advice`, `identity-root`, `import-candidates`,
`metric-violation`, `module-edges`, `object-literal-functions`,
`orphan-exclusions`, `path-universe`, `per-root-compiler-options`,
`project-relative`, `selection-memo`, `shallow-clone`). `packages/core`
declares zero runtime dependencies and is gated ts-morph-free by
`arch.rules.ts`'s `eess/kernel-no-engine-deps` rule (ADR-007). **Copying these
15 verbatim is not possible without breaking this repo's own binding
architecture rule** — the honest answer to "why not just copy it" for this
slice specifically. Each would need re-derivation behind an engine-neutral
seam (a structural `ArchProject`-shaped type, per ADR-007 Rule 1), which is
design work, not a copy, and is out of scope here (see Out of scope). The
other ~15 (`check-all` [superseded by `finishPreset`, skip], `comment-suppression`,
`correspondence-core` [likely superseded by the kernel `correspondence()`,
same ruling as the builder above — verify, don't assume], `dedupe-config-findings`,
`diagnose`, `diff-disclosure`, `disk-set`, `edge-coverage`, `glob-diagnosis`,
`glob-evaluator`, `glob-site`, `rule-builder-like`, `stderr`, `type-guards`,
`unsuppressable`) carry no ts-morph import and have no such blocker — Phase 4
below.

## Implementation phases

### Phase 1 — Corrected classification (done, this plan)

Re-derived the shared-file diff list and the never-received list against the
live `packages/ts/src` and `packages/core/src` trees (not just basename
matching, which produced false positives — see Problem). Output is the table
above. **Files changed:** none (analysis).

### Phase 2 — Land the 4 genuinely-missing eess-ts-bound modules

- [x] done-otherwise: `conditions/match-identity.ts` — port `identifyMatches()`/`MatchKind`
      verbatim (no ts-morph-purity concern, it's `packages/ts`). Unit test
      (ts-archunit has no direct unit test for it either — only indirect
      coverage via a baseline-pattern integration test that depends on
      body-analysis conditions this plan hasn't ported yet; write one here).
      Wiring it into `conditions/body-analysis*.ts` so baselines actually use
      it is Phase 3's job (those files are themselves part of the 95-file
      delta) — landing the function alone is correct and inert until then.
      This checkbox stayed stale after the work actually landed — confirmed
      at close: `identifyMatches` is imported and called in
      `body-analysis.ts`, `body-analysis-function.ts`, and
      `body-analysis-module.ts`, matching the plan's own scoping.
- [x] done-otherwise: `cli/rule-file-findings.ts` — port `attributeToRuleFile()` /
      `ruleFileFailure()` / `failureOrViolations()` / `ruleFileTruncated()` +
      its full ported test suite (`tests/cli/rule-file-findings.test.ts`,
      11 cases, pins the finding shape independent of the CLI wiring).
      Confirmed at close: both files exist and are wired into
      `cli/commands/check.ts`.
- [x] done-otherwise: Wire it in: `packages/ts/src/cli/load-rules.ts`'s `loadRuleFiles`
      currently flattens every rule file's builders into one array,
      discarding per-file attribution — `runCheck`/`runBaseline` need
      per-file iteration to call `failureOrViolations`/`attributeToRuleFile`
      correctly. This is a real, live bug independent of ts-archunit's
      history (reproduced against `packages/ts/src/cli/commands/check.ts:51-56`
      this session): a non-`ArchRuleError` throw from one rule file rethrows
      today and drops every other file's findings. Red test first (per the
      `bug` skill discipline — this is a bug fix riding along in a feature
      plan, not itself the plan's subject), then fix. Landed differently
      than literally described: `loadRuleFiles` itself still takes a bulk
      file list unchanged; the per-file attribution fix instead lives in
      `cli/commands/check.ts`'s `runCheck`, which now calls
      `loadRuleFiles([file], ...)` inside a `for` loop over `args.ruleFiles`
      — the same guarantee (one bad file can't drop another file's
      findings), achieved by the caller rather than by changing the
      loader's own signature. Confirmed at close by reading `check.ts`
      directly.
- [x] done-otherwise: `cli/commands/doctor.ts` — read ts-archunit's version in full (not yet
      read this session beyond the file list) and decide: port as-is,
      port-adapted, or reject with a reason, same discipline as
      `correspondence-builder.ts` above. Record the ruling here. Ported in
      Phase 4 (`runDoctor()`, see that entry below) — this earlier checkbox
      was never ticked to match.
- [x] dropped-on-purpose: `correspondence-builder.ts` / `correspondence-core.ts` — the real
      question, not a copy: read what ts-archunit's version does that the
      kernel `correspondence()` doesn't (if anything), and record the ruling
      (extend the kernel primitive / reject as superseded / narrow port of a
      specific missing capability).

### Phase 3 — Reconcile the 95 shared eess-ts-bound files

The bulk of the diff-lines. Batch by directory, biggest/highest-risk first
(builders touch the evidence gate directly and need the most care; leaf
predicates/conditions are closer to mechanical). Order:

1. **Builders** (evidence-gate-integrated, highest risk):
   `slice-rule-builder.ts` (546 diff-lines), `cross-layer-builder.ts` (233),
   `function-rule-builder.ts` (118), `type-rule-builder.ts` (82),
   `class-rule-builder.ts` (82), `call-rule-builder.ts` (89),
   `module-rule-builder.ts` (32), `jsx-rule-builder.ts` (55),
   `scoped-function-rule-builder.ts` (16).
2. **Conditions**: `dependency.ts` (491), `slice.ts` (340),
   `cross-layer.ts` (307), `reverse-dependency.ts` (246), `call.ts` (97),
   `body-analysis.ts` (60), `body-analysis-function.ts` (59),
   `body-analysis-module.ts` (56), `members.ts` (33), `function.ts` (29),
   `structural.ts` (23), `jsx.ts` (13), `helpers.ts` (11), `exports.ts` (10),
   `catch-analysis.ts` (2).
3. **Presets**: `shared.ts` (400), `boundaries.ts` (313), `layered.ts` (243),
   `agent-guardrails.ts` (234), `data-layer.ts` (127), `recommended.ts` (116),
   `index.ts` (23). (Each of `agentGuardrails`/`dataLayerIsolation`'s
   `KNOWN_FAIL_OPEN` vacuity gaps — plan 0088 Phase 4a's finding — should be
   re-checked against the newer ts-archunit body: it may have already fixed
   the "constructs zero rules" hole upstream, which would let 0088's ratchet
   entries retire early instead of waiting for their 2026-11-15 expiry.)
4. **Smells**: `inconsistent-siblings.ts` (390), `smell-builder.ts` (207),
   `duplicate-bodies.ts` (178), `fingerprint.ts` (42).
5. **Helpers**: `slice-graph.ts` (308), `body-traversal.ts` (232),
   `matchers.ts` (185), `callback-extractor.ts` (102), `tarjan.ts` (31).
6. **Graphql**: `resolver-rule-builder.ts` (224), `schema-rule-builder.ts`
   (174), `schema-loader.ts` (118), `index.ts` (26).
7. **CLI**: `cli/commands/init.ts` (419), `cli/commands/check.ts` (242),
   `cli/index.ts` (192), `cli/load-rules.ts` (125, partly done by Phase 2's
   wiring), `tsconfig/tsconfig-builder.ts` (98), `cli/commands/baseline.ts`
   (92), `rules/metrics.ts` (91), `cli/resolve-config.ts` (62),
   `cli/watch.ts` (59), `cli/commands/explain.ts` (58), `rules/metrics-function.ts`
   (70), `cli/config.ts` (10).
8. **Predicates + models + remaining rules/**: the long tail, mostly small
   deltas (`predicates/module.ts` 129 down to several 4-line/0-line diffs —
   see the full measured list in this plan's PR description, re-derivable
   with the method in Phase 1).
9. **`index.ts` barrel** (170 diff-lines) — last, once every export it names
   exists. Rebuild the alias-disambiguation table (`notExist`,
   `haveNameMatching`, `resideInFile`, `havePropertyNamed`,
   `acceptParameterOfType`, `notImportFrom`, `haveAttribute*` — each collides
   2–10× across families per the delta spike) composed with eess-ts's own
   prefixed aliases (`classHaveMethodNamed` etc.) — do not replace them.

Each file lands with: the newer ts-archunit body, reconciled against eess's
`CollectResult`/`evidencedViolations()` gate (not ts-archunit's own gate
shape — that reconciliation already happened structurally in 0088; a
mechanically-copied file must call the eess seam, not reintroduce
ts-archunit's), ADR-005 compliance (no `any`/`as` — verify, ts-archunit
carries the same rule but re-check on port), and its ported/updated test
file. `npm run validate` stays green after each batch.

### Phase 4 — The non-ts-morph kernel-bound modules

Port `dedupe-config-findings`, `diagnose`, `diff-disclosure`, `disk-set`,
`edge-coverage`, `glob-diagnosis`, `glob-evaluator`, `glob-site`,
`rule-builder-like`, `stderr`, `type-guards`, `unsuppressable`,
`comment-suppression` into `packages/core/src/` where not superseded.
`correspondence-core` and `check-all` need the same "already superseded?"
check as their eess-ts-bound siblings in Phase 2 before porting — do not
duplicate. `diagnose()`/`orphanExclusions()` landing here closes the gap
plan 0088's ledger disclosed and left open on purpose.

## Out of scope

- **The 15 ts-morph-importing kernel-bound modules**
  (`cache-registry`…`shallow-clone`, listed in Problem) — re-expressing them
  behind an ADR-007 engine-neutral seam is design work (a structural
  `ArchProject` type), not a copy, and belongs in its own plan once Phase 4
  shows which of them are still needed after `diagnose()`/`orphan-exclusions`
  land natively.
- **Renaming eess-ts's existing aliases to match ts-archunit's names** — same
  exclusion 0088 already made; not a churn goal.
- **New engine features ts-archunit has gained since this plan's own
  measurement date** — this plan closes the measured 2026-08-15 delta: a
  moving upstream doesn't reopen it.
- **The GraphQL extension's own further ts-archunit-side plans** (if any) not
  reflected in the delta spike's file list.

## Test inventory

Every ported file carries its own ported/adapted test file — this is not a
"port code, backfill tests later" plan. Phase 2's `rule-file-findings.ts` and
its CLI wiring additionally get a **red-test-first** bug fix (per the `bug`
skill) for the live drop-other-files'-findings defect. `npm run validate`
(build + every `check:*` gate + typecheck + lint + format + test) must stay
green at the end of every phase, not just at the end.

## Success definition

- The 4 genuinely-missing eess-ts-bound modules are landed, tested, and wired.
- The 95 shared files carry ts-archunit's newer body, reconciled against
  eess's own evidence-gate/ADR-005 floor — not a second, conflicting
  implementation bolted alongside.
- `correspondence-builder.ts`/`correspondence-core.ts` and `check-all.ts`
  have a recorded ruling (port narrowly / reject as superseded), not a
  silent skip.
- The non-ts-morph kernel-bound modules land in `packages/core`.
- The 15 ts-morph-bound kernel modules have a named follow-on plan, not a
  silent drop — the gap plan 0088's own ledger should have disclosed and
  didn't.
- `npm run validate` green throughout.

## Progress ledger

- [x] Phase 1 — corrected classification. Done 2026-08-15 (this plan's
      Problem section is the deliverable).
- [x] Phase 2 — land the 4 missing modules + the live CLI bug fix. Done
      2026-08-15, uncommitted on `plan-0088-build`. Landed in order:
  - `conditions/match-identity.ts` — `identifyMatches` ported (the `MatchKind`
    type stays unexported, matching ts-archunit's own scoping), with a new
    unit test (6 cases; ts-archunit has no direct unit test for this function
    either, only indirect coverage via a baseline-pattern integration test).
    Wired into `body-analysis.ts`, `body-analysis-function.ts`,
    `body-analysis-module.ts` (the 3 conditions that report a match-position
    message) so it isn't dead code — this pulled forward a slice of Phase 3's
    "Conditions" batch, and pulled forward one kernel change: `ArchViolation`
    gained an optional `identity` field (`packages/core/src/violation.ts`)
    and `hashViolation` (`packages/core/src/baseline.ts`) now prefers it over
    the rule+element+message fallback when set. Both are additive — no
    existing caller breaks. New regression test proves the point directly:
    two in-memory copies of the same class, one with a blank line inserted
    above the match, produce different messages but the same
    `hashViolation()` output.
  - `cli/rule-file-findings.ts` — `attributeToRuleFile`, `failureOrViolations`,
    `ruleFileTruncated` exported; `ruleFileFailure` stays unexported (reached
    only through `failureOrViolations`, matching ts-archunit's own scoping and
    this repo's own unused-exports gate). Full ported test suite (17 cases),
    adapted for eess's `ArchViolation` shape (no `severity` field — the
    ported test's `severityFor` assertion doesn't transfer, replaced with a
    `bypassFilters` assertion) and routed through `failureOrViolations` rather
    than the unexported `ruleFileFailure` directly. One ts-archunit test case
    — "does not resurrect the double-printed remedy" — was not ported: it
    pins dedup behaviour that lives in `format.ts`
    (`packages/core/src/format.ts`), a different, not-yet-reconciled file
    (Phase 3, CLI batch).
  - Wired into the CLI for real: `cli/commands/check.ts`'s `runCheck` now
    loads and checks per rule file (was: bulk-load every file, then iterate a
    flat builder list) — a non-`ArchRuleError` throw, from either
    `loadRuleFiles` itself or a builder's `.check()`, is caught, reported via
    `reportViolations`, counted, and the loop continues to the next file.
    Reproduced the live defect first (a bad rule file rethrew and discarded
    every other file's results — bug-0025 class, confirmed against this
    file's code, not inherited from ts-archunit's history), then fixed it.
    `check.test.ts`'s `'re-throws non-ArchRuleError errors'` test — which
    pinned the old defect as if it were a feature — was rewritten to assert
    the new behaviour, plus a new multi-file regression test
    (`'keeps checking every other rule file after one fails to load'`).
    `cli/commands/baseline.ts`'s `runBaseline` got the same per-file
    treatment (was: one bulk `loadRuleFiles` + `collectViolations`, silently
    swallowing any non-`ArchRuleError` per-builder throw and crashing whole
    on a per-file load failure), plus `attributeToRuleFile` applied to every
    collected violation (not just crash-path findings) — its own new
    regression test confirms `generateBaseline`'s existing
    `bypassFilters`-exclusion correctly drops the synthesized
    config-finding from the written baseline while still letting the other
    files' real violations through.
  - `cli/commands/doctor.ts` and the `correspondence-builder.ts`/
    `correspondence-core.ts` ruling are **not yet done** — deferred to keep
    this phase's diff reviewable; next concrete step.
  - Verified at each step and again at the end: `npm run validate` full
    chain green (build, all `check:*` gates including `check:arch` — which
    caught two real dogfood violations during this work, both fixed: a dead
    unimported module before the body-analysis wiring, an unused export
    before un-exporting `ruleFileFailure` — typecheck, lint, format, and the
    full test suite, 149 files / 1989 tests in `eess-ts` alone).
- [x] Phase 3 — reconcile the remaining 95 shared files (9 batches, listed
      above; the body-analysis slice of batch 2 landed early, folded into
      Phase 2 above). **Done, 2026-08-15** — Batches 1–13 below (batch
      numbering grew past the original 9 as real sub-scopes surfaced;
      Batch 13's own note is the closing summary). Every genuinely-blocked
      item (dead-glob-diagnosis, `project-relative.ts` workspace-root
      awareness, `element-cache.ts`, `checkAll()`'s comment-suppression/
      diff-disclosure dependencies) is named, not silently dropped — deferred
      to the same follow-on plan as the 15 ts-morph-purity-blocked kernel
      modules from the Problem section.
  - **Cross-cutting discovery, batch 1 (Builders):** 13 of the 95 files
    reference a `globs()` dead-glob-diagnosis kernel subsystem
    (`glob-site.ts`/`glob-diagnosis.ts`/`glob-evaluator.ts`, ~600 lines, ts-
    archunit's plan 0069) that itself needs `path-universe.ts` and
    `project-relative.ts` — both on the 15-file ts-morph-purity-blocked list
    from the Problem section. `glob-site.ts` alone (the pure declaration
    layer: `GlobNode`, `stampGlobs`, `isFaultPosition`) has no ts-morph
    import and no blocked dependency, but is worthless to land alone — its
    only consumer is the evaluation half, which is blocked. Similarly, 6 of
    the 9 Builders (`class`/`function`/`module`/`call`/`type`/`jsx`-rule-
    builder.ts) reference `element-cache.ts`'s `createElementCache` — also on
    the ts-morph-blocked list. **Verdict:** for these files, `.globs()`
    overrides and the `element-cache` population-caching are deferred to the
    same follow-on plan as the 15 blocked kernel modules — not a copy today,
    named rather than silently dropped.
  - Checked all 6 cache-referencing builders' FULL diffs beyond the blocked
    parts: `class-rule-builder.ts`, `function-rule-builder.ts`,
    `type-rule-builder.ts`, `jsx-rule-builder.ts`, `module-rule-builder.ts`
    need no other changes today — eess's predicate/condition method surface
    is already at parity (in several places ahead: more JSDoc than
    ts-archunit's own current source). `scoped-function-rule-builder.ts`'s
    entire 16-line diff is a `globs()` override; no other changes needed.
  - `call-rule-builder.ts` had one real, live bug beyond the blocked parts:
    `.identifiedByArg()` mutated `this` in place and returned `this`, instead
    of copying — the exact bug-0016 class already fixed this session in
    `SliceRuleBuilder`/`ResolverRuleBuilder`/`SchemaRuleBuilder`/
    `SmellBuilder`, found because ts-archunit's own current source already
    carries the fix (`const next = this.copy(); next._identifyByArgument =
index; return next`) and eess's didn't. Fixed the same way. A new
    regression test reproduces the real hazard (two rules built from the
    same held selection, `.identifiedByArg()` called for only one) and was
    sabotage-verified — reverting the fix turns it red, restoring it turns
    it green. One existing test's doc comment, which described the old
    mutate-in-place behaviour as intentional, was corrected rather than left
    to mislead the next reader.
  - `slice-rule-builder.ts` (546 diff-lines, the largest in the whole
    95-file set): 5 more bug-0016-class defects found and fixed —
    `matching()`, `assignedFrom()`, `beFreeOfCycles()`, `respectLayerOrder()`,
    `notDependOn()` all mutated `this` in place instead of calling the
    class's own `copy()` override (added earlier this session for a
    different reason — protecting `_slices`/`_conditions` array aliasing —
    but never wired into the chain methods that needed it). Also closed the
    Important finding plan 0088's own review left open and disclosed but
    unfixed: the "no conditions" branch of `collectViolations()` hardcoded
    `examined: 0` even when real slices with real files existed, which would
    misname the cause (a generic "examined zero units" message when the real
    cause is "forgot to chain a condition") if it ever surfaced downstream —
    now returns the real file count, mirroring `RuleBuilder`'s own identical
    branch exactly. `collectViolations()` split into two small private
    helpers (`examinedFiles()`, `noConditionsResult()`) to stay under this
    repo's own 50-line method-length gate, which caught the growth live.
    Deferred (named, not silently dropped): the `globs()` override, the rich
    empty-discovery diagnostic subsystem (`emptyDiscoveryMessage`,
    `ownsDiscoveryDiagnosis`, `metaViolation`), and `ImportOptions`/
    `splitGlobArgs` for `beFreeOfCycles({ ignoreTypeImports })` — all need
    kernel modules not yet ported (`glob-site`/`glob-diagnosis`/
    `glob-evaluator`, `empty-project-advice`, `import-options.ts`'s own
    delta).
  - `cross-layer-builder.ts` (233 diff-lines): one more bug-0016-class defect
    — `.layer()` mutated `this` in place, and `CrossLayerBuilder` (which does
    not extend `TerminalBuilder`) had no `copy()` at all to call. Fixed with
    a small local `copy()` (no kernel dependency needed — this class has no
    subclasses, so the fix uses a concrete `CrossLayerBuilder` return type
    rather than `this`, avoiding an ADR-005 cast). Bug 0036 (a
    project-relative layer glob never resolving — needs `project-relative.ts`,
    ts-morph-blocked) and the `ownsDiscoveryDiagnosis()`/`examinedUnitNoun()`
    empty-layer diagnostics (need `owns-empty-discovery.ts`, NOT ts-morph-
    blocked but not yet ported either) are deferred, named. eess's own
    `matchSelections()`-based pairing is confirmed **ahead** of ts-archunit's
    hand-rolled nested loop here — ts-archunit's current source itself now
    carries a `@deprecated` note pointing at exactly this kernel primitive as
    "what `crossLayer` should have been built on."
  - Every one of the other 7 Builders-batch files (`class`/`function`/
    `module`/`call`/`type`/`jsx`/`scoped-function`-rule-builder.ts) needed NO
    changes beyond what's already covered above — their real content is
    already at parity (in several places ahead, with more JSDoc than
    ts-archunit's own current source); their only diff was `element-cache.ts`/
    `glob-site.ts` references (both ts-morph-blocked, deferred) plus
    import-path noise from the kernel/dialect split ts-archunit doesn't have.
  - **Batch 1 (Builders) is therefore fully accounted for — 9/9 files
    checked**, 3 real bug-0016-class defects found and fixed across
    `call-rule-builder.ts`/`slice-rule-builder.ts`/`cross-layer-builder.ts`
    (8 methods total), one already-disclosed Important finding closed, all
    with sabotage-verified regression tests (reverting each fix turns its
    test red). `npm run validate` green throughout (149 files, 1993 tests).
  - **Recalibration, worth recording plainly:** batch 1 surfaced that a large
    fraction of the remaining diff-lines across Phase 3's batches 2–9 are not
    independent per-file features — they route through a small number of
    not-yet-ported kernel modules (`glob-site`/`glob-diagnosis`/
    `glob-evaluator`, `element-cache`, `empty-project-advice`,
    `owns-empty-discovery`, `import-options.ts`'s delta, `project-relative`).
    13 of the 95 files reference the glob trio alone. Continuing file-by-file
    without porting the shared prerequisites first means re-deriving and
    re-stating the same "deferred, needs X" footnote dozens of times instead
    of once. **The non-ts-morph subset of that list — `glob-site.ts`
    (pure, no dependency), `glob-diagnosis.ts`/`glob-evaluator.ts` (block on
    `path-universe.ts`/`project-relative.ts`, which ARE ts-morph-blocked, so
    these two stay deferred too), `empty-project-advice.ts` (ts-morph-
    blocked, deferred), `owns-empty-discovery.ts` (NOT blocked, portable
    now, same WeakSet-registry pattern as `cardinality.ts` which already
    landed this session) — should be re-scoped as Phase 4's first slice and
    pulled ahead of Phase 3's remaining batches**, not the other way around.
    Real bugs (like the three found this batch) are still worth finding
    file-by-file; the glob/cache/discovery infrastructure is not.
- [x] Phase 4 — non-ts-morph kernel-bound modules. **Done, 2026-08-16, uncommitted on
      `plan-0088-build`.** Batches 1–4 below port and wire every module Phase 4's own scope text
      names. The 15-module ts-morph-purity-blocked estimate was corrected in place (5 of the
      real 7 already landed in earlier batches); the genuine remainder is spun off as
      [plan 0148](./0148-workspace-multi-root-awareness.md), not silently dropped. Detail below,
      preserved as the correction-then-progress record it is:
  - **The "15 ts-morph-blocked kernel modules" list in this plan's own
    Problem section was wrong.** Re-verified file-by-file against the live
    ts-archunit checkout (not trusted from the inherited delta-spike list):
    only **7** of the 15 actually `import ... from 'ts-morph'` —
    `descendant-cache`, `import-candidates`, `metric-violation`,
    `module-edges`, `object-literal-functions`, `per-root-compiler-options`,
    `project-relative`. The other 8 (`cache-registry`, `element-cache`,
    `empty-project-advice`, `identity-root`, `orphan-exclusions`,
    `path-universe`, `selection-memo`, `shallow-clone`) have no direct
    ts-morph import at all. Separately, "needs `ArchProject`" is not the
    same question as "needs the kernel" — a module typed against
    `ArchProject` (itself ts-morph-typed in eess's split) belongs in
    `packages/ts`, where ts-morph dependency is normal and unrestricted, not
    behind an invented kernel seam. `metric-violation.ts` is exactly this
    case: it imports `Node` from ts-morph directly, and simply lives in
    `packages/ts/src/core/` now (see below) — no seam needed, no seam built.
  - Attempted to pull the full dead-glob-diagnosis subsystem forward
    (`glob-site`/`path-universe`/`disk-set`/`glob-diagnosis`/`glob-evaluator`/
    `owns-empty-discovery`/`diagnose`) to unblock the 13 Phase-3 files that
    reference `globs()`. Traced it through to its real integration point —
    `TerminalBuilder`'s own `deadSelectorFindings()`/`evidencedViolations()`
    gate, which is the single largest delta in the whole fold (1200+ lines,
    with its own `narrowingHint()`/`examinedUnitNoun()`/
    `deadSelectorViolation()` machinery) — and correctly stopped short of
    porting the declaration-only modules with no live consumer (the exact
    unused-export trap `match-identity.ts` hit before it was wired in).
    **Verdict, recorded rather than re-litigated next time:** this subsystem
    is a genuinely separate, bounded piece of work deserving its own pass,
    not a fold-in alongside builder/condition reconciliation. `globs()` on
    the 13 referencing files stays deferred until that pass lands.
  - Landed a narrower, real, self-contained slice instead —
    `identity-root.ts` (portable, confirmed no `ArchProject`/ts-morph
    dependency at all): ported to `packages/core/src/identity-root.ts`
    (`discoverIdentityRoot`, `normalizeIdentityText`; `toPortablePath`
    trimmed — no consumer yet, added back when `disk-set.ts` needs it), full
    ported test suite (16 cases). This closed a real portability gap in this
    session's own earlier `identity` field work: an `identity` string built
    from `identifyMatches` embeds an absolute file path, and without
    root-scrubbing the same baseline generated on two machines (or locally
    vs. CI) would never match. `hashViolation` now takes an optional `root`
    and scrubs `identity`/`rule`/`element`/`message` through it;
    `generateBaseline`/`withBaseline`/`Baseline` all thread the same
    `discoverIdentityRoot()`-derived root through consistently.
  - Went further and closed the metric-baseline-churn defect
    (bug-0012 class) `identity-root.ts`'s own hash-formula work exposed:
    `metric-violation.ts` ported to `packages/ts/src/core/metric-violation.ts`
    (needs `Node`, so lives in the TS dialect, not the kernel — the
    placement correction above, applied for real). `ArchViolation` gained an
    optional `measured?: number` (kernel, additive). `Baseline.isKnown()`
    gained a **ratchet** comparison for any violation carrying `measured`:
    known if the baseline has an accepted measurement for this identity AND
    the current measurement is no worse — identity alone (which deliberately
    excludes the count) cannot express "improved" vs. "regressed", only a
    numeric comparison can. New ratchet test suite (5 cases: improves stays
    known, regresses does not even though the hash is unchanged, unchanged
    stays known, writes `measured` only for metric findings, no baseline
    entry is never known) — sabotage-verified against the pre-ratchet
    `isKnown()`.
    `metricViolation()` wired into all 8 real call sites across the
    codebase (not just the 2 this plan originally scoped for Phase 3 batch
    2): `conditions/members.ts` (`maxProperties`), `conditions/exports.ts`
    (`haveMaxExports`, hand-built — no `Node` to derive from, reports
    against the file), `rules/metrics.ts` (`maxCyclomaticComplexity`,
    `maxClassLines`, `maxMethodLines`, `maxMethods`, `maxParameters`),
    `rules/metrics-function.ts` (`maxFunctionComplexity`, `maxFunctionLines`,
    `maxFunctionParameters`). `packages/ts/src/core/violation.ts` gained
    `enclosingScopeName()`, extracted from `getElementName()`'s existing
    inline ancestor-walk (behavior-preserving refactor — `getElementName`
    still returns exactly `direct name ?? enclosing scope ?? kind name`) —
    `metricViolation()`'s per-member identity needs "what encloses this
    node", not "what is this node called", and the two differ for
    method-shorthand object-literal functions. New identity-shape regression
    tests in `tests/rules/metrics.test.ts` (2 cases: identity excludes the
    count, two different metrics on the same subject don't collide).
  - Also wired `identifyMatches` into `conditions/call.ts`'s two
    multiple-matches-per-call conditions (`notHaveCallbackContaining`'s
    callback-body search, `notHaveArgumentContaining`'s argument search) —
    flattening matches across all of a call's arguments before assigning
    identities (a per-argument counter would restart at 1 for each callback,
    colliding two callbacks with a match in the same enclosing declaration).
    2 new regression tests (per-match identity distinctness, identity
    stability when a line shifts above the match). Deliberately **not**
    wired: `reportedLine`/`triviaPos`-based line accuracy (a different,
    separate fix — accounting for leading comments in the reported line
    number — bundled with `identifyMatches` in ts-archunit's own diff but
    not required for baseline-identity stability, which is what this pass
    scoped).
  - `conditions/jsx.ts` and `conditions/catch-analysis.ts` — checked, no
    real delta beyond import-path noise and one `eess-exclude` comment
    wording difference; no changes needed.
  - `npm run validate` green throughout every step of this batch (149 files,
    2002 tests in `eess-ts`; 8 files, 67 tests in the kernel).
  - Not yet done: the dead-glob-diagnosis subsystem itself (see verdict
    above — its own pass); `disk-set.ts`/`diagnose.ts`/`doctor.ts` (depend on
    it); the remaining non-blocked, non-consumed kernel modules
    (`cache-registry`, `orphan-exclusions`, `selection-memo`,
    `shallow-clone`) — each needs a real consumer identified before porting,
    same discipline `owns-empty-discovery.ts` was held to.

### Phase 3, Batch 3 (Presets) — done for real content, 2026-08-15

**Correction first, load-bearing for the rest of this batch:** `presets/shared.ts`
is not a 5-line stub waiting to be filled from ts-archunit's 393-line
`shared.ts` — it re-exports the kernel's own `preset-dispatch.ts`
(`dispatchRule`/`validateOverrides`/`finishPreset`), a **different, native,
dialect-independent design** built this session's earlier phases, not ported
from ts-archunit at all. ts-archunit's `atPath`/`collectRule`/
`overrideFindings`/`declaredEmptyFindings` machinery is a different, TS-only
answer to the same problem eess's kernel already solves for every dialect.
Nothing to port here — the batch is about the individual presets' own logic
(`boundaries.ts`/`layered.ts`/`agent-guardrails.ts`/`data-layer.ts`/
`recommended.ts`), not their shared plumbing.

- **Closed all 3 remaining `KNOWN_FAIL_OPEN` vacuity-matrix entries for real**
  (`agentGuardrails()`, `dataLayerIsolation()`, `strictBoundaries()` — the
  exact gap plan 0088 Phase 4a inherited and named, and this plan's own
  Presets-batch note predicted might be fixable). **Correction to this
  document's own earlier claim:** `identity-root.ts` had already landed;
  `owns-empty-discovery.ts` had NOT — it was investigated and confirmed
  portable, then deliberately not ported (no live consumer; the dead-glob
  gate that would use it is still deferred). This plan's own progress ledger
  said otherwise for one batch — caught and corrected here rather than left
  to compound. Ported two small, genuinely engine-neutral kernel modules
  this batch actually needed — `stderr.ts` (`writeStderr`, the EPIPE-safe
  stderr channel — fixes a real,
  live bug: every `console.warn`-based library warning was invisible inside
  vitest's default reporter for a _passing_ test, so `.warn()`'s own output,
  stale/unused-exclusion warnings, and 5 other call sites were silently
  dropped in the common case) and `unsuppressable.ts` (`UNSUPPRESSABLE`, the
  one shared sentence naming which mechanisms a configuration finding
  refuses — `DECLARE_INSTEAD`/`UNSUPPRESSABLE_MECHANISMS` were trimmed,
  unused, matching the `toPortablePath` precedent). Added
  `presetConstructsNothingViolation(presetName, optionsHint)` to the kernel's
  `preset-dispatch.ts` (dialect-independent — any dialect's preset can have
  this shape) and wired it into all three presets with per-preset "attempted"
  logic (before override, matching the `agentGuardrails`/`dataLayerIsolation`
  precedent already established for `SliceRuleBuilder`'s own equivalent
  check): `dataLayerIsolation` (neither `baseClass` nor
  `requireTypedErrors`), `agentGuardrails` (reused its own existing
  `collectRuleIds()` helper), `strictBoundaries` (`boundaryFolders.length ===
0 && !noCopyPaste` — a discovery-glob cause, not an unset-flag cause,
  correctly distinguished from the other two). Retired the 3 stale
  `KNOWN_FAIL_OPEN` entries from `scripts/vacuity-matrix.mjs` and repointed
  `scripts/nonvacuity/bad-vacuity-matrix.mjs` + `scripts/check-nonvacuity.mjs`'s
  hardcoded sabotage target from `agentGuardrails()` to `schemaFromSDL()`
  (the one export still genuinely fail-open, unrelated to this batch — a
  different-shaped gap in the bare-SDL-parsing path). 2 existing preset
  tests that asserted the old fail-open behaviour as correct
  (`'passes when no boundary folders match the glob'`,
  `'skips base class check when baseClass not specified'`) were rewritten to
  assert the fix, plus one new test for `strictBoundaries`'s `noCopyPaste`
  escape hatch.
- **Migrated every real `console.warn` call site to `writeStderr`** — not
  just the ones the vacuity fix touched. 9 sites across
  `packages/core/src/{diff-aware,execute-rule,rule-builder,preset-dispatch,baseline}.ts`
  and `packages/ts/src/{builders/slice-rule-builder,graphql/schema-rule-builder,graphql/resolver-rule-builder,helpers/matchers}.ts`.
  Bulk-updated 57 `vi.spyOn(console, 'warn')` call sites across 17 test files
  to `vi.spyOn(process.stderr, 'write')`; fixed the handful that asserted
  against a bare `console.warn`/`process.stderr.write` reference instead of a
  captured spy variable (the former is what `@typescript-eslint/unbound-method`
  exists to catch — caught it live, fixed by capturing the spy, same pattern
  already used everywhere else in the suite). New direct test coverage for
  `stderr.ts` itself (5 cases: writes with a trailing newline, doesn't double
  one that's already there, attaches its EPIPE-guard listener lazily once
  per process rather than once per write, `resetStderrGuardForTests()` lets
  a test observe reattachment). `resetStderrGuardForTests` needed an
  `eess-exclude eess/no-unused-exports` (test-only hook, and the gate
  correctly doesn't count test-file imports as "used" — first precedent for
  that exact shape in this codebase).
- `npm run validate` green throughout (149 files, 2003 tests in `eess-ts`; 9
  files including the new `stderr.test.ts`, in the kernel).
- Deliberately not attempted in this batch: `recommended.ts`/`layered.ts`'s
  own remaining deltas beyond what `dispatchRule`/`finishPreset` already
  cover, and `presets/index.ts`'s barrel ordering — neither surfaced a real
  gap during this pass; revisit only if a future diff shows one.

### Phase 3, Batch 4 (Smells) — done for real content, 2026-08-15

- **Four more bug-0016-class fixes** (mutate-vs-copy: a chain method mutates
  `this` directly instead of routing through the builder's own `copy()`
  override, so two branches taken from the same held selection leak state
  into each other): `SmellBuilder.inFolder()`/`minLines()`/`ignoreTests()`/
  `ignorePaths()`/`groupByFolder()` (5 methods, one shared base every smell
  detector inherits), `DuplicateBodiesBuilder.withMinSimilarity()`,
  `InconsistentSiblingsBuilder.forPattern()`. Every fix sabotage-verified
  (stash the source fix only, confirm the paired regression test goes red,
  restore, confirm green) — including catching and fixing one regression
  test whose own design (`smell-builder.test.ts`'s "branches from a held
  selection via `.because()` do not leak scoping into each other") didn't
  actually capture the return value of the first branch, so it couldn't have
  gone red for the right reason; fixed the test's own logic, not just the
  source.
- **`distinctVocabulary`/`minDistinctVocabulary()`** — a false-positive
  reducer for duplicate-body detection, ported into `fingerprint.ts` (new
  `distinctVocabulary` field, computed over identifier/literal `SyntaxKind`s
  in `buildFingerprint()`) and `duplicate-bodies.ts` (`_minDistinctVocabulary
= 8` field, `minDistinctVocabulary(n)` setter, a second fast-rejection in
  `findSimilarPairs()` alongside the existing similarity threshold). Rationale:
  a shared AST shape alone (a wither, a getter, a boilerplate skeleton) isn't
  evidence of copy-paste when it carries almost no distinct vocabulary — the
  new floor rejects pairs below it regardless of how high their structural
  similarity scores. `docs/smell-detection.md` updated (Configuration table
  row + a "Distinct vocabulary" bullet in the AST Fingerprinting section).
  The new default floor correctly flagged 2 existing fixtures
  (`tests/fixtures/presets/agent/src/violations.ts`'s `sumA`/`sumB`,
  `tests/fixtures/presets/boundaries/src/{feature-a,feature-b}/helper.ts`'s
  `helperA`/`helperB`) as too-minimal to be real copy-paste evidence — rather
  than lowering the floor to accommodate deliberately-minimal example code,
  rewrote both fixtures with realistic, richer vocabulary while preserving
  the same structural shape (so they still trigger high AST similarity),
  reasoning that real-world copy-paste rarely involves single-letter
  variables. Vocabulary counts verified empirically against the actual built
  `buildFingerprint()` (a throwaway Node script, run then deleted) rather
  than by hand, after getting the count wrong by hand twice.
- **`cache-registry.ts`/`selection-memo.ts`** ported into the kernel
  (`registerCacheReset`/`clearRegisteredCaches`, `selectionMemo<T>()` —
  pure, WeakMap-based memoization + reset-registry pattern, no ts-morph).
  Wired into two real consumers: `packages/ts/src/core/project.ts`'s
  `resetProjectCache()` now also calls `clearRegisteredCaches()`, and
  `DuplicateBodiesBuilder` gained a `selected()` private method memoizing
  `collectFilteredFunctions()` via `selectionMemo`, with `detect()`/
  `examinedCount()` both routed through it. `resetProjectCache()`'s doc
  comment initially mis-described the WeakMap semantics; caught it,
  looked up ts-archunit's own original comment, and used its actual
  reasoning instead of a guessed one.
- **`identity` fields added to duplicate-bodies/inconsistent-siblings
  violations** — `duplicate-pair::${sorted endpoints}` and
  `inconsistent-sibling::${filePath}::${patternDesc}`, matching the
  bug-0012-class baseline-ratchet identity shape landed earlier this plan
  for other conditions.
- `npm run validate` green throughout (149 files, 2006 tests in `eess-ts`
  and the kernel combined). Confirmed no scratch-file pollution left behind
  (the throwaway vocabulary-verification script).

### Phase 3, Batch 5 (Helpers) — matchers.ts + body-traversal.ts, done for real content, 2026-08-15

**Correction of direction, load-bearing for the rest of this batch:** an
earlier diff read (`diff -u ts-archunit/... eess/...`) was misread backwards —
the removed (`-`) lines are ts-archunit's, the added (`+`) lines are eess's.
For `helpers/matchers.ts` this batch, ts-archunit is genuinely ahead, carrying
real upstream bug fixes eess never received. Caught before any code was
written on the wrong premise.

- **Ported a stale-matcher-state fix.** `comment()`'s matcher held a
  `Set<string>` of matched `filePath:pos` keys closed over inside the
  returned matcher object, never reset — so the SAME rule object returned
  violations once and then nothing on its second evaluation. Live impact:
  watch mode, a preset array checked twice, any test reusing a rule
  constant. Fixed by making `comment()` stateless: `ExpressionMatcher`
  gained an optional `matchedTriviaPositions?(node): readonly number[]`
  member (a matcher is a "trivia matcher" by this method's presence, not a
  separate boolean flag — the two disagreeing was itself a prior defect
  shape), and dedup now happens in the traversal, keyed by comment
  position, not in matcher state.
- **Ported the STUB_PATTERNS anchoring/case-discipline fix.** The prior
  `STUB_PATTERNS` (`/\b(TODO|...)\b|.../i`) was unanchored and fully
  case-insensitive — it matched a marker word anywhere in prose (a
  docstring mentioning "TODO" three times, a wrapped JSDoc line starting
  `stub,`) and matched lowercase markers no convention actually uses.
  Replaced with the anchored version: markers must open a comment line and
  stay case-**sensitive** (the anchor alone isn't enough — a wrapped JSDoc
  continuation line can start with lowercase prose); the two phrase forms
  ("not implemented", "coming soon") are anchored too and case-**insensitive**
  via a new `anyCase()` helper that derives the letter-by-letter alternation
  (metacharacter-safe, multi-character-case-mapping-safe — `'ß'.toUpperCase()`
  is `'SS'`, which a naive `[Ss]`-per-letter class would silently mishandle)
  rather than hand-alternating first letters only, which is the exact shape
  of regression ts-archunit's own history records for this pattern.
  `anyCase` is exported for test use only (`eess-exclude`d, absent from
  `src/index.ts` — not public API, matching the `resetStderrGuardForTests`
  precedent from the Presets batch).
- **Ported the trivia line-accuracy fix**, end to end through
  `helpers/body-traversal.ts`: `MatchResult` gained `triviaPositions`
  (parallel to `matchingNodes`); a new `Match { node, triviaPos? }` type and
  `reportedLine(node, triviaPos)` accessor (comment's line when trivia,
  node's own line otherwise — one accessor instead of open-coded
  `getStartLineNumber()` calls that could disagree between a violation's
  `line` field and its message text); a new `triviaMatches()` traversal
  dispatches trivia matchers first (before the by-kind/broad split), so a
  trivia matcher that also narrows by `syntaxKinds` still gets full trivia
  expansion; and a `triviaRoot()` fix in `searchFunctionBody()` — a
  function's own leading comment attaches to the **declaration**, and for
  an arrow assigned to a `const` that's the enclosing `VariableStatement`,
  two levels above `ArchFunction.getNode()` — so `noStubComments()` was
  blind to `// TODO` / `/** TODO */` directly above a `const f = () => …`,
  which is one of the two placements anyone actually writes. Wired through
  all 4 real consumers: `conditions/body-analysis.ts`,
  `body-analysis-function.ts`, `body-analysis-module.ts` (all three:
  `node.getStartLineNumber()` → `reportedLine(node, result.triviaPositions[index])`
  at each violation site), and `conditions/call.ts` (`findMatchesInNode` now
  returns `Match[]` instead of `Node[]` — its two `notHave*Containing`
  conditions updated to map `.node` for `identifyMatches` and use
  `reportedLine(match.node, match.triviaPos)` for the message).
- **Ported `core/descendant-cache.ts`** (new file, `packages/ts/src/core/` —
  ts-morph-typed, so packages/ts not the kernel, per this plan's corrected
  architectural understanding): `descendantsOfKind()`/`allDescendants()`,
  one walk per `(node, kind)` shared across matchers, invalidated per
  source file via `onModified` (a node survives an edit to its own body and
  is not forgotten, so a bare `WeakMap<Node, …>` would serve a stale
  pre-edit list) and validated per hit against `wasForgotten()` on the
  cached list's endpoints (`node.forget()`/`forgetNodesCreatedInBlock()`
  forget descendants without firing `onModified`, so an early
  "is the key node forgotten" check guards the harmless case and misses
  the one that throws). Registers its reset via the kernel's
  `registerCacheReset()` (already ported and wired into
  `resetProjectCache()` in the Smells batch) — no additional wiring needed.
  Wired into `body-traversal.ts`'s `findMatchesByKind`/`findMatchesBroad`/
  `triviaMatches`.
- **Sabotage-verified both halves independently**: stashing `matchers.ts`
  alone reds 9 stub-marker/trivia tests (anchoring, case-sensitivity, arrow-
  const docstring placement, dedup-by-comment count); restoring it and
  stashing `body-traversal.ts` alone instead throws a `TypeError` reading
  `triviaPositions[index]` off the old `MatchResult` shape in all 22
  trivia/cache tests — confirming both halves are independently load-bearing,
  not redundant with each other.
- **Ported `tests/core/descendant-cache.test.ts`** (new, 23 cases) and
  `tests/helpers/pattern-change-moves-baselines.test.ts` (new, 18 cases —
  `anyCase`'s round-trip-in-every-casing property tests, plus a
  change-detector on `STUB_PATTERNS`'s exact `String()` form: the pattern
  text is inside `identifyMatches`'s identity via the matcher's
  `description`, so a silent pattern-text change silently invalidates every
  baselined `noStubComments` finding — this file's whole job is to make
  that impossible to do by accident). **One test rewritten, not ported
  verbatim**: `descendant-cache.test.ts`'s
  `'does not fix forgetNodesCreatedInBlock, which was already broken'`
  asserted a defect specific to ts-archunit's own `FunctionRuleBuilder`
  element cache (plan 0075 there) — a layer eess never ported (confirmed:
  `packages/ts/src/builders/function-rule-builder.ts` has no element cache;
  `getElements()` re-collects fresh every call). Empirically verified via a
  throwaway probe script (written, run, deleted) that eess's actual
  behaviour after `forgetNodesCreatedInBlock` does **not** throw — genuinely
  better behaviour than ts-archunit's own documented defect, not a gap.
  Rewrote the test to assert eess's real behaviour honestly rather than
  port a false claim about a bug that doesn't exist here.
- Also folded in two small same-file deltas found while reconciling:
  `matchers.test.ts`'s two `expression()`-dedup assertions upgraded from
  bare counts to identity checks (`.map(m => m.node.getText())`), now that
  `findMatchesInNode` exposes `.node`; `matchers-jsx.test.ts`'s
  `jsx: 2` → `jsx: ts.JsxEmit.React` readability fix.
- `npm run validate` green throughout (151 files, 2066 tests). Only
  pre-existing, expected non-green output in the full log: the one
  documented `schemaFromSDL()` `KNOWN_FAIL_OPEN` vacuity-matrix entry, and
  `check:nonvacuity`'s own sabotage-fixture output (rule files that are
  _supposed_ to fail, proving the gate catches them) — confirmed by
  re-running `npm run validate` standalone (exit 0).
- **`tarjan.ts` checked — eess is already ahead, nothing to port.** The
  diff read backwards again at first glance: eess's current file already
  has the `noUncheckedIndexedAccess`-safe guard pattern (`const lv =
lowlink[v]`, explicit `undefined` checks) that ts-archunit's still expresses
  with `lowlink[v]!`/`eslint-disable-next-line
@typescript-eslint/no-unnecessary-type-assertion`. No change needed.
- **`callback-extractor.ts` — ported the object-literal callback naming fix**,
  scoped narrowly. The real defect: two callbacks on `{ preHandler, handler
}` both came back **anonymous** and **shared the same `argIndex`** (the
  object's), because the file's own local `extractFromObjectLiteral`
  recursion routed every match through the same `fromArrowExpression`-style
  wrapper (hardcoded `getName: () => undefined`). Nothing in the shape told
  them apart, so a rule about the `handler` callback specifically was
  writable and selected nothing — expressible, plausible, and empty, the
  same failure class this plan has repeatedly fixed elsewhere.
  - Fixing it needed two dependencies eess didn't have, ported **only as
    far as this fix needs, not the wider feature they also enable**:
    `core/object-literal-functions.ts` (new — `collectObjectLiteralFunctions()`,
    the shared object-literal-property-value traversal: arrows, function
    expressions, method shorthand, nested literals depth-limited to 3;
    ts-morph-typed, so `packages/ts/src/core/`, not the kernel) and
    `fromObjectLiteralFunction()`/`qualifiedName()` added to
    `models/arch-function.ts` (builds an `ArchFunction` named by its
    qualified property-key path, e.g. `hooks.onRequest`).
  - **Deliberately NOT ported in this pass**: ts-archunit's wider
    "proposal 016" feature — `collectFunctions()`'s
    `includeObjectLiteralFunctions` opt-in (a 4th, file-level collection
    pattern for `functions()` itself, with its own `owningBindingName`/
    `isNestedInObjectLiteral` binding-name-prefixing logic) — because it
    reaches further than this fix needs: a `FunctionRuleBuilder`-level
    option, its own dedicated test file
    (`function-rule-builder-object-literal.test.ts` in ts-archunit, not yet
    even looked at here), and touches `element-cache.ts` (a module this
    plan has already deliberately deferred elsewhere) and metric-identity
    naming. `fromObjectLiteralFunction`/`qualifiedName` are ported now
    because `callback-extractor.ts` needs them directly, at the call site,
    with no binding-name prefixing — the wider Pattern-4 feature is a
    separate, future batch.
  - `object-literal-functions.ts` needed two `eess-exclude` waivers
    (`ObjectLiteralFunction` — return-element type, declaration-emit
    precedent already established for `MatchResult`/`Match`;
    `MAX_OBJECT_LITERAL_DEPTH` — trimmed from `export` entirely instead,
    since unlike `anyCase` it has no test-only consumer, matching the
    `toPortablePath` trim precedent over the exclude one).
  - Sabotage-verified: reverting `callback-extractor.ts` alone (stash) reds
    5 tests — the two dedup-by-name assertions, the multi-property naming
    assertion, and both rows of the new "property key wins over the
    function expression's own identifier" block — confirming the fix is
    load-bearing. Restored and green.
  - Ported `tests/core/object-literal-functions.test.ts` (new, 6 cases —
    the shared traversal's own coverage: arrow/function-expression/method-
    shorthand collection, nested key-path recording, the depth-3 boundary
    pinned exactly, computed-key degradation, non-recursion into function
    bodies, non-object-literal input) and updated
    `tests/helpers/callback-extractor.test.ts` (5 assertions upgraded from
    bare `.toHaveLength()` counts to name-based identity checks, plus a new
    2-case block for the "property key wins" behaviour).
- `npm run validate` green throughout (152 files, 2074 tests). No stray
  untracked files.
- Deliberately not attempted in this batch (Helpers batch closed):
  `slice-graph.ts` (308 diff-lines) was never reached — reprioritized in
  favor of the smaller `matchers.ts`/`body-traversal.ts`/
  `callback-extractor.ts`/`tarjan.ts` files this batch named; next up.

### Phase 3, Batch 6 (Graphql) — done for real content, 2026-08-15

- **`graphql/index.ts`** — only ts-archunit→eess package-name/branding
  strings in doc comments (`@nielspeter/ts-archunit` → `@nielspeter/eess-ts`);
  eess's own copy was already correctly branded. No change needed.
- **`resolver-rule-builder.ts` — found and fixed a severe, measured,
  currently-shipping defect**, not a stylistic delta: `getElements()` called
  `collectFunctions(sf)` with no options, so on any realistically-shaped
  GraphQL resolver map (`{ Query: { user: async () => {...} } }` — the shape
  every real GraphQL server uses) the `resolvers()` builder selected **zero
  real resolvers** and every rule written against it silently passed on the
  wrong subjects. Invisible in this repo's own test suite because every
  existing fixture (`post.resolver.ts`, `query.resolver.ts`,
  `user.resolver.ts`) used only top-level named declarations, never the
  realistic map shape. Root cause: `collectFunctions()` only collects
  object-literal function properties when explicitly asked
  (`includeObjectLiteralFunctions: true`, opt-in by design for the general
  `functions()` entry point, where it would otherwise flood every rule with
  inline callbacks) — `resolvers()` never asked.
  - Fixing it required porting the wider feature this plan's earlier
    callback-extractor pass had deliberately deferred: `FunctionCollectionOptions`
    (`includeMethods`/`includeObjectLiteralFunctions`) plus `collectFunctions()`'s
    Pattern-4 block, `owningBindingName()` (prefixes a collected callback's
    name with the binding that owns its enclosing object literal, so two
    literals sharing a key name — `routeA.handler`/`routeB.handler` — stay
    distinguishable) and `isNestedInObjectLiteral()` (roots-only walk so the
    shared traversal's own recursion isn't double-counted), all in
    `models/arch-function.ts`. The narrower fix from the earlier Helpers
    batch (`fromObjectLiteralFunction`/`qualifiedName`) turned out to be a
    real prerequisite, not a full solution — the wider option this plan had
    deferred was directly load-bearing for a real, severe bug after all.
  - One line: `getElements()` now calls
    `collectFunctions(sf, { includeObjectLiteralFunctions: true })`.
  - Added the `schema-map.resolver.ts` fixture (an idiomatic nested
    resolver map, `Query`/`Post` root types, arrow + method-shorthand
    resolvers, some using the DataLoader correctly and some hitting the DB
    directly) and a new test block proving `resolvers()` now sees all 4
    named-by-qualified-path resolvers and enforces per-resolver, not
    per-file (`schemaResolvers.Post.comments`/`schemaResolvers.Query.posts`
    correctly flagged, the two DataLoader-using ones correctly not).
    Sabotage-verified: reverting the one-line fix collapses the selection
    to a single phantom `'unnamed'` violation instead of the 4 real named
    resolvers — confirmed, then restored.
- **Two more bug-0016-class fixes** (mutate-vs-copy — a `copy()` override
  already existed on both `ResolverRuleBuilder` and `SchemaRuleBuilder`, but
  their own chain methods didn't call it): `ResolverRuleBuilder.resolveFieldReturning()`/
  `contain()`/`notContain()`/`useInsteadOf()` (4 methods) and
  `SchemaRuleBuilder.queries()`/`mutations()`/`typesNamed()`/
  `returnListOf()`/`haveFields()`/`acceptArgs()`/`haveMatchingResolver()` (7
  methods). Both builders already carried a narrower `.because()`-branch
  regression test that happened not to exercise this exact shape (branching
  via `.because()` already forks the object before the mutate-vs-copy bug
  in a chain method can manifest) — replaced each with ts-archunit's more
  thorough two/three-test blocks that branch directly off one held
  selection without an intervening fork, which is the shape that actually
  catches condition/predicate leakage. Sabotage-verified both: reverting
  `ResolverRuleBuilder`'s 3 methods doubles a violation count (11 → 22, a
  leaked second copy of the same condition stacking); reverting 5 of
  `SchemaRuleBuilder`'s 7 methods duplicates a single-element violation
  list (`['BadCollection']` → `['BadCollection', 'BadCollection']`). Both
  restored and green.
- **`schema-loader.ts` — ported a real error-message-accuracy fix.**
  `requireGraphQL()`'s catch previously reported every failure as "not
  installed" — genuinely not-installed, a corrupt install (an internal
  `graphql` file missing, which Node's `MODULE_NOT_FOUND` names by that
  internal file's specifier, not `graphql` itself), a version mismatch, and
  a throw from `graphql`'s own module init all produced the same
  install-instruction message, discarding the real cause in every case but
  the first. Now distinguishes by checking the failed specifier is exactly
  `graphql` before showing the install instruction; everything else reports
  "installed but could not be loaded: `<real cause>`". Needed a swappable
  loader seam (`setGraphQLLoaderForTests`/`resetGraphQLLoaderForTests`,
  both `eess-exclude`d as test-only) to reach the error branches at all —
  the alternative, mocking `node:module`'s `createRequire` directly, is a
  Node-builtin intercept that isn't reliably isolated per test file under
  Vitest's default worker reuse. New dedicated test file
  `schema-loader-require-errors.test.ts` (4 cases: reset restores the real
  loader, exact "not installed" specifier, corrupt-internal-file
  MODULE_NOT_FOUND naming a different specifier, a bare throw during
  module init) — sabotage-verified (collapsing the branch back to a single
  message reds 2 of the 4 cases; restored and green). Confirmed eess's
  existing bare-`catch {}` → `catch (err) { void err; ... }` pattern in the
  same file (`findGraphqlFiles`, `isGraphQLAvailable`) was **already**
  ahead of ts-archunit's own version here — no change needed, a second
  instance this plan has now found of eess independently landing ahead of
  ts-archunit on the same file it also needed catching up on elsewhere.
- `object-literal-functions.ts`/`arch-function.ts`/`schema-loader.ts`
  needed 3 more `eess-exclude`s for the same declaration-emit/test-only
  reasons already established this plan (`ObjectLiteralFunction`,
  `FunctionCollectionOptions`, `setGraphQLLoaderForTests`/
  `resetGraphQLLoaderForTests`); `MAX_OBJECT_LITERAL_DEPTH` had already been
  trimmed from `export` in the Helpers batch.
- `npm run validate` green throughout (153 files, 2085 tests). No stray
  untracked files.
- Deliberately not attempted in this batch: the dead-glob-diagnosis-adjacent
  remainder of `resolver-rule-builder.ts`/`schema-rule-builder.ts`'s own
  diffs (`globs()`, `GlobNode`, `stampGlobs`, `selectionMemo`-backed
  `selected()`, `examinedUnitNoun()`, `assertsSomething()`/
  `assertionAdvice()`, `describeRule()`, the optional `glob`/`project`
  constructor params and `getProject()`) — this is the same, single largest
  deferred subsystem this plan named earlier (the dead-glob-diagnosis
  gate's own `TerminalBuilder.evidencedViolations()` integration); eess's
  existing, differently-shaped evidence mechanism (`writeStderr` "has
  predicates but no conditions" + `collectViolations()`'s own
  zero-examined handling) already covers the same ADR-009/010 ground for
  these two builders without it. `FunctionRuleBuilder`'s own
  `includeObjectLiteralFunctions()` chain-method surface (a `functions()`
  builder-level option, distinct from the `collectFunctions()` function-level
  option ported here) — deliberately still deferred; not needed by
  anything landed this batch.

### Phase 3, Batch 7 (CLI, partial — smaller files reconciled) — 2026-08-15

**Corrected direction, repeatedly, this batch.** Misread `diff -u ts-archunit/…
eess/…`'s `-`/`+` sign convention several times in a row before catching it —
concluded a file "needed porting" from the diff alone, then found by directly
reading eess's current source that it was **already ahead**: `resolve-config.ts`
(already on `jiti`, with the exact bug-0074-class CommonJS-consumer-project fix
this plan initially thought was missing), `watch.ts` (already using a private
`#runCount` field + getter and the `AsyncIterator.return?.()` protocol directly,
no `isNullaryCallable` needed), `load-rules.ts` (already on `jiti`, already
throwing loudly on a non-builder default-export entry rather than silently
skipping it). Caught each only by reading the live file directly rather than
trusting the diff's sign direction — a discipline worth stating plainly since it
recurred: **read the file, not just the diff, before concluding action is
needed.**

- **`cli/config.ts`** — branding strings only, already correct in eess. No
  change.
- **`cli/index.ts`** — `--fix`/`--apply` flags and the whole deterministic-fix
  CLI surface turned out to be **eess-exclusive**, not a ts-archunit feature
  to port (confirmed by the sign-direction correction above, and independently
  by this session's earlier `check:nonvacuity` sabotage output showing
  `--fix (dry run)` / `--fix (applied)` already working). The one genuine gap
  — `doctor` command references (help text + `runDoctor` import) — matches
  this plan's own original "4 genuinely missing modules" table from before
  this session's work began; not attempted this batch, see below.
- **`cli/commands/explain.ts` — ported a real dedup fix** for the
  `--format agent` output. A preset generates one rule per configured folder
  with IDENTICAL metadata — `strictBoundaries({ folders })` over six
  boundaries produces six `no-cross-boundary` rules — so the same bullet was
  printed six times in output meant to be committed into an AI agent's system
  prompt, where repetition is pure cost (tokens on every request, reads as
  six different rules). Deduplicated on the bullet **text**, not the rule id
  (two rules can share an id and differ in imperative — deduping by id would
  silently delete a real rule from the agent's instructions). Added the two
  tests directly into the existing `'runExplain agent output'` describe block
  in `explain-command.test.ts` (not a separate file — eess already had solid
  coverage for sentinel-wrapping/grouping/fallback there; only the dedup
  behavior was missing). Sabotage-verified: reverting the fix reds the
  "printed six times → once" test with the exact expected/received shape;
  restored and green.
- **`tsconfig/tsconfig-builder.ts` — one more bug-0016-class fix**
  (mutate-vs-copy): `TsconfigBuilder.requires()` reassigned
  `this._requirements` in place and returned `this` instead of routing
  through `this.copy()` — so two branches held off the same `tsconfig(p)`
  builder are literally the same object, and a second branch's
  `.requires({...})` call accumulates into the first's. New regression test
  in `tsconfig.test.ts` (ts-archunit's own test suite has no dedicated test
  for this method's copy-on-write, despite the source already calling
  `.copy()` there — wrote one directly, matching this plan's established
  sabotage-verification shape rather than porting a nonexistent test).
  Sabotage-verified: reverting the fix makes branch B's `noEmit` requirement
  leak into branch A's violation set (`['strict']` → `['strict', 'noEmit']`);
  restored and green.
- **`resolve-config.ts`/`watch.ts`/`load-rules.ts`/`cli/commands/init.ts`
  (partial — `isRecord` sharing question only)** — confirmed already ahead,
  no changes needed. `isRecord` exists as independent local copies in
  `resolve-config.ts` and `cli/commands/init.ts` rather than a single shared
  `core/type-guards.ts` (which ts-archunit has and eess doesn't) — a real,
  small DRY gap (ts-archunit's own `type-guards.ts` docstring cites this
  exact duplication as its own reason for existing, "bug 0049" in its
  numbering), but not a behavioral bug, and not attempted this batch — the
  duplication is 2 copies, not the "written twice, verbatim" 2-copies-plus-a-
  third-site-cast shape that motivated the original consolidation.
- `npm run validate` green throughout (153 files, 2088 tests). No stray
  untracked files.
- Deliberately not attempted in this batch (CLI batch left open, most
  clearly-scoped remainder next): `cli/commands/doctor.ts` (244 lines, a
  whole new command — already named in this plan's own original "4
  genuinely missing modules" table, deserves its own focused pass rather
  than a CLI-batch afterthought) and `check.ts`'s own remaining diff (264
  diff-lines, not yet read in this batch — likely intersects with the
  already-existing `--fix`/`--apply` machinery eess has and ts-archunit
  doesn't, so needs the same "read the file first" discipline before
  assuming direction). `cli/commands/init.ts`'s own diff not yet checked.
  `isRecord` DRY consolidation into a shared kernel-level `core/type-guards.ts`
  — named above, small, real, deliberately deferred as non-behavioral.

### Phase 3, Batch 8 (`cli/commands/check.ts` — the open question resolved) — 2026-08-15

The prior entry left `check.ts` as an open question — was eess's per-builder
`.check(options)` loop a deliberate, correct consequence of its own kernel
design, or a real gap against ts-archunit's unified-pipeline guarantee?
**Resolved by direct measurement, not by porting lines from a diff.**

- **Confirmed a severe, currently-shipping, measured defect**, matching the
  exact shape ts-archunit's own history calls "bug 0029": `runCheck()`'s
  previous loop called each builder's own `.check(options)` directly. Each
  failing builder's `.check()` calls the kernel's `reportViolations()`
  internally BEFORE throwing — so N failing rules across a run write N
  separate, complete `{summary, violations}` JSON documents to stdout,
  concatenated. Measured directly with a throwaway probe script (two
  `executeCheck()` calls with `format: 'json'`, captured stdout,
  `JSON.parse()`): `PARSE FAILED: Unexpected non-whitespace character after
JSON at position 291`. This is exactly the input `explain --format
agent`'s own generated instructions tell an AI agent to `JSON.parse()`
  ("run `eess-ts check --format json`, read the `violations` array") — so
  the documented agent-verification loop breaks the moment more than one
  rule fails in one run.
- **Root-caused ts-archunit's own fix**, which is NOT
  `setCallerAggregatesReports` (a red herring this plan's earlier
  investigation didn't rule out before writing the "open question" entry —
  that flag turns out to govern a narrower, different case: `.warn()`'s own
  double-write of an unsuppressable `bypassFilters` finding that also rides
  a throw). The actual mechanism, found by reading ts-archunit's full
  `check.ts` directly: `runCheck()` never calls `.check()`/`.warn()` on any
  builder at all. It calls the pure, non-throwing `.violations()` accessor
  on every builder, collects everything into one array, applies
  baseline/diff filtering **once** over the combined list, and calls
  `writeReport()` **once** at the very end.
- **Ported that architecture**, adapted to eess's existing (simpler,
  severity-less) design rather than ts-archunit's later severity-aware one
  (`stampSeverity`, per-violation `error`/`warn`, `EdgeCoverage`,
  `comment-suppression`, `diff-disclosure` — all separate, larger, already
  out of scope; eess's rule files export only `.check()`-worthy builders,
  so every collected violation is implicitly error-severity, and no
  `severity` field was added to `ArchViolation`). Reused the EXISTING
  `collectViolations()` helper (already present, used by `--fix`, prefers
  `.violations()` and falls back to `.check()`+catch) for the main path
  too — no new kernel code needed. Also wired in `attributeToRuleFile()`
  (bug-0026-class: a location-less config finding with `file: ''` now
  correctly renders against its actual rule file — this was already ported
  to `packages/ts/src/cli/rule-file-findings.ts` earlier this session but
  never actually called from `check.ts`).
- **Also fixed the empty-run JSON case**: `reportViolations()` itself emits
  nothing for an empty violation set (correct for its many other callers —
  a passing `.check()` should print nothing). But a `--format json`
  consumer piping stdout and finding zero bytes on a CLEAN run is the same
  class of surprise as finding invalid JSON on a failing one — an agent
  expecting to always parse a document sees nothing and stops. `check.ts`
  now explicitly writes `formatViolationsJson([])` for the empty+json case,
  without changing the shared `reportViolations()` contract for its other
  callers.
- **Preserved eess's own terminal status-line feature** (the "N rules
  across M files · 0 failing" denominator line this whole project's own
  gates rely on for non-vacuity — CLAUDE.md documents it directly) rather
  than dropping it in favor of ts-archunit's plainer output. Split into two
  tallies: `ruleCount`/`failedRules` (builder-level, for the status line's
  own "N rules... failing" phrasing) and `filtered.length` (violation-level,
  for the exit code and the JSON `summary.total`) — deliberately NOT the
  same number when a single rule carries more than one violation, so the
  failing-case phrasing changed from "N of M rules... failing" (confusing
  when N could exceed M) to "M rules... · N violations", avoiding the
  math entirely rather than porting a phrasing that doesn't fit eess's
  metric.
- **Exit code semantics changed**: was a count of failing
  builders/rule-invocations, now a count of post-filter violations (matches
  ts-archunit's `'sums error-severity violations across builders'` test
  intent, and matches what a `--format json` consumer's `summary.total`
  already says — the two now agree, where before the exit code and the
  JSON body could report different numbers for the same run).
- Ported 4 new tests into the existing `check.test.ts` (adapted off
  ts-archunit's own, dropping severity-specific assertions to match eess's
  model): the WIRING test for `attributeToRuleFile`, the multi-builder
  single-JSON-document test, the clean-run JSON test, and the
  baseline-applies-to-the-unified-list test (mocking `withBaseline` via a
  partial `vi.mock('@nielspeter/eess', ...)`, following this repo's own
  existing `importOriginal()` + `as object` precedent from
  `diff-aware-function.test.ts` rather than a generic type-argument, which
  this repo's lint config forbids).
- **Sabotage-verified the whole fix** by reconstructing the pre-session
  per-builder-`.check()` architecture in a temp file, swapping it in, and
  confirming exactly the 4 new tests go red (the 8 pre-existing tests stay
  green — no regression in the ordinary pass/fail-count path). Restored and
  green. **Then verified end-to-end against the real built CLI binary**
  (not just vitest mocks): a genuine two-rule-file, two-violation scratch
  project run through `node packages/ts/dist/cli/bin.js check --format
json` now produces exactly one `JSON.parse()`-able document with both
  violations, exit code 1 — confirmed broken (two concatenated documents)
  before the fix, confirmed fixed after.
- `npm run validate` green throughout (153 files, 2092 tests). No stray
  untracked files. Two lint errors caught and fixed in the same pass
  (`prefer-const` on the now-never-reassigned `collected` array;
  `@typescript-eslint/consistent-type-imports` forbidding an inline
  `import()` type annotation in the test's `vi.mock` callback).
- Deliberately not attempted: the wider severity-aware pipeline
  (`stampSeverity`, per-violation `error`/`warn`, `EdgeCoverage`,
  `comment-suppression`, `diff-disclosure`/`suppressionNotice`) that
  ts-archunit's own `check.ts` also carries — a materially larger,
  separate feature (touches `ArchViolation`'s own shape, kernel-wide,
  every dialect) that this fix's narrower, measured scope did not need.

### Phase 3, Batch 9 (CLI batch closed: `baseline.ts` fixed, `init.ts` confirmed clean) — 2026-08-15

- **`cli/commands/baseline.ts` — the same false-green class as `check.ts`'s
  own fix, applied to `eess-ts baseline`.** `generateBaseline()` already
  correctly refuses to write `bypassFilters` configuration findings into the
  baseline file (ADR-010 — a rule whose own instrument is broken right now
  can never legitimately become "known, pre-existing debt"), but
  `runBaseline()` never told the caller: it returned `Promise<void>`, always
  printed the pre-filter violation count (overstating what was actually
  written), and `cli/index.ts`'s `handleBaseline()` never set
  `process.exitCode` at all — so `eess-ts baseline` unconditionally exited
  0 even when a real, unfixed blocker existed. Exactly the scenario
  ts-archunit's own history names directly: `npm run arch:baseline`
  "succeeds", gets committed, and the next `arch` job fails on findings the
  baseline was supposed to have covered, with nothing in between explaining
  why. Fixed: `runBaseline()` now returns `Promise<number>` (computes
  `refused`/`written` from the same `bypassFilters` filter `generateBaseline`
  already applies internally, prints the accurate written count, lists what
  was refused and why, returns `1` when anything was refused), and
  `handleBaseline()` propagates it to `process.exitCode`. 2 new tests (clean
  run returns 0; a `bypassFilters` finding returns 1, is listed by name, and
  confirmed absent from the written file) plus 2 existing tests updated to
  assert the return code their own scenarios already implied but never
  checked. Sabotage-verified: hardcoding the return to always `0` reds
  exactly the 2 new/updated exit-code assertions, none of the content
  assertions; restored and green.
- **`cli/commands/init.ts` (505 diff-lines) — read in full, confirmed
  already fully reconciled, no changes needed.** The bulk of the diff is
  NOT a portable delta: eess's own comment documents a real, deliberate,
  ADR-008-grounded architectural divergence — ts-archunit's presets return
  spreadable arrays directly usable in `export default [...preset(p)]`;
  eess's presets return eager `ArchViolation[]` (ADR-008's caller-owns-
  reporting design), which a CLI rule file cannot spread the same way. So
  `init` expands the floor preset into individual inline builders (visible,
  editable, CLI-loadable) instead, and deliberately scaffolds only the
  floor presets (`recommended`/`agentGuardrails`), leaving the shape
  presets (`layered`/`strict-boundaries`/`data-layer`) to test-file use —
  matching this session's own repeated direction-correction discipline,
  every OTHER function in the file (`leadingDir`'s file-vs-directory
  rejection, `detectIndent`'s minified-file handling, the `catch {}` →
  `catch (err) { void err; ... }` documentation pattern, the local
  `isRecord`) was checked directly against eess's live source and confirmed
  already present, not just inferred from the diff's sign direction.
- `npm run validate` green throughout (153 files, 2093 tests). No stray
  untracked files.
- **CLI batch (Batch 7/8/9) now closed**, except the two items already
  named and deliberately deferred: `cli/commands/doctor.ts` (dead-glob-
  diagnosis subsystem dependency) and the small `isRecord` DRY
  consolidation into a shared `core/type-guards.ts`.
- **Scoped the next batch while surveying `slice-graph.ts`** (344
  diff-lines, the last Helpers-batch leftover): its real content —
  `sliceEdgesOf()`/`ErasureQuestion` distinguishing "does importing this
  cause evaluation" (cycle question) from "does this reference the
  target's types" (coupling question), which diverge only under
  `verbatimModuleSyntax: true` for two specific import spellings — depends
  entirely on `core/module-edges.ts` (`ModuleEdge`, `edgesOf`,
  `FORWARD_EDGE_KINDS`), which does not exist in eess yet. Per this plan's
  own Phase 4 correction, `module-edges.ts` is ts-morph-typed but NOT
  kernel-blocked — it belongs in `packages/ts/src/core/`, the same
  placement `descendant-cache.ts`/`metric-violation.ts` already
  established this session. `module-edges.ts` is the single shared
  prerequisite for `slice-graph.ts` AND the still-unstarted Conditions
  batch's three largest files — `conditions/dependency.ts` (491
  diff-lines), `conditions/reverse-dependency.ts` (246),
  `conditions/cross-layer.ts` (307) — all of which read the same edge
  graph. Fixing three real, well-documented bugs in ts-archunit's own
  history (bug 0022 "forward import conditions blind to reexports/dynamic
  imports", bug 0059 "slice vs module conditions disagree about a
  dependency", plan 0085/0087 "slice graph blind to a re-export"/"an
  inline type import still requests the module"). **Verdict: this is the
  Conditions batch's real entry point, not a Helpers-batch leftover** —
  scoped as its own next pass (port `module-edges.ts` first, then
  reconcile its four consumers together, since porting the shared module
  without wiring a real consumer immediately would repeat the
  unused-export trap this plan has hit before), not attempted this batch.

**Refined that scope after actually reading `module-edges.ts` in full** (808
lines — read completely, not sampled). This is materially larger than the
diff-line count suggested: an extremely dense, extensively-measured module
(five module-edge kinds, a `verbatimModuleSyntax`-aware erasure classifier
distinguishing "does this reference types" from "does this cause module
evaluation", a source-order ordinal system solving a real baseline-identity
collision class, a locale-independent sort forced by a measured
`en-US`/`da-DK` divergence, a per-file cache with its own `onModified`
invalidation) accreting the fixes for 4 distinct historical bugs (0022,
0028, 0058, 0059) and 4 plans (0071, 0076, 0087, 0094) — the single most
carefully-engineered file surveyed anywhere in this fold so far. It has two
more prerequisites, also not yet in eess: `core/per-root-compiler-options.ts`
(89 lines, not yet checked) and `core/import-options.ts`'s own delta (grows
from eess's current 43 lines to ts-archunit's 116 — not yet checked either).
Combined with the four consumer files, this is a genuinely multi-thousand-
line, extremely subtle undertaking — not a same-session continuation of the
CLI batch, and not something to rush: several of the documented fixes exist
specifically because an earlier, plausible-looking implementation was
silently wrong (locale-dependent sort order, an ordinal off-by-one that
pre-accepted the next added edge, `require`'s classification trap). **Stops
here, named and scoped rather than started and abandoned mid-file.** Next
concrete step for a future pass: read `per-root-compiler-options.ts` and
`import-options.ts`'s delta in full, port `module-edges.ts` faithfully
(not a rewrite — the subtlety is the point), then reconcile `slice-graph.ts`
and the three Conditions-batch files together so they share one correct
edge definition rather than drifting the way ts-archunit's own bug 0022
described.

### Phase 3, Batch 10 (`module-edges.ts` and its five consumers, reconciled together) — 2026-08-15

Picked up exactly where Batch 9's scoping note left off. Ported `core/module-edges.ts`
faithfully (not a rewrite) with **one deliberate simplification**:
`usesVerbatimModuleSyntax()` reads `sourceFile.getProject().getCompilerOptions()`
directly instead of going through `per-root-compiler-options.ts`/`project-relative.ts`
— that workspace-multi-root awareness is deferred (bug-0036/0037/0058-class), matching
every earlier deferral of the same pair this session. `projectRoot` is threaded through
every signature that would consume it (`candidatesFor`, `edgeCandidates`,
`importCandidatePaths`) but always called with `undefined` — the parameter exists so a
future pass can wire it without another signature change, not because it's live now.

Reconciled all five real consumers together, in one pass, so they share one edge
definition rather than drift the way ts-archunit's own bug 0022 described:

- **`core/import-candidates.ts` (new)** — `candidatesFor()`/`matchedCandidate()`,
  fixing bugs 0014/0037 (a banned-package glob that only matched a resolved `.d.ts`
  path; a project-relative glob that never matched an absolute resolved path). Ported
  `importCandidates()` too, then **deleted it** — confirmed even ts-archunit's own
  `src/` has no consumer for it, only its tests do.
- **`helpers/slice-graph.ts`** — rewritten onto `module-edges.ts`. Added the
  `ErasureQuestion` distinction (`'module-request'` vs `'type-bindings'`), diverging
  only under `verbatimModuleSyntax: true` for two specific import spellings.
  `buildSliceDependencyGraph`/`findSliceDependencyDetails` are now module-private (no
  external consumer); `buildFileToSliceMap`/`SliceEdge` stay exported for
  `conditions/slice.ts`.
- **`conditions/slice.ts`** — `beFreeOfCycles` now resolves `ignoreTypeImports ?? true`
  per-field (bug 0057), sorts SCC members via `byCodepoint` (bug 0056), emits one
  violation per internal edge instead of per-SCC with a `cycle-edge::` identity, and a
  new `siteIdentity()` helper fixes the bug-0063-class basename collision.
  `respectLayerOrder`/`notDependOn` gained the real `(globs, options)` overload via
  `splitGlobArgs` and use the `'type-bindings'` question (opposite default from
  `beFreeOfCycles`, deliberately).
- **`conditions/dependency.ts`** — fully rewritten off `module-edges.ts` +
  `import-candidates.ts`. `onlyImportFrom`/`notImportFrom`/`dependOn` gained real
  overloaded signatures via `splitGlobArgs`, replacing 6 `as`-cast ADR-005 violations
  found live in this file. `onlyImportFrom`/`onlyHaveTypeImportsFrom` wired to
  `recordEdgeCoverage()` (bug 0015 — an allowlist condition testing zero edges passes
  vacuously; now disclosed via `edgeCoverageNotice()` rather than silent). `dependOn`
  gained an `identity` field (bug 0063). `onlyHaveTypeImportsFrom` now iterates every
  edge kind via `TYPE_IMPORT_KINDS`, catching re-exports it previously missed.
- **`predicates/module.ts`** — `importFrom`/`notImportFrom` rewritten onto
  `edgesOf`/`FORWARD_EDGE_KINDS` (same kind-set as `dependency.ts`'s conditions —
  fixes the other half of bug 0059, "predicate and condition disagree about what an
  import is") + `candidatesFor` + `splitGlobArgs`, removing the same 6 `as`-cast
  violations' predicate-side twins.
- **`conditions/reverse-dependency.ts`** — rewritten onto `moduleEdges()` (its first
  real consumer, closing `check:arch`'s last unused-export finding), replacing a
  hand-rolled three-pass indexer (`indexStaticImports`/`indexReExports`/
  `indexDynamicImports`) that included its own heuristic `resolveDynamicImport()`
  (guessing `.js→.ts`/`.jsx→.tsx`/directory-index extensions) where `edge.resolvedPath`
  already carries ts-morph's real compiler-driven resolution. Two real, live bugs fixed
  by the rewrite, both confirmed applicable to eess's prior code by direct inspection
  (not just diff-reading) before being changed:
  - **`addToGraph`'s dedup flag was inconsistent** (`indexStaticImports` passed
    `false`, the other two passed `true`) — eess's own graph had the identical
    structure, so two static imports of one target from one file produced two
    byte-identical violations at the same `file:line`. Now always deduplicated on
    `(importer, target)`, since one `moduleEdges` pass replaces the three separate
    indexers that motivated the flag.
  - **`require()`/`type-expression` edges were never counted** for "is this file
    referenced" purposes — a false-positive-dead-module risk (a module only
    `require()`-d by CJS code, or referenced only from a type position, would be
    reported as an orphan; deleting it would break the build). The reverse direction
    deliberately counts every kind, the opposite policy from the forward conditions,
    and the module now documents why in `getReverseImportGraph`.
  - Also carried the message fix from ts-archunit's own bug 0065: `onlyBeImportedVia`
    now names the importer by full path in the violation message instead of basename
    (basename collisions between importers in different folders used to print
    byte-identical, unreadable messages). `element` deliberately stays a basename —
    `.excluding()` matches on it.
- **`core/module-dependencies.ts` — deleted.** Once all three real consumers moved
  onto `module-edges.ts`, every export (`getDependencyDecls`, `resolveDependencyPath`,
  `isTypeOnlyDependency`, `DependencyDecl`) had zero remaining real consumers, and it
  was never re-exported from `packages/ts/src/index.ts` — a clean, non-breaking `git rm`.
- **`packages/core`** gained `edge-coverage.ts` (kernel, zero deps: `recordEdgeCoverage`/
  `untestedRules`/`edgeCoverageNotice`/`resetEdgeCoverage`) and `byCodepoint` in
  `violation.ts`, both re-exported from `packages/core/src/index.ts` and
  `packages/ts/src/index.ts` (the latter needed for `standalone-surface.test.ts`'s
  "eess-ts alone must expose everything the kernel exposes" check). `cli/commands/
check.ts` calls `resetEdgeCoverage()` at the top of every `runCheck()` and prints
  `edgeCoverageNotice()` to stderr (unconditional on format, keeping `--format json`
  stdout machine-clean).

**Verified, not just written.** Existing test suites run _before_ any test file was
touched, to measure drop-in compatibility: `slice-rule-builder.test.ts` +
`integration/slice-rules.test.ts` + `models/slice.test.ts` + `conditions/slice.test.ts`
(38 tests) and `conditions/dependency.test.ts` + `conditions/reexport-dependency.test.ts`
(32 tests) all passed unchanged. `conditions/reverse-dependency.test.ts` (11 tests)
passed unchanged against the full rewrite — strong behavioral-compatibility signal for
all six files. Full `packages/ts/` suite: 2093/2093 passed, one real failure found and
fixed (`standalone-surface.test.ts` — the edge-coverage re-export gap above).
`check:arch` — 0 unused-export findings (was blocking on `moduleEdges`,
`edgeValuePhrase`, `edgeTypeOnlyRemedy`, `edgeStream`, `edgeTypeOnlyNoun`, all now
real). Full `npm run validate` green: build, every `check:*` gate, typecheck × 5
packages, lint, format, 153 test files / 2093 tests. One lint error caught and fixed
in the same pass (`isTypeOnlyImport` — a leftover unused import in `dependency.ts`
from an earlier draft of the rewrite, orphaned once the file moved onto `edge.typeOnly`
directly). No stray untracked files.

**Discovered and deliberately deferred, not silently dropped: `disambiguateIdentities`
is missing from eess's kernel entirely.** While reconciling `reverse-dependency.ts`,
found ts-archunit's own bug 0065 ("reverse-dependency findings carry no identity, so
two collide on a shared basename") and its actual fix — not per-condition `identity`
fields, but a generic kernel mechanism (`core/violation.ts`'s `disambiguateIdentities`,
called from `core/execute-rule.ts` after severity filtering, before reporting) that
repairs a colliding `element::message` fallback hash by appending a collision suffix
only where the string is genuinely duplicated within a run — zero migration, because
it operates on the same fallback `hashViolation` already computes. `packages/core`
has `identity`/`measured` fields on `ArchViolation` and `byCodepoint` (ported earlier
this session) but **no disambiguation mechanism at all** — confirmed by grep, not
assumed. This means eess today still has the exact collision bug 0065 describes: two
same-basename orphan files, or two same-basename modules with an unused export, hash
to one baseline entry and only one is ever reported. This session's rewrite carries
the smaller, real half of 0065's fix (the message no longer uses basename for the
importer in `onlyBeImportedVia`), but the mechanism itself is kernel-wide
(`core/violation.ts` + `core/execute-rule.ts` + `core/baseline.ts`'s `subjectOf`, per
ts-archunit's own file list), touches every dialect's every condition, and needs its
own design pass — not a drive-by inside a single condition file's reconciliation. Left
unbuilt, named here so it isn't lost: porting `disambiguateIdentities` is real,
portable, dialect-independent kernel work, scoped as its own future batch.

### Phase 3, Batch 11 (`conditions/cross-layer.ts` — a real latent bug found and fixed, not just a port) — 2026-08-15

Read both the diff and the full context around it before touching anything, because the
diff's headline change — `PairConditionContext extends ConditionContext { layers }` — is
about a mechanism (`marksOwnEmptyDiscovery`/`ownsEmptyDiscovery`, coordinating with a
builder-level dead-glob-diagnosis gate) that depends on the dead-glob-diagnosis subsystem
already deferred all session (`glob-site.ts`/`glob-diagnosis.ts`/`doctor.ts` etc., none of
which exist in eess). Ported the part that's real and independent of that subsystem,
deferred the part that isn't:

- **`core/pair-condition.ts`** gained `PairConditionContext` (`ConditionContext & { readonly
layers: readonly Layer[] }`) — ts-morph-typed, so it stays in `packages/ts`, not the
  kernel, matching this plan's own placement correction.
- **`builders/cross-layer-builder.ts`**'s `PairFinalBuilder.collectViolations()` now threads
  its own resolved `this.layers` into the context. **This closes a real, live defect, found
  by reading the code rather than assumed from the diff**: `haveMatchingCounterpart(layers:
Layer[])` required the CALLER to pass a `Layer[]`, but nothing in the builder chain
  (`PairConditionBuilder`/`PairFinalBuilder`) exposed its own resolved layers publicly — so
  the only way to call it was to hand-reconstruct an independent copy of the same globs the
  builder already resolved. `cross-layer-rules.test.ts`'s own `resolveTestLayers()` does
  exactly this, and the builder's own docstring examples (`cross-layer-builder.ts:56,191`)
  called `haveMatchingCounterpart()` with **zero arguments** — which did not typecheck
  against the pre-existing required-parameter signature. Exactly the bug-0040 shape
  ts-archunit's own history describes ("no public API could produce this array"). Now
  `context.layers` supplies it and the argument is optional, kept only for a direct
  `evaluate()` caller with no context.
- **`conditions/cross-layer.ts`** — all three condition factories (`haveMatchingCounterpart`,
  `haveConsistentExports`, `satisfyPairCondition`) now hoist an empty-layer / too-few-layers
  check before their pair loop, porting `emptyLayerFinding`/`unusableLayersFinding`
  (`bypassFilters: true` + `UNSUPPRESSABLE`, both already present in eess's kernel from
  earlier this session) — but **without** `marksOwnEmptyDiscovery`/`ownsEmptyDiscovery`,
  since that machinery exists solely to coordinate with the dead-glob-diagnosis gate this
  session keeps deferring; porting it now would ship dead infrastructure with no consumer,
  the exact unused-export trap this plan has hit and avoided before.
- **Found and fixed a real double-report bug of my own making, caught by the existing test
  suite before it shipped**, not by inspection: the first cut of the empty-layer check fired
  unconditionally, and running the pre-existing `empty layer` tests immediately red two of
  them — `TerminalBuilder`'s own kernel-level non-vacuity guard (`examined === 0` →
  `zeroExaminedViolation()`, with a real `.expectEmpty()` escape hatch) already owns the
  simple "one dead layer, zero pairs total" case, so emitting `emptyLayerFinding` in that
  same case duplicated it — two violations for one root cause, one of them unsuppressable
  where the other has a legitimate exemption. Gated all three empty-layer checks on
  `pairs.length > 0`: the layer-level finding now fires only in the narrower case the
  generic guard cannot see — a 3+-layer chain where ONE layer is dead but pairs still form
  elsewhere (`examined > 0`, so the generic guard stays quiet), which otherwise degrades to
  confusing per-file "no counterpart" noise blamed on a neighbour's files, or true silence
  when the dead layer is used only as a `leftLayer` with nothing else to report in its own
  iteration.
- **New regression test**, not ported from ts-archunit (its layer/gate architecture differs
  too much to reuse the fixture directly): a 4-layer chain (`routes → nonexistent(empty) →
schemas → sdk`) where `schemas→sdk` still produces a real pair, so `pairs.length > 0` and
  the kernel's generic guard stays quiet. Asserts exactly one violation naming the dead
  layer, not the three confusing per-file findings the pre-fix code produced. **Sabotage-
  verified**: reverted the `pairs.length > 0`-gated empty-layer check, confirmed the new
  test goes red with `3` violations (none naming `nonexistent`) instead of `1`, restored,
  confirmed green.
- **Kernel additions**: `UNSUPPRESSABLE` (already existed in `packages/core/src/
unsuppressable.ts` from earlier this session, but was never re-exported) added to both
  `packages/core/src/index.ts` and `packages/ts/src/index.ts`'s barrels.
- Fixed the two now-stale-no-longer docstring examples in `cross-layer-builder.ts` implicitly
  — `haveMatchingCounterpart()` called with zero arguments now typechecks and behaves
  correctly (`context.layers` supplies the builder's real resolution), where before this
  batch it was a standing documentation bug.
- `npm run validate` green throughout: build, every `check:*` gate, typecheck × 5 packages,
  lint, format, 153 test files / 2094 tests (2093 + 1 new). One prettier formatting fix on
  the new test. No stray untracked files. `check:corpus` — 742 checks, 0 violations.

### Phase 3, Batch 12 (`predicates/` + `models/` + `rules/` surveyed exhaustively; one real bug found and fixed) — 2026-08-15

Surveyed every file in `packages/ts/src/predicates/`, `models/`, and `rules/` against
ts-archunit — the plan's own Batch 8 numbering. File sets match 1:1 across all three
directories (no whole-file gap either direction). Diffed each pair; read the live eess
file directly before concluding anything needed porting (the direction-reading discipline
this whole plan has practiced) — one survey pass initially misread `rules/code-quality.ts`
as needing a fix that eess **already has** (the `#private`-field skip in `noPublicFields()`,
already present with its own "dogfood finding, plan 0060" comment), caught before any edit
by reading the file instead of trusting the diff sign.

Confirmed already reconciled with no real delta: `predicates/{call,class,function,index,jsx,metrics,module}.ts`,
`models/{arch-call,arch-function,arch-jsx-element,cross-layer}.ts`,
`rules/{architecture,code-quality,dependencies,errors,hygiene,metrics-function,metrics,naming,security,typescript}.ts`.
Confirmed blocked on already-deferred subsystems, no new action: `predicates/{identity,type}.ts`
(entirely `project-relative.ts`/`glob-site.ts`).

**`models/slice.ts`'s `resolveByMatching()` — a real, live bug found and fixed** (bug-0009
class, matching ts-archunit's own history). eess's prior code appended a trailing wildcard
segment to the AUTHORED glob and derived `baseDir` from the glob's own last `/` — so a glob
whose final segment already carried a wildcard AND a trailing slash (`'src/features/*/'`,
the exact form of `matching()`'s own trailing-slash docstring example) computed
`baseDir = 'src/features/*/'`, a string containing a literal `*` no real file path can ever
contain. `filePath.indexOf(baseDir)` was then always `-1`, so `resolveByMatching` **silently
returned zero slices for that spelling, always** — not an edge case, the documented example
shape. Ported `parseMatchingGlob()` (module-private — the two `matchingGlobPrefix`/
`matchingGlobPattern` exports ts-archunit adds alongside it are consumed only by its glob-
diagnosis-aware `slice-rule-builder.ts`, which eess doesn't have; skipped both, matching the
"don't ship dead infrastructure with no consumer" discipline from Batch 10/11), which derives
`fullGlob` and `baseDir` from ONE shared normalization instead of two independently-derived
strings, removing the divergence class entirely. `resolveByDefinition()`'s own delta (bugs
0033/0035, project-relative slice-definition globs) stays deferred — genuinely blocked on
`project-relative.ts`, unlike `resolveByMatching()`'s fix.

Ran the full existing slice suite (models/conditions/builders/integration, 38 tests) _before_
touching any test file — all passed unchanged, confirming drop-in compatibility. Added 2 new
regression tests to `tests/models/slice.test.ts` for the trailing-wildcard-plus-slash spelling
(exercising the fixture's `feature-a/index.ts` sitting directly in its matched directory) and
its agreement with the no-trailing-slash spelling. **Sabotage-verified**: reverted
`resolveByMatching()` to the old two-derivation logic, confirmed both new tests go red with
`result === []` (exactly the always-empty behavior described above), restored, confirmed
green — 40/40.

`npm run validate` green throughout: build, every `check:*` gate, typecheck × 5 packages,
lint, format, 153 test files / 2096 tests (2094 + 2 new). No stray untracked files.
`check:corpus` — 743 checks, 0 violations.

### Phase 3, Batch 13 (`index.ts` barrel — Phase 3 closed) — 2026-08-15

The last item. Diffed the full 450-line ts-archunit barrel against eess's 413-line one
(242 diff-lines) and went through every hunk, checking the live files before acting rather
than trusting the diff's sign direction. Most of the diff was noise this plan's own
discipline already predicts — kernel re-exports spelled `@nielspeter/eess` instead of a
relative `./core/...` path, eess already ahead on several export lists
(`isTypeOnlyReExport`/`splitGlobArgs`, `BaselineFilter`/`DiffFilterLike`), and the whole
glob-declaration-model / `diagnose.ts` / `orphan-exclusions.ts` block correctly absent
(dead-glob-diagnosis, deferred all session). Two items resolved as **no action needed**,
confirmed rather than assumed:

- **`havePathMatching`** — ts-archunit moved it from `predicates/module.ts` to
  `predicates/identity.ts` (a placement change motivated by an `api/no-single-glob-
predicates` dogfood rule that doesn't exist in eess). eess still exports it from
  `module.ts` under the same public name — a placement difference, not a delta.
- **Correspondence primitive (`correspondence`, `CorrespondenceBuilder`, `byName`, `byArg`,
  `byPropertyNames`, `setCorrespondence`)** — ts-archunit re-exports its own TS-specific
  `correspondence-builder.ts` wrapper from `index.ts`. Before touching this, read
  `standalone-surface.test.ts`, which names `correspondence`/`CorrespondenceBuilder`/
  `matchSelections`/`applyFixes` a **deliberate, documented exception**
  ("plan 0088 Phase 4's own named exception: serves crossvalidate/md's two-sided binding,
  not a standalone ts user... stay kernel-only on purpose"). Porting a TS-specific
  convenience wrapper here would contradict eess's own binding architectural decision, not
  fill a gap — confirmed by reading the guard test before acting, not by inference from the
  diff's sign.

Real, portable gaps found and fixed, each with the same read-the-live-code-first,
red-test-first, sabotage-verify discipline as every other batch:

- **`fromObjectLiteralFunction`, `FunctionCollectionOptions`, `collectObjectLiteralFunctions`,
  `ObjectLiteralFunction` — a pure barrel gap.** All four already existed, fully implemented
  and tested (`models/arch-function.ts`, `core/object-literal-functions.ts`, both from
  earlier this session), just never re-exported from `index.ts`. Wired in.
- **`severityFor`/`remedyRepeatsMessage` — missing from eess's kernel entirely, and their
  absence was two live, verified defects, not a hypothetical.** Found while checking
  whether `remedyRepeatsMessage`/`severityFor` (named in ts-archunit's index.ts as
  "violation semantics an external renderer or aggregator cannot re-derive from the
  `ArchViolation` type alone") existed under another name in eess — grep found nothing —
  and reproduced both defects live before writing a line of fix:
  - **A `bypassFilters` config finding's own `UNSUPPRESSABLE` text promises "not by
    `.warn()`", and nothing enforced that promise.** `executeWarn` never throws regardless
    of `bypassFilters` (by design, for ordinary findings), and `preset-dispatch.ts`'s
    `dispatchRule` drops a rule's violations from the aggregated throw entirely under a
    per-rule `overrides: { id: 'warn' }`. Reproduced: a rule chained with `.warn()` that
    examines zero elements prints the "examined zero units" finding to stderr and exits 0.
  - **Every terminal-format producer printed a `bypassFilters` finding's message TWICE** —
    once as the finding, once as its own repeated `Fix:` — because every such producer sets
    `suggestion` to exactly its own `message` (there is no author remedy for a finding about
    the rule's own instrument), and none of the three renderers (`format.ts` rich + plain,
    `format-github.ts`) checked for that. Reproduced empirically with a real
    `zeroExaminedViolation`-shaped object before touching any renderer.

  Fixed by porting `severityFor`/`remedyRepeatsMessage` into `packages/core/src/violation.ts`
  (matching eess's simpler `.check()`/`.warn()` terminal-method model rather than
  ts-archunit's per-violation stamped-`.severity` field, which eess's `ArchViolation` does
  not have and this fix does not need — `severityFor` is a pure decision helper, not a field
  reader) and wiring both at every site the docstring names: `executeWarn` now escalates
  (throws with) any `bypassFilters` violations among its filtered set while still printing
  the rest as ordinary warnings; `dispatchRule`'s `'warn'` branch now returns the
  `bypassFilters` subset for the preset's aggregated throw instead of unconditionally `[]`;
  all three renderers gate their `Fix:` line on `!remedyRepeatsMessage(v)`. Re-exported from
  both `packages/core/src/index.ts` and `packages/ts/src/index.ts`.

- **`formatViolationsJson` silently dropped `codeFrame` and `measured`** — both fields
  already exist on `ArchViolation` and are populated by real producers (bug 0012's own
  ratchet measurement among them), but were never serialized, so a JSON consumer had no way
  to read them. Added both, plus a `kind: 'configuration' | 'violation'` field derived from
  `bypassFilters` (matching ts-archunit's own field, ported additively). **Deliberately not
  ported**: a `severity` field (no `.severity` on eess's `ArchViolation` — see above),
  `untestedAllowlists`/`commentSuppressed` (edge-coverage exists but isn't threaded through
  this function's signature yet; comment-suppression doesn't exist in eess at all), and the
  `file`/`line` → `null` normalization for location-less findings (bug-0047-class in
  ts-archunit — a real, correctly-motivated fix, but a value-shape change on _existing_
  fields with a wider blast radius across already-shipped JSON consumers, unlike the purely
  additive fields above) — named here as real, deferred, future work rather than folded in
  under this batch's time budget.

**Verified.** Sabotage-verified all four fixes independently (`executeWarn`'s escalation,
`dispatchRule`'s escalation, the renderer `remedyRepeatsMessage` gate on both `format.ts`
sites and `format-github.ts`, and `formatViolationsJson`'s new fields) — each reverted in
isolation, confirmed its own regression test(s) red, restored, confirmed green. 16 new tests
across 3 files (`packages/core/tests/violation.test.ts`, new; `execute-rule.test.ts` +3;
`preset-dispatch.test.ts` +2; `packages/ts/tests/core/format-json.test.ts` +2), plus updated
the one pre-existing exact-`toEqual` JSON-shape assertion to include the new additive fields.
`npm run validate` green throughout: build, every `check:*` gate, typecheck × 5 packages,
lint, format, 153 test files / 2098 tests (2096 + 2). `check:arch` — 0 unused-export
findings. No stray untracked files. `check:corpus` — 743 checks, 0 violations.

**Named and deferred, real future work** (not silently dropped): `checkAll()` — the
vitest-file equivalent of the CLI's `runCheck`, depends on three subsystems not yet in
eess (`comment-suppression.ts`, `diff-disclosure.ts`'s `suppressionNotice`,
`dedupeConfigFindings`) plus a `RuleBuilderLike` aggregation contract — genuinely large,
not a same-batch add. `BaselineDelta`/`BaselineOptions`/`formatBaselineDelta` — the
load-bearing half of this delta (`identity-root.ts`'s portable-root discovery) is _already_
ported and wired into `withBaseline`/`generateBaseline` from earlier this session; the
remaining piece is `generateBaseline` returning a before/after/added/removed delta instead
of `void`, useful reporting but not a correctness gap, unlike `severityFor`. The
`formatViolationsJson` fields named above. `models/slice.ts`'s `resolveByDefinition()`
project-relative fix (bugs 0033/0035) — blocked on `project-relative.ts`, same as every
other deferral of that pair this session.

**Phase 3 is closed.** Batches 5 through 13 have now reconciled every file this plan's own
batch list named: Helpers, Graphql, the CLI (`check.ts`/`baseline.ts`/`init.ts`),
`module-edges.ts` and its five consumers (`import-candidates.ts`, `slice-graph.ts`,
`conditions/slice.ts`, `conditions/dependency.ts`, `predicates/module.ts`,
`conditions/reverse-dependency.ts`), `conditions/cross-layer.ts`, the full
`predicates`/`models`/`rules` survey (one real fix: `models/slice.ts`'s `resolveByMatching`
bug-0009-class), and the `index.ts` barrel. Every batch carried the same discipline: read
the live eess file before concluding the diff's sign meant action was needed, distinguish
real portable content from genuinely subsystem-blocked content (dead-glob-diagnosis,
project-relative workspace-root awareness — each deferred consistently, never silently, at
every site it recurred), verify with the full `npm run validate` chain, and sabotage-verify
every real bug fix by reverting it, confirming the regression test goes red, restoring, and
confirming green again.

### Phase 4, Batch 1 (the dead-glob-diagnosis algebra — ported, tested, published; NOT wired into the build-failing gate) — 2026-08-15

Picked up Phase 4 after Phase 3 closed. This batch ports the single largest piece Phase 4's
own scope names — `glob-site`, `glob-diagnosis`, `glob-evaluator`, `disk-set`, plus the
materializers `path-universe`/`empty-project-advice` — and lands it as real, tested, public
infrastructure. **What it does NOT do, named plainly rather than silently skipped: wire this
into `TerminalBuilder`'s `.check()`/`.warn()` throw path, so a declared-but-dead glob does not
yet fail a build with a better message than the existing generic "examined zero units" gate
does today.** That integration is real, separate, harder work — see "Scoped and deferred"
below for exactly what it needs and why it's not a same-batch add.

**A placement correction, found by running the gate rather than assumed from the plan's own
inherited note.** The plan's Phase 4 entry (written earlier this session) claimed
`glob-diagnosis.ts`/`glob-evaluator.ts` "block on `path-universe.ts`/`project-relative.ts`,
which ARE ts-morph-blocked." Reading the live ts-archunit source directly showed this was only
half right: `path-universe.ts` and `disk-set.ts` have **no direct ts-morph import** — they take
`ArchProject` as a parameter, the same "needs `ArchProject`, not the kernel" case this plan
already corrected for `metric-violation.ts`. `glob-site.ts`, `glob-diagnosis.ts` and
`glob-evaluator.ts` have **no `ArchProject` dependency at all** — they operate on plain
`PathUniverse`/`DiskSet` value types. So the real blocker was never `ArchProject` — it was
**`picomatch`**, which `arch.rules.ts`'s own binding `eess/kernel-no-engine-deps` rule bans
from `packages/core/src/**` ("Kernel purity: @nielspeter/eess imports no ts-morph / picomatch /
dialect"), and `glob-diagnosis.ts`/`glob-evaluator.ts` both call `picomatch()` directly. This
was **found by running `check:arch` after an initial kernel placement**, not caught in advance
— the gate did its job. Fixed by splitting the port along the ACTUAL boundary, not the assumed
one:

- **Kernel (`packages/core/src/`)**: `glob-site.ts` (the full declaration model — `GlobKind`,
  `GlobPosition`, `isFaultPosition`, `GlobBase`, `DeclaredGlob`, `GlobSite`, `OpaqueGlob`,
  `GlobTree`, `stampGlobs`, `negateGlobs`, `combineGlobs`, `globAnyOf` — pure, no picomatch, no
  `ArchProject`), `path-universe.ts` (the `PathUniverse` type + `viewsFor()` only — pure),
  `disk-set.ts` (the `OnDisk` type + `DiskSet` interface only — pure), a new small
  `project-relative.ts` (just `isAnchored()`, extracted from ts-archunit's larger
  `project-relative.ts` — the rest of that file, `rootOf`/`relativeToRoot`, is genuinely
  `ArchProject`-blocked workspace-multi-root awareness and stays deferred, matching every other
  deferral of that pair this whole session). Also re-exported `discoverIdentityRoot`/
  `normalizeIdentityText` from `identity-root.ts` (already ported earlier this session, but
  never barrel-exported — `disk-set.ts`'s materializer needs it publicly) and `UNSUPPRESSABLE`
  (same situation, needed by Batch 11's `cross-layer.ts` work).
- **`packages/ts/src/core/`** (picomatch-dependent, so cannot be kernel however little
  `ArchProject` they need): `glob-diagnosis.ts` (`GlobFault`, `syntacticFault`, `diagnoseGlob`,
  `FAULT_ADVICE`, `ON_DISK_ADVICE` — dropped the unexported-by-ts-archunit-in-practice
  `candidatesFor(site, universe)`, confirmed zero consumers even in ts-archunit's own `src/`,
  matching the `importCandidates()` precedent from Batch 10; also would have collided in name
  with `import-candidates.ts`'s own `candidatesFor`), `glob-evaluator.ts` (`isDeadGlobTree`,
  `isDeadSite`, `globSitesOf` — the soundness-critical function whose own docstring warns
  "three consecutive revisions... returned a false verdict"), `path-universe.ts`'s
  `pathUniverse()` materializer, `disk-set.ts`'s `diskSet()`/`buildDiskSet()` materializer (full
  filesystem walk, `PRUNE`/`ENTRY_BUDGET`/`TS_FILE` ported verbatim), `empty-project-advice.ts`
  (`loadedNothing`, `emptyProjectAdvice`).
- Fixed one more real, small `check:arch` finding along the way: `disk-set.ts`'s walk had a
  silent `catch {}` with no error binding — this repo's own `no-silent-catch` rule (`catch (err)
{ void err; ... }`, the same documented-discard pattern used elsewhere this session).

**Wiring, not just porting — every export is a genuine kernel/dialect public-API surface
member, not dead infrastructure.** `check:arch`'s `no-unused-exports`/`imported-by-at-least-
one-module` gates caught every one of these as unreferenced on first pass — correctly, since
nothing calls them yet. Rather than exclude-comment them (the established precedent for that
is declaration-emit necessity, not "no consumer yet" — a different, less honest use of the
mechanism), they're wired into both barrels for real: `packages/core/src/index.ts` (the pure
algebra) and `packages/ts/src/index.ts` (the materializers + picomatch-dependent evaluation,
plus re-exporting the kernel's pure half so `eess-ts` alone exposes the whole surface —
`standalone-surface.test.ts` caught 13 missing value exports on the first attempt, which is
exactly the gate this session has hit and fixed before). This matches Batch 13's own precedent
(`fromObjectLiteralFunction` etc. — "already existed, fully implemented and tested... just
never re-exported from index.ts") for functions whose only real gap is public-surface
visibility, which is an honest description of this batch's exports: they are correct, tested,
callable — genuinely public API, not a promise of a feature that doesn't work yet.

**Verified.** Full test suites ported/adapted (not a subset skipped for time): 17 new kernel
tests (`glob-site.test.ts` — every combinator and the documented double-negation-restores-
polarity case; `path-universe.test.ts` — `viewsFor`'s per-kind view selection), 44 new
`packages/ts` tests (`path-universe.test.ts`/`disk-set.test.ts` against the real `cross-layer`
fixture project — `holds-typescript`/`no-typescript`/`absent` classification, the injectable-
budget degrade path, the two filesystem-walk input guards — `empty-project-advice.test.ts`,
`glob-diagnosis.test.ts` — every `GlobFault`/`OnDisk` has advice text, `syntacticFault`'s
dot-segment/unanchored/exempt cases — `glob-evaluator.test.ts` — the three documented soundness
rules for `isDeadGlobTree` explicitly: negative-never-dead, opaque-never-dead-never-dropped,
`all`-dead-if-any vs `any`-dead-only-if-every). **Sabotage-verified** the trickiest one directly
rather than trusting the port: reverted `isDeadChild`'s opaque-leaf handling to `return true`
(the wrong, sound-sounding shortcut a less careful implementation would take), confirmed both
of the opaque-specific tests go red, restored, confirmed all 15 green again. ADR-005 compliant
throughout — no `any`, no `as`; test doubles for `ArchProject` are typed object literals with
real ts-morph `Project` instances underneath, matching this session's own established pattern.

`npm run validate` green throughout every fix in this batch (final state: 158 test files, 2142
tests — 2098 + 44 new). `check:arch` — 0 violations (was 11, then 17 after the file move
surfaced the barrel gaps, now 0). `check:corpus` — 743 checks, 0 violations. No stray
untracked files beyond the legitimate new source/test files this batch and earlier ones added.

**Scoped and deferred, named rather than silently dropped — this is the real remaining work,
not a footnote.** Wiring the ported algebra into a build-failing gate needs a genuine design
decision this batch correctly stopped short of making silently: ts-archunit's own
`deadSelectorFindings()`/`globs()`/`narrowingHint()`/`examinedUnitNoun()` machinery lives
directly on its single-package `TerminalBuilder`, hardcoded against `ArchProject` — a shape
eess's kernel/dialect split cannot copy verbatim, because `packages/core/src/terminal-builder.ts`
is shared by every dialect (md, mermaid, gherkin, crossvalidate — none of which have or want an
`ArchProject` concept) and adding `ArchProject`-typed methods to it directly would poison the
kernel with TS-dialect knowledge. `RuleBuilder<T, P>` already carries the right shape of seam
for this — it's generic over `P` and already has one precedent hook of exactly this kind,
`protected sourceEmpty(): boolean` (kernel default, overridden per TS builder using `P`) — but
`SliceRuleBuilder`/`PairFinalBuilder` extend `TerminalBuilder` directly, bypassing
`RuleBuilder<T,P>` entirely, and Batch 1's own note already flagged both of them as needing this
machinery too (`ownsDiscoveryDiagnosis`). So the real open question — does the kernel's
`TerminalBuilder` itself gain a generic `P` (disruptive, touches every dialect's base class), or
does the dead-glob gate live only at the `RuleBuilder<T,P>` level (leaves slice/cross-layer out,
the two builders that most obviously need it) — is a genuine architectural decision with
consequences for every dialect, not something to decide as a drive-by inside one batch. Matches
this plan's own precedent for the 15 ts-morph-purity-blocked kernel modules ("re-expressing them
behind an ADR-007 engine-neutral seam is design work... belongs in its own plan") — the same
reasoning applies here, and is recorded here so it isn't re-litigated from scratch next time.

Also not done, dependent on the seam decision above or on `.globs()` declarations existing
somewhere real predicates populate: `RuleBuilder<T,P>`'s own `.globs()` accumulator and its
wiring into any real predicate (`resideInFolder`/`resideInFile`/etc.); `diagnose.ts` (613 lines
in ts-archunit — the CLI-facing orchestration that walks a rule file's declared globs and
reports every dead one, independent of whether `.check()` fails); `cli/commands/doctor.ts` (244
lines — the CLI command wrapping `diagnose()`, Phase 2's own ledger entry already named this
"not yet done — deferred to keep this phase's diff reviewable" once, still true); `owns-empty-
discovery.ts` (small, standalone — could land now, but its only real purpose is coordinating
with the builder-level dead-glob gate that doesn't exist yet, so porting it before that would
repeat the exact "ship dead infrastructure with no consumer" trap this batch's own barrel-wiring
discipline just avoided); wiring `owns-empty-discovery.ts` into `cross-layer-builder.ts` (Batch
11's own deferral) and `slice-rule-builder.ts` (Batch 1's own deferral) once it exists.
`rule-builder-like.ts` needs no port at all — eess already has the identical concept
(`RuleBuilderLike` in `packages/ts/src/cli/load-rules.ts`), just placed in `cli/` instead of
`core/`, confirmed by direct comparison rather than assumed.

### Phase 4, Batch 2 (dead-glob diagnosis wired into `RuleBuilder<T,P>`'s build-failing gate) — 2026-08-15

Picked up Batch 1's own open architectural question. Verified the reasoning against the real
code before building on it (`packages/core/src/rule-builder.ts` and `terminal-builder.ts`, read
in full) rather than trusting a prose description: the actual precedent (`sourceEmpty`) is
narrower than "does `TerminalBuilder` need a generic `P`" — `CollectResult` (defined in
`terminal-builder.ts`) already carries `sourceEmpty?: boolean` as a plain optional field, and
`TerminalBuilder.evidencedViolations()` (the shared `.check()`/`.warn()` throw path) only ever
reads fields off that object — it never needs to know `P` itself. `RuleBuilder<T, P>` is the one
that actually has `P`, and populates `sourceEmpty` before handing the result up. **Decision**:
extend `CollectResult` with one more optional field (`deadGlob?: string`, a pre-formatted
message — the kernel never touches picomatch or a project type to build it), give
`TerminalBuilder.evidencedViolations()` one more conditional branch (`deadGlobViolation()`,
alongside `zeroExaminedViolation()`/`zeroLoadedSourceViolation()`/etc.), and let
`RuleBuilder<T,P>` alone populate it. Purely additive to `TerminalBuilder` — no generic `P`
added, no disruption to md/mermaid/gherkin/crossvalidate, which simply never populate the field.

**`SliceRuleBuilder`/`PairFinalBuilder` are correctly left out, confirmed not a gap.** Both
extend `TerminalBuilder` directly, bypassing `RuleBuilder<T,P>` entirely, so they never populate
`deadGlob` and keep today's generic `zeroExaminedViolation()`/`.expectEmpty()` behavior
unchanged. This is fine: both already have their own MORE specific, condition-level
empty-discovery diagnostics from earlier this session — `conditions/cross-layer.ts`'s
`emptyLayerFinding`/`unusableLayersFinding` (Batch 11, gated on `pairs.length > 0` to avoid
double-reporting against the generic guard) most concretely. A generic dead-glob check at the
`TerminalBuilder` level couldn't say anything as specific as "Layer X's own `.layer()` glob
matched 0 files" anyway. So `owns-empty-discovery.ts` (the WeakSet-based "who owns reporting
this" coordination registry) is **not needed for this scope** — there is no double-report risk
when the generic gate never even runs for these two builders. Not ported this batch; stays a
named future item only if a real coordination need surfaces later.

**Landed:**

- **Kernel (`packages/core/src/`)**: `predicate.ts`/`condition.ts` gained an optional
  `globs?: DeclaredGlobs` field (Batch 1's `glob-site.ts` algebra already had the type, just no
  consumer). `project-relative.ts` gained `isProjectRelative()` alongside the already-ported
  `isAnchored()` — both pure string functions, confirmed by reading ts-archunit's real
  `project-relative.ts` directly (the rest of that file, `rootOf`/`relativeToRoot`, stays
  deferred, genuinely `ArchProject`-blocked). `rule-builder.ts` gained a public `globs(): readonly
GlobNode[]` method (walks `_predicates`/`_conditions` for their stamped `globs`, position derived
  from which phase registered them — a structural fact, not something an author declares) and a
  `protected deadGlobDiagnosis(): string | undefined` hook (default `undefined`, same override
  shape as `sourceEmpty()`). `terminal-builder.ts` gained `CollectResult.deadGlob` and
  `deadGlobViolation()`, consulted in `evidencedViolations()` right before the generic
  `zeroExaminedViolation()` fallback — never overriding `sourceEmpty`/`.expectEmpty()`/cardinality
  exemption, only replacing the least-informative message with a more specific one when available.
- **`packages/ts/src/`**: `predicates/identity.ts`'s `resideInFile`/`resideInFolder` and
  `predicates/module.ts`'s `havePathMatching` now stamp `globs` via `globNode()` (the three
  glob-declaring predicates ts-archunit's own source has — confirmed by grep, not guessed).
  New `core/dead-glob.ts` — `diagnoseDeadGlobs(project, trees)`, the orchestration `RuleBuilder`
  can't do itself: materializes `pathUniverse()`/`diskSet()` (Batch 1), walks each tree with
  `isDeadGlobTree()`/`globSitesOf()`/`isDeadSite()` (Batch 1's `glob-evaluator.ts`), and builds
  the message from `diagnoseGlob()`/`FAULT_ADVICE`/`ON_DISK_ADVICE` (Batch 1's
  `glob-diagnosis.ts`) for the first dead site found. `diskSet()` (a real filesystem walk) is only
  materialized once a tree is confirmed dead by `isDeadGlobTree()` against the already-cached
  `pathUniverse()` — most rules never reach that line, since this whole function only runs when a
  rule already examined zero elements. All 6 `RuleBuilder<T, ArchProject>` subclasses
  (`ClassRuleBuilder`/`FunctionRuleBuilder`/`ModuleRuleBuilder`/`CallRuleBuilder`/
  `TypeRuleBuilder`/`JsxRuleBuilder`) gained a one-line `deadGlobDiagnosis()` override calling
  `diagnoseDeadGlobs(this.project, this.globs())`, matching each one's existing `sourceEmpty()`
  override immediately above it.
- Both new kernel functions (`globs()`, `deadGlobDiagnosis()` default) wired into
  `packages/core/src/index.ts`'s existing exports (`isProjectRelative` alongside `isAnchored`);
  `packages/ts/src/index.ts` gained the matching re-exports (`isProjectRelative`,
  `diagnoseDeadGlobs`) — `standalone-surface.test.ts` caught the first gap immediately, exactly
  the gate this session has hit and fixed every time a kernel export grew.
- **A real, small `check:arch` finding, found by running the gate rather than estimated**:
  the new `globs()` method + `deadGlobDiagnosis()` hook pushed `RuleBuilder` past this repo's own
  300-line class-length gate (`arch.internal.rules.ts`). Fixed by extracting the glob-tree-walking
  logic into a free function (`declaredGlobsOf()`, alongside the already-external
  `describeOrigin()` helper) so `globs()`'s method body is one line, then trimming the two new
  docstrings to their load-bearing content — 338 → 300 lines, gate green.

**Verified.** Full existing suite (2142 tests) run _before_ any test file was touched — all
passed unchanged, confirming the new optional fields/methods are additive with zero behavior
change for every existing caller. 2 new regression tests in
`tests/builders/class-rule-builder.test.ts` proving the actual defect this closes: a genuinely
dead `resideInFolder('**/this-folder-does-not-exist-anywhere/**')` now names the specific glob
and why ("can never match: these are anchored but matched no file...") instead of the generic
"examined zero units" message; a live glob (`**/src/**`) narrowed to zero by a further predicate
correctly keeps the generic message (not a false "dead glob" claim over an ordinary empty
selection). **Sabotage-verified**: reverted the `deadGlob` computation to always `undefined`,
confirmed the first new test goes red (the dead-glob-specific assertions fail, falling back to
the generic message) while the second stays green (correctly unaffected — it was already
asserting the generic-message path), restored, confirmed both green again.

`npm run validate` green throughout (158 test files, 2144 tests — 2142 + 2 new). One prettier
formatting fix on `rule-builder.ts` caught by `format:check` after the trim, applied and
re-verified. `check:arch` — 0 violations (including the class-length finding found and fixed
mid-batch). `check:corpus` — 743 checks, 0 violations. `check:ledger` — 0 findings. No stray
untracked files beyond the legitimate new source/test files this batch and earlier ones added.

**Deferred, still owed, named rather than dropped**: `diagnose.ts`/`cli/commands/doctor.ts` (the
standalone CLI orchestration — independent of everything landed this batch, doesn't need the
architectural question above); wiring `.globs()` into the remaining glob-adjacent predicates
beyond the 3 landed (`havePathMatching`'s sibling `havePathMatching`-style checks in other
dialects' own predicates, if any — not surveyed this batch); `owns-empty-discovery.ts` (per the
reasoning above, not currently needed — revisit only if a real coordination gap surfaces).

### Phase 4, Batch 3 (`diagnose()` + `doctor` CLI command — scoped to two of ts-archunit's seven finding kinds) — 2026-08-15

Picked up Batches 1–2's own named next step. Read ts-archunit's live `src/core/diagnose.ts`
(613 lines) and `src/cli/commands/doctor.ts` (244 lines) in full before starting, rather than
assuming the earlier batches' size estimate still described a portable-as-is module. It didn't:
`diagnose()` has grown, across several of ts-archunit's own plans this repo does not carry
(0090's deferred/accepted-warning previews, 0102's structural `inertAdvice()` adequacy predicate
for `inconsistentSiblings`, 0096/0097's declared-emptiness bookkeeping, bug-0044's orphaned
exclusion comments), to **seven** finding kinds: `dead-glob`, `no-condition`, `project-unknown`,
`project-empty`, `zero-subjects`, `inert`, `orphan-exclusion`, `deferred-warning`. Porting all
seven verbatim would mean inventing eess equivalents of features eess doesn't have and this plan
never scoped — the wrong kind of scope creep for a "copy the delta" plan. **Scoped down instead**,
matching this plan's own repeated "land a real, honestly-scoped subset, name the rest" precedent:
ported the two kinds eess's kernel actually has the machinery for today.

- **`dead-glob`** — Batches 1–2's whole point: walk a rule's declared globs
  (`RuleBuilder.globs()`), find any that can never match, name it and why. This is what makes
  `diagnose()`/`doctor` earn their keep as something distinct from `.check()`: a rule that is
  currently PASSING can still carry a dead glob (an `or(dead, live)` selector, or one that used
  to be live), and nothing else in eess sees that before a real regression exercises it.
- **`project-empty`** — `empty-project-advice.ts` (ported Batch 1, unconsumed until now). Bug-
  0031-class: diagnosing each glob independently against a project that loaded zero files reports
  every one of them as individually malformed, when the real cause is the project. Deduped per
  project by object identity (`WeakSet`), not per rule — two rules against one empty project
  produce one finding, not two.

**Deliberately not ported this batch, named rather than silently answering a narrower question
with ts-archunit's wider promise**: `no-condition` (eess already reports this differently — a
stderr warning from `RuleBuilder.collectViolations()`'s own assertion-less-rule branch, not an
ADR-010 unsuppressable finding — a real design divergence to resolve deliberately, not port
blind); `zero-subjects`/`inert`/`deferred-warning`/`orphan-exclusion` (each needs a ts-archunit-
specific feature eess doesn't have — `.asSeverity('warn', { accepted })` deferred warnings, a
per-family structural adequacy predicate, declared-emptiness surfaced to a diagnostic rather than
just the gate, and `orphan-exclusions.ts` itself, which was already deferred pending `diagnose.ts`
existing — it can be revisited now that this does, but wasn't attempted this batch); `project-
unknown` (unreachable for eess today — every real `RuleBuilder<T, ArchProject>` subclass takes
its project unconditionally through the constructor, unlike ts-archunit's historical `crossLayer`/
`resolvers` builders that motivated this kind — `diagnose()` still degrades gracefully via
`rule.getProject?.() ?? project` for a hypothetical foreign builder, it just never produces this
specific finding kind today).

**Landed:**

- **`packages/core/src/rule-builder.ts`** gained `getProject(): P` — one method on the shared
  base class, not six per-subclass overrides (unlike `sourceEmpty()`/`deadGlobDiagnosis()`,
  `project: P` is already a single `protected readonly` field on `RuleBuilder<T,P>` itself, so
  every subclass gets this for free). Trimmed two docstrings (this new method's own, and
  `deadGlobDiagnosis()`'s from Batch 2) to keep the class under this repo's own 300-line
  class-length gate — found by running `check:arch`, not estimated in advance.
- **`packages/ts/src/core/diagnose.ts`** (new) — `DiagnosableRule` (structural, every hook
  optional — a builder that doesn't implement `globs()`/`getProject()`/`describeRule()`, like
  `SliceRuleBuilder`/`PairFinalBuilder`, contributes nothing rather than throwing) and
  `diagnose(rules, project?)`. Per rule: resolve its own project (`rule.getProject?.() ?? project`
  — the rule's own naming wins, so a rule file with two `project()` calls doesn't get half its
  globs checked against the wrong universe), skip rules with no declared globs, report syntactic
  faults for a rule with no resolvable project, report `project-empty` (deduped) and syntactic
  faults only (skip the real glob walk — every one would carry a false individual cause) for an
  empty project, else walk `isDeadGlobTree()`/`globSitesOf()`/`isDeadSite()`/`diagnoseGlob()`
  (all Batch 1) for real dead-glob findings.
- **`packages/ts/src/cli/commands/doctor.ts`** (new) — `runDoctor()`, ported from ts-archunit's
  `doctor.ts` with the `orphan-exclusion` finding kind and its `orphanExclusions()` call dropped
  (deferred, named above) and `HAS_GLOB`'s `Record` narrowed to the two-kind union. Per-file
  loading with the same two-shape error handling ts-archunit's own history settled on: an
  `ArchRuleError` (a rule file that self-executes a throwing `.check()` at import) gets a distinct
  message from an ordinary load failure (syntax error, missing dependency, a vitest/jest file
  `doctor` cannot load), and loading continues on the remaining files either way. `--format json`
  emits `{ findings, loadFailures }`; terminal format renders each finding under its rule file.
  Wired into `cli/index.ts` (`handleDoctor`, `eess-ts doctor [files...]`, help text) alongside
  `check`/`baseline`/`explain`.
- Both new kernel/dialect surfaces wired into their barrels
  (`packages/core/src/index.ts`/`packages/ts/src/index.ts` were already exporting everything
  `diagnose.ts` consumes from Batch 1 — no new barrel gap this batch).

**Verified.** Full pre-existing suite (2144 tests) run before any new test file was written — all
passed unchanged. 7 new tests in `tests/core/diagnose.test.ts` against the real `poc` fixture
project (a genuinely dead `resideInFolder()` glob is reported with its advice; a live glob is
silent; a live glob narrowed to zero by a further predicate is correctly NOT reported as dead —
diagnose() must not conflate an ordinary empty selection with a dead selector; `project-empty` is
deduped per project across two rules; an empty project's own glob is not individually blamed; a
bare `RuleBuilderLike` with no `globs()` produces nothing rather than throwing; the `project`
fallback parameter is consulted when a rule can't name its own). 8 new tests in
`tests/cli/doctor.test.ts` (no rule files → 1; clean run → 0; a dead glob → 1, printed to stderr
naming the glob and rule file; `--format json` emits a parseable document; a load failure on one
file doesn't abandon the rest; an `ArchRuleError`-throwing file gets its own distinct message;
zero rules loaded → 1). **Sabotage-verified** the one genuine correctness property with a
dedicated test: reverted `project-empty`'s per-project `WeakSet` dedup guard to push
unconditionally, confirmed the "once per project, not once per rule" test goes red (2 findings
instead of 1), restored, confirmed green again (15/15 across both new files).

`npm run validate` green throughout (160 test files, 2159 tests — 2144 + 15 new). One real
`check:arch` finding found and fixed mid-batch: `RuleBuilder` past the 300-line class gate again
(see "Landed" above). One lint error (`no-unsafe-assignment` on a directly-typed `JSON.parse()`
result in `doctor.test.ts`) fixed by matching this test suite's own established `as {...}`
convention for parsed CLI JSON output (`check.test.ts`/`baseline-cmd.test.ts`/
`explain-command.test.ts` all already do this — a test-file exception to ADR-005, not a new one
invented here). One prettier fix on the new test file. `check:corpus` — 743 checks, 0 violations.
`check:ledger` — 0 findings. No stray untracked files beyond the legitimate new source/test files
this batch and earlier ones added.

**Remaining Phase 4 work, named rather than dropped going into Batch 3**: `owns-empty-discovery.ts`
and its wiring into `cross-layer-builder.ts`/`slice-rule-builder.ts` (per Batch 2's own reasoning,
not currently needed); the five deferred `diagnose()` finding kinds above, each blocked on a
feature this plan never scoped; the other non-ts-morph kernel-bound modules Phase 4's own scope
text names — `dedupe-config-findings`, `diff-disclosure`, `type-guards`, `comment-suppression` —
plus the `correspondence-core`/`check-all` "already superseded?" ruling Phase 4's scope text
explicitly asks for.

### Phase 4, Batch 4 (the last five kernel modules Phase 4's scope text names, all wired to real behavior — plus both "already superseded?" rulings) — 2026-08-15

Picked up Batch 3's own closing list. All five modules verified against the live ts-archunit
source before porting, matching this plan's discipline throughout — and each one wired into a
real, confirmed-live call site, not left as a barrel-only export waiting for a future consumer.

- **`type-guards.ts`** (`isRecord`, `isNullaryCallable`) → `packages/core/src/type-guards.ts`.
  **Real, confirmed-live duplication closed, not hypothetical**: `isRecord` was still duplicated
  verbatim in `packages/ts/src/tsconfig/tsconfig-builder.ts:171` and
  `packages/ts/src/cli/commands/init.ts:468` — grepped directly, matching ts-archunit's own bug
  0049 precedent. Both replaced with the kernel import; both local definitions deleted.
  `isNullaryCallable` closed a second real site: `cli/load-rules.ts`'s `resolveExported()` had an
  `eess-exclude eess/adr005-no-type-assertions` comment on exactly the cast ts-archunit's own
  docstring names as the motivating case (`(exported as () => unknown)()` after a
  `typeof === 'function'` check) — the type guard replaces the cast, and the exclude comment is
  gone, a real ADR-005 violation removed rather than just annotated.
- **`shallow-clone.ts`** (`shallowClone<T>`) → `packages/core/src/shallow-clone.ts`. **Real
  consumer, found rather than fabricated**: `TerminalBuilder.copy()` (the base `copy()` every
  copy-on-write builder in the whole family extends) was already hand-inlining this exact
  `Object.getPrototypeOf`/`Object.create`/`Object.assign` pattern, eslint-disable comments and
  all — the textbook case the module's own docstring describes ("the one place... every
  copy-on-write builder goes through here so that carve-out is written once and reviewed once").
  Swapped the inline implementation for a call to `shallowClone(this)`; the two `eslint-disable`
  comments move into the new module (written once) instead of living in `terminal-builder.ts`.
  Every subclass `copy()` override (`RuleBuilder`, and every builder beyond it) calls
  `super.copy()` first, so this is a behavior-preserving refactor of the ONE base implementation,
  not a per-subclass retrofit — confirmed by running the full suite before writing any new test,
  unchanged.
- **`diff-disclosure.ts`** (`suppressionNotice`, `activeNotice`, `resetDiffDisclosureForTests`) →
  `packages/core/src/diff-disclosure.ts`. Read `packages/core/src/diff-aware.ts` directly first:
  it has the filtering (`DiffFilter.filterToChanged()`, correctly never filtering `bypassFilters`
  findings) but **zero disclosure** — a CI job configured with `--changed` once and forgotten
  reads as permanently clean even with real findings outside the diff. Wired both notices for
  real, matching ts-archunit's own two-surface design exactly: `activeNotice` into
  `execute-rule.ts`'s `executeCheck`/`executeWarn` (the per-rule `.check({ diff })`/
  `.warn({ diff })` path — computes `before.length - after.length` around each `filterToChanged`
  call, fires once per process); `suppressionNotice` into `cli/commands/check.ts`'s `runCheck()`
  (the aggregating CLI path — reads `diffFilter.size` and `args.base`, matching the
  `edgeCoverageNotice()` disclosure already established two rows above it).
- **`comment-suppression.ts`** (`resetCommentSuppression`, `recordCommentSuppression`,
  `commentSuppressions`, `commentSuppressionNotice`) → `packages/core/src/comment-suppression.ts`.
  Same module-state shape as the already-ported `edge-coverage.ts`. Wired into
  `execute-rule.ts`'s `applyFilters` at the exact site where an inline `// eess-exclude` comment
  drops a violation (`recordCommentSuppression(ruleId, v.file)` inside the filter predicate,
  right where `isExcludedByComment` returns true) — this was previously the **only silent**
  filter in the pipeline: `.excluding()` warns on a dead pattern, diff-aware now discloses
  (above), the edge-coverage allowlist family discloses, and inline comments dropped violations
  with no count anywhere. `resetCommentSuppression()`/`commentSuppressionNotice()` wired into
  `runCheck()` alongside the existing edge-coverage reset/notice pair.
- **`dedupe-config-findings.ts`** (`dedupeConfigFindings`) → `packages/core/src/dedupe-config-
findings.ts`. Wired into `runCheck()` right before `reportViolations()`/`formatViolationsJson()`,
  replacing `filtered` outright so the exit count and terminal summary line agree with what's
  actually displayed — one collapsed finding, one count, not a report showing 1 line while the
  exit code says 2. **The exact eess-native fan-out ts-archunit's own history measured (a preset
  option that enables nothing) reproduces the identity collision this function exists for**:
  `agentGuardrails(p, { src: g1, report: 'return' })` and `agentGuardrails(p, { src: g2, report:
  'return' })`, both with no capability enabled, both call `presetConstructsNothingViolation()`
  with identical `rule`/`element` (`'agentGuardrails'`) and, once `attributeToRuleFile()` runs,
  identical `file` — the exact `(file, ruleId, element)` collision `dedupeConfigFindings` collapses.
  Building this test caught a real trap in itself: the default preset option is
  `report: 'throw'`, so the FIRST `agentGuardrails()` call in an array-spread throws before the
  SECOND ever runs (JS evaluates left to right) — the fan-out only exists at all under
  `{ report: 'return' }`, which the test now says explicitly rather than silently relying on it.
- **Rulings** (Phase 4's own scope text asked for both before porting either):
  - **`correspondence-core.ts` (`setCorrespondence`) — superseded, not ported.** Read both files
    in full: ts-archunit's version is a plain `Set`-based two-key-set comparator (missing,
    orphans, no ambiguity detection, no predicate matching). eess's own
    `packages/core/src/matching.ts` (`matchSelections`) is strictly more capable — O(n+m) indexed
    matching by key OR O(n×m) by predicate, plus `leftAmbiguous` detection `setCorrespondence`
    has no equivalent for — and is already the shared engine both `correspondence()` and
    `crossLayer`'s pair-matching build on. Porting the narrower engine would introduce a second,
    less capable, no-consumer duplicate.
  - **`check-all.ts` — genuinely missing, not implemented here.** Confirmed by reading it in
    full: it is the vitest-file terminal for an array of rules (`checkAll([...rules])`, the
    aggregating equivalent of the CLI's `runCheck` for test-file use) that eess has no
    equivalent of. Every dependency it names now exists in eess after this batch —
    `dedupeConfigFindings`, `suppressionNotice`, `edgeCoverageNotice`/`resetEdgeCoverage`/
    `untestedRules` (already ported), `commentSuppressionNotice`/`resetCommentSuppression`,
    `RuleBuilderLike` (eess's own equivalent already exists in `cli/load-rules.ts`) — except
    `execute-rule.ts`'s `writeReport`, which eess's `execute-rule.ts` does not have (though it
    likely reduces to a thin combination of the already-ported `reportViolations`/
    `formatViolationsJson`). `work/plans/ROADMAP.md` already carries a dedicated board entry for
    exactly this gap — [0081 — port checkAll](../0081-port-checkall.md) (Low priority, Draft) —
    so this batch's job was the "already superseded?" check Phase 4's scope text asks for, not
    the implementation; plan 0081 remains the right home, now closer to buildable than its own
    entry assumed.

**Verified.** Full pre-existing suite run before any test file was touched, confirming every new
field/module is additive with zero behavior change for existing callers. New tests, real
assertions throughout: `type-guards.test.ts` (10 cases), `shallow-clone.test.ts` (5 cases,
including the prototype-chain and constructor-parameter-property preservation properties the
module's own docstring claims), `diff-disclosure.test.ts` (10 cases), `comment-suppression.test.ts`
(6 cases, including the listing cap and its disclosure), `dedupe-config-findings.test.ts` (8
cases, including the "unnamed sentinel never collapses" bug-0099-class regression) — all pure unit
tests, run directly. Real wiring proven through 4 more integration tests, each **sabotage-verified
independently** (revert the wiring → confirm red → restore → confirm green): 4 new cases in
`execute-rule.test.ts` for the `activeNotice` wiring into `executeCheck`/`executeWarn` (spying on
`process.stderr.write`, not just asserting throw behavior); 2 new cases in
`exclusion-comments-e2e.test.ts` for `recordCommentSuppression` firing through the REAL
`applyFilters` path over a real fixture project (not a hand-built violation); 1 new case in
`check.test.ts` for the `dedupeConfigFindings` wiring, going through `runCheck()`'s real JSON
output end to end.

`npm run validate` green throughout (full suite; two real, small issues caught and fixed mid-batch
— a TS2741 type error from an early draft of the `dedupeConfigFindings` test using a bare
`{ violations }` object where `RuleBuilderLike` requires `check` too, and a lint error from an
initial `vi.importActual<typeof import(...)>()` generic-type-argument, replaced with a plain
top-level import since `../../src/index.js` was never mocked in that test file — followed by a
5-file prettier fix). `check:arch`/`check:corpus`/`check:ledger` clean. No stray untracked files
beyond the legitimate new source/test files this batch and earlier ones added.

**Remaining Phase 4 work, named rather than dropped**: `owns-empty-discovery.ts` and its wiring
into `cross-layer-builder.ts`/`slice-rule-builder.ts` (still not currently needed, per Batch 2's
own reasoning); the five deferred `diagnose()` finding kinds (Batch 3); `checkAll()`'s real
implementation (now unblocked except for `writeReport`, homed at plan 0081, not this plan). Every
non-ts-morph kernel module Phase 4's own scope text named by name (`dedupe-config-findings`,
`diagnose`, `diff-disclosure`, `disk-set`, `edge-coverage`, `glob-diagnosis`, `glob-evaluator`,
`glob-site`, `rule-builder-like`, `stderr`, `type-guards`, `unsuppressable`, `comment-suppression`)
is now ported and wired — the scope text's own list is closed.

**The 15 ts-morph-purity-blocked kernel modules from this plan's own Problem section — the last
open item — now have a named, authored follow-on plan, not a silent drop.** Re-verified the count
directly against the live tree before spinning it off (not trusted from the stale Problem-section
estimate): 5 of the corrected 7 real ts-morph-importers (`descendant-cache`, `import-candidates`,
`metric-violation`, `module-edges`, `object-literal-functions`) are already landed in
`packages/ts/src/core/` across this plan's own batches. The genuine remainder —
`per-root-compiler-options.ts` and `project-relative.ts`'s `rootOf`/`relativeToRoot` (the
workspace multi-root awareness this plan deferred at three separate integration points throughout
Phase 3, and Phase 4 Batch 2 already extracted the two pure functions from) — is real, live,
present-day-defective in eess's own `workspace()` (confirmed by reading `project.ts` directly: the
exact "one Project's compiler options for every package" shape ts-archunit's own bug 0058 fixed),
not hypothetical. Spun off as
[plan 0148 — workspace multi-root awareness](./0148-workspace-multi-root-awareness.md), Draft,
on the board. **Phase 4 is closed.**

## Close

Deferred: `checkAll()`'s real implementation → [plan 0081 — port checkAll](../0081-port-checkall.md)
(Low priority, Draft; this plan's batch confirmed every dependency it needs now exists except
`execute-rule.ts`'s `writeReport`); workspace multi-root awareness (the 2 genuine remaining
ts-morph-purity-blocked kernel modules) → [plan 0148 — workspace multi-root awareness](./0148-workspace-multi-root-awareness.md)
(now also closed, in the same pass as this plan). Dropped on purpose, not deferred to a home
(confirmed not needed for this plan's own scope, no live consumer): `owns-empty-discovery.ts`
and its `cross-layer-builder.ts`/`slice-rule-builder.ts` wiring (both builders already have
more specific condition-level empty-discovery diagnostics; the generic coordination registry
has no double-report risk to guard against here); the 5 of 7 `diagnose()` finding kinds this
plan never scoped (each blocked on a feature outside this plan's Problem/Success definition).
The 5 stale unchecked boxes under Phase 2 above (`match-identity.ts`, `rule-file-findings.ts`,
its `load-rules.ts` wiring, `doctor.ts`, the correspondence-primitive ruling) were confirmed
done or ruled at close — the work landed across later batches but those specific checkboxes
were never ticked to match; each now carries its own done-otherwise/dropped-on-purpose note
inline.
