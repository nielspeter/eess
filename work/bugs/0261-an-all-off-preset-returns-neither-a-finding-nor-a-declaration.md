# Bug 0261: an all-off preset returns neither a finding nor a declaration

## Status

- **State:** Draft — reproduced against the shipped source; fix not built.
- **Severity:** High — **false green.** The flagship dialect's flagship preset
  can be switched off entirely and every gate reports it healthy. This is the
  class ADR-009/010 exist to make unrepresentable, in the package adopters
  install.
- **Created:** 2026-09-05
- **Found by:** self-found · building plan 0235 Phase 0, checking whether that
  plan's D5 could be wired as written

## Symptom

`recommended()` with every rule overridden `off` returns an empty array. No
violation, and no declaration either — nothing that records the preset enforces
nothing.

Measured against `packages/ts/src/presets/recommended.ts`:

```ts
const out = recommended(p, {
  report: 'return',
  overrides: {
    'preset/recommended/no-eval': 'off',
    'preset/recommended/no-function-constructor': 'off',
    'preset/recommended/no-silent-catch': 'off',
    'preset/recommended/no-empty-bodies': 'off',
  },
})
// returned: 0, value: []
```

A caller who does this — or inherits a config that did — gets a green run from a
preset that constructed zero rules.

## Root cause

`recommended` builds its rules by iterating `SPECS` and skipping any rule whose
override is `'off'`. With all four off, `builders` is empty, `constructed` is
empty, and the preset falls through to `deliver()` with nothing.

Nothing catches it, because **`recommended` has no construction guard at all**.
Measured across the five `eess-ts` presets:

| preset                | guard              |
| --------------------- | ------------------ |
| `agentGuardrails`     | `assertEnabled`    |
| `dataLayerIsolation`  | `assertEnabled`    |
| `strictBoundaries`    | `assertDiscovered` |
| `layeredArchitecture` | **none**           |
| `recommended`         | **none**           |

`declaredEmptyFindings` does not cover it: it only fires when `expectEmpty`
names an id the preset did not construct. With no `expectEmpty`, it returns `[]`
and says nothing.

## What the right answer is — settled by experiment, not preference

**A configuration finding.** Not because all-off is an illegitimate thing to
intend, but because eess has no standing to certify an intent nobody expressed.

This was tested rather than argued. The kernel already rules on the identical
shape one level down, and the two cases discriminate:

| case                                                                   | result                                                                            |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `.expectEmpty()` over a **dead instrument** (`sourceEmpty`)            | **1 violation** — "this rule's source loaded zero units before any selection ran" |
| `.expectEmpty()` over a **loaded** project, selection narrowed to zero | **0 violations, green**                                                           |

A declaration legitimises an empty _selection_; it cannot rescue a dead
_instrument_. The terminal says why in its own words: "there is no selection to
widen, and a `.notExist()`-shaped condition 'passing' against an instrument that
never loaded anything is not evidence of anything."

A preset that constructed zero rules is the second row, one level up: nothing was
built, so there is no selection to widen and no assertion that can ever expire.
`examined` is structurally 0 forever, so the expiry property that justifies a
declaration never engages.

Two further facts, both measured, close the alternative:

- **No `eess-ts` preset calls `dispatchRule`** — zero call sites; only
  `eess-md`'s `adrEnforcement` does. So the mint ADR-014 §3 originally named for
  this case cannot reach `recommended` or `layeredArchitecture` at all.
- **The codebase forbids a user to write the declaration eess would mint.**
  `declaredEmptyFindings` reports an `expectEmpty` id naming an `'off'` rule:
  "`'off'` deleted the rule, so the declaration about it is dead."

[ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §3 was
amended 2026-09-05 accordingly: a declaration is one a caller made over a live
instrument, never one eess infers from a configuration.

**A correction recorded rather than edited away.** The first version of this
record argued the opposite — that all-off should be marked `declaredEmpty` and
the defect was only that the receipt failed to say so. That rested on reading
ADR-014 §3 as written and on misreading the `UNSUPPRESSABLE` sentence's "a
permanent decision that never expires" as a blessing. In ADR-010 §3's grammar
"never expires" is the diagnostic, not the endorsement: a declaration whose
expiry can never engage asserts nothing.

## Fix

The finding is the preset-seam analogue of `sourceEmpty`, and its message is the
existing one raised a level: the preset constructed zero rules before any rule
ran. No new vocabulary.

Sequenced into [plan 0235](../plans/0235-the-emitter-takes-a-receipt.md), because
the receipt is where the evidence lives and a standalone guard would build a
parallel floor that 0235 then replaces. `recommended` and `layeredArchitecture`
join the census as call sites passing the fact.

Plan 0235's Phase 0 must NOT route these two presets through `assertEnabled`:
that finding's message ("every rule it can build sits behind an optional flag,
and none was set") is false of both — their rules are on by default. Two causes,
two messages. That correction is recorded in 0235's Phase 0.

**The reachable remedies for an author who means it** are the ones ADR-010 §3
already names: leave the rules on and declare them empty, so the declaration
expires the day it stops being true; or remove a call that enforces nothing.

## Reach — it is not an `eess-ts` problem

Measured: `adrEnforcement` (`eess-md`) with `adr/enforcement-declared`,
`adr/valid-tiers` and `adr/citations-resolve` all overridden `'off'` returns
`[]`. The same silent green, in a second dialect, reached through
`dispatchRule` rather than through a preset's own loop.

That settles placement. `deliver()` is `eess-ts`-only and not exported, and
`eess-md` and `eess-crossvalidate` reach `finishPreset` with no `deliver()` in
between (plan 0235's D6 states this). A `deliver()`-scoped guard would cover the
five `eess-ts` presets and leave `adrEnforcement`, `honestyAtClose` and
crossvalidate's six emitting green over zero constructed checks. The finding
belongs at the seam both dialects share.

## Verification

- [ ] a red test: `recommended` with every rule `'off'` returns something that
      records the preset constructed nothing — asserted by identity, not count
- [ ] the same for `layeredArchitecture`
- [ ] a preset that legitimately constructs rules and finds nothing stays green
      and is not marked declared-empty (the opposite direction)
- [ ] a non-vacuity fixture per rule id the fix emits
