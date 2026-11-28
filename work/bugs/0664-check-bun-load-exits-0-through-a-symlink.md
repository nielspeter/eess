# Bug 0664: `check-bun-load.mjs` exits 0 through a symlink

## Status

- **State:** Draft — found 2026-11-27 by the enforcement review of
  [plan 0662](../plans/completed/0662-the-corpus-rows-run-in-one-process.md); reproduced 2026-11-28; no fix yet.
- **Severity:** Low — no false green in CI today: `check:bun-load` runs the script by its own path
  (`package.json`, `"check:bun-load": "node scripts/check-bun-load.mjs"`). But a gate that exits 0
  having checked nothing is the failure [ADR-009](../../adr/009-agent-first-failure-surfaces.md)
  names, and it is one wrapper or symlink away.
- **Origin:** self-found · the enforcement review of [plan 0662](../plans/completed/0662-the-corpus-rows-run-in-one-process.md), 2026-11-27.
- **Reported:** 2026-11-28

## Symptom

Run directly, `node scripts/check-bun-load.mjs` exits 0 and prints its report (352 bytes here,
naming every package's entries and bins). Run through a symlink to the same file, it exits 0 and
prints nothing. Measured 2026-11-28 at 3562cad7, Node 24.22.0.

## Root cause

The command is guarded by `process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)`
(`scripts/check-bun-load.mjs:869`). Node resolves the entry module's real path, so `import.meta.url`
names the target while `process.argv[1]` names the symlink: the two differ, the guard is false, and
the file only defines its functions. It is the only script in `scripts/` and `packages/*/src` with
this guard.

## Fix

Not designed. [Plan 0662](../plans/completed/0662-the-corpus-rows-run-in-one-process.md) used
`import.meta.main`, which is `true` through a symlink, and throws when it is not a boolean, so a
runtime without it fails closed. The same shape is the obvious candidate here.

## Verification

- [ ] Red first: the script run through a symlink exits 0 with no output today.
- [ ] Through a symlink, it prints the same report and exit code as run directly.
