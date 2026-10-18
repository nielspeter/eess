# Bug 0484: `corpus/state-present` picks records by a path prefix, not a glob

## Status

- **State:** Draft — recorded 2026-10-18 from plan 0469's review.
- **Severity:** Low — fails closed (zero examined reds), but the finding cannot name the cause.
- **Origin:** self-found · plan 0469's review, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

`corpus/state-present` (`scripts/check-corpus.mjs:336`) selects live records with an opaque
`satisfy()` predicate that tests `d.relPath.startsWith(lane.roots[0].replace(/\*\*$/, ''))`. A
predicate that declares no globs is opaque to the dead-selector diagnosis, so if a lane's root
changes, the rule reds as "examined zero units" without naming the glob that matched nothing.

## Fix

Select with `resideInFolder` over the lane's root glob (and its done folders negated), so the kernel
can diagnose a dead glob.

## Verification

- [ ] Red first: with a lane root renamed, the finding names no glob
- [ ] Green: the finding names the lane's root glob

Deferred: none
