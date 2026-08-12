# Bug 0122: the `.violations()` path drops `.because`, so every caller-owns-reporting gate ships violations with no rationale

## Status

- **State:** Draft — reproduced against a live violation in both terminal and
  `--format json`; the one-line cause is identified, no red test yet.
- **Severity:** Medium — not a false green. It is an honesty gap: CLAUDE.md
  promises agents that every violation carries its `because`, and for the whole
  `.violations()` surface that promise is false.
- **Origin:** self-found · architect and testing reviews of [0106](./fixed/0106-no-gate-requires-a-changeset.md)'s
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

One line beside the existing `ruleId` stamp in `applyFilters`:

```ts
if (v.because === undefined && ctx.reason !== undefined) v.because = ctx.reason
```

Then remove the local workarounds in `scripts/release-gate.mjs` and, if it is the
same shape, `packages/md/src/rules/ledger.ts`.

Separately, and possibly its own record: `violationFor` should accept the rule's
`suggestion`/`docs` rather than folding `suggest` into `message`, so `--format
json` can carry the three fields apart.

## Verification

- [ ] Red test written first: a `correspondence()` rule with `.because()`
      consumed via `.violations()` carries the reason; passes today.
- [ ] `--format json` from `check:release` shows a non-null `because`.
- [ ] The local stamp in `scripts/release-gate.mjs` is deleted and the gate's
      output is unchanged.
- [ ] `npm run validate` green.

Deferred: none.
