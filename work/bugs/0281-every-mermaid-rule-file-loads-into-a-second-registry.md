# Bug 0281: every `eess-mermaid` rule file loads into a second registry

## Status

- **State:** Parked — the prior question is answered and gated; the alignment
  work is deferred until the gate reds. Found by the validator of
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

## The break, measured — and it is smaller than first written

This record first said moving the door is "a migration with a break, not a
repair", and left it there as if the break were a reason not to. Measured, the
framing was backwards.

**The constraint is already the family norm.** `eess-ts` refuses a rule file
carrying non-erasable TypeScript today, because its loader is native-first and
Node's type stripping is erasable-syntax only. The same file, in both dialects:

| dialect        | a rule file containing `enum Kind { … }`                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `eess-ts`      | refused — `This rule file could not be evaluated … enum is not supported in strip-only mode`, exit 1 |
| `eess-mermaid` | loads and runs — `✗ eess-mermaid — 1 of 1 rule across 1 file failing`                                |

So `eess-mermaid` is the outlier, holding an extra permission the flagship does
not, and aligning it removes a divergence rather than imposing a new rule.

**Nothing taught the permission.** This repo's own `mermaid.rules.ts` is
erasable-only, and no page under `docs/` or `packages/mermaid/README.md` shows an
`enum`, a `namespace` or a parameter property in a rule file. The population at
risk is an adopter who reached for syntax nothing documented and the sibling
dialect rejects.

**What aligning would cost beyond the loader.** `load-rules.ts` gets fresh-mode
cache busting from jiti's `moduleCache: false`; native loading needs the
`importFresh` equivalent `eess-ts` has, or watch mode serves stale rule files —
the defect bug 0223's review found on the `eess-ts` side.

**What it buys.** `instanceof ArchRuleError` becomes reliable, so the duck-type
in `packages/mermaid/src/cli/commands/check.ts` can go; `callerAggregatesReports`
starts working, closing the half of the hazard that has no duck-type available.

## The prior question, now answerable from evidence

Three defensible answers, and this is a decision for ADR-015 rather than a fix:

1. **Align.** Native-first with the same narrow fallbacks. Removes the
   divergence; breaks untaught syntax in a published dialect; needs a plan, a
   migration note and a `minor` on `0.x`.
2. **Sanction it.** Amend ADR-015 to permit a transpiled rule-file population,
   and document the duck-type and the dead aggregation flag as its consequences
   rather than as workarounds. Cheapest, and leaves the hazard standing where the
   ADR says it is foreclosed.
3. **Fall back on the strip-only refusal too.** Native-first, but let a file Node
   cannot parse reach jiti. Every current rule file keeps working and the registry
   split shrinks to the files that opted into it. Makes the registry a rule file's
   syntax decides, which is subtler to reason about than either of the above.

## Ruling — 2026-09-12: option 2, with a trigger

**Sanctioned, conditionally, and the condition is gated.** `eess-mermaid` rule
files may be a transpiled population for as long as that dialect holds no state
shared with the rule file's copy. ADR-015's Decision records it, and
`scripts/lib/mermaid-registry-isolation.test.mjs` — wired into `check:family` —
reds if `packages/mermaid/src/**` imports any kernel accessor whose answer
depends on one registry. Measured both ways: adding one such import reds it, and
its own list guard reds when a banned name stops being a kernel export.

**Why not align.** On today's evidence it is a bad trade: it breaks rule files
using untaught syntax, needs a plan, a migration note, a `minor` bump and the
watch-freshness work `eess-ts` already needed — to delete one duck-typed function
that works. Option 3 is worse: falling back on the strip-only refusal would be
actively wrong for `eess-ts`, where both halves of the hazard are live, so the
family would end up with a per-dialect loading rule.

**What this record is now for.** The trigger. The reasoning above expires the
moment `eess-mermaid` needs shared state, and nothing would have announced it.
Now something does, and when it fires the remedy is this bug rather than an
exception in the test.

**The limit, stated.** None of this can see adopters. If mermaid rule files in
the wild already use an `enum`, aligning later breaks them, and the population is
unmeasurable from inside this repository — which is what
[bug 0279](./0279-the-barrel-criterion-has-no-memory-and-no-adopter-signal.md) is
about. Sanctioning now keeps them working; it does not make the eventual
alignment cheaper.

## The corruption that must produce a violation

A dialect loading a consumer's rule file into a registry other than the CLI's,
with nothing saying so.

Today nothing does: the entire `eess-mermaid` half of 0223's fix could be deleted
and the repository suite stayed green until a test was added for the config door
alone. The rule-file door still has no such test.

## Verification ledger

- [x] The prior question answered and recorded: transpiled, conditionally —
      ADR-015's Decision, with the condition gated by
      `scripts/lib/mermaid-registry-isolation.test.mjs`.
- [x] ADR-015's Decision and its two affected Enforcement rows say the true
      thing, rather than a universal this door refutes. The rule-file row is
      `gated` on the condition rather than claiming conformance.
- [x] The duck-typed `isArchRuleError` is a documented consequence rather than an
      incidental workaround, named in the ADR and in the gate's own docblock.
- [ ] `deferred→this record` — the alignment work itself: native-first loading,
      the `importFresh` equivalent for watch, and a migration note for the
      transpiled syntax that would stop loading. Owed only if the gate reds.

Deferred: one, to this record, held open by its own gate.
