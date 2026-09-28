# Bug 0352: disk-set offers the repo-root naming to a glob the matcher refuses, so the advice names a cause that is false

## Status

- **State:** Draft — measured on a real fixture, in both checkouts, against built `dist`.
- **Severity:** Medium — **no false green; a false cause.** The dead-selector
  finding fires correctly. The advice it carries sends the author into their
  `tsconfig` `include`/`exclude`, where nothing they do will fix it. ADR-009 rule 2
  is about exactly this.
- **Origin:** architecture and product review of
  [0348](./fixed/0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md),
  found independently by two lenses.
- **Reported:** 2026-09-28

## Symptom

Measured on 0348's own fixture — a two-package monorepo, rules run against
`apps/api`'s tsconfig, `apps/identity` pulled in by a cross-package import —
identically in a plain and a dot-directory checkout:

| glob                 | subjects | `diskSet.classify` | dead-selector findings |
| -------------------- | -------- | ------------------ | ---------------------- |
| `apps/identity/**`   | 0        | `holds-typescript` | 1                      |
| `**/apps/api/src/**` | 1        | `holds-typescript` | 0                      |
| `apps/billing/**`    | 0        | `absent`           | 1                      |

Row one is the finding. The message reads:

> …can never match anything in this project … **this path exists and contains
> TypeScript, but your tsconfig include/exclude keeps it out of the project.**
> Correct the glob, or remove the rule.

`apps/identity/src/services/jwt.service.ts` **is** in the project — 0348's own test
asserts `selected(plain, '**/apps/identity/**')` is `['jwt.service.ts']`. The
tsconfig is not keeping it out. The true cause is the one 0348's ruling wrote down:
the glob is project-relative and names a sibling package above the tsconfig root.

## Root cause

`packages/ts/src/core/disk-set.ts:238` builds `prefixes = [repoRoot, tsconfigRoot]`
and gates **both** on `readsRootRelativePath(glob)`. 0348 established that the
repo-root naming belongs to `readsRepoRelativePath` — a strictly narrower set — and
did not propagate that to `disk-set`. So the filesystem producer still offers the
repo-root naming to project-relative globs, which `matchesPath` deliberately
withholds it from.

Pre-existing: it reproduces in a plain checkout and predates 0348. What 0348 changed
is that the disagreement is now **designed** rather than accidental — there is a
written ruling saying these two globs are matched against different root sets, and
one of the two derivations does not implement it.

## A second half, in the same diagnosis

`packages/ts/src/core/glob-diagnosis.ts:103,106` decides the `file-not-folder` cause
against `universe.filePaths` / `universe.parentDirs` — the **absolute view alone**.
So the two halves of one diagnosis read different universes: 0348 widened the
_deadness_ union (`viewsFor`) and left _cause_ detection on one view. Under a
dot-directory a `parent-dir` glob written at a file is live and no longer
diagnosable as `file-not-folder`; the reader falls through to the generic `no-match`
advice, whose first cause is "a path segment is misspelled".

Pre-existing from 0339 — it lacks the tsconfig view too, not just the repo one — and
advice-only, no verdict turns on it. Filed here rather than separately because it is
the same defect as the symptom above: a producer of CAUSES reading a narrower
universe than the producer of VERDICTS.

## Fix

Not decided; the shape is one gate per prefix rather than one gate for both.

- identity/repo prefix → `readsRepoRelativePath(glob)`
- tsconfig prefix → `readsRootRelativePath(glob)`

With that, `apps/identity/**` classifies `absent` and the message becomes "no file
or directory matching this was found under the project root" — which is true when
the glob is read relative to `apps/api`.

**The open question is whether `absent` is enough.** The sharper message is the one
the ruling implies: "this path exists above your project root — a glob spelled
relative to the project root cannot reach it; write `'**/apps/identity/**'`".
`diagnoseGlob` already computes both facts needed to tell the case apart, so this
is a suggestion string rather than new API. Whether to add a fault kind for it is
the decision.

## Related

- [0348](./fixed/0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md)
  — the ruling this does not implement. Its `CONTROL: a project-relative glob does
not reach above the tsconfig root` pins that the finding fires and asserts nothing
  about whether its cause is true.
- [0339](./fixed/0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md)
  — where `disk-set`'s two prefixes came from, and its own comment on why a
  producer that states a fact about the filesystem must not be confidently wrong.

## Verification

- [x] measured: the table above, in both checkouts, against built `dist`.
- [ ] a ruling on whether the repair is the narrower gate alone or a new fault kind
- [ ] a red-first test asserting the CAUSE, not only that a finding fires
- [ ] the `file-not-folder` half — its own red-first case under a dot-directory
- [ ] a changeset — advice-only, so possibly `none`
- [ ] `npm run validate` green.

Deferred: none.
