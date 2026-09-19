# Bug 0328: the peer floor that makes a sibling import resolvable is a manual release step

## Status

- **State:** Draft — the mechanism is designed and measured against the shape it must catch; not built.
- **Severity:** Medium — it fails **loudly**, at import, not silently: `ERR_PACKAGE_PATH_NOT_EXPORTED`.
  What makes it worth a record is that the step it depends on has a written history of being skipped.
- **Origin:** self-found · architecture review of [0287](./fixed/0287-four-copies-of-one-fence-lexer-across-three-packages.md)'s
  fix (PR #145), which added the first import of a sibling's `/internal`
- **Reported:** 2026-09-20

## Symptom

`packages/crossvalidate/src/md-gherkin.ts` imports `@nielspeter/eess-md/internal` at runtime.
`packages/crossvalidate/package.json` declares its floor as `"@nielspeter/eess-md": ">=0.6.1"` — a
published release with no such subpath. What makes the import resolvable for an adopter is
`RELEASING.md` step 3a, raising the floors by hand in the `changeset version` commit.

The floor cannot be raised earlier: `RELEASING.md` measured that raising it to an unpublished version
makes `npm install` fail with `ETARGET` for every fresh clone, and `npm ci` does not notice, because
npm's lockfile validation compares names and versions and never `peerDependencies`. So "later, by hand"
is correct — and unguarded.

`RELEASING.md:414` is a numbered warning headed _"Do not skip step 3a because the fix touched one
package."_ A document that has to say this is a document recording that the step gets skipped.

## The corruption that must produce a violation

For every sibling-dialect specifier `packages/crossvalidate/src/**` imports, the declared peer floor
must be at least that package's workspace version. A floor below it means the published crossvalidate
admits a sibling that cannot satisfy the import.

The shape fits `check:family`, beside `scripts/lib/family-re-exports.test.mjs` — same question, one
layer out: that one asks whether a dialect re-exports what its source imports, this one asks whether the
manifest admits a version that has it.

**Why it fires at the right moment, and not before.** Today the floor (`>=0.6.1`) equals eess-md's
workspace version (`0.6.1`), so the check is green. `changeset version` bumps eess-md to `0.7.0` in the
release commit, and the check reds there — exactly where step 3a is performed — until the floor is
raised. That is the one moment the manual step exists for.

## Also on this seam

- `@nielspeter/eess-md` is declared `optional: true` in crossvalidate's `peerDependenciesMeta`, while
  `./md-gherkin` now hard-requires it at **import** time rather than at call time (the type-only import
  it replaced erased at build). Whether "optional" still describes that entry point is part of the same
  decision.
- This is the family's first import of a **sibling's** `/internal`.
  [0327](./0327-adr-011-is-written-about-the-kernel-and-the-family-now-has-two-internals.md) is where
  that belongs.

## Verification

- [x] Confirmed the import is at runtime, and that the declared floor admits a release without the
      subpath.
- [x] Confirmed `RELEASING.md` defers the raise to step 3a deliberately, with the `ETARGET` measurement
      that makes an earlier raise wrong.
- [ ] Red first: a floor below the workspace version of an imported sibling fails `check:family`.
- [ ] The check, and whether `optional: true` still holds for `./md-gherkin`.

Deferred: none.

## Related

- [0287](./fixed/0287-four-copies-of-one-fence-lexer-across-three-packages.md) — the import that made
  this reachable.
- [0327](./0327-adr-011-is-written-about-the-kernel-and-the-family-now-has-two-internals.md) — the
  packaging contract half.
