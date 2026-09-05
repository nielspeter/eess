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

## What the right answer is, and what it is not

**Not a violation.** [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)
§3 rules that "a preset every rule of which was disabled is declared, not red —
the standing ruling that all-off is a permanent, legitimate decision holds in
every dialect", and `UNSUPPRESSABLE` says `overrides: { id: 'off' }` "is not a
suppression, it is a permanent decision that never expires". Turning the preset
off deliberately is allowed.

**The defect is that the receipt does not SAY so.** Under ADR-014 §3 an all-off
preset should arrive carrying `declaredEmpty`; today it arrives carrying
nothing, which is indistinguishable from a preset that ran and found nothing.
A pass constructed from a declaration is legitimate; a pass constructed from
silence is the thing ADR-010 forbids.

So this is not "make all-off red". It is "make all-off _declared_" — and until
the receipt exists there is nowhere to put the declaration, which is why the fix
is sequenced against plan 0235 rather than taken alone.

## Fix

Not decided; two shapes, and the choice interacts with plan 0235.

1. **Sequenced into [plan 0235](../plans/0235-the-emitter-takes-a-receipt.md).**
   ADR-014 §3 already specifies the mechanism: `dispatchRule` mints
   `declaredEmpty` for a rule explicitly turned off, and the preset plumbing is
   handed the fact rather than inferring it. `recommended` and
   `layeredArchitecture` join the census as call sites that must pass it. This
   is the honest home — the declaration has nowhere to live until the receipt
   does.
2. **A standalone guard first**, if 0235 slips: a `declaredEmpty`-shaped finding
   from `deliver()` on the all-off fact, carrying no receipt. Cheaper, and
   throws away work when 0235 lands.

Plan 0235's Phase 0 must NOT route these two presets through `assertEnabled`:
that produces a violation, and its message ("every rule it can build sits behind
an optional flag, and none was set") is false of both — their rules are on by
default. That correction is recorded in 0235's Phase 0.

## Verification

- [ ] a red test: `recommended` with every rule `'off'` returns something that
      records the preset constructed nothing — asserted by identity, not count
- [ ] the same for `layeredArchitecture`
- [ ] a preset that legitimately constructs rules and finds nothing stays green
      and is not marked declared-empty (the opposite direction)
- [ ] a non-vacuity fixture per rule id the fix emits
