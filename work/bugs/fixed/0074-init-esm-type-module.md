# Bug 0074: `eess-ts` crashes on its scaffolded config in CJS-default projects

## Status

- **State:** Done — red-first reproduced, fixed to green (config loads via jiti), e2e re-verified, suite + validate green. Deferred: none.
- **Reported:** 2026-07-19 — self-found while executing plan 0072's recipes
  against the published npm package (deferred from that plan's close as
  `0074-init-esm-type-module`).

## Symptom

In a fresh `npm init -y` project (no `"type": "module"`), `npx eess-ts init`
scaffolds successfully — and the very next command, `npx eess-ts check`,
crashes before doing any work:

```
SyntaxError: Cannot use import statement outside a module
    at .../eess-ts.config.ts:1
```

The scaffolder produces a setup its own CLI cannot load. It goes unnoticed in
this repo only because the monorepo root is already `"type": "module"`.

## Reproduction

```bash
mkdir demo && cd demo && npm init -y          # CJS-default package.json
npm install -D @nielspeter/eess-ts
npx eess-ts init                              # scaffolds eess-ts.config.ts (ESM syntax)
npx eess-ts check                             # ← crashes: Cannot use import statement outside a module
```

## Root cause

`resolveConfig` (`packages/ts/src/cli/resolve-config.ts`) loaded the config
with a raw `await import(path.resolve(configPath))`. Node decides a `.ts`
file's module-ness from the **consumer project's** nearest `package.json`
`type` field.

Bisected precisely (the first repro attempt with a hand-written
`{ "name": "demo" }` package.json did **not** reproduce): with the `type`
field **absent**, Node's module-syntax detection kicks in and loads the
ESM-syntax config fine. The trigger is that modern `npm init -y` writes an
**explicit `"type": "commonjs"`**, which disables detection — the config is
then parsed as CJS and the `import` statement throws. So every fresh
`npm init -y` project hits it, deterministically.

Rule files never hit this because `packages/ts/src/cli/load-rules.ts:24`
loads them through **jiti**, which handles ESM-syntax TypeScript regardless
of the host package's `type`. The two loaders diverged; the config loader was
the defective one.

## Fix

Load the config through jiti, exactly as rule files are loaded — one loader
behavior for both user-authored TypeScript inputs. No scaffold change, no
mutating the user's `package.json`, works in ESM and CJS consumer projects
alike. Follow-up in the same change: the docs' interim
`npm pkg set type=module` prerequisite (added by plan 0072 as the workaround)
is retired, since the constraint disappears.

## Verification

- [x] Red test written first (reproduces the defect):
      `packages/ts/tests/cli/config-cjs-project.test.ts` drives the built CLI
      in a temp project with `"type": "commonjs"` (the `npm init -y` shape)
      and the exact scaffolded config — failed with
      `Cannot use import statement` before the fix.
- [x] Fix turns it green — `resolveConfig` loads via jiti
      (`createJiti(import.meta.url).import(...)`), mirroring `load-rules.ts`.
- [x] End-to-end re-run of the plan-0072 wedge: the original crashing
      npm-installed scratch project (explicit `"type": "commonjs"`) runs
      `check` clean with the fixed dist — 4 rules, exit 0.
- [x] Suite still green; `npm run validate` green. Also retired the interim
      `npm pkg set type=module` prerequisite from `docs/agent-integration.md`
      and both quickstarts — the fix makes it unnecessary.

Deferred: none
