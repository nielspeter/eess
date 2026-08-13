# Bug 0086: a link to a directory never resolves

## Status

- **State:** Draft — reproduced by running the gate; root cause read from the
  source. No red test written yet.
- **Reported:** 2026-08-08 — self-found while extending `check:corpus` to cover
  `work/bugs/**` ([bug 0084](./0084-preserve-relations-right-to-left.md) and
  [0085](./0085-table-row-violations-report-table-line.md) prompted the
  coverage). The extension is reverted pending this fix.

## Symptom

`links().should().resolve()` reports a violation for a markdown link whose
target is a **directory that exists**:

```
work/bugs/BUGS.md:3  broken link: "./fixed/" does not resolve to a file in the repo
```

`work/bugs/fixed/` exists and holds two documents. GitHub renders the link fine.
The corpus is right and the gate is wrong, which is the worst direction for a
gate: it teaches authors to stop linking directories, or to stop trusting the
gate.

This is not one stray link. It is the house idiom — `work/README.md` links its
lanes the same way (`[plans/](./plans)`), and any corpus with a folder-per-lane
structure will hit it the moment that folder is gated.

## Reproduction

Add `'work/bugs/**'` to `ROOTS` in `scripts/check-corpus.mjs` and run
`npm run check:corpus`. Two violations appear; this bug is the first.

(The second is `work/bugs/fixed/0083-…md:75` — a stale pointer in a **frozen**
record that is not being treated as frozen. See **Fix**.)

## Root cause

`packages/md/src/conditions/resolve.ts` resolves a link by looking its target up
in the corpus's **file index** — there is no directory existence check anywhere
in the path. `candidates()` (`packages/md/src/conditions/resolve.ts:54`) builds
the list of things to try: the target as written, then `tryExtensions`, then
`tryIndex` joined onto the bare target.

So a directory target can only resolve if the caller sets `tryIndex` _and_ the
directory happens to contain that index file. `work/bugs/fixed/` has no
`index.md`, and neither does any lane folder in this corpus — the convention
here is a board file (`BUGS.md`, `ROADMAP.md`) that lives one level **up**, not
an index inside.

A directory is simply not a resolvable target shape in this dialect.

## Fix

Teach the resolver that a link ending in `/`, or naming a path that is a
directory in the repo tree, resolves when that directory exists. The corpus
already walks the tree to build its file index, so directory existence is
derivable from it without new I/O — every indexed file's ancestors are known
directories.

Two design points to settle:

- **Opt-in or default?** Resolving directories is correct for a repo-hosted
  corpus (GitHub, GitLab) and wrong for a static-site corpus where a directory
  is not a page. This may want to sit beside `tryIndex` in
  `LinkResolveOptions` rather than becoming unconditional.
- **Trailing slash significance.** Whether `./fixed` and `./fixed/` are both
  directory links, or only the slashed form.

A second, unrelated cause blocks the same coverage and should land in the same
change. `scripts/check-corpus.mjs` freezes the `completed`, `wont-do` and
`archived` done-folders, but not `fixed` — the bug lane's own done-folder, and
one of the terminal folders `honestyAtClose` already knows about. Without it,
history in `fixed/` is gated rather than reported, and a fixed bug's pointers
are forced to describe today's code instead of the code as it was.

## Verification

- [ ] Red test written first: a link to an existing directory reports a
      violation before the fix, none after.
- [ ] A link to a directory that does **not** exist still goes red — the fix
      must not resolve everything.
- [ ] `tryIndex` behaviour unchanged for corpora that use it.
- [ ] The `fixed` done-folder added to the frozen list in
      `scripts/check-corpus.mjs`.
- [ ] `work/bugs/**` added to `ROOTS` in `scripts/check-corpus.mjs` and
      `npm run check:corpus` green — the coverage this bug blocks.
- [ ] Suite + `npm run validate` green.

Deferred: none
