# Bug 0335: the binding resolver asks the checker once per identifier, and memoizes nothing

## Status

- **State:** Draft — measured by the architecture review of PR #148. The fix is a cache, and a
  cache's invalidation is the decision.
- **Severity:** Medium — **no wrong verdict; a cost that can make a check worth switching off.**
  Measured over this repository's five shipped security rules on 270 source files:
  **83,764 `getSymbol()` calls against 17,142 distinct nodes** — 4.9x across rules, 1.41x inside one
  cold rule — and a `WeakMap` memo served 100% of a second pass. The steady-state cost is the
  checker, not the walk: the pre-change matcher is ~24ms, adding `SyntaxKind.Identifier` costs ~1ms
  because the walk is already shared, and `functionNoConsole` is ~100ms.
- **Origin:** the architecture review of PR #148, 2026-09-20, which measured the repeat work and
  named ADR-007 Rule 2 beside it.
- **Reported:** 2026-09-20

## Symptom

`globalChainOf` (`packages/ts/src/helpers/global-binding.ts:59`) calls `root.getSymbol()` on every
candidate identifier, per rule, with no memo. Five rules over one file resolve the same identifiers
five times. The package already records this exact finding for a different reader:
`packages/ts/src/core/module-edges.ts:241` measured a 5x repeat for module edges and solved it with
a per-file cache (plan 0076).

Measured on the `recommended` floor gate over 270 files: 0.50–0.86s before this resolver, 0.90–1.07s
after — about 1.5ms per file.

## Root cause

The resolution is correct and the walk is already cached (`core/descendant-cache.ts`); what is not
cached is the **checker answer**. Nothing in `helpers/` may hold that cache: a symbol resolves
against the whole program, so a memo has to respect more than the walk caches do —
`invalidateOnModify`, `registerCacheReset` read as a live binding, forgotten nodes, and **cross-file
edits**, which `packages/ts/src/core/module-edges.ts:266` documents as the reason that cache routes through
`resetProjectCache()`.

## Fix

Not decided. A memo in `core/`, keyed by node, invalidated as above, is the shape. The decision is
what it is allowed to key on and when it must be dropped, because a stale symbol is a **wrong
verdict**, not a slow one — the failure mode is worse than the cost it removes, which is why this is
filed rather than added at the end of the PR that created the need.

**ADR-007 Rule 2 sits beside it.** A per-identifier `getSymbol()` inside an `ExpressionMatcher.matches()`
callback is the chatty per-node pattern that ADR names as one that would not survive an
out-of-process engine; every other checker use in this package is coarse or already batched behind a
per-file cache. That clause's status is `manual`, so the architecture review is its mechanism, and
this record is where the review's finding lives. A memo is what makes the calls batchable later, so
the two horizons take the same fix.

## Related

- [0305](./fixed/0305-security-rules-miss-a-global-reached-through-a-local-alias.md) — the fix that
  introduced the resolver, with its own measured cost.
- [0174](./0174-eess-ts-reports-a-clean-gate-with-no-denominator.md) — the other record about a
  gate's honesty rather than its correctness.

## Verification

- [x] measured — the call counts, the distinct-node count, the memo hit rate and the gate timings
      above, all from the architecture review of PR #148.
- [ ] a decision on where the memo lives and what invalidates it
- [ ] the fix, with a test that a modified file is not answered from a stale symbol
- [ ] a measured before/after on the floor gate
- [ ] `npm run validate` green.

Deferred: none.
