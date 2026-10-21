# Plan 0542: this repository's record mentions are migrated

## Status

- **State:** Draft — written 2026-10-21 so that [plan 0541](./0541-this-repositorys-record-mentions-are-gated.md)'s
  ledger has a named home for its removal (PR #256's method review, I3). It cannot go Ready until
  [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s ask B and its fix
  are planned and built; both are held, on [bug 0400](../bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md)
  and on the choice between [spike 0540](../spikes/0540-one-join-over-every-source.md)'s two shapes
  for the fix. Bug 0400 was fixed on 2026-10-21, so the choice of shape, and the fix's
  correctness sample, are what hold them now.
- **Priority:** Low until B is built; then Medium.
- **Effort:** Large, and to be split at Ready by lane: the fixable mentions are mechanical, the
  colliding ones need a reader.
- **Created:** 2026-10-21
- **Builds after:** [plan 0541](./0541-this-repositorys-record-mentions-are-gated.md), and the plan
  that builds [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s B and fix.

## Problem

[Plan 0541](0541-this-repositorys-record-mentions-are-gated.md) holds this repository's unlinked mentions at today's count and lets it only fall. This
plan brings it to zero and deletes `scripts/record-mention-ceilings.json`, so the rule is judged with
no ledger at all.

## What is known ([spike 0540](../spikes/0540-one-join-over-every-source.md), 2026-10-21)

Over 4,682 plain mentions, with ts-archunit's record list as a second source:

| outcome                                              | count | how it closes                                                 |
| ---------------------------------------------------- | ----- | ------------------------------------------------------------- |
| exactly one record in either source                  | 3,079 | the fix, once built; correctness sampled before it is applied |
| a record in both sources (the ts-archunit collision) | 1,598 | a reader decides each, link by link                           |
| no record anywhere                                   | 5     | reworded or removed by a reader                               |

Mentions in inline code that quote examples move to fenced blocks.

## Phases

Not written: they depend on the shape B's plan chooses for the fix. At Ready, one phase per lane
(`adr/`, `docs/`, `work/` by folder), each a reviewable diff, and the last deleting the ledger.

## Out of scope

- Building B or the fix: [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s held asks.

## Progress ledger

- [ ] Ready, once B and the fix are built
- [ ] The ledger at zero and deleted
