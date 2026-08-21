# Bug 0168: `no-unused-exports` misses barrel re-exports and inline `type` specifiers

## Status

- **State:** Draft — the false positives are live and currently waived in
  `packages/ts/src`.
- **Found:** 2026-08-19, auditing the `eess-exclude` directives added on
  `adopt-ts-archunit-tests`.

## Symptom

`eess/no-unused-exports` reports three symbols as unused that are demonstrably
used, two of them from the package's own public barrel:

| Symbol                      | Actually used by                                                      |
| --------------------------- | --------------------------------------------------------------------- |
| `FunctionCollectionOptions` | `src/index.ts:147` **and** `src/builders/function-rule-builder.ts:13` |
| `ObjectLiteralFunction`     | `src/index.ts:150`                                                    |
| `resetStderrGuardForTests`  | `src/index.ts:147`                                                    |

Measured: deleting `export` from any of them makes `npm run typecheck` fail with
`TS2459` naming those exact call sites. The export is load-bearing; the rule says
nothing uses it.

## Root cause

Two distinct blind spots in the usage scan, both about **type-position imports**:

1. **Barrel re-exports.** `src/index.ts` uses `export type { X } from './m.js'`.
   That form is a re-export, not an import binding, and the scan does not count
   it as usage. `index.ts` is in `ENTRY_POINTS` so it is excluded as a _subject_ —
   correctly — but excluding it as a subject must not also mean ignoring what it
   consumes.
2. **Inline `type` specifiers.** `function-rule-builder.ts:13` writes
   `import { collectFunctions, type FunctionCollectionOptions } from '…'` — a
   value import with an inline `type` specifier. The scan sees the value
   specifier and misses the type one beside it.

## Why it matters beyond the noise

This is the failure class ADR-009 is about, pointed the wrong way. A false
positive on a correct export teaches the reader that the honest response to this
rule is a waiver comment — and once waiving is the habit, the _true_ positives
get waived the same way. That is exactly what happened on this branch: 51
directives were added at once, and 35 of them were suppressing a finding whose
fix was to delete one word.

## Fix

Count both forms as usage:

- `export … from` re-exports, including `export type { … } from`.
- Inline `type` specifiers inside a value import clause.

## Verification

- [ ] A red test first: a fixture with a symbol used **only** via
      `export type { X } from` in an entry point, and one used only via an inline
      `type` specifier — both must be reported today and silent after the fix.
- [ ] The three waivers in `packages/ts/src` carrying the
      `see work/bugs/0168` reason are removed, and `check:arch` stays green.
- [ ] `scripts/check-nonvacuity.mjs` still reds when the rule is emptied.

## Out of scope

The **test-only** exports (13 of the 16 surviving waivers). Those are a true
positive: the gate reads `tsconfig.build.json`, which excludes tests, so an
export used only by tests genuinely has no `src` consumer. Widening the scan to
count test usage would disarm the rule against test-only surface that ships in
the package — the wrong fix. Whether such seams should live behind a separate
entry point is a design question, not this bug.
