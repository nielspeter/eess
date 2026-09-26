# Bug 0340: the path-glob census keys on declaration, so a matching site that declares nothing is invisible

## Status

- **State:** Draft — measured; the fix is a second scan in the shape the first one already has.
- **Severity:** Medium — **no false green today, and a known route to one.** Every surface that
  matches a path glob is supposed to be classified and, since
  [0339](./fixed/0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md), measured.
  The census that enforces that finds surfaces by looking for a **glob declaration**, so a site that
  matches paths without declaring a `GlobSite` is owed nothing and tested by nothing.
- **Origin:** the enforcement review of PR #150, 2026-09-26 (Minor 6), and independently the R12 row
  of 0339's own sabotage matrix, which fired nothing for exactly this reason.
- **Reported:** 2026-09-26

## Symptom

`packages/ts/tests/matrix/path-glob-surfaces.ts` scans `src/` for files containing `globAnyOf(` or
`globNode(` **and** `'file-path'`/`'parent-dir'`. Four of the surfaces 0339 fixed declare nothing and
are invisible to it:

| surface                   | declares a glob site | in `CLASSIFIED` | falsifier                                       |
| ------------------------- | -------------------- | --------------- | ----------------------------------------------- |
| `presets/boundaries.ts`   | no                   | no              | pinned by hand in 0339                          |
| `core/disk-set.ts`        | no                   | no              | pinned by hand in 0339                          |
| `smells/sibling-files.ts` | no                   | no              | inherits `smells/smell-builder.ts`'s row        |
| `models/slice.ts`         | no                   | no              | inherits `builders/slice-rule-builder.ts`'s row |

The two hand-pinned rows are the receipt: **`presets/boundaries.ts` had no falsifier at all** until
0339's sabotage matrix reverted it and the entire suite stayed green.

The census's own guard — `it('no surface is unclassified')` — cannot see any of this. It is a
correspondence between a source scan and a table, and both sides agree on a population that excludes
these four.

## Root cause

The census was written for bug 0036, whose subject was what a **declared** glob's `base` means. 0339
made the subject wider: what a glob is **matched against**. Declaration and matching are not the same
population, and the scan was never moved.

The consolidation 0339 performed is what makes the second scan cheap: there is now exactly one pair of
functions a matching site can use — `matchesPath` / `anyMatchesPath`
(`packages/ts/src/core/project-relative.ts`) — so "every file that calls one of these is classified or
on a named exception list" is the same shape `pathGlobSurfaces()` already has, over a different token.

## Fix

Not decided; one obvious candidate and one question.

- **The second scan.** Add `pathMatchSurfaces()` beside `pathGlobSurfaces()`, scanning for
  `matchesPath(`/`anyMatchesPath(`, and assert every hit is a key in `CLASSIFIED` or in a named,
  commented exception list. The exceptions today would be the four above plus `core/project-relative.ts`
  itself.
- **The question:** whether they should instead be _added_ to `CLASSIFIED`, which would make the
  0339 probe table owe each of them a probe — the stronger answer, and the one that would have made
  R12 impossible rather than merely noticed. It needs a classification for a surface that declares no
  `base`, which is what `CLASSIFIED`'s three values currently encode.

## Related

- [0339](./fixed/0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md) — the fix
  that consolidated the matching sites, and whose R12 row is this bug's evidence.
- [0330](./0330-what-a-rule-reads-is-ruled-in-archived-bug-records.md) — where the rule these
  surfaces implement should be written down.

## Verification

- [x] measured: the four invisible surfaces, the scan tokens, and R12's green run.
- [ ] a ruling between the second scan and widening `CLASSIFIED`
- [ ] the guard, failing on a seeded unclassified matching site
- [ ] a changeset — or an explicit `none`, if this ships nothing an adopter observes
- [ ] `npm run validate` green.

Deferred: none.
