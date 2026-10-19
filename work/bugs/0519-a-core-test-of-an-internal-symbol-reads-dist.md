# Bug 0519: a core test of an `/internal` symbol reads dist, so a src mutant needs a rebuild to show

## Status

- **State:** Draft — recorded 2026-10-19 from PR #251's enforcement review (M2); reproduced on
  branch `batchfix/frozen2`. Record only.
- **Severity:** Low — no gate is wrong today. It is a trap for whoever runs a sabotage matrix on the
  kernel: a row recorded without rebuilding reads as "the mutant survived" when the test never saw it,
  or a stale build hides a regression from a local run until the next `npm run build`.
- **Origin:** self-found · PR #251's enforcement review (M2)
- **Reported:** 2026-10-19

## Symptom

Eight kernel test files import the kernel by its package name, `@nielspeter/eess/internal`, which
resolves to the built `packages/core/dist/`, not to `packages/core/src/`:

- `packages/core/tests/assertion-less-rules.test.ts`
- `packages/core/tests/cardinality-selector-fault.test.ts`
- `packages/core/tests/contract/extension-surface.test.ts`
- `packages/core/tests/expect-non-empty-on-not-exist.test.ts`
- `packages/core/tests/internal-is-not-forwarded.test.ts`
- `packages/core/tests/not-exist.test.ts`
- `packages/core/tests/undecided.test.ts`
- `packages/core/tests/unique-by.test.ts`

A change to the source those tests exercise is invisible to them until the package is rebuilt.

## Reproduction

Measured 2026-10-19: in `packages/core/src/unique-by.ts`, report only each group's first member
(`group.entries()` → `group.slice(0, 1).entries()`).

| run                                              | `packages/core/tests/unique-by.test.ts` |
| ------------------------------------------------ | --------------------------------------- |
| mutant applied, no rebuild                       | 12 of 12 pass                           |
| mutant applied, `npm run build -w packages/core` | 3 fail, 9 pass                          |
| mutant restored, rebuilt                         | 12 of 12 pass                           |

## Root cause

`/internal` is a subpath export, so the test imports it the way a dialect does. Vitest resolves the
package through `node_modules` to its `exports`, which point at `dist/`. Tests that import
`../src/…` (most of the kernel's) do not have the problem.

## Fix

Undecided. Either point those imports at `../src/internal.js` (the symbols are the same; the
contract test `internal-is-not-forwarded` may need the package path on purpose), or alias
`@nielspeter/eess` to `src/` in the kernel's vitest config. Meanwhile, the sabotage-matrix guidance
in `.claude/agents/reviewer-testing.md` says to rebuild after a kernel mutant.

## Verification

- [ ] Red test written first: a src mutant in `unique-by.ts` reds `unique-by.test.ts` without a
      rebuild.
- [ ] `npm run validate` green.

Deferred: none
