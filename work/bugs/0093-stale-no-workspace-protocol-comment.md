# Bug 0093: `check:integrity` claims npm has no `workspace:` protocol — it does

## Status

- **State:** Draft — confirmed against the source and the installed npm; no red
  test written yet (a comment bug; verification is accuracy, not a fixture).
- **Reported:** 2026-08-12 — self-found during the [plan 0091](../plans/0091-cross-dialect-examples-checked.md)
  review, when the comment's claim was used to justify a bare version pin.

## Symptom

`scripts/check-workspace-integrity.mjs:15-16` documents the local-linking hazard
with a false premise (line 17 onward — "Every `@nielspeter/eess*` package must
resolve to a symlink into `packages/`" — is correct and stays):

> npm has no `workspace:` protocol, so a lagging version range can silently
> install the published kernel instead of linking the local one.

npm has supported the `workspace:` protocol since npm 9; this repo runs npm
11.19.0. The comment is wrong, and it is not inert: during the plan-0091 review
it led one reviewer to bless a bare `"0.1.2"` pin as "fine and honest" — the exact
drift the gate exists to forbid.

## Reproduction

```bash
npm --version   # 11.19.0
# npm 9+ resolves "workspace:*" to the local workspace copy, not the registry
```

## Root cause

The comment predates npm 9's `workspace:` protocol support and was never updated.
It now actively misleads: it tells a reader the safe local-linking mechanism does
not exist, steering them toward the bare-pin pattern the gate is chartered to
catch.

## Fix

Correct the comment to state that `workspace:*` is available and is the
preferred way to declare a dependency on a workspace package, and that a bare
version range is the hazard:

> npm supports the `workspace:` protocol (npm 9+). A bare version range on an
> independently-versioned package can silently install the published kernel
> instead of linking the local one; `workspace:*` always links the local copy.

## Verification

- [ ] The corrected comment matches npm's actual behavior (verified against
      `npm --version` and a `workspace:*` resolution).
- [ ] No behavior change to the gate itself (this bug is the comment only; the
      guard gap it hides is [0092](./0092-integrity-gate-misses-three-packages.md)).
- [ ] `npm run validate` green.

Deferred: none
