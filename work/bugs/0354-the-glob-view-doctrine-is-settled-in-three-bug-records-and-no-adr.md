# Bug 0354: the glob-view doctrine is settled in three bug records and no ADR, so a fourth glob bug will re-derive it from prose

## Status

- **State:** Draft — measured; the decision exists and is correct, and is written
  nowhere a reader looks for decisions.
- **Severity:** Medium — **no false green in the product; a false green in the
  method**, the same shape as
  [0347](./0347-the-always-loaded-index-does-not-reach-the-doctrine-digest.md). The
  rule that decides what every adopter's glob _means_ is binding, is appealed to by
  three fixes, and lives in bug records and a docstring.
- **Origin:** architecture and method review of
  [0348](./fixed/0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md),
  found independently by two lenses.
- **Reported:** 2026-09-28

## Symptom

One principle now decides three bugs:

| bug                                                                                                     | the location that must not decide the verdict                       |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [0339](./fixed/0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md)                 | where the project sits on disk (a dot-segment in the checkout path) |
| [0348](./fixed/0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md) | the same, for a glob naming segments above the tsconfig root        |
| [0349](./fixed/0349-a-path-shaped-dependency-ban-passes-silently-under-pnpm-and-yarn.md)                | the package manager's own `node_modules` layout                     |

0348's record heads a section `## Ruling: a third view, offered only to a glob that
says "anywhere"` and derives it from "the same clause 0349 settled … one population
over". 0349 in turn cites 0339's standing rejection of `{ dot: true }` for path
globs. The doctrine is real, consistent, and cited as precedent by each successor.

Measured: `ls adr/` is 15 ADRs, none about path-glob view semantics.
`grep -rln "path glob\|second view\|three views\|glob semantics" adr/ work/plans/ work/proposals/`
returns only `work/plans/completed/0237-…` and `work/proposals/010-…`, neither about
this.

## Root cause

The repo's own convention — the ADR is the decision, the record is the work — was
followed for every other binding decision and not for this one, because each glob
bug looked like an incident rather than a decision until the third one cited the
second.

What is undecided-in-writing, and would be the ADR's clauses:

1. **How many views a path is named by, and which spelling gets which.** Today:
   absolute for everything; tsconfig-relative for a project-relative or `'**/'`-led
   glob; repo-relative for a `'**/'`-led glob only.
2. **That a location the author does not own must not decide a verdict** — the
   checkout path, the package manager's layout — while a location inside the
   repository is theirs and does decide one.
3. **That the diagnosis and the matcher must be given the same view set**, in both
   directions: a view the matcher has and the universe lacks reports a working rule
   as dead; the reverse lets a glob that selects nothing pass unremarked.
4. **That a view is added only when it can be shown to add no match in the
   unaffected case** — the suffix property 0348 measured.

## Fix

Write the ADR, with an `## Enforcement` table. The pinning tests already exist and
would fill the rows — `packages/ts/tests/core/globs-under-a-dot-directory.test.ts`,
`a-glob-above-the-tsconfig-root.test.ts`, `a-dependency-ban-under-pnpm.test.ts`, and
`packages/core/tests/path-universe.test.ts`. Use the `eess-adr-author` skill and
then `eess-adr-validate`, or `.claude/workflows/adr-enforce.mjs` for both as one
enforced step.

**This is an ADR, not a plan** — it is a decision already taken and applied three
times, needing to be written down, not work needing to be sequenced.

## Related

- [0347](./0347-the-always-loaded-index-does-not-reach-the-doctrine-digest.md) — the
  same class one level up: a binding clause that exists and cannot be found.
- [0353](./0353-pathuniverse-and-viewsfor-are-one-dialects-vocabulary-in-the-kernel.md)
  — where the views live, which this ADR would have to be consistent with.

## Verification

- [x] measured: the three records above cite one another as precedent; zero ADRs and
      zero plans/proposals on path-glob view semantics.
- [ ] the ADR written, with its Enforcement table
- [ ] `eess-adr-validate` (or the workflow) run against it
- [ ] the three bug records pointed at it
- [ ] `npm run validate` green.

Deferred: none.
