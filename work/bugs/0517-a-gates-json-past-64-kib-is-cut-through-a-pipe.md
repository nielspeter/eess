# Bug 0517: a gate's JSON past 64 KiB is cut off when it writes to a pipe on macOS

## Status

- **State:** Draft — recorded 2026-10-19 during [plan 0481](../plans/completed/0481-this-repository-dogfoods-notexist.md)'s build; measured on macOS 27.0.1 with
  Node v24.14.0, no red test yet. Record only.
- **Severity:** Medium — the exit code survives, so no gate goes green, but the machine-readable
  stream an agent or CI step parses is invalid JSON once it passes 64 KiB, and the findings past the
  cut are lost to that reader ([ADR-009](../../adr/009-agent-first-failure-surfaces.md): the failure surface an agent reads is the JSON).
- **Origin:** self-found · [plan 0481](../plans/completed/0481-this-repository-dogfoods-notexist.md)'s build (its `corpus/ledger/claimed-twice` non-vacuity row)
- **Reported:** 2026-10-19

## Symptom

`scripts/check-ledger.mjs --format json` writes its findings through the kernel's
`reportViolations` (`process.stdout.write`) and then calls `process.exit` on the next line. On macOS,
Node writes to a pipe asynchronously, and `process.exit` does not wait for the pending write, so the
reader gets the first 65,536 bytes and nothing after.

## Reproduction

Measured 2026-10-19 on branch `fix/fail-open-batch`: `UNLANED` in `scripts/lib/ledger-lanes.mjs`
given one more entry, `{ name: 'everything', glob: 'work/**' }`, so every document under `work/` is
claimed twice (465 findings). Run through `spawnSync(process.execPath, [...], { encoding: 'utf8',
maxBuffer: 1e8 })`:

| run                                | exit | bytes read       | result                    |
| ---------------------------------- | ---- | ---------------- | ------------------------- |
| `check-ledger.mjs --format json`   | 1    | 65,536 (stdout)  | `JSON.parse` throws       |
| `check-ledger.mjs` (terminal path) | 1    | 553,699 (stderr) | complete, summary present |

The same cut appeared through a shell pipe (`node scripts/check-ledger.mjs --format json | node …`).
Only stdout was cut in this measurement; the terminal path's stderr arrived whole. Not measured on
Linux, where Node documents pipe writes as synchronous, so CI may not show it.

## The gates that exit straight after writing JSON

Found with `git grep` over `scripts/*.mjs` for a `--format json` path followed by `process.exit`
(2026-10-19). Each writes JSON to stdout and then calls `process.exit` before the write has drained:

- `scripts/check-ledger.mjs:174` (`reportViolations`), exit at `:176` / `:178` — measured above
- `scripts/check-corpus.mjs:1142` (`reportViolations`), exit at `:1143`
- `scripts/check-release.mjs:385` (`reportViolations`), exit at `:387` / `:389`
- `scripts/check-baseline.mjs:69` (`reportViolations`), exit at `:70`
- `scripts/check-guardrails.mjs:104` (`reportViolations`), exit at `:105`
- `scripts/check-mermaid-parses.mjs:45` (`process.stdout.write`), exit at `:49`
- `scripts/check-bun-load.mjs:893` (`process.stdout.write`), exit at `:899`

Not affected: the dialect CLIs (`eess-ts`, `eess-mermaid`) set `process.exitCode` and let the process
end on its own (`packages/ts/src/cli/index.ts:163`, `packages/mermaid/src/cli/index.ts:97`), which
drains stdout first. Only `check-ledger.mjs` was measured; the others share the shape, and whether
they cut depends on their output passing 64 KiB.

## Root cause

`process.exit()` ends the process without waiting for an asynchronous stdout write, and on macOS a
pipe write is asynchronous. A gate that writes then exits loses whatever has not drained.

## Fix

Undecided. Two candidates: set `process.exitCode` and return instead of calling `process.exit`
after the JSON write (the CLIs' shape), or exit in the write's callback. Either is per gate, so a
shared helper for "write the JSON, then exit" may be the one place to fix it.

## Verification

- [ ] Red test written first: a gate's `--format json` output past 64 KiB, read through a pipe,
      parses.
- [ ] `npm run validate` green.

Deferred: none
