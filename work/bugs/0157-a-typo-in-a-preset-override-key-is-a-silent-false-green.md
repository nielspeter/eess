# Bug 0157: A typo in a preset override key is a silent false green

## Status

- **State:** Draft — reproduced at runtime and at the type level; no red test yet.
- **Severity:** High — false green. A caller who escalates a rule to `'error'`
  and misspells the key gets the unescalated default, a stderr line, and a
  passing build.
- **Origin:** self-found · fold audit of ts-archunit's fixed-bug corpus
  (upstream bug 0038), prompted by [bug 0154](./0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md)
- **Reported:** 2026-08-19

## Symptom

`overrides` keys on a preset are matched against the preset's rule ids by
string. A key that matches nothing writes one line to stderr and is otherwise
ignored — the configuration silently does not apply, and nothing fails.

## Reproduction

Runtime, against built `packages/ts/dist` with a fixture containing one silent
catch. `rule-fired` is read off the emission, so every row is provably
non-vacuous:

```
no overrides                        threw=null            rule-fired=true
CORRECT no-silent-catch: 'error'    threw=ArchRuleError   rule-fired=true
TYPO    no-silent-cach : 'error'    threw=null            rule-fired=true    ← escalation lost
TYPO    no-silent-cach : 'off'      threw=null            rule-fired=true
CORRECT no-silent-catch: 'off'      threw=null            rule-fired=false
```

In `report: 'return'` mode the typo'd rows return `n=0` — no configuration
finding is produced at all, only a stderr line.

Type level — five nonsense override keys, one per published preset,
compiled with the repo's own `tsc`:

```
tsc exit = 0   (no diagnostics)
```

Including a case-variant key (`no-Silent-Catch`). Under upstream's shipped fix
every one of these is a compile error.

## Root cause

`packages/core/src/preset-dispatch.ts:72-86` — `validateOverrides` returns
`void` and its only effect is `writeStderr`:

```ts
export function validateOverrides(
  overrides: Record<string, RuleSeverity> | undefined,
  knownIds: string[],
): void {
```

**This predates plan 0088's fold** — the pre-fold tree carries the identical
void-returning function. eess forked at ~0.17 and froze; upstream fixed this
afterward and the fix was not carried across.

Upstream's fix had two halves, neither present:

1. **Runtime** — an `overrideFindings` return spread into the preset's own
   findings, so an unmatched key becomes a real configuration finding with
   `bypassFilters`. `grep -rn "overrideFindings" packages/` returns nothing.
2. **Type** — `PresetBaseOptions<TRuleId extends string = string>` with each
   preset supplying its own derived id union, so a typo fails `tsc`. eess's
   `preset-dispatch.ts:17-19` still declares
   `overrides?: Record<string, RuleSeverity>`, and
   `packages/ts/src/presets/recommended.ts:33` declares
   `const SPECS: readonly RuleSpec[]` rather than `as const satisfies`, so no
   preset could derive a union even if the type parameter were added.

All six call sites pass it as a void side-effect: `recommended.ts:99`,
`boundaries.ts:97`, `layered.ts:117`, `data-layer.ts:36`,
`agent-guardrails.ts:52`, and — beyond the ts dialect —
`packages/md/src/rules/adr.ts:115`.

## Why it matters

The blast radius is one surface **wider** in eess than it was upstream: the md
dialect calls `validateOverrides` too, a surface ts-archunit never had.

## Fix

Port both halves. The type half is the one that actually prevents the defect
(it fails before the code runs); the runtime half covers dynamically-built
options objects the type system cannot see. Landing only the runtime half
leaves a stderr-shaped remedy for a mistake `tsc` could have caught.

`SPECS` must become `as const satisfies readonly RuleSpec[]` for any preset
that is to derive its id union — upstream records reverting that as a caught
sabotage row.

## Verification

- [ ] Red test first: a typo'd override key produces a finding and a non-zero
      exit, in both `throw` and `return` report modes.
- [ ] Red test: a typo'd key is a **compile** error for every published preset,
      including a case-variant key.
- [ ] Control: a correct key still escalates, and `'off'` still suppresses.
- [ ] The md dialect's call site (`packages/md/src/rules/adr.ts:115`) is
      covered or its exclusion is stated.
- [ ] `npm run validate` green.

Deferred: none.
