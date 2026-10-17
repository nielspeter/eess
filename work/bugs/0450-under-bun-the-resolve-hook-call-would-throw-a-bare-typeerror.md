# Bug 0450: under Bun, the CLI's resolve-hook call would throw a bare `TypeError`

## Status

- **State:** Draft — recorded 2026-10-17 at plan 0448's close, from its review. Not reproduced: the
  path has not been reached under Bun.
- **Severity:** Low — no package claims Bun (ADR-020), and the path is reached only when a TypeScript
  rule file's `.js` specifier misses, which Bun resolves on its own.
- **Origin:** self-found · plan 0448's review (devops, enforcement and method), 2026-10-17.
- **Reported:** 2026-10-17

## Symptom

Since bug 0439's fix, `packages/core/src/cli-config.ts` calls `nodeModule.registerHooks(...)` in
`enableTypeScriptSpecifierResolution`. Under Bun, `node:module` has no `registerHooks`, so if that
function were called it would throw `TypeError: nodeModule.registerHooks is not a function`, with no
remedy. Its callers are `packages/ts/src/cli/import-rule-module.ts:62` and
`packages/mermaid/src/cli/import-config.ts:36`, on the path where a specifier misses. Plan 0448's method review measured a rule file importing a missing `./missing.js` under Bun and got the ordinary "Cannot find
module" finding, so the path was not reached there. PR #232's method review then ran a rule file importing `./sibling.js`, where only `sibling.ts` exists, through the eess-ts CLI under Bun: it loaded with no `TypeError`, as under Node, so Bun resolves the substitution itself and the path may never be reached. The fix should weigh that before asking for a red test.

## Fix

To be decided with a claim: either refuse with a message naming the runtime (ADR-020 rule 5's
"excluded features refuse to run"), or skip registering where the runtime already resolves the
substitution, with a test that proves it does.

## Verification

- [ ] Red first: a Bun run that reaches the call

Deferred: none
