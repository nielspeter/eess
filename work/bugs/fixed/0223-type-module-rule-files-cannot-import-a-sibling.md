# Bug 0223: under `"type": "module"`, a rule file that imports a sibling cannot be loaded at all

## Status

- **State:** Fixed — by teaching the process loader TypeScript's specifier
  substitution and retrying the NATIVE import. Red first, all 5 ledger items closed.
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
and run against the same project, and printed exactly one violation block. The test would have
shipped as a guard of nothing.

**The first version of this section then explained WHY, and the explanation was false.** It
said `dedupeConfigFindings` "collapses duplicate configuration findings by content hash". A
method review disproved it, and the first attempt to retract it here overcorrected in the
other direction. What is true, read from `packages/core/src/dedupe-config-findings.ts`:

- **Not content-keyed.** The key is
  `` `${violation.file} ${identity} ${violation.element}` ``, and that file's docblock states
  the reason in bold — "**The glob, not the message**" — because two different globs that both
  match nothing are two edits.
- **One in-process array.** It is applied at `packages/ts/src/cli/commands/check.ts:238` and
  `packages/ts/src/core/check-all.ts:95`. A cross-registry double print is two separate writes
  to stderr, which no array function can collapse. This is the part that matters: whatever the
  key were, it could not absorb the hazard it was credited with absorbing.
- **The exclusions are narrow, not "all configuration findings".** `keyFor` declines a key for
  a finding that is not `bypassFilters`, for an empty or `'unnamed'` identity or element, and
  for the five ids in `EMITTER_IDS`. An ordinary configuration finding with a real id and a
  real element **is** deduped.

**And the hazard did not reproduce.** A method review forced the jiti branch on the built CLI
(`--no-experimental-detect-module` in a `"type": "commonjs"` project, which makes the native
import raise the format refusal) over a self-executing rule file with a vacuous selector — the
only shape that reads `callerAggregatesReports` at all. It printed **two** blocks, the vacuity
finding and the CLI's truncation notice, inside one numbered report. A genuine two-registry
load would give three: the rule file's own standalone report, then the CLI's pair. Zero
occurrences of the dedupe's own note ("This one option generated …") rule out that path
independently.

**So the honest statement is: the test did not discriminate, and why the hazard no longer
reproduces is not established.** Three candidates were named and none tested — jiti resolving
a bare specifier for an ESM package in `node_modules` through native `import()` rather than
transforming it; `withCallerAggregating` having become a dynamic extent rather than a latch
(bug 0203); or a Node or jiti version change since plan 0165 measured it. The probe also
entered jiti through the format-refusal branch rather than the rejected widening, and its
package was a symlink to this repo, so both sides shared one realpath; a consumer tree with a
separately installed copy is the same shape and was not tested.

Reaching for a mechanism to explain a measurement, and publishing it in three places without
checking it, is the same defect as the unfalsifiable test — a claim written ahead of what was
verified. The enum discriminator below stands on its own measurement and does not depend on
any of this being resolved.

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
- [x] `explain` reports a message, not an unhandled stack. **This box was checked
      before it was earned.** The case backing it used a project whose sibling
      RESOLVES, so after the repair it proved only that a working project works. A
      product review measured the class this record's own Severity paragraph
      describes — a specifier naming nothing, the ordinary typo — and found
      `explain` alone answering with ten frames of Node internals while `check`
      and `doctor` both reported a message. It failed CLOSED throughout, exit 1
      either way, so this was a missing diagnosis and not a false green.
      `explain` now wraps the load the way the other two do, and two cases cover
      the failure path: one for `explain`, one asserting `check` and `doctor`
      still do the same so it is not special-cased.
- [x] The error message no longer names a test runner for a file that imports none — and still
      names one for a file that does, so the gate cannot pass by saying nothing.
- [x] Two regressions the fix must not introduce: a specifier naming nothing still fails as it
      did, and a real `.js` beside a `.ts` of the same name is still the one resolved.

Deferred: none.
