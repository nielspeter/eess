# Bug 0265: `haveNoUnusedExports` reports a barrel's re-export at a line in another file

## Status

- **State:** Draft — measured against the shipped source on 2026-09-06, by the
  architect lens reviewing proposal 010 and again by execution during the
  synthesis; no red test yet.
- **Severity:** Low — the verdict is right and the location is wrong, and it
  fails closed: a waiver on the barrel's real line does not apply, a code frame
  points at a line that may not exist in the named file, and an agent sent to
  line 5 of `index.ts` finds nothing there. Nothing is hidden; time is wasted. Same
  class as [0242](./fixed/0242-a-waiver-on-a-non-anchor-file-silently-does-not-apply.md).
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

**Not the same defect as [0243](./0243-a-barrel-re-export-counts-as-a-use.md)**,
which lives in the same function and is about the _verdict_ — a re-export
counted as a use of the declaring module's symbol. This record is about the
_location_ when the subject is itself the barrel. The two must not be folded:
a fix for one changes nothing about the other, and proposal 010's Ask C (an
index in place of the LanguageService) must inherit neither.

## Fix

Anchor a re-exported name on its export site **in the subject file**: the
`ExportSpecifier` inside `export { x } from` (or the `export *` statement for a
star), found from `sf.getExportDeclarations()` by name, and report that node's
line. An own declaration keeps today's line. Whether a barrel's re-export whose
only user is the declaring file should be a finding at all is 0243's question
and stays there.

## Verification

- [ ] Red test written first: a one-line barrel re-exporting a name declared
      at line 5 of another file reports `line: 1`. Red today: it reports 5.
- [ ] The own-declaration path is unchanged: an export declared in the subject
      file still reports its declaration's line.
- [ ] `export * from` reports the star statement's line.
- [ ] `npm run validate` green.

Deferred: none.

## Related

- [0243](./0243-a-barrel-re-export-counts-as-a-use.md) — the verdict half, same function.
- [0242](./fixed/0242-a-waiver-on-a-non-anchor-file-silently-does-not-apply.md) — the wrong-anchor class.
- [Proposal 010](../proposals/010-ts-performance-at-scale.md) — surfaced by its review; Ask C must not inherit this.
