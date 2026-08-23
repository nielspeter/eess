# Bug 0157: A typo in a preset override key is a silent false green

## Status

- **State:** Draft — fix **built and measured** in an isolated worktree, both
  halves (see Fix); no red test committed yet.
- **Severity:** High — false green. A caller who escalates a rule to `'error'`
  and misspells the key gets the unescalated default, a stderr line, and a
  passing build.
- **Origin:** self-found · fold audit of ts-archunit's fixed-bug corpus
  (upstream bug 0038), prompted by [bug 0154](./fixed/0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md)
- **Shipped in:** the published `@nielspeter/eess` (`0.2.2`) / `eess-ts`
  (`0.2.1`). `validateOverrides(…): void` is unchanged in `810808b` (the
  `v0.2.3` release commit), so this is live for adopters today.
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

> **Use fully-qualified ids when reproducing.** The real id is
> `preset/recommended/no-silent-catch` (`packages/ts/src/presets/recommended.ts:57`),
> validated against the fully-qualified `RULE_IDS`. Written bare as
> `no-silent-catch`, the CORRECT row emits the same "does not match any rule"
> stderr as the TYPO row and the control stops discriminating — which is what
> makes the typo row non-vacuous. With qualified ids the matrix reproduces
> exactly as printed.

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
   `packages/ts/src/presets/recommended.ts:34` declares
   `const SPECS: readonly RuleSpec[]` rather than `as const satisfies`, so no
   preset could derive a union even if the type parameter were added.

All six call sites pass it as a void side-effect: `recommended.ts:99`,
`boundaries.ts:97`, `layered.ts:117`, `data-layer.ts:36`,
`agent-guardrails.ts:52`, and — beyond the ts dialect —
`packages/md/src/rules/adr.ts:115`.

## Why it matters

The blast radius is one surface **wider** in eess than it was upstream: the md
dialect calls `validateOverrides` too, a surface ts-archunit never had.

## Fix — measured 2026-08-19

Built and measured in an isolated worktree against a green baseline
(presets+smells 105/105 before any patch).

| check                                       | before        | after                 |
| ------------------------------------------- | ------------- | --------------------- |
| typo'd key produces a configuration finding | **0**         | **1** ✓               |
| typo'd key in `throw` mode fails the build  | did not throw | **`ArchRuleError`** ✓ |
| CONTROL: correct key produces no finding    | 0             | 0                     |
| CONTROL: no overrides produces no finding   | 0             | 0                     |
| typo'd keys rejected by `tsc` (4 presets)   | **0 of 4**    | **4 of 4** ✓          |
| CONTROL: a correct key still compiles       | compiles      | compiles              |
| presets + smells suites                     | 105/105       | 105/105               |
| md suite                                    | 113/113       | 113/113               |
| `check:arch` / `check:spec`                 | green         | green                 |

**Runtime half.** `validateOverrides` now **returns** `ArchViolation[]` instead
of only writing stderr; each unmatched key becomes a finding with
`bypassFilters` and a stable `identity`, spread into the preset's own
violations. The stderr line is kept, so a caller ignoring the return (the old
`void` contract) still sees something and every existing call site compiles
unchanged. Wired at all six sites — the five ts presets **and**
`packages/md/src/rules/adr.ts`, the surface upstream never had.

**Type half.** `PresetBaseOptions<TRuleId extends string = string>` with
`overrides?: Partial<Record<TRuleId, RuleSeverity>>`, defaulting to `string`
so an undeclared preset compiles unchanged. `recommended`'s `SPECS` became
`as const satisfies readonly RuleSpec[]` (the annotation `: readonly RuleSpec[]`
widens `meta.id` to `string` and silently collapses the union — that reversion
is a caught sabotage row upstream, and a comment now says so at the line). The
other three ts presets and md's `adrEnforcement` already had `as const` id
arrays, so their unions are `(typeof RULE_IDS)[number]`.

**`agentGuardrails` is the documented exception — it stays `string`-typed.**
Its ids are computed from options at call time (`collectRuleIds`), including
a template-interpolated `preset/agent/no-inline-logic/${api}` whose value
depends on the caller's own array. A static union is not derivable without a
template-literal type over that option; the runtime half is its only guard.
Recorded rather than left as an apparent oversight.

**Two ripples worth knowing.** The internal `dispatchRule`/`validateOverrides`
signatures had to widen from `Record<string, RuleSeverity>` to
`Partial<Record<…>>` for a typed overrides object to flow through — two lines.
And the four new `…RuleId` unions are genuine public API (a consumer needs them
to type their own overrides object), so they are re-exported from
`packages/ts/src/presets/index.ts`; `check:arch`'s no-unused-exports rule
caught them before that and is what prompted it.

The original prescription, kept for reference: The type half is the one that actually prevents the defect
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
