# Bug 0281: every `eess-mermaid` rule file loads into a second registry

## Status

- **State:** Draft — found by the validator of
  [ADR-015](../../adr/015-the-kernel-extends-resolution-never-execution.md),
  auditing that ADR's own Enforcement table.
- **Severity:** Medium-to-high — it is the exact hazard ADR-015 exists to
  foreclose, shipping today, in the dialect the ADR's own table claimed as
  conforming. Not a false green in a rule; a decision that is already untrue
  where it is stated most confidently.
- **Origin:** self-found · adversarial validation of ADR-015

## Symptom

`packages/mermaid/src/cli/load-rules.ts:51` loads every rule file with
`jiti.import(resolved)` — unconditionally. There is no native import attempt, so
`isModuleFormatRefusal` and `isTypeScriptSpecifierMiss` are never consulted and
the native-first design ADR-015 records does not apply to this door at all.

`eess-ts` reaches jiti only through the `"type": "commonjs"` format refusal, and
`eess-mermaid`'s CONFIG loader was brought onto the same footing by bug 0223. Its
RULE FILE loader was not, and the split sits inside one package.

## The repo already knows

`packages/mermaid/src/cli/commands/check.ts:18` does not use `instanceof`:

```ts
function isArchRuleError(value: unknown): boolean {
  // Duck-type: ArchRuleError class identity is unreliable across jiti boundaries
  // because the rule file may load its own copy of the kernel. Match by name.
  return 'name' in value && typeof value.name === 'string' && value.name === 'ArchRuleError'
}
```

That comment is a description of the defect, written as a workaround. Plan 0165
measured the same split in `eess-ts` and paid to avoid it; the kernel's
`isArchRuleError` in `core/errors.ts` exists because class identity cannot be
relied on across registries. Here the dialect re-derived a local duck-type
instead, and the second half of the hazard — module state with no cross-registry
identity, which is what `callerAggregatesReports` is — has no duck-type
available.

## Why this is not simply "apply 0223's fix here"

Moving this door to native-first is a behaviour change for every published
`eess-mermaid` rule file. jiti transpiles; Node's type stripping does not. A rule
file using a TypeScript `enum`, parameter properties, or namespaces loads today
and would stop loading — the same discriminator ADR-015 relies on to prove the
registries differ cuts the other way here. That is a migration with a break, not
a repair.

The prior question is therefore whether `eess-mermaid` rule files are allowed to
be a transpiled population, and if so how ADR-015's Decision should be scoped to
say it. Answering it is the work.

## The corruption that must produce a violation

A dialect loading a consumer's rule file into a registry other than the CLI's,
with nothing saying so.

Today nothing does: the entire `eess-mermaid` half of 0223's fix could be deleted
and the repository suite stayed green until a test was added for the config door
alone. The rule-file door still has no such test.

## Verification ledger

- [ ] The prior question answered and recorded: may an `eess-mermaid` rule file
      be transpiled, or must it load natively like every other consumer file?
- [ ] Whichever way it is answered, ADR-015's Decision and its Enforcement rows 4
      and 7 say the true thing, rather than a universal that this door refutes.
- [ ] If the answer is "native": red-first against a rule file importing a
      sibling, and a migration note for the transpiled syntax that stops loading.
- [ ] If the answer is "transpiled": the duck-typed `isArchRuleError` and the
      unreachable `callerAggregatesReports` half are documented consequences
      rather than incidental workarounds.
