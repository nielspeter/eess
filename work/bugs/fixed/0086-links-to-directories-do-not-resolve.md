# Bug 0086: a link to a directory never resolves

## Status

- **State:** Fixed — both causes fixed, red-then-green tests written and
  verified, the coverage this bug blocked (`work/bugs/**`) is on and green
  against the real corpus. Reviewed by three personas; the routing gap they
  found live is fixed and proven by a permanent nonvacuity fixture, not just
  documented. Moved to `fixed/` in this same PR, so the merge and the close
  are one atomic act.
- **Reported:** 2026-08-08 — self-found while extending `check:corpus` to cover
  `work/bugs/**` ([bug 0084](../0084-preserve-relations-right-to-left.md) and
  [0085](../0085-table-row-violations-report-table-line.md) prompted the
  coverage). The extension is live as of this fix, not reverted.

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
`npm run check:corpus`. Two violations appeared; this bug is the first.

(The second was `work/bugs/fixed/0083-…md:75` — a stale pointer in a **frozen**
record that was not being treated as frozen. Resolved as a side effect of
freezing `fixed/` — see **Fix**; `check:corpus`'s pointer count now reads
`143 live · ✓ all ground in code`, zero stale.)

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

Taught the resolver that a link naming a real directory resolves even with no
index file. Directory existence is derived from the corpus's own file index —
every indexed file's ancestors are known directories — no new I/O.

**The two design points, settled:**

- **Opt-in, not default.** `resolveDirectories?: boolean` sits beside
  `tryIndex` in `LinkResolveOptions`, default `false`. Widening what
  "resolves" means is exactly the false-green risk this repo has spent this
  whole session hunting down elsewhere; every existing caller's behaviour is
  unchanged unless it explicitly opts in. Confirmed load-bearing, not
  theoretical: `docs/` is this repo's own VitePress site, where a bare
  directory with no index is _not_ a page the site would actually serve, so
  the option must stay **off** there and **on** everywhere else
  (`work/**`, `adr/**` — repo-hosted markdown GitHub renders as a listing).
  `scripts/check-corpus.mjs` now runs two resolution profiles — `SITE_OPTS`
  (unchanged: `tryExtensions`, `tryIndex`, `rootDir: 'docs'`, no
  `resolveDirectories`) for `docs/**`, `REPO_OPTS` (adds
  `resolveDirectories: true`, no `rootDir`) for everything else — routed by
  which root a link's own document lives in, and merged in the script rather
  than the library (`links()` has no per-folder predicate to express this
  inside the dialect DSL, and inventing one for a single caller would be the
  wrong side of the kernel/dialect line).
- **Trailing slash: both forms.** Checked against the real corpus, not
  assumed: `work/README.md`'s own directory link
  (`[`plans/`](./plans)`) has **no** trailing slash, so requiring one would
  have left the house idiom this bug's own Symptom cites still broken.
  `candidates()`'s existing bare-target stripping (`target.replace(/\/+$/,
'')`) already normalises this for free — no new logic needed, only reusing
  what `tryIndex` already relied on.

**The second, unrelated cause**, fixed in the same change: `**/fixed/**`
added to `scripts/check-corpus.mjs`'s frozen list, alongside `completed`,
`wont-do`, `archived` — the bug lane's own done-folder, previously the only
terminal folder `honestyAtClose` knows about that this gate didn't.

**Turning the coverage on surfaced three genuine, pre-existing dangling
links** — real drift `work/bugs/**` had never been gated against, not
something this fix introduced: 0108 linked `./0107-…md` after 0107 moved to
`fixed/`; 0104 and 0109 (both already in `fixed/`) linked sibling records with
a stray `../` a directory too many. Fixed alongside, since this bug's own
Verification requires the newly-enabled gate to actually run green, not just
exist.

## Review round — 2026-08-13

Reviewed by architect/enforcement/testing personas before commit. **Two
findings were critical, and both were reproduced live, not just reasoned
about** — the enforcement and testing reviewers independently mutated the
routing (adding `resolveDirectories` to `SITE_OPTS`; adding a new `ROOTS`
entry without classifying it) and confirmed `check:corpus` and
`check:nonvacuity` both stayed silently green. This directly falsified the
first draft of this record, which had argued the routing was "four lines,
directly readable at the call site, and lower-risk than the mechanism it
composes" and declined to build a permanent fixture for it. It was neither —
demonstrated, not assumed.

**The real defect:** the original routing used the site (`docs/`) as the
named case and everything else as the default —
`isSiteDoc(relPath) ? SITE_OPTS : REPO_OPTS`. That made the **loose** profile
the default for any _unclassified_ region, including a future root nobody
remembered to route. A link resolving that shouldn't is the exact false-green
class this fix exists to prevent, and the routing itself was the one piece of
this change that could produce it undetected.

**Fixed by extracting the routing into `scripts/lib/corpus-link-routing.mjs`**
(mirroring bug 0121's `lane-coverage.mjs` precedent, which this record's first
draft explicitly declined to follow — the reviewers were right to hold it to
the same bar):

- `isRepoNativeLink` inverted to a true allowlist (`REPO_NATIVE_ROOTS =
['work/', 'adr/']`) — anything not on it, including any future root, gets the
  strict profile by **default**. An unclassified new root now reads as a
  false red (annoying, safe) instead of a silent false green.
- `unclassifiedRoots` — `check-corpus.mjs` now refuses to run at all if any
  `ROOTS` entry isn't explicitly classified as site or repo-native, rather
  than trusting a default either way.
- `siteOptsAreSafe` — a **separate** assertion, because the routing fix above
  does not close the whole gap: `SITE_OPTS.resolveDirectories` being mutated
  directly bypasses the routing entirely (a link that resolves cleanly under
  the site profile never reaches the routing's filter at all). Verified: with
  only the routing fix and not this assertion, the exact mutation the
  reviewers demonstrated still passed `check:corpus` green. `check-corpus.mjs`
  now asserts this at startup and exits 1 if it's ever true.

**All three are proven by a permanent nonvacuity fixture**
(`scripts/nonvacuity/bad-corpus-link-routing.mjs`, wired in as
`corpus/link-routing`), not a one-time manual check — and each direction was
re-verified against the exact mutation that broke the old code, both in the
isolated fixture and end-to-end against the real `check-corpus.mjs` script
(temporarily reapplying each reviewer's mutation and confirming it now exits 1
with a clear message, then reverting).

**Also added in response to review:** two more unit tests
(`packages/md/tests/links.test.ts`) proving an ordinary file resolution is
undisturbed by a sibling directory-shaped link, and that `tryIndex` and
`resolveDirectories` compose rather than conflict when both are set — traced
as safe by construction during review, now also asserted. Two doc-comment
clarifications in `resolve.ts`: the directory-vs-mistyped-file ambiguity (not
a new failure mode — GitHub would render the same link the same way), and
that `directoryIndex` deliberately excludes the repo root itself.

**Deferred→[bug 0137](../0137-directory-link-violation-does-not-say-why.md):**
the violation message (`broken link: "..." does not resolve to a file in the
repo`) doesn't tell a `docs/`-region author _why_ a directory link fails there
when the same shape resolves elsewhere in the repo. Real, flagged Important by
the enforcement review — but the right fix needs the condition to name _which_
near-miss occurred (directory-exists-no-index vs. genuinely-nonexistent), a
design question of its own, not a one-line patch inside this bug.

## Verification

- [x] Red test written first: a link to an existing directory reports a
      violation before the fix, none after —
      `packages/md/tests/links.test.ts`, "directory targets (bug 0086)".
- [x] A link to a directory that does **not** exist still goes red — the fix
      must not resolve everything.
- [x] `tryIndex` behaviour unchanged for corpora that use it — existing
      `links.test.ts` cases still pass unmodified; `resolveDirectories`
      defaults to `false` with its own explicit regression test.
- [x] The `fixed` done-folder added to the frozen list in
      `scripts/check-corpus.mjs`.
- [x] `work/bugs/**` added to `ROOTS` in `scripts/check-corpus.mjs` and
      `npm run check:corpus` green — the coverage this bug blocks. 97 live
      documents, 446 links, 0 violations.
- [x] Suite + `npm run validate` green.

Deferred: [0137](../0137-directory-link-violation-does-not-say-why.md) — the
violation message doesn't say why a directory link failed under a given
resolution profile.
