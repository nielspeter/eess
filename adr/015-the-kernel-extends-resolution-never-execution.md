# ADR-015: The kernel extends resolution, never execution

## Status

**Accepted** — 2026-09-12.

Written after [bug 0223](../work/bugs/fixed/0223-type-module-rule-files-cannot-import-a-sibling.md),
whose fix installs a process-wide module-resolution hook from
`packages/core`. The rule that fix follows already governed the loaders — it is
why an easier repair was refused — but it lived only in docblocks inside the
files a maintainer would be editing, plus a completed plan and a closed bug.
None of those are binding.

## Context

A rule file is TypeScript, and TypeScript **mandates** the emitted `.js`
specifier for a relative import under `nodenext`. Node performs no `.js` → `.ts`
substitution. So the specifier `tsc` demands is the one Node cannot resolve, and
a rule file that imports a sibling fails to load with `ERR_MODULE_NOT_FOUND`.
Until 0223 that excluded the whole shape: a TypeScript ESM project could use the
CLI only while every rule fitted in one file with no local imports.

The family already carries a second loader. `jiti` transpiles, resolves the
specifier correctly, and was sitting right there in the `catch`. Widening its
fallback is a two-token change and it works.

**It is refused, and the reason is the decision this ADR records.** A module
loaded through `jiti` gets `jiti`'s own module registry, so the copy of the
dialect it imports is a different instance from the CLI's. Plan 0165 measured
both halves of what that breaks: `instanceof ArchRuleError` goes false, so a
truncated run says nothing about the rules that never ran ([ts-archunit bug
0029](https://github.com/nielspeter/ts-archunit/blob/main/bugs/fixed/0029-a-throwing-warn-truncates-the-rest-of-the-rule-file.md));
and `execute-rule.ts`'s module-level `callerAggregatesReports` is set on one copy
and read on the other. The first half was later made structural by
`isArchRuleError`. The second cannot be: module state has no cross-registry
identity to compare.

So the loaders are native-first by design, and `isModuleFormatRefusal` keeps the
`jiti` fallback to exactly one condition — a consumer project that is
`"type": "commonjs"` while the file uses ESM syntax
([bug 0074](../work/bugs/fixed/0074-init-esm-type-module.md)).

## Decision

**Module RESOLUTION may be extended. Module EXECUTION may not be delegated to a
second registry.**

Concretely, for any file the family loads on a consumer's behalf — a rule file, a
config file:

1. The kernel may teach the host process's resolver a fact about how TypeScript
   writes specifiers, through `node:module`'s synchronous `registerHooks`. That
   hook is in-thread and changes only which URL a specifier names.
2. The file is then imported by Node, into the CLI's own registry. A second
   registry is not an acceptable price for loading a file.
3. The one standing exception is the `"type": "commonjs"` format refusal above,
   which predates this ADR and is narrowed by a predicate rather than by a
   general `catch`.

**One door does not conform, and it ships today.** `eess-mermaid`'s RULE FILE
loader — `packages/mermaid/src/cli/load-rules.ts` — calls `jiti.import()`
unconditionally, with no native attempt, so every `eess-mermaid` rule file loads
into a second registry right now. That package's own
`packages/mermaid/src/cli/commands/check.ts` duck-types `ArchRuleError` by name,
commenting that "class identity is unreliable across jiti boundaries" — this
hazard, described as a workaround. Its CONFIG loader was brought onto the
native-first footing by bug 0223; its rule-file loader was not.

This ADR states the rule the family is held to and names that door as a known
divergence rather than quietly excluding it. Whether those rule files may remain
a transpiled population — moving them is a break, since jiti accepts TypeScript
syntax Node's type stripping refuses — is the prior question, and it is
[bug 0281](../work/bugs/0281-every-mermaid-rule-file-loads-into-a-second-registry.md).
Found by the adversarial validation of this table, not by its author.

The substitution is confined to where it cannot change an existing answer: it
fires only when the parent is a TypeScript source, the emitted path is **absent**
from disk, and the TypeScript source is **present**.

## Alternatives rejected

**Widen the `jiti` fallback to `ERR_MODULE_NOT_FOUND`.** The easy fix, and the
one a maintainer reaches for on seeing this symptom. Rejected for the registry
split above. It is genuinely distinguishable rather than theoretically so: under
the widened fallback a rule file whose sibling contains a TypeScript `enum` loads
and reports `1 rule across 1 file`, because `jiti` transpiles it; under the
shipped fix Node refuses it, because type stripping is erasable-syntax only.

**Register the hook only around the import, then deregister.** `registerHooks`
returns a handle and `deregister()` works — measured, a later import fails once it
is called. Rejected because it breaks a legitimate shape: a rule file that
imports a sibling lazily, inside a predicate at check time rather than at module
scope, resolves during the window under the shipped design and fails with
`ERR_MODULE_NOT_FOUND` under a scoped one.

**Resolve the specifier ourselves before importing.** Not possible. The failing
import is a statement inside the consumer's module, not at our call site; nothing
but a loader hook can rewrite it.

## Consequences

The honest cost, and it is smaller than "the kernel mutates its host process"
sounds. Measured:

| property                                        | result                                                                                                                                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Can it change a resolution that already worked? | No. With a real `.js` and a `.ts` of the same name both on disk, the `.js` is resolved.                                                                                       |
| When is it registered?                          | Lazily, only after a native import has already failed. A consumer who already resolves TypeScript never triggers it.                                                          |
| What does a consumer's own hook observe?        | A hook registered **after** an eess load, keying on `.js`, sees the rewritten specifier — only where its own hook did not resolve it.                                         |
| Is it reversible?                               | No. The handle is discarded deliberately: an export nothing calls is what [bug 0279](../work/bugs/0279-the-barrel-criterion-has-no-memory-and-no-adopter-signal.md) is about. |

It also adds `node:module` to the kernel's imports. That is a Node builtin, so
`check:integrity`'s phantom-dependency rule is unaffected — `@nielspeter/eess`
still declares no dependencies.

**It forecloses two things**, and they are the reason this is a decision rather
than an implementation detail: a worker-thread or async loader for rule files,
and any design in which a dialect hands a consumer's file to a transpiler and
keeps the result.

**Node floor.** `module.registerHooks` is present on Node 24.0.0, which is the
`engines` floor every package declares — verified against that exact version, not
inferred.

## Enforcement

| Clause                                                                          | Tier | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Status    |
| ------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| A rule file loads into the CLI's own registry, not a transpiler's               | 2    | `packages/ts/tests/cli/esm-sibling-import.test.ts` · `it('resolves the sibling with Node, not by falling back to a transpiler')` — a TypeScript `enum` in the SIBLING discriminates the two loaders, because Node's type stripping refuses one and `jiti` transpiles it. Measured red against the rejected implementation, built and run                                                                                                                                                                                                                                               | `gated`   |
| Resolution is extended only where Node would otherwise fail                     | 2    | `packages/ts/tests/cli/esm-sibling-import.test.ts` · `it('a real .js beside a .ts of the same name still wins')` for the hook, and `packages/core/tests/typescript-specifier-resolution.test.ts` for the predicate — its first case asserts the on-disk conjunct. Both measured red when the respective conjunct is removed. The kernel half is cited by path, not by title: the ADR↔test resolver loads only `packages/ts/tsconfig.json`, so a kernel `it()` cannot be resolved ([bug 0262](../work/bugs/0262-an-adr-cannot-cite-a-kernel-test.md)). It runs in `npm test` and blocks | `gated`   |
| The substitution follows TypeScript's own emit table, not a guess               | 1    | `packages/core/tests/typescript-specifier-resolution.test.ts` — one case asserts the four emitted-to-source pairs as a set, so deleting a row fails; another asserts the inverse, that a `.mjs` specifier never resolves to a plain `.ts`, so the mapping cannot pass by accepting everything. Cited by path rather than by title for the same reason as the row above ([bug 0262](../work/bugs/0262-an-adr-cannot-cite-a-kernel-test.md))                                                                                                                                             | `gated`   |
| Both CONFIG doors — `eess-ts` and `eess-mermaid` — take this route              | 2    | `packages/mermaid/tests/cli/esm-sibling-config.test.ts`, driven through a real Node subprocess because vitest resolves through Vite and performs the substitution itself — an in-process version of this test passed with the fix deleted. Cited by path: the resolver is `eess-ts`-only ([bug 0262](../work/bugs/0262-an-adr-cannot-cite-a-kernel-test.md)). Only these two dialects ship a bin; the other three load no consumer file                                                                                                                                                | `gated`   |
| Every RULE FILE door takes this route                                           | 2    | **False today, and known.** `eess-ts`'s does, and row 1 gates it. `eess-mermaid`'s `packages/mermaid/src/cli/load-rules.ts` calls `jiti.import()` unconditionally, so every one of its rule files loads into a second registry — [bug 0281](../work/bugs/0281-every-mermaid-rule-file-loads-into-a-second-registry.md). The whole `eess-mermaid` half of bug 0223's fix could be deleted with the repository suite green until a config-door test was added; the rule-file door still has none                                                                                         | `pending` |
| The kernel gains no dependency by doing this                                    | 1    | `check:integrity`'s phantom-dependency check — `@nielspeter/eess` declares no dependencies, so any non-builtin bare import in its `src/` fails                                                                                                                                                                                                                                                                                                                                                                                                                                         | `gated`   |
| The hook never fires for a parent that is not a TypeScript source               | 1    | No test exists. The guard is `isTypeScriptSource` in `packages/core/src/cli-config.ts`; removing it lets a relative specifier inside `node_modules` be rewritten, which is how a dependency shipping source beside a stale build directory would get its TypeScript loaded through strip-only mode. Owed a fixture                                                                                                                                                                                                                                                                     | `pending` |
| `jiti` is entered for the `"type": "commonjs"` format refusal and nothing else  | 2    | **A second entrance already ships**, so this is not an unproven hypothetical: `packages/mermaid/src/cli/load-rules.ts` enters `jiti` unconditionally (bug 0281). `packages/ts/tests/cli/config-cjs-project.test.ts` covers that the refusal path works, and nothing asserts it is the only path. A rule counting `createJiti` call sites per dialect is the shape; the enum clause above catches the specific widening this ADR rejects, not a further entrance                                                                                                                        | `pending` |
| A worker-thread or async loader for rule files is out of scope while this holds | 5    | Ratification: no mechanism is possible for a decision about what is not built. Recorded so the next person weighing it reads this first                                                                                                                                                                                                                                                                                                                                                                                                                                                | `manual`  |
