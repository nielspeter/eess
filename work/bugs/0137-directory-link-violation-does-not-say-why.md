# Bug 0137: a broken directory link and a typo'd file link report the identical message, with no hint that the corpus region matters

## Status

- **State:** Draft — read from the source during bug 0086's review round; no
  red test yet.
- **Severity:** Low — a missing-attribution gap, not a false green. Nothing
  here passes over drift; a reader gets a correct "broken" verdict, just no
  hint at _why_, which costs them a debugging step rather than a wrong answer.
- **Origin:** self-found · enforcement review of
  [bug 0086](./fixed/0086-links-to-directories-do-not-resolve.md)'s fix
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

Not designed yet — the shape is a real design question, not a one-line patch:

- The condition itself doesn't know it's "the docs/ profile" vs. "the repo
  profile" — that labelling exists only in `scripts/check-corpus.mjs`'s
  routing (`scripts/lib/corpus-link-routing.mjs`), one layer above
  `LinkResolveOptions`. Widening the message requires either passing a
  profile label into `resolve()`, or having the condition detect and report
  the specific near-miss (e.g. "this resolves as a directory once
  `resolveDirectories` is set" or "this directory has no index file") without
  needing to know the caller's label at all — the second is more general and
  probably the right shape, since it wouldn't require `check-corpus.mjs` (or
  any other consumer) to thread a profile name through.
- Candidate framing: when a link fails, check what it _would_ have taken to
  resolve (an index file present, `resolveDirectories` on, an extension
  added) and say that specific gap in the message, rather than a single
  generic "does not resolve."

## Verification

- [ ] Red test written first: a link to a real directory with no index,
      checked under `resolve()` with `resolveDirectories` off, reports a
      message distinguishing "directory exists, no index" from "target
      doesn't exist at all."
- [ ] The existing generic "does not resolve" message is not lost for the
      genuinely-nonexistent case — only sharpened for the near-miss cases.
- [ ] `npm run validate` green.

Deferred: none.
