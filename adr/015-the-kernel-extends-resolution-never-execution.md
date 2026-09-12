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

**It is refused, and the first version of this ADR gave the wrong reason.** It
said a module loaded through `jiti` gets `jiti`'s own registry, "so the copy of
the dialect it imports is a different instance from the CLI's", and rested the
whole decision on that. An architecture review measured it and it is false.

Under the pinned `jiti` 2.7.0, the transpiled rule file is `jiti`'s; every bare
specifier it names resolves to the instance the host already holds. Measured
three ways, with controls: the kernel's error class is the same object,
`instanceof` holds, the dialect's exported function is the same object, and a
write performed inside a `jiti`-loaded file is visible to the host's read.
Fresh mode, which the watch path uses, behaves identically.

**The split is a property of installation topology, not of the loader.** A second
physical copy of the kernel — a nested or duplicated install — does split it, and
would split it just as thoroughly under a native `import()`. That is why
`isArchRuleError` in `packages/core/src/errors.ts` is structural, and it stays
justified; plan 0165 measured a real split on an older `jiti`, so this is ground
that moved rather than an error made then.

**The durable reason to load natively is different, and simpler: the loader
decides which PROGRAMS are a valid rule file.** `jiti` transpiles, so it accepts
TypeScript that Node's strip-only mode refuses — an `enum`, a `namespace`, a
parameter property. Whether a rule file compiles must not depend on which dialect
is reading it, and today it does.

So the loaders are native-first by design, and `isModuleFormatRefusal` keeps the
`jiti` fallback to exactly one condition — a consumer project that is
`"type": "commonjs"` while the file uses ESM syntax
([bug 0074](../work/bugs/fixed/0074-init-esm-type-module.md)).

## Decision

**Module RESOLUTION may be extended. A consumer's file is EXECUTED by Node, not
handed to a transpiler.**

Concretely, for any file the family loads on a consumer's behalf — a rule file, a
config file:

1. The kernel may teach the host process's resolver a fact about how TypeScript
   writes specifiers, through `node:module`'s synchronous `registerHooks`. That
   hook is in-thread and changes only which URL a specifier names.
2. The file is then imported by Node. Which loader reads a consumer's file
   decides which programs are valid rule files, and that must not vary by
   dialect — a transpiler quietly widens the accepted language for one dialect
   and not another.
3. The one standing exception is the `"type": "commonjs"` format refusal above,
   which predates this ADR and is narrowed by a predicate rather than by a
   general `catch`.

**That exception does contradict the rule, and an architecture review measured
it.** The paragraph that stood here claimed the fallback never widens the
accepted language, on the grounds that Node's strip-only parse refuses
non-erasable syntax before `isModuleFormatRefusal` is consulted. That holds only
when the offending syntax is in the ENTRY file, which is the one shape its author
tested. Put it in a SIBLING — the shape this ADR's own row 1 uses as its
discriminator — and Node never parses the sibling: the entry fails with `Cannot
use import statement outside a module`, the predicate matches, and `jiti`
transpiles the whole graph. Measured on the `engines` floor:

| consumer's `type` | a sibling containing `enum` |
| ----------------- | --------------------------- |
| `commonjs`        | loads and runs, exit 0      |
| `module`          | refused, exit 1             |

So **the accepted language of an `eess-ts` rule file varies with the consumer's
`type` field** — the very thing clause 2 says must not vary. That is a second
divergence, inside one dialect, and it is recorded rather than explained away:
[bug 0281](../work/bugs/0281-mermaid-rule-files-accept-syntax-eess-ts-refuses.md)
carries it alongside the `eess-mermaid` one. Closing it means restricting the
fallback to erasable syntax, which is work this ADR does not do.

Clause 3 is therefore narrower than it first reads: the exception is standing and
known to widen the language, not tolerable because it does not.

**One door does not conform, and it ships today.** `eess-mermaid`'s RULE FILE
loader — `packages/mermaid/src/cli/load-rules.ts` — calls `jiti.import()`
unconditionally, with no native attempt. Measured, the consequence is not a
second registry: it is a wider accepted language. The same rule file, in both
dialects:

| a rule file containing | `eess-ts`       | `eess-mermaid` |
| ---------------------- | --------------- | -------------- |
| `enum`                 | refused, exit 1 | loads, exit 0  |
| `namespace`            | refused, exit 1 | loads, exit 0  |
| a parameter property   | refused, exit 1 | loads, exit 0  |

The refusal is consistent across `"type": "module"` and `"type": "commonjs"`:
Node raises the syntax error before the format refusal, so the `jiti` fallback is
never reached.

**That door is sanctioned, and the sanction is about language, not registries.**
Nothing taught the permission — this repo's own `mermaid.rules.ts` is
erasable-only, and no page under `docs/` or the mermaid README shows any of the
three. Aligning the loader would break rule files using syntax nothing documented
and the sibling dialect already refuses. So `eess-mermaid` rule files remain a
transpiled population until that break is worth taking, and
[bug 0281](../work/bugs/0281-mermaid-rule-files-accept-syntax-eess-ts-refuses.md)
holds the prior question.

**What is gated instead.** The premise this ADR was first argued from — that
`jiti` splits the kernel — is now pinned by
`scripts/lib/module-registry-identity.test.mjs`, with a duplicate-install control
so the probe can be shown capable of observing a split. If `jiti` changes, that
reds and this reasoning is re-derived rather than drifting. An earlier version of
this ADR gated a scan of `eess-mermaid`'s imports for shared kernel state; a
testing review emptied that gate without any case noticing, and the premise it
guarded turned out not to hold, so it is deleted rather than repaired.

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

| Clause                                                                          | Tier | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Status    |
| ------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| A rule file loads into the CLI's own registry, not a transpiler's               | 2    | `packages/ts/tests/cli/esm-sibling-import.test.ts` · `it('resolves the sibling with Node, not by falling back to a transpiler')` — a TypeScript `enum` in the SIBLING discriminates the two loaders, because Node's type stripping refuses one and `jiti` transpiles it. Measured red against the rejected implementation, built and run                                                                                                                                                                                                                                                                                                                                                                                                      | `gated`   |
| Resolution is extended only where Node would otherwise fail                     | 2    | `packages/ts/tests/cli/esm-sibling-import.test.ts` · `it('a real .js beside a .ts of the same name still wins')` for the hook, and `packages/core/tests/typescript-specifier-resolution.test.ts` for the predicate — its first case asserts the on-disk conjunct. Both measured red when the respective conjunct is removed. The kernel half is cited by path, not by title: the ADR↔test resolver loads only `packages/ts/tsconfig.json`, so a kernel `it()` cannot be resolved ([bug 0262](../work/bugs/0262-an-adr-cannot-cite-a-kernel-test.md)). It runs in `npm test` and blocks                                                                                                                                                        | `gated`   |
| The substitution follows TypeScript's own emit table, not a guess               | 1    | `packages/core/tests/typescript-specifier-resolution.test.ts` — one case asserts the four emitted-to-source pairs as a set, so deleting a row fails; another asserts the inverse, that a `.mjs` specifier never resolves to a plain `.ts`, so the mapping cannot pass by accepting everything. Cited by path rather than by title for the same reason as the row above ([bug 0262](../work/bugs/0262-an-adr-cannot-cite-a-kernel-test.md))                                                                                                                                                                                                                                                                                                    | `gated`   |
| Both CONFIG doors — `eess-ts` and `eess-mermaid` — take this route              | 2    | `packages/mermaid/tests/cli/esm-sibling-config.test.ts`, driven through a real Node subprocess because vitest resolves through Vite and performs the substitution itself — an in-process version of this test passed with the fix deleted. Cited by path: the resolver is `eess-ts`-only ([bug 0262](../work/bugs/0262-an-adr-cannot-cite-a-kernel-test.md)). Only these two dialects ship a bin; the other three load no consumer file                                                                                                                                                                                                                                                                                                       | `gated`   |
| Every RULE FILE door takes this route, or is a sanctioned transpiled population | 2    | **No mechanism can red for this clause today, so it is not gated.** `scripts/lib/module-registry-identity.test.mjs` pins whether `jiti` shares the host's module instances — a fact this ADR now argues is NOT the reason for the decision — so it cannot fail when the clause is violated: add a sixth dialect whose rule-file door calls `jiti.import()` unconditionally and every case stays green. An architecture review caught this row keeping `gated` after the only mechanism that could ever have red for it was deleted in the same commit. The shape is a rule counting unconditional `createJiti` entrances per dialect; the prior question is [bug 0281](../work/bugs/0281-mermaid-rule-files-accept-syntax-eess-ts-refuses.md) | `pending` |
| The kernel gains no dependency by doing this                                    | 1    | `check:integrity`'s phantom-dependency check — `@nielspeter/eess` declares no dependencies, so any non-builtin bare import in its `src/` fails                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `gated`   |
| The hook never fires for a parent that is not a TypeScript source               | 1    | No test exists. The guard is `isTypeScriptSource` in `packages/core/src/cli-config.ts`; removing it lets a relative specifier inside `node_modules` be rewritten, which is how a dependency shipping source beside a stale build directory would get its TypeScript loaded through strip-only mode. Owed a fixture                                                                                                                                                                                                                                                                                                                                                                                                                            | `pending` |
| `jiti` is entered for the `"type": "commonjs"` format refusal and nothing else  | 2    | **A second entrance already ships**, so this is not an unproven hypothetical: `packages/mermaid/src/cli/load-rules.ts` enters `jiti` unconditionally (bug 0281). `packages/ts/tests/cli/config-cjs-project.test.ts` covers that the refusal path works, and nothing asserts it is the only path. A rule counting `createJiti` call sites per dialect is the shape; the enum clause above catches the specific widening this ADR rejects, not a further entrance                                                                                                                                                                                                                                                                               | `pending` |
| A worker-thread or async loader for rule files is out of scope while this holds | 5    | Ratification: no mechanism is possible for a decision about what is not built. Recorded so the next person weighing it reads this first                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `manual`  |
