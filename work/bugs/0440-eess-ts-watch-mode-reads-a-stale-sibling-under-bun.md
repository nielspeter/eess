# Bug 0440: under Bun, eess-ts watch mode reads an edited sibling file as it was

## Status

- **State:** Draft — recorded 2026-10-16 from [spike 0438](../spikes/0438-what-the-family-does-under-bun.md).
  Measured in one test only; `eess-ts check --watch` end to end was not run under Bun.
- **Severity:** Medium under Bun — a false verdict: after an edit to a file the rule file imports, a
  watch run checks the old content. None under Node, the only runtime eess supports today.
- **Origin:** self-found · spike 0438, 2026-10-16.
- **Reported:** 2026-10-16

## Symptom

`packages/ts/tests/cli/esm-sibling-import.test.ts`, "a second fresh load sees the edited sibling,
not the first one", run under `bun --bun vitest` on a build with bug 0439's import patched, received
`{ first: 'v1', second: 'v2' }` as `{ first: 'v1', second: 'v1' }`. Under Node it passes.

## Root cause

Not traced. `importFresh` (`packages/ts/src/cli/watch.ts:39`) re-imports the rule file under a new
`?t=` URL. Why the edited sibling comes back fresh under Node and stale under Bun is the open
question.

## Fix

Owed to the Bun plan: trace how Bun caches an imported sibling, and either bust it or report that
watch mode cannot re-read siblings under Bun rather than checking stale code.

## Verification

- [ ] Reproduced with `eess-ts check --watch` under Bun, end to end
- [ ] Red test first on the Bun runtime

Deferred: none
