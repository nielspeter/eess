# Bug 0273: nothing compiles a changeset's migration snippet

## Status

- **State:** Draft — the mechanism gap that let a wrong migration reach a
  release-ready PR.
- **Priority:** Medium
- **Found by:** enforcement and release reviews of PR #122, independently.

## Symptom

`check:docs-code` compiles the fenced code blocks under `docs/` — 57
import-bearing fences, measured. It never opens `.changeset/`.

A changeset body is the one document written specifically to tell an adopter how
to change their code, and it is the one document with no compile gate. It also
ships: changesets copies it into six `CHANGELOG.md` files and it reaches npm.

## The corruption that must produce a violation

A `ts` fence in `.changeset/*.md` importing a symbol from a package or subpath
that does not export it.

## The instance that produced this bug

Plan 0263 Phase 5 removed `throwIfViolations` from three barrels and its
changeset told adopters:

> `finishPreset` is exported from the same three places the alias was, so the
> import line does not move.

`@nielspeter/eess-ts/presets` did not export `finishPreset`. An adopter
following that verbatim gets an ESM link-time error:

```
SyntaxError: The requested module '@nielspeter/eess-ts/presets' does not provide an export named 'finishPreset'
```

The subpath is the one `docs/getting-started.md` teaches, and
`docs/api-reference.md` documented the removed alias under its presets table, so
the adopter who followed the docs is exactly the one the migration failed. Three
reviewers found it; no gate did. This is ADR-009 rule 2 — a remedy must be
verified to remediate — missed in the very plan that shipped four
`emitter/remedy-remediates` fixtures for that clause.

## Why the fixture is cheap

The docs-code machinery already compiles fences against the built packages. The
work is extending its root set to `.changeset/**` and adding a non-vacuity
fixture that plants a fence importing a non-existent export and asserts the gate
reds by rule id.

Worth settling while building it: a changeset may legitimately show the OLD, now
broken call as the "before" half of a migration. The gate needs a way to say
which fence is the target state — a `before`/`after` convention, or compiling
only fences after a marker.

## Verification ledger

- [ ] Red test first: a fence importing a non-existent export from a real
      subpath, failing before the fix.
- [ ] `check:docs-code` reads `.changeset/**`, with the before/after question
      settled rather than assumed.
- [ ] A non-vacuity fixture, asserted by rule id, so an emptied implementation
      cannot stay green.
