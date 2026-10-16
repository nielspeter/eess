# Bug 0441: `check:mermaid-parses --format json` can print two JSON documents

## Status

- **State:** Draft — recorded 2026-10-16, an accepted residual of plan 0427's PR (#225), from its
  enforcement re-review.
- **Severity:** Medium — an honesty gap on the board's scale: the script header promises `--format
json` to machine consumers, and the stream does not parse as one document. Not a false green:
  every finding is on stdout and the exit is 1.
- **Origin:** self-found · PR review of plan 0427, 2026-10-16.
- **Reported:** 2026-10-16

## Symptom

A run with both a finding of the gate's own (a stale exclusion, say) and a parse violation prints
`check()`'s JSON report and then the gate's own `{ violations: [...] }`
(`scripts/check-mermaid-parses.mjs:44`). `JSON.parse(stdout)` rejects it: "Unexpected
non-whitespace character after JSON at position 1265" in the enforcement review's scratch
repository, and at position 1266 in this PR's method review's, on 2026-10-16: the offset depends on
the path. The harness reader
`violationsOf` in `scripts/check-nonvacuity.mjs` reads a stream of documents, so no row sees it. The
gate's own document also lacks the kernel report's `summary` (and so `summary.examined`).

## Fix

Emit one document: merge the gate's findings into the parse rule's report. That is the family's
convention: the eess-ts CLI emits one document however many rules fail
(`packages/ts/src/cli/commands/check.ts:256`, re-measured with two failing rules).

## Verification

- [ ] Red first: a scratch repository with a stale exclusion and a broken block, stdout parsed as one
      document
- [ ] Green, with a non-vacuity row

Deferred: none
