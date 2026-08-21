# Bug 0202: `check:release` credits any pending changeset, so a PR can declare nothing

## Status

- **State:** Draft — measured on this repo, on a live PR.
- **Deferred:** none
- **Found:** 2026-08-21, devops review of PR #74.

## Symptom

`check:release` is meant to fail a PR that changes a package without declaring a
release for it (bug 0106). It reads **declarations from a full disk scan** —
`scripts/check-release.mjs:168`, `readdirSync('.changeset')` — while only the
**waivers** are scoped to the PR's diff.

So a changed package is satisfied by _any_ pending changeset naming it, whoever
wrote it and whenever. Measured today: 16 changesets are pending and at least nine
already declare `@nielspeter/eess-ts`. **PR #74 would have passed `check:release`
with no changeset at all.**

The changeset in PR #74 is correct because the author wrote one, not because the
gate required it.

## Why it matters

The gate's own stated question is "will this source be reachable from a published
version" — and against _that_ question the current behaviour is arguably right: if
some pending changeset bumps `eess-ts`, this PR's code does ship.

But `CLAUDE.md` and `RELEASING.md` both describe it as a per-PR obligation
("Touch anything under `packages/<name>/` and that package needs a changeset naming
it"), and that is how contributors read it. The gap between the documented promise
and the implemented check is the defect, and it is invisible precisely while the
queue is non-empty — which on this repo is nearly always.

**The green is therefore weaker than it reads**: it attests "some pending changeset
names this package", not "this change was declared". A reviewer reading
`✓ release readiness — 1 changed of 6 workspace package(s), 1 declared` will take
the stronger meaning.

## The asymmetry is the tell

The scoping fix that bug 0106's follow-up applied to **waivers** was not applied to
**declarations**. `scripts/release-gate.mjs`'s WAIVERS block scopes waivers to the
diff; nothing does the same for declarations.

## Fix

Not decided. The honest options differ in what they claim:

1. **Scope declarations to the diff too** — a changed package needs a changeset
   _added or modified by this PR_. Matches the documented promise; would redden a
   PR that legitimately rides an existing pending changeset (a follow-up commit to
   an already-declared feature), which is a real workflow here.
2. **Keep the behaviour, fix the words** — say in the summary line and the docs
   that the check is "reachable from a pending release", not "declared by this PR".
   Cheapest, and honest.
3. **Both** — scope it, and allow an explicit opt-out naming the changeset being
   ridden.

Option 2 is the minimum; the gate must not read stronger than it checks.

## Verification

- [ ] Red test first: a fixture PR touching `packages/<x>/` with **no** changeset
      of its own, while an unrelated pending changeset names `<x>`, behaves as the
      chosen option says — and the fixture pins which option was chosen.
- [ ] The summary line states what it actually attests.
- [ ] `CLAUDE.md` and `RELEASING.md` agree with the implementation.
