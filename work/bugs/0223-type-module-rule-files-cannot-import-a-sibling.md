# Bug 0223: under `"type": "module"`, a rule file that imports a sibling cannot be loaded at all

## Status

- **State:** Draft — root cause confirmed against `packages/ts/src/cli/import-rule-module.ts`;
  no red test written yet.
- **Priority:** High — it is not a diagnostic gap but a total loss of the CLI for a whole
  project shape. `check`, `doctor` and `explain` all fail, and `explain` fails with an
  unhandled `ERR_MODULE_NOT_FOUND` stack rather than a message. The shape it excludes —
  TypeScript ESM with `.js` specifiers — is the one TypeScript _mandates_ for ESM, and it is
  what any project splitting rules across files will hit on its first attempt.
- **Origin:** **inbound** — reported by an agent in a consuming project while evaluating the
  CLI. Re-sourced here: the reproduction below is a bare scratch package, and the root cause
  was confirmed by reading this repository's own loader, not the reporter's tree.

## Symptom

A rule file that imports a sibling module fails to load when the consuming package is
`"type": "module"`. The same two files load and diagnose correctly when `"type": "module"` is
removed.

```
Error: rules.ts could not be loaded (Cannot find module '/…/sibling.js'
imported from /…/rules.ts), so none of it could be diagnosed. If this file
imports a test runner (vitest/jest), doctor cannot load it — run your test
suite instead; the runtime writes the same diagnostics to stderr.
```

⚠️ **The message misdirects.** It offers a test-runner explanation for a file that imports no
test runner. The reporting agent took the hint as the cause and concluded — wrongly, and in
writing — that `doctor` refuses any file importing vitest. It does not: a rule file importing
`vitest` diagnoses correctly, which was measured before this record was filed.

## Reproduction

```bash
mkdir probe && cd probe && npm init -y
npm pkg set type=module
npm i -D @nielspeter/eess-ts@0.4.0 typescript
printf '{"compilerOptions":{"target":"ES2022","module":"nodenext","moduleResolution":"nodenext","strict":true},"include":["src/**/*.ts"]}' > tsconfig.json
mkdir src && echo 'export const x = 1' > src/index.ts

cat > sibling.ts <<'TS'
import { project } from '@nielspeter/eess-ts'
export const p = project('tsconfig.json')
TS

cat > rules.ts <<'TS'
import { modules } from '@nielspeter/eess-ts'
import { p } from './sibling.js'
export default [
  modules(p).that().resideInFolder('**/nope-xyz/**').should().notImportFrom('**/also-nope/**')
]
TS

npx eess-ts doctor rules.ts    # Cannot find module '.../sibling.js'
npx eess-ts check  rules.ts    # "This rule file could not be evaluated"
npx eess-ts explain rules.ts   # unhandled ERR_MODULE_NOT_FOUND stack
```

**Controls, all measured:**

| variant                                                                  | result                                            |
| ------------------------------------------------------------------------ | ------------------------------------------------- |
| remove `"type": "module"`                                                | ✅ all three commands work                        |
| single-file rules, no relative import, `type: module`                    | ✅ works — reports the vacuous selector correctly |
| `./sibling` (extensionless) instead of `./sibling.js`, no `type: module` | ✅ works                                          |
| add `import { describe, it } from 'vitest'` to a single-file rules file  | ✅ works — **not** a test-runner problem          |

## Root cause

`packages/ts/src/cli/import-rule-module.ts` tries native `import(file)` first and falls back to
jiti only when `isModuleFormatRefusal(error)` is true:

```ts
function isModuleFormatRefusal(error: unknown): boolean {
  if (!(error instanceof SyntaxError)) return false
  return (
    error.message.includes('Cannot use import statement outside a module') ||
    error.message.includes("Unexpected token 'export'")
  )
}
```

Under `"type": "module"` Node's native ESM loader takes the file — and Node does **not**
perform TypeScript's `.js` → `.ts` extension substitution. The failure is therefore
`ERR_MODULE_NOT_FOUND`, not a `SyntaxError`, so `isModuleFormatRefusal` is false and the error
rethrows. jiti — which _would_ resolve the specifier, because it applies TS resolution — is
never reached.

⚠️ **The narrowness is deliberate and must not simply be widened.** The same file documents
why (plan 0165, bug 0029): a rule file loaded through jiti gets jiti's own module registry, so
its copy of eess-ts is a different instance — `instanceof ArchRuleError` goes false, and
`execute-rule.ts`'s module-level `callerAggregatesReports` flag is set on one copy and read on
the other, double-reporting every configuration finding. A broad `catch` that fell back on any
error would also re-execute a self-executing rule file and print its findings twice. So the
fix cannot be "widen `isModuleFormatRefusal`".

## Why it matters

The excluded shape is not exotic. TypeScript requires the `.js` specifier for relative imports
under `nodenext`/ESM, and `"type": "module"` is what any modern TS project sets. Together they
mean: **a TS ESM project can use the CLI only while all of its rules fit in one file with no
local imports.** The moment rules are split — shared `project()` instances, shared globs, a
helper — the CLI stops working, with an error that points at the wrong thing.

## Fix

Not built. Two directions, neither obviously right:

1. **Resolve the specifier before importing.** On `ERR_MODULE_NOT_FOUND` for a relative
   `.js` specifier, retry with `.ts`/`.tsx` — keeping native `import()`, so the single-registry
   invariant the current design protects is preserved. Narrow, and does not touch jiti.
2. **Extend the jiti fallback to `ERR_MODULE_NOT_FOUND`** — simple, but re-opens exactly the
   two-registry hazards this file documents, and would need `isArchRuleError` plus a
   cross-registry answer for `callerAggregatesReports`.

Separately, and independent of either: the loader's error message should not offer the
test-runner explanation when the file imports no test runner, and `explain` should degrade the
way `check` and `doctor` do rather than throwing a raw stack.

## Verification

- [ ] The reproduction above loads under `"type": "module"` with a `.js` sibling specifier.
- [ ] ⚠️ **The single-registry invariant still holds** — `instanceof ArchRuleError` is true for
      an error thrown by a loaded rule file, and a configuration finding is reported **once**,
      not twice. That is what plan 0165 and bug 0029 cost; a fix that reopens it is not a fix.
- [ ] `explain` reports a message, not an unhandled stack.
- [ ] The error message no longer names a test runner for a file that imports none.
