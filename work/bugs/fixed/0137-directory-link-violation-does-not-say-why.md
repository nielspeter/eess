# Bug 0137: a broken directory link and a typo'd file link report the identical message, with no hint that the corpus region matters

## Status

- **State:** Fixed — fix implemented and verified, red-then-green confirmed,
  reviewed by two personas with two real findings fixed. Moved to `fixed/` in
  this same PR, so the merge and the close are one atomic act.
- **Severity:** Low — a missing-attribution gap, not a false green. Nothing
  here passes over drift; a reader gets a correct "broken" verdict, just no
  hint at _why_, which costs them a debugging step rather than a wrong answer.
- **Origin:** self-found · enforcement review of
  [bug 0086](./0086-links-to-directories-do-not-resolve.md)'s fix
- **Reported:** 2026-08-13

## Symptom

`linkResolves` (`packages/md/src/conditions/resolve.ts`) reports every broken
link with the same message regardless of _why_ it's broken:

```ts
message: `broken link: "${link.url}" does not resolve to a file in the repo`,
```

Since bug 0086, this repo runs two resolution profiles over the same corpus —
`docs/` (the VitePress site) keeps `resolveDirectories` off, because a bare
directory with no index isn't a real page there; everywhere else
(`work/**`, `adr/**`) has it on, because GitHub renders any real directory as
a listing. Both are correct, deliberately different rules for different
regions of the _same repo_.

An author who writes `[guide](./guide/)` in `docs/` and hits a broken-link
violation gets:

```
docs/some-page.md:12  broken link: "./guide/" does not resolve to a file in the repo
```

identical to what a genuine typo or a moved file would produce, and identical
to what the _same-shaped link_ would report if it merely didn't exist in
`work/**` either. Nothing distinguishes "this directory is real, but this
region requires an index file" from "this path doesn't exist at all." An
author who has seen `[fixed/](./fixed/)` work fine in `work/bugs/BUGS.md`
has no way to tell, from the message alone, why the same pattern fails in
`docs/`.

## Reproduction

```bash
# from repo root
mkdir -p docs/__repro__ && echo '# x' > docs/__repro__/item.md
printf '\n[repro](./__repro__/)\n' >> docs/index.md
npm run check:corpus
# docs/index.md:NNN  broken link: "./__repro__/" does not resolve to a file in the repo
rm -rf docs/__repro__ && git checkout docs/index.md
```

The message gives no signal that `__repro__/` genuinely exists and would
resolve one directory over in `work/**`.

## Root cause

`linkResolves`'s violation message is built once, without reference to which
resolution profile was active or why the specific target shape failed. The
condition doesn't currently distinguish its failure reasons internally either
— `candidates()` and the directory check are both plain boolean tests, with no
record of _which_ shape was tried and lost (file-index miss vs.
directory-exists-but-no-index vs. directory-doesn't-exist-at-all).

## Fix

Took the second framing named as "probably the right shape": the condition
detects and reports the specific near-miss itself, without needing to know
which profile is calling it.

`linkResolves()` (`packages/md/src/conditions/resolve.ts`) builds a lazy,
memoized directory index — the same `directoryIndex()` function `dirIndex`
already uses when `resolveDirectories` is on, just invoked from the opposite
side. When a link fails to resolve and `resolveDirectories` is **off**, it
checks whether the (slash-stripped) target names a real directory; if so, the
message gains a clause naming it:

```
broken link: "./guide/" does not resolve to a file in the repo — "docs/guide" is a real directory; this check runs with resolveDirectories off
```

A genuinely nonexistent target keeps the plain message, unchanged.

**Scoped narrower than the Root cause section's full list of near-misses.**
Only the directory case is covered — not a missing `tryIndex` file, not a
missing `tryExtensions` entry. Those are real, symmetrical gaps (an
extensionless link that would resolve with the right `tryExtensions` entry
gets the same generic message today), but this bug's own Symptom and
Reproduction are specifically about the directory case bug 0086 introduced;
widening to the other two would be answering a question this record never
asked. Left as a candidate follow-up, not filed — no evidence yet that either
one has actually confused anyone, unlike the directory case, which did.

**Cost:** the diagnostic directory index is built at most once per
`linkResolves()` call, lazily — only if a violation is actually being
reported with `resolveDirectories` off. A clean corpus, or one that never hits
this specific near-miss, pays nothing extra. When `resolveDirectories` is
**on**, a real directory already resolved before reaching the
violation-construction branch at all, so the hint path is provably
unreachable there — no redundant check.

## Review round — 2026-08-13

Reviewed by enforcement + testing personas (not architect — no new placement
or kernel/dialect decision here, only message text inside an existing
condition). Two findings were real and fixed:

- **The primary new test was vacuous.** Demonstrated by mutation: hardcoding
  the wrong directory name into the hint still passed all 16 original tests,
  because the assertion used loose `toMatch(/is a real directory/)` /
  `toMatch(/resolveDirectories/)` patterns that any hint text satisfies,
  correct or not. Fixed by switching to an exact `toBe()` match on the full
  message — re-verified the strengthened test correctly fails against the
  same sabotage (3 of 19 tests now catch it) before restoring the real fix.
- **A site-absolute link with `rootDir` set yields two resolution candidates
  (repo-root, then content-root), and either can independently be a real
  directory.** The original hint reported whichever came first, unlabelled —
  for this repo's own `docs/` profile (`rootDir: 'docs'`), a repo-root
  directory sharing a name with an intended content-root page would be named
  as if it were the page the author meant, sending them to toggle
  `resolveDirectories` — which would resolve the unrelated repo-root
  directory, not fix the actual missing page. Not live in the real corpus
  today (confirmed: 0 such links exist), but reachable. Fixed by labelling
  the hint (`"decoy" (repo-root)` vs. `"decoy" (content-root)`) whenever
  there are two candidates to disambiguate between; the common single-target
  case (no `rootDir`) is unaffected.

Also closed two coverage gaps named during review: the no-trailing-slash
directory shape (`./fixed`, not just `./fixed/`) and the
`resolveDirectories: true` + genuinely-missing-target combination both now
have their own exact-match tests.

**Not acted on, deliberately:** the claim that the diagnostic directory index
is built "at most once, memoized" rests on a source comment, not a test —
confirmed true by temporary instrumentation during review, but making it
self-checking would mean exporting an internal for test-only introspection,
disproportionate for a performance property rather than a correctness one.

## Verification

- [x] Red test written first: a link to a real directory with no index,
      checked under `resolve()` with `resolveDirectories` off, reports a
      message distinguishing "directory exists, no index" from "target
      doesn't exist at all." Confirmed to fail before the fix (one assertion
      red, the other two — which describe pre-existing behaviour — already
      green), pass after.
- [x] The existing generic "does not resolve" message is not lost for the
      genuinely-nonexistent case — only sharpened for the near-miss cases.
      `packages/md/tests/links.test.ts`'s "a genuinely missing target keeps
      the generic message" asserts the exact unchanged string.
- [x] `npm run validate` green.

Deferred: none.
