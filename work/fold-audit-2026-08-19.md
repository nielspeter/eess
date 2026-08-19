# Fold audit — did plan 0088 carry ts-archunit's bug fixes across?

**Measured:** 2026-08-19 · **Scope:** all 72 records in ts-archunit's
`bugs/fixed/` · **Method:** per-bug verification against eess's built `dist`,
running reproductions rather than reading code.

## Why this was run

eess forked ts-archunit's engine at ~v0.17 and froze. [Plan
0088](./plans/completed/0088-fold-ts-archunit-into-eess.md) folded the engine
back in, closing a drift its own Problem section measured at "10,342 diff-lines
across 118 shared files, plus 37 modules never received."

The fold reconciled **per file** — its Phase 1 is "a per-file classification of
ts-archunit's `src/` vs eess kernel + eess-ts, three buckets" — rather than
copying wholesale. A reconcile keeps eess's existing file wherever the two look
equivalent, and "looks equivalent" is exactly how a **deleted line** or a
**reordering** hides. It never enumerated upstream's fixed-bug corpus to check
which fixes came across.

That gap surfaced by accident: [plan
0150](./plans/0150-close-0088s-disclosed-review-findings.md)'s Phase 4 built
`orphanExclusions()` — the first consumer that reads the exclusion parser's
output — and it returned 14 findings, all false, because eess's parser is the
pre-fix shape for upstream's bug 0043. One sample, one hit. This audit asked
whether that was a one-off.

## Was a wholesale copy ever available? — measured, no

Tested on a throwaway branch: copying all 156 of ts-archunit's `src/` files
into `packages/ts` **typechecks clean** (zero errors in `src/`; 62 errors, all
in 15 eess test files encoding eess-only features — ADR-008's `report` option,
`--fix`, `havePathMatching`).

But it drops shared-kernel imports from **83 → 6** and duplicates 57 core files
into the dialect, re-forking the kernel that [plan
0051](./plans/completed/0051-consolidation-eess-monorepo.md) consolidated.

For `packages/core` a copy is not merely unwise but impossible:

|                                   |                                                 |
| --------------------------------- | ----------------------------------------------- |
| ts-archunit `src/core` files      | 57                                              |
| directly importing ts-morph       | 13                                              |
| **transitively ts-morph-tainted** | **37**                                          |
| transitively clean                | 20 — of which 18 are already in `packages/core` |

eess's kernel imports ts-morph in **zero** files and is gated on it
(`eess/kernel-no-engine-deps`). Upstream's `violation.ts`,
`project-relative.ts` and `exclusion-comments.ts` all import it; eess's
counterparts do not. The kernel was deliberately re-architected, so the
reconcile was **forced**, not chosen carelessly.

**The failure is therefore narrow and specific:** having correctly chosen
reconcile — the one mode where upstream fixes vanish silently — the fold owed a
bug-corpus check, and never ran one.

## Results

| verdict                        |  count |
| ------------------------------ | -----: |
| PRESENT                        |     37 |
| PARTIAL                        |     15 |
| MISSING                        |      6 |
| N/A (feature absent from eess) |      3 |
| **total**                      | **72** |

**~85% of upstream's fixes came across.** The misses cluster in three files —
`rule-builder.ts`, `exclusion-comments.ts`, `preset-dispatch.ts` — rather than
spreading evenly. A deliberately-biased first sample (silent-failure bugs in
shared kernel files) returned 40% missing; the full corpus returns ~8%. The
sample was not representative, and this record exists partly so that the 40%
figure is not remembered as the finding.

Every defect found is **inherited** — present in eess before the fold, and in
several cases in the published `0.2.x`. None is in the fold's own new work.

### Filed as bugs

| upstream         | eess bug                                                                               | what                                                            |
| ---------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 0043             | [0154](./bugs/0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md) | a directive inside a string literal suppresses a real violation |
| 0019             | [0155](./bugs/0155-a-rule-with-no-condition-passes-in-total-silence.md)                | a rule with subjects and no condition passes silently           |
| 0020             | [0156](./bugs/0156-should-twice-silently-drops-the-first-assertion.md)                 | a second `.should()` discards the first assertion               |
| 0038             | [0157](./bugs/0157-a-typo-in-a-preset-override-key-is-a-silent-false-green.md)         | a typo'd preset override key is silently ignored                |
| 0039             | [0158](./bugs/0158-an-undocumented-exclusion-directive-suppresses-and-only-warns.md)   | a reason-free directive suppresses and only warns               |
| 0064, 0067, 0065 | [0159](./bugs/0159-violation-identities-collide-across-distinct-findings.md)           | distinct findings share one identity                            |
| 0054             | [0160](./bugs/0160-within-creates-an-import-cycle-and-nothing-watches-for-cycles.md)   | `within()` cycle, and no cycle rule exists                      |

### Backlog — real, not yet filed

Each is reproduced; none is filed as its own record yet. Filing one is cheap
(`/bug`) and should happen when it is picked up, not before.

- **upstream 0030 — MISSING.** `definePredicate`/`defineCondition` are arity-2
  with no `globs` parameter, so a user-defined predicate cannot declare its
  globs and `diagnose()` is blind to it. The plumbing works: the same object
  built as a literal with `globs` diagnoses correctly.
- **upstream 0013 — PARTIAL, and a false green.**
  `smells/duplicate-bodies.ts:125` and `smells/inconsistent-siblings.ts:39`
  call `collectFunctions(sf)` without `includeObjectLiteralFunctions`. Two
  byte-identical object-literal arrows report **0 findings**.
  `resolver-rule-builder.ts:201` is fixed; these two are not.
- **upstream 0023 — PARTIAL, and a false red.** `shared: ['**/src/shared']`
  (folder glob, no `/**`) falsely flags a legitimate import and emits **zero**
  config findings. eess has no `shared-discovery` guard.
- **upstream 0021 — PARTIAL.** Config findings inherit the rule author's
  `docs` link: a vacuity finding about a dead selector carries a URL about
  cycles. The `suggestion` half is correct; `docs` leaks.
- **upstream 0029 — PARTIAL.** A config finding prints **twice** in terminal
  output (once from `executeWarn`, once from the CLI re-render) while
  `--format json` reports `total: 2`. eess has no
  `setCallerAggregatesReports` equivalent — an ADR-008 violation.
- **upstream 0047 — PARTIAL.** Fileless findings render `(:0)` in terminal and
  `"file": "", "line": 0` in JSON, rather than nulling the location.
- **upstream 0046 — PARTIAL.** `README.md`, `CLAUDE.md`, `RELEASING.md` and
  every `packages/*/README.md` are in **no link-checked root**
  (`scripts/check-corpus.mjs`'s `ROOTS`). The repo whose product is "links
  resolve" does not check its own front door.
- **upstream 0036, 0040, 0048, 0060, 0010, 0015, 0018, 0080 — PARTIAL.**
  Narrower gaps: unclassified glob surfaces; a gated empty-layer check; empty-
  project advice that differs between the rule and `doctor`; no `hashVersion`
  or stale-baseline diagnostic; the untested-allowlist notice on stderr only.

### Deliberate divergences — decisions, not defects

Worth recording so they are not "fixed" by a later reader:

- **upstream 0015.** eess routes the untested-allowlist notice to stderr only
  (`cli/commands/check.ts:131-139`: _"a `--format json` consumer's document
  stays machine-clean"_). Upstream put it on stdout precisely because _"an
  agent parses stdout, so a stderr-only notice would have been invisible."_
  Both are defensible; eess's is currently undocumented as a choice.
- **upstream 0050.** eess exports `marksAssertsCardinality` publicly (the
  kernel/dialect split requires it), which weakens upstream's "the binding is
  not exported" guarantee. Already disclosed in `packages/core/src/cardinality.ts`.
- **upstream 0027, 0044, 0017.** Features eess does not have: baseline
  diagnosis (eess's `baseline.ts` is 231 lines to upstream's 774),
  `orphanExclusions` (attempted and reverted — see plan 0150), and
  `because`/`suggestion` metadata on `no-cross-boundary`.

### Not fold drift

- **upstream 0007 (dependencies aliases).** Upstream still ships
  `src/rules/dependencies.ts` and its subpath export too; no removal commit in
  either repo. The record's "Fixed / Removed" status is false upstream as well.
- **upstream 0051 (JSX never run on-disk).** A test-coverage gap, not a defect
  — a real `.tsx` fixture was built and the entry point worked correctly.

## The lesson worth keeping

Upstream pairs `orphanExclusions()`'s unit test with a **dogfood** test that
runs it over its own `src/` and asserts `[]` by identity. That test's own
comment records why it exists: _"We shipped `orphanExclusions` to catch it, and
then exercised it only in its own unit test."_

Plan 0150's attempt ported the unit test and left the dogfood behind —
repeating verbatim the mistake the source repo had already made, fixed, and
written down.

**When porting, enumerate from the source's test-file list, not from its
implementation.** A fix whose shape is a deletion leaves nothing to copy; only
its test shows it existed.

## Timing

Most of what is listed here is in the **unpublished** `0.3.0`. npm currently
serves `@nielspeter/eess@0.2.2` / `eess-ts@0.2.1`, and [plan
0100](./plans/0100-publish-the-fold-retire-ts-archunit.md) is the publish gate.
Bugs 0154 and 0158 are the exceptions — both predate the fold and are live in
the published `0.2.x`.

That makes 0100 the natural deadline for the filed bugs above.
