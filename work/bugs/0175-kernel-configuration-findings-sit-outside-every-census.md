# Bug 0175: kernel configuration findings sit outside every census

## Status

- **State:** Draft — measured; fix not built.
- **Found:** 2026-08-20, enforcement review of the `fold-audit-0154-0160` branch
  (finding I2).
- **Severity:** a coverage gap in a guard, not a dead gate. The five producers
  below all fire — verified by sabotage.

## Symptom

`packages/ts/tests/core/every-config-finding-is-classified.test.ts` enforces that
_"a new producer cannot arrive without someone saying whether its remedy has been
tried"_. It scans `src/` **relative to `packages/ts`**
(`every-config-finding-is-classified.test.ts:37,221`), so it sees the dialect and
nothing else.

`packages/core` holds **seven** `bypassFilters: true` producers, none with a
`remedy` classification or a `verified:` decision:

| producer                       | line                                                        |
| ------------------------------ | ----------------------------------------------------------- |
| `zeroExaminedViolation`        | `packages/core/src/vacuity-findings.ts:24`                  |
| `deadGlobViolation`            | `:54`                                                       |
| `unmetExpectNonEmptyViolation` | `:78`                                                       |
| `zeroLoadedSourceViolation`    | `:105`                                                      |
| `expiredExpectEmptyViolation`  | `:130`                                                      |
| `assertionLessViolation`       | `packages/core/src/terminal-builder.ts:413`                 |
| (preset dispatch)              | `packages/core/src/preset-dispatch.ts` — deleted 2026-09-06 |

They serve `eess-md`, `eess-mermaid`, `eess-gherkin` and `eess-crossvalidate` —
four dialects whose configuration findings are therefore entirely un-surveyed.

**The census's absence is what let two real defects through**, which is the
argument for building it rather than a hypothetical:

- `zeroLoadedSourceViolation` had no break class anywhere in the monorepo.
  Measured: making it unreachable left core at 159/159 and md, mermaid and
  gherkin green. Fixed on this branch, in
  `packages/core/tests/contract/extension-surface.test.ts`.
- `deadGlobViolation` cannot fire at all —
  [bug 0178](./0178-the-kernels-dead-glob-finding-cannot-fire.md).

Both are producers a census would have forced someone to write a `verified:` row
for, and neither row was writable. That is the census working by being absent.

## Not vacuous — measured

Breaking the kernel floor (`packages/core/src/terminal-builder.ts:269`,
`if (examined === 0)` → `< 0`) reddens **5 core + 12 md** tests. These producers
work. What is missing is the census that would stop a _sixth_ one arriving with
no one deciding whether its remedy remediates.

## Pre-existing, and why it is filed now

The five lived inside `packages/core/src/terminal-builder.ts` before the
`fold-audit-0154-0160` branch split them into their own module. The gap did not
change; the branch made it legible by giving the producers a file with a name that
says what they are.

## Root cause

The census was written in the dialect, for the dialect, at a time when the kernel
produced no configuration findings of its own. The kernel now does.

## Fix

Not built — it carries a real design choice and five honest verdicts, which is
more than a tail-end addition to another branch should carry.

Two shapes, and the choice matters:

1. **A kernel census** in `packages/core/tests/`, mirroring the dialect's. The
   architecturally correct home — a kernel concern tested from a dialect is
   backwards, and `packages/core` cannot import from `packages/ts`.
2. **Parameterise the dialect census over both roots.** Less duplication, but it
   leaves the kernel's guarantee owned by a package that merely depends on it.

Prefer (1) unless writing it shows the two tables want to be one.

The five classifications are the substance, not the scan. All five write
`suggestion: message` at the producer, so `remedy: 'own'` is straightforward.
`verified:` is the judgment: whether a behavioural test applies the stated remedy
and shows the finding clear, or an honest `stated-only:` with the reason none
exists. Do not copy `'stated-only'` five times to make the table green — that is
the exact failure the census exists to prevent.

## Verification

- [ ] All seven `bypassFilters: true` producers in `packages/core/src` are
      classified — including the two outside `vacuity-findings.ts`, which a
      scan pointed at that file alone would miss.
- [ ] The census fails when a new kernel producer is added without a row.
- [ ] The census fails when a classified producer is deleted (the stale
      direction, which is how the hand-written list it replaces went wrong).
- [ ] A vacuity row asserts the scan found producers, with a floor above zero.
