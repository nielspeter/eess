# Bug 0122: two-sided rules lose `.because` (and `suggestion`/`docs`) — `TerminalBuilder` has no path to carry them

## Status

- **State:** Fixed — `applyFilters` now stamps `ruleId`, `because`, `suggestion`
  and `docs` from the rule onto every violation that does not carry its own.
  Proven by `packages/core/tests/correspondence.test.ts` ·
  `it('carries because, suggestion, docs and ruleId onto violations from .violations()')`,
  verified red before the fix.
- **Severity:** Medium — not a false green. It is an honesty gap: CLAUDE.md
  promises agents that every violation carries its `because`, and for two-sided
  rules that promise was false.
- **Origin:** self-found · architect and testing reviews of [0106](./0106-no-gate-requires-a-changeset.md)'s
  fix, which arrived at it independently
- **Reported:** 2026-08-12

## Symptom

A rule built with `.because('…')` and consumed through `.violations()` — the
ADR-008 caller-owns-emission path — emits violations whose `because` is unset:

```json
{
  "ruleId": "release/changed-package-needs-changeset",
  "because": null,
  "suggestion": null,
  "docs": null
}
```

The same rule consumed through `.check()` renders the rationale correctly.

## Correction — this record's scope claim was too broad

As filed, the title and the _Why it matters_ section said the defect hit "the
whole `.violations()` surface" and "every caller-owns-reporting gate". Measured
before fixing, against `eess-md`'s `links().should().resolve()` with `.because()`
and `.rule({ suggestion })`, on the pre-fix build:

```
RuleBuilder path BEFORE fix: {"because":"ONE-SIDED RATIONALE","suggestion":"ONE-SIDED FIX"}
```

One-sided rules were never affected. `RuleBuilder.buildConditionContext()`
already threads `because`, `ruleId`, `suggestion` and `docs` into the
`ConditionContext`, and conditions build their violations from it. The defect is
confined to `TerminalBuilder` subclasses — `correspondence()` and the pair
builders — which construct violations directly and had no equivalent path. That
is still the whole `eess-crossvalidate` surface, so the severity holds; the
population does not.

## Root cause

`applyFilters` in `packages/core/src/execute-rule.ts` stamps `ruleId` onto every
violation that lacks one, and stops there:

```ts
const ruleId = ctx.metadata.id
if (v.ruleId === undefined) v.ruleId = ruleId
```

`ctx.reason` — what `.because()` sets — is never stamped. `executeCheck` passes
it separately to `reportViolations`, which is why `.check()` keeps it and
`.violations()` loses it. Nothing in between carries it on the violation itself.

`correspondence()` compounds it from the other side: `violationFor` in
`packages/core/src/correspondence.ts` constructs violations with `rule`,
`ruleId`, `element`, `file`, `line`, `message` and `codeFrame` — no `because`, no
`suggestion`, no `docs`. The per-side `suggest` text is folded into `message`, so
a machine consumer cannot separate rationale, fix, and message even when the text
is present.

## Why it matters

CLAUDE.md tells agents:

> every violation surfaces its rationale (`.because`), a `Fix:` line (the rule's
> `suggestion`), and a `Docs:` link where present

For any gate that owns its own reporting that is not true, and the affected set
is not small: it is every `correspondence()`-based rule, which is the kernel's
answer to "two artifacts must agree". `check:ledger` escapes only because
`eess-md`'s ledger rules hand-stamp `because` per violation; `check:release`
works around it by stamping in its own helper. Two callers have now written the
same workaround, which is the signal the kernel should carry it.

The rationale is the part that makes a gate's friction acceptable to whoever hit
it. Losing it turns an instruction back into an error.

## Fix

Stamp all four in `applyFilters`, beside the existing `ruleId` stamp and outside
its `metadata.id` guard — `.because()` is usable without `.rule({ id })`:

```ts
if (result.length > 0) {
  for (const v of result) {
    if (v.ruleId === undefined && ctx.metadata?.id !== undefined) v.ruleId = ctx.metadata.id
    if (v.because === undefined && ctx.reason !== undefined) v.because = ctx.reason
    if (v.suggestion === undefined && ctx.metadata?.suggestion !== undefined)
      v.suggestion = ctx.metadata.suggestion
    if (v.docs === undefined && ctx.metadata?.docs !== undefined) v.docs = ctx.metadata.docs
  }
}
```

One stamp for every builder rather than a correspondence-local patch: the four
fields are properties of the **rule**, so this is their single source of truth,
and a condition that set its own is left untouched. That is the same argument the
existing `ruleId` stamp already carries in its comment.

No output changes on the `.check()` path: `format.ts` renders `v.because ?? reason`,
and the two are now the same string.

**This also closes the headline half of [0113](../0113-correspondence-drops-rule-suggestion.md)**
— `.rule({ suggestion })` on a correspondence now renders its `Fix:` line. 0113
is narrowed to its ambiguous-branch question, which is a design call rather than
a missing stamp.

The local workaround in `scripts/release-gate.mjs` is deleted; the gate's output
is unchanged because the kernel now supplies what it was stamping.
`packages/md/src/rules/ledger.ts` is **not** affected — it is a preset returning
hand-built violations, not a builder, so its per-violation `because` is the right
thing and stays.

## Verification

- [x] Red test written first — three added to
      `packages/core/tests/correspondence.test.ts`; two fail without the fix
      (verified by reverting it), the third guards against overwriting metadata a
      violation already carries.
- [x] `--format json` from `check:release` shows a non-null `because`.
- [x] The local stamp in `scripts/release-gate.mjs` is deleted and the gate's
      output is unchanged.
- [x] The scope claim was measured rather than assumed — see _Correction_.
- [x] `npm run validate` green.

Deferred: none.
