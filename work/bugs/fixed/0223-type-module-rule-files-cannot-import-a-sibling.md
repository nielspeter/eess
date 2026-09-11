# Bug 0223: under `"type": "module"`, a rule file that imports a sibling cannot be loaded at all

## Status

- **State:** Fixed — by teaching the process loader TypeScript's specifier
  substitution and retrying the NATIVE import. Red first, all four ledger items closed.
- **Severity:** High — it is not a diagnostic gap but a total loss of the CLI for a whole
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

**Direction 1, as the record argued.** `node:module`'s `registerHooks` is synchronous and
in-thread, so a resolve hook changes resolution without changing the loader: the rule file
still lands in this module registry. Two new members on the kernel's `cli-config.ts`, beside
`isModuleFormatRefusal` for the reason that file already gives — this is the shared, easy-to-
get-dangerously-wrong part of the impure half:

- `isTypeScriptSpecifierMiss(error)` — `ERR_MODULE_NOT_FOUND` whose `url` names a JS-family
  path whose TypeScript source **is on disk**. A genuinely missing module is still genuinely
  missing and nothing is retried on its behalf.
- `enableTypeScriptSpecifierResolution()` — registers the hook once. It rewrites only when the
  emitted path is absent AND the source present, so a real `.js` beside a `.ts` of the same
  name still wins.

`packages/ts/src/cli/import-rule-module.ts` and `packages/mermaid/src/cli/import-config.ts`
call it and retry natively. `packages/mermaid/src/cli/load-rules.ts` is unaffected — it goes
straight to jiti and never attempts a native import.

The doctor message is now gated on `importsTestRunner(file)`, parsed with ts-morph per ADR-002.

## What the first attempt at a falsifier proved, which was nothing

The ledger's second item is the load-bearing one: a fix that reopens the two-registry hazard is
not a fix. The obvious test was to assert a configuration finding is reported once rather than
twice.

**It passed under the rejected fix too.** Measured: the jiti-widening implementation was built
and run against the same project, and printed exactly one violation block. `dedupeConfigFindings`
in the kernel now collapses duplicate configuration findings by content hash, so the observable
that hazard was named for is absorbed before it reaches the report. The test would have shipped
as a guard of nothing.

What discriminates is **which loader resolved the specifier**, and a TypeScript `enum` answers
it: Node's type stripping is erasable-syntax only and refuses one, jiti transpiles it. Putting
the enum in the SIBLING means it is only reached after the substitution, so it probes the
repaired path rather than the entry file. Measured both ways:

| implementation           | result                                            |
| ------------------------ | ------------------------------------------------- |
| native retry (shipped)   | refuses the enum — Node loaded the sibling        |
| jiti fallback (rejected) | `1 rule across` — a transpiler loaded the sibling |

This does not re-argue whether the jiti fix was safe. It records that the stated reason to
reject it is no longer observable the way the record assumed, and that the test which looked
like a guard was not one.

## Verification

`packages/ts/tests/cli/esm-sibling-import.test.ts`, eight cases driving the BUILT CLI in a temp
`"type": "module"` project. Red first: `check`, `doctor` and `explain` all failed before the
change, `explain` with a raw `ERR_MODULE_NOT_FOUND` stack.

- [x] The reproduction above loads under `"type": "module"` with a `.js` sibling specifier —
      `check` evaluates the rule, `doctor` diagnoses the file.
- [x] **The single-registry invariant still holds** — asserted by the enum discriminator above,
      measured red under the rejected fix. The originally-planned assertion is recorded as
      `done-otherwise`: it could not distinguish the two implementations, and the section above
      says why rather than leaving a passing test to imply it did.
- [x] `explain` reports a message, not an unhandled stack.
- [x] The error message no longer names a test runner for a file that imports none — and still
      names one for a file that does, so the gate cannot pass by saying nothing.
- [x] Two regressions the fix must not introduce: a specifier naming nothing still fails as it
      did, and a real `.js` beside a `.ts` of the same name is still the one resolved.

Deferred: none.
