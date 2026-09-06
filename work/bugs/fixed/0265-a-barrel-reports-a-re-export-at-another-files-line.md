# Bug 0265: `haveNoUnusedExports` reports a barrel's re-export at a line in another file

## Status

- **State:** Fixed — red test first (it reported 2 where the barrel's line is
  3), then `exportSiteLine` in `packages/ts/src/conditions/reverse-dependency.ts`
  anchors the finding on the export site in the subject file. Fixed 2026-09-06.
  `Deferred: none`.
- **Severity:** Low — the verdict is right and the location is wrong, and it
  fails closed: a waiver on the barrel's real line does not apply, a code frame
  points at a line that may not exist in the named file, and an agent sent to
  line 5 of `index.ts` finds nothing there. Nothing is hidden; time is wasted. Same
  class as [0242](./0242-a-waiver-on-a-non-anchor-file-silently-does-not-apply.md).
- **Origin:** self-found · architect review of proposal 010, verified by execution
- **Reported:** 2026-09-06

## Symptom

A one-line barrel:

```ts
// src/index.ts
export { deep } from './lib.js'
```

where `lib.ts` declares `deep` on its line 5 and nothing imports `deep` from
either file. Under

```ts
modules(p).that().resideInFile('**/index.ts').should().haveNoUnusedExports()
```

the finding is:

```text
file=index.ts  line=5  index.ts exports "deep" which is not referenced by any other file
```

`index.ts` has one line. Line 5 is `lib.ts`'s declaration line. The `file` and
the `line` of one finding belong to two different files.

## Reproduction

Three files under a temp project (`tsconfig.json` including `src`; `src/lib.ts`
with four comment lines then `export function deep(): number { return 1 }`;
`src/index.ts` as above) and the rule above through `.violations()`. Measured
2026-09-06 against `packages/ts/dist`: `examined=1`, one violation, `line=5`.

On this repository the defect is **latent**, not absent: `packages/core/src/index.ts`
exports 100 declarations and every one of them is declared elsewhere
(`scripts/profile-ts-check.mjs` reports 192 foreign declarations across
`packages/core/src`), but `eess/no-unused-exports` excludes both barrels as
entry points (`arch.internal.rules.ts:65`), so `check:arch` never asks the
question of a barrel. Any adopter barrel that is not excluded gets the wrong
line.

## Root cause

`findUnusedExportsInFile` (`packages/ts/src/conditions/reverse-dependency.ts:247`)
iterates `sf.getExportedDeclarations()` (`packages/ts/src/conditions/reverse-dependency.ts:249`),
which follows a re-export to the **declaring** node in the other file. The
finding then takes its `line` from that node —
`firstDecl.getStartLineNumber()` at
`packages/ts/src/conditions/reverse-dependency.ts:256` — and its `file` from the
subject — `sf.getFilePath()` at
`packages/ts/src/conditions/reverse-dependency.ts:260`. For an own declaration
the two agree; for a re-export they never do.

## Why it matters

A finding must report its own line. Inline exclusion comments anchor on
`violation.line` (`packages/core/src/exclusion-comments.ts:475`), so an
`// eess-exclude` on the barrel's actual `export` line does not apply — the
0242 shape, fail-closed. The code frame and the GitHub annotation are rendered
from the same pair and point at nothing. Under ADR-009 a violation must be
actionable; this one names the right symbol at the wrong place.

**Not the same defect as [0243](../0243-a-barrel-re-export-counts-as-a-use.md)**,
which lives in the same function and is about the _verdict_ — a re-export
counted as a use of the declaring module's symbol. This record is about the
_location_ when the subject is itself the barrel. The two must not be folded:
a fix for one changes nothing about the other, and proposal 010's Ask C (an
index in place of the LanguageService) must inherit neither.

## Fix

`exportSiteLine` in `packages/ts/src/conditions/reverse-dependency.ts` anchors a
re-exported name on its export site **in the subject file**: the
`ExportSpecifier` inside `export { x } from` (matched on the alias, so
`export { dead as gone } from` is found under `gone`), the `export * as N from`
statement, or the `export *` statement that forwards the name. An own
declaration keeps the line it always had. Whether a barrel's re-export whose only
user is the declaring file should be a finding at all is 0243's question and
stays there.

**One defect inside the fix, found by the fixtures and recorded rather than
quietly repaired.** The first cut branched on ts-morph's `isNamespaceExport()`,
which is implemented as `!hasNamedExports()` and is therefore **true for a bare
`export * from`** as well as for `export * as N from`. The star form took the
namespace branch, matched no name, and fell through to the declaring file's
line — so the fix left its own headline case broken while the aliased and
namespace cases passed. The three isolated fixtures caught it on their first run
(star reported 5 under a two-line barrel); the code now reads
`getNamespaceExport()` and says why in a comment.

## Verification

- [x] Red test written first — `packages/ts/tests/conditions/reverse-dependency.test.ts` ·
      `it('reports a re-exported name at the barrel\'s own export line, never the declaring file\'s (bug 0265)')`
      over the existing `reverse-deps` fixture: the barrel re-exports `helperTwo`
      on its line 3, the declaration is the other file's line 2, and the test
      failed with "expected 2 to be 3" before the fix.
- [x] The own-declaration path is unchanged —
      `it('an own declaration still reports its declaration line (control for 0265)')`.
- [x] `export * from`, `export * as L from` and `export { dead as gone } from`
      each report their own statement's line — an isolated fixture,
      `packages/ts/tests/fixtures/barrel-line/`, whose declaration sits on line 5
      so a wrong anchor is a line none of the one-statement barrels has.
- [x] Discrimination measured by sabotage: with `exportSiteLine` reduced to the
      pre-fix behaviour (always the declaration's line), **exactly these four
      tests red** and the other twelve in the file stay green — including the
      own-declaration control, which the sabotage must not move.
- [x] `npm run typecheck`, `lint`, the ts suite, `check:release` and `check:fast`
      green in the PR; `npm run validate` is CI's.

Deferred: none.

## Related

- [0243](../0243-a-barrel-re-export-counts-as-a-use.md) — the verdict half, same function.
- [0242](./0242-a-waiver-on-a-non-anchor-file-silently-does-not-apply.md) — the wrong-anchor class.
- [Proposal 010](../../proposals/010-ts-performance-at-scale.md) — surfaced by its review; Ask C must not inherit this.
