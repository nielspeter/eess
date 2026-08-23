# Bug 0221: `diffAware()` cannot tell "nothing changed" from "wrong base"

## Status

- **State:** Draft — measured 2026-08-23; fix not built.
- **Priority:** Medium — it silently suppresses every violation in one reachable case, but
  only for callers who opt into `check({ diff })`, and no gate in this repo does.
- **Origin:** self-found — architect review of an earlier, diff-gated design for
  [plan 0218](../plans/completed/0218-gate-proposal-acceptance-criteria.md). That design was reverted as
  over-built, but the finding about the **kernel's** `diffAware()` stands on its own and is
  independent of it.

## Symptom

`diffAware(baseBranch = 'main')` (`packages/core/src/diff-aware.ts:60`) resolves nothing and
reads nothing:

- it takes a **branch name**, defaulting to `'main'` — no `origin/main` fallback, no
  `GITHUB_BASE_REF`, no env override, no candidate list;
- on a git **error** it returns `new DiffFilter(null)` and reports every violation with a
  warning (`:70-77`);
- on an **empty diff** it returns `new DiffFilter(new Set())` — which filters out
  **everything** (`:79-82`).

The two failure modes are opposite, and the second is the dangerous one: `git diff
main...HEAD` succeeding with empty output is indistinguishable, at this seam, from "the base
I was handed is not the base you meant". A consumer in CI whose checkout has a stale local
`main`, or who passes a branch that exists but is not their PR target, gets **zero
violations and no warning** — the run is green because nothing was compared.

An empty diff legitimately means "no changed files" for a filter, so this is not a bug in
that branch alone. It is a bug in there being no way to tell the two apart.

## Repro

```bash
# a branch whose diff against a resolvable-but-wrong base is empty
git switch -c probe main
# a rule that would otherwise report violations:
#   classes(p).should().notContain(call('eval')).check({ diff: diffAware('main') })
# → 0 violations, exit 0, no warning. Identical output to a clean codebase.
```

Contrast `git diff nonexistent...HEAD`, which errors and therefore reports everything.

## Root cause

`DiffFilter(null)` and `DiffFilter(new Set())` encode "no filtering" and "filter everything"
— but the function has no third state for "I could not establish a basis". So the _safest_
outcome (report all) is reserved for the loudest failure (git threw), and the _least_ safe
(report none) is what an ordinary wrong-base produces.

`scripts/check-release.mjs` takes the opposite position for a gate: `EESS_RELEASE_BASE` →
the PR's target → `origin/main` → `main`, and an unresolved base is **fatal**, never an
empty diff. A filter and a gate legitimately want different things — but the shipped filter
is the one that cannot say which zero it produced, and that part is not a matter of taste.

`packages/ts/src/helpers/diff-aware.ts` is a near-verbatim third copy, so a fix has two
sites, not one. That duplication is [plan 0188](../plans/0188-unify-the-duplicated-engine-modules.md)'s
subject and not this bug's.

## Fix — the decision this needs first

1. **Report the basis.** Whatever else changes, the caller should be able to see what was
   compared: `DiffFilter` carrying its base and its changed-file count, surfaced the way
   `check:corpus` now prints `0 added since origin/main`. Cheapest, and it makes the other
   two decidable rather than guessed.
2. **Give `diffAware` the shared resolution order**, so `origin/main` and a PR's real target
   work without the caller knowing to ask. This is behaviour change for existing callers and
   wants a changeset.
3. **Decide whether an unresolvable base should fail.** For a gate the answer is yes; for a
   filter it is arguably no. Whichever it is, it should be stated rather than emergent.

Not folded into 0218: that plan is repo-local scripts, and this is published kernel surface
with its own release obligations.

## Verification

- [ ] Red first: a rule filtered by `diffAware('main')` against a resolvable-but-wrong base
      reports what it compared, rather than a bare zero.
- [ ] A committed violating fixture, so an emptied implementation cannot stay green.
- [ ] Both copies (`packages/core`, `packages/ts`) move together, or the second is filed.
