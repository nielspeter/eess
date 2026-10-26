# Proposal 020 — a fix dry run a reader can review

**State:** Draft — filed 2026-10-25 from adopter feedback on [proposal 019](./019-md-a-mention-is-a-link-built-from-blocks.md)'s
fix; not reviewed.
**Priority:** Medium — [plan 0550](../plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md)'s
fix proposes thousands of edits in one run, and its safety rests on a reader checking them before
`--apply`.
**Origin:** inbound · adopter feedback, 2026-10-25. Every adopter asked would run the mention fix only
after reading a dry-run list grouped by target, and sampling it.
**Affects:** `@nielspeter/eess-ts` (the `check --fix` output) for A; `@nielspeter/eess` for B
(`ArchFix` and the JSON report, `packages/core/src/format-json.ts`, which is the agent contract).

## Problem

`eess-ts check --fix` without `--apply` prints a dry run: one `would fix: <describe>` line per fix,
listed per file and by offset within a file (`packages/core/src/apply-fixes.ts`), then a count (`packages/ts/src/cli/commands/check.ts:457-469`). That
serves `movedLinkFix`, which proposes a handful of edits. The mention fix proposes one edit per plain
mention, about 3,000 to 4,700 in each corpus measured, and the one error a reader can catch is many
mentions sent to the same wrong target. A flat list hides it.

## Existing code survey

- **`ArchFix` carries no structured target** (`packages/core/src/violation.ts:15-26`): a file, a span,
  the replacement text and a one-line `describe`. Grouping by target would mean parsing `describe`
  or the replacement.
- **The JSON report omits the fix** (`packages/core/src/format-json.ts:199`, `suggestion` is there,
  `fix` is not), so an adopter cannot sample the dry run with a script of their own.
- **The dry run and `--apply` share one path**, `applyFixes` (`packages/core/src/apply-fixes.ts`),
  with `write: false` for the preview.

## Asks

- **A — group the dry run by target.** Fixes that write the same target are listed together, with a
  count per target, largest first.
- **B — the fix in the JSON report.** `--format json` carries each finding's fix (file, span,
  replacement, target), so a reader can draw a sample.

## Acceptance criteria

- **Break class:** a dry run of two fixes to one target and one to another lists the pair under one
  target, with its count, before the single.
- **Break class:** `--format json` of a finding with a fix carries the fix; without one, no fix field.
- **Break class (no change):** `--apply` writes exactly what the dry run listed.
- **Non-vacuity:** a fixture row per break class.

## Open questions

1. **Where the target lives.** An optional `target` on `ArchFix` (a kernel change, additive), or a
   grouping key each fix states, or grouping by replacement text in eess-ts alone. A `target` on
   `ArchFix` together with a `fix` on the JSON wire changes the agent contract, and likely needs an
   ADR row rather than only a plan. Until then, [plan 0550](../plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md)
   fixes its `describe` with the target last, so a shell pipeline can group the dry run.
2. **Grouped by what for `movedLinkFix`.** Its target is the moved file; the same field would serve.

## Out of scope

- The mention fix itself: [plan 0550](../plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md).
- An interactive per-fix accept or reject.
