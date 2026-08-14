# Bug 0092: `check:integrity`'s local-linking guard misses three of the six packages

## Status

- **State:** Draft — confirmed against the source; no red test written yet.
- **Reported:** 2026-08-12 — self-found during the [plan 0091](../plans/completed/0091-cross-dialect-examples-checked.md)
  review, when the devops persona checked whether a root devDependency on
  `@nielspeter/eess-crossvalidate` would be caught if it drifted.

## Symptom

`npm run check:integrity` is chartered to fail when any `@nielspeter/eess*`
package resolves to a registry copy instead of a local workspace symlink. It
checks only **three** of the six packages. A registry-installed copy of
`@nielspeter/eess-crossvalidate`, `@nielspeter/eess-md`, or
`@nielspeter/eess-gherkin` sails through the gate silently.

## Reproduction

```js
// scripts/check-workspace-integrity.mjs
const WORKSPACE_PKGS = ['@nielspeter/eess', '@nielspeter/eess-ts', '@nielspeter/eess-mermaid']
```

The local-linking loop (line 132) iterates only `WORKSPACE_PKGS`. Replace
`node_modules/@nielspeter/eess-crossvalidate` with a real directory from the
registry and re-run `npm run check:integrity` — it reports OK.

## Root cause

`scripts/check-workspace-integrity.mjs:30` hard-codes three names. The list was
written when the family was three packages; `eess-md`, `eess-gherkin`, and
`eess-crossvalidate` were added to the workspace later and never added to the
guard. The gate's own charter (lines 15–17) names the hazard — "a lagging version
range can silently install the published kernel instead of linking the local
one" — but the guard does not cover the packages most likely to be consumed as
dependencies.

## Fix

Add the three missing packages to `WORKSPACE_PKGS`:

```js
const WORKSPACE_PKGS = [
  '@nielspeter/eess',
  '@nielspeter/eess-ts',
  '@nielspeter/eess-md',
  '@nielspeter/eess-mermaid',
  '@nielspeter/eess-gherkin',
  '@nielspeter/eess-crossvalidate',
]
```

## Verification

- [ ] Red test written first: a fixture where one of the three (e.g.
      `eess-crossvalidate`) is a real directory, not a symlink → the gate fails;
      today it passes.
- [ ] The gate still passes with all six correctly symlinked.
- [ ] `npm run validate` green.

Deferred: none
