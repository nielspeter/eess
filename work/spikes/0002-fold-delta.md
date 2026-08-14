# Spike 0002: Fold delta — ts-archunit → eess (plan 0088 Phase 1)

Measured 2026-08-14 against `ts-archunit` commit `b4084c9` (`package.json`
version **0.61.0**) at `/Users/nps/Documents/Projects/NielsPeter/ts-archunit`.
The plan's own headline figures (10,342 diff-lines / 37 modules) were measured
2026-08-10 against **0.59** — this is a newer checkout, so the real numbers
below are larger, not smaller. That is expected: the source has kept moving
since the plan's original measurement, not a correction to it.

## Method

Two comparisons, deliberately using different matching precision because the
two eess trees have different shapes:

- **Kernel-bound** (`ts-archunit/src/core/*.ts` vs `eess/packages/core/src/*.ts`,
  both flat directories) — matched by **basename**.
- **eess-ts-bound** (`ts-archunit/src/**` vs `eess/packages/ts/src/**`, both
  have real subdirectory structure — `predicates/`, `conditions/`, `builders/`,
  etc.) — matched by **last-2-path-segments** (`dir/file.ts`), which avoids
  false matches between unrelated files sharing a generic basename
  (`index.ts`, `call.ts`, `class.ts`, `slice.ts` each appear 2-7× across
  unrelated directories in both trees).

## Headline numbers

|                                                  | Plan's 2026-08-10 figure (v0.59) | Measured 2026-08-14 (v0.61.0)           |
| ------------------------------------------------ | -------------------------------- | --------------------------------------- |
| Shared-file diff-lines, kernel-bound (21 files)  | —                                | **3,585**                               |
| Shared-file diff-lines, eess-ts-bound (95 files) | —                                | **8,009**                               |
| **Total shared-file diff-lines**                 | **10,342** (118 files)           | **11,594** (116 files)                  |
| Never-received modules (basename match)          | **37**                           | **37** (exact match — see caveat below) |

**Caveat on the 37 match:** basename-only matching found exactly 37 files with
no basename anywhere in either eess tree — the same count the plan cites, which
is a strong signal the classification methodology is stable even though the
source moved. It is not a semantically clean number: 6 of the 37 are barrel
`index.ts` files (expected to differ trivially, not real "modules"), and one
(`builders/correspondence-builder.ts`) is eess-ts-bound, not kernel-bound.
Excluding those, ~30 are genuinely new core/ modules never received.

## Bucket A — kernel-bound, shared (21 files, `packages/core/`)

Exact basename match against the plan's own count of 21 — the kernel/ts-archunit
ancestry is stable.

| file                                   | ts-archunit lines | eess lines | diff-lines    |
| -------------------------------------- | ----------------- | ---------- | ------------- |
| terminal-builder.ts                    | 1298              | 160        | **1214**      |
| rule-builder.ts                        | 571               | 376        | **557**       |
| violation.ts                           | 512               | 51         | **511**       |
| execute-rule.ts                        | 514               | 192        | **462**       |
| exclusion-comments.ts                  | 426               | 280        | **250**       |
| format-json.ts                         | 180               | 31         | 155           |
| index.ts                               | 20                | 78         | 82            |
| combinators.ts                         | 111               | 100        | 73            |
| format.ts                              | 125               | 103        | 60            |
| format-github.ts                       | 83                | 49         | 42            |
| define.ts                              | 96                | 52         | 48            |
| predicate.ts                           | 45                | 10         | 35            |
| rule-description.ts                    | 51                | 13         | 40            |
| rule-metadata.ts                       | 44                | 26         | 24            |
| check-options.ts                       | 64                | 50         | 14            |
| condition.ts                           | 65                | 58         | 7             |
| errors.ts                              | 19                | 24         | 9             |
| silent-exclusion.ts                    | 43                | 43         | 2             |
| ansi.ts, code-frame.ts, environment.ts | —                 | —          | 0 (untouched) |

`terminal-builder.ts`, `rule-builder.ts`, and `violation.ts` alone account for
**2,282** of the 3,585 kernel-bound diff-lines (64%) — these three are where
Phase 4's real engine-fold effort concentrates.

## Bucket A2 — kernel-bound, never received (~30 new `core/` modules)

`cache-registry` `cardinality` `check-all` `comment-suppression`
`correspondence-core` `dedupe-config-findings` `descendant-cache` `diagnose`
`diff-disclosure` `disk-set` `edge-coverage` `element-cache`
`empty-project-advice` `glob-diagnosis` `glob-evaluator` `glob-site`
`identity-root` `import-candidates` `metric-violation` `module-edges`
`object-literal-functions` `orphan-exclusions` `owns-empty-discovery`
`path-universe` `per-root-compiler-options` `project-relative`
`rule-builder-like` `selection-memo` `shallow-clone` `stderr` `type-guards`
`unsuppressable`

This is the honest-gate machinery ADR-009/010 describe, built after the fork
— confirms the plan's Problem section: "the doctrine is missing" is a file-level
fact, not just a prose claim.

## Bucket B — eess-ts-bound, shared (95 files, `packages/ts/`)

Not reproduced in full here (see the per-file numbers computed during this
spike, re-derivable from the method above); heaviest single-file deltas:
`conditions/dependency.ts` (431), `builders/slice-rule-builder.ts` (479),
`presets/shared.ts` (398), `smells/inconsistent-siblings.ts` (351),
`conditions/slice.ts` (304), `helpers/slice-graph.ts` (270),
`conditions/cross-layer.ts` (277), `presets/boundaries.ts` (261).

## Bucket C — already-in-eess / superseded

Not separately re-derived this pass — `check-all.ts` (superseded by
`finishPreset`, per the plan and prior plan 0081) is the one the plan names by
example; confirmed present in ts-archunit's never-received list above (it never
needed porting, by design).

## Merge hazard re-verification (2026-08-14, against v0.61.0)

**Hazard 1 — the gate/`diagnose()` pair.** Confirmed still an ordered pair:
`terminal-builder.ts` (now 1298 lines, was ~424 at the plan's citation) and
`diagnose.ts` (now 613 lines, was ~380) both still reference all five shared
symbols the plan names (`isFaultPosition`, `loadedNothing`,
`emptyProjectAdvice`, `assertionAdvice`, `zeroSubjectsAdvice`) — 2-5 hits each.
Both files have grown substantially past the plan's line-range citations;
whoever executes Phase 4 should re-read them fresh rather than trust the
`~339–424`/`~194–380` ranges, which are now stale by file growth, not by the
symbols moving.

**Hazard 2 — the three unforgeable registries.** Confirmed exactly as the plan
describes: `cardinality.ts`'s `CARDINALITY_ASSERTERS` is a module-private
`WeakSet<object>()`; `owns-empty-discovery.ts`'s `OWNERS` is also a
non-exported `WeakSet<object>()`, with an inline comment explicitly recording
why (a prior `unique symbol` version was forgeable via
`Object.getOwnPropertySymbols`); `silent-exclusion.ts` is the one that
**does** use `unique symbol` (`const SILENT: unique symbol = ...`) — matching
the plan's own description of it as the odd one out among the three. All three
still exist, unmodified in kind.

**Hazard 3 — name collisions.** Confirmed and slightly worse than the plan's
"2–4×" citation: `notExist` (10 hits), `haveNameMatching` (9),
`resideInFile` (9), `havePropertyNamed` (4), `acceptParameterOfType` (4),
`notImportFrom` (7), `haveAttribute*` (4 files). The collision surface has
grown since the 2026-08-10 measurement, reinforcing rather than weakening the
plan's point: the barrel-aliasing table must be rebuilt from the current
source, not assumed stable at the old counts.

## The ts-morph-import blocker (Phase 4's kernel-purity constraint)

Of the ~54 kernel-bound candidate files (21 shared + ~33 new), **19 import
`ts-morph` directly**: `exclusion-comments.ts`, `rule-builder.ts`,
`terminal-builder.ts`, `violation.ts` (all 4 of the "big four" from Bucket A),
plus `cache-registry.ts`, `descendant-cache.ts`, `element-cache.ts`,
`empty-project-advice.ts`, `identity-root.ts`, `import-candidates.ts`,
`metric-violation.ts`, `module-edges.ts`, `object-literal-functions.ts`,
`orphan-exclusions.ts`, `path-universe.ts`, `per-root-compiler-options.ts`,
`project-relative.ts`, `selection-memo.ts`, `shallow-clone.ts`.

This is the concrete list Phase 4's "must classify which kernel-bound files
actually import ts-morph, and re-express them behind an engine-neutral seam"
requirement operates over. It is not a small tail: **more than a third** of
the kernel-bound candidate set needs the `ArchProject`-seam treatment (ADR-007
Rule 1 shape) before it can land in `packages/core`, which must stay
ts-morph-free (verified this pass: `packages/core/package.json` still declares
no `dependencies`).

## What this changes about Phase 4's scope

Nothing in direction — every hazard, bucket, and constraint the plan names is
confirmed present and load-bearing. What changes is scale: the fold is larger
now (11,594 vs 10,342 shared-diff-lines) than when the plan was frozen, and the
ts-morph-purity rework touches 19 files, not an unspecified subset. Phase 4
should treat this spike's bucket lists as its literal starting worklist rather
than re-deriving them from scratch.
