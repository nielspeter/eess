# Bug 0441: `check:mermaid-parses --format json` can print two JSON documents

## Status

- **State:** Draft — recorded 2026-10-16, an accepted residual of plan 0427's PR (#225), from its
  enforcement re-review.
- **Severity:** Low — no false green: every finding is on stdout and the exit is 1. A consumer that
  parses stdout as one document gets a parse error instead of the findings.
- **Origin:** self-found · PR review of plan 0427, 2026-10-16.
- **Reported:** 2026-10-16

## Symptom

A run with both a finding of the gate's own (a stale exclusion, say) and a parse violation prints
`check()`'s JSON report and then the gate's own `{ violations: [...] }`
(`scripts/check-mermaid-parses.mjs:44`). `JSON.parse(stdout)` rejects it: the enforcement review
measured "Unexpected non-whitespace character after JSON at position 1265". The harness reader
`violationsOf` in `scripts/check-nonvacuity.mjs` reads a stream of documents, so no row sees it. The
gate's own document also lacks the kernel report's `summary` and `examined`.

## Fix

Emit one document: merge the gate's findings into the parse rule's report, or say in the script
header that `--format json` emits one or more documents, as the eess-ts CLI does per failing rule.

## Verification

- [ ] Red first: a scratch repository with a stale exclusion and a broken block, stdout parsed as one
      document
- [ ] Green, with a non-vacuity row

Deferred: none
