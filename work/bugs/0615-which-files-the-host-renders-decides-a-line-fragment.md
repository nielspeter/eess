# Bug 0615: which files the host renders decides what a line fragment reaches

## Status

- **State:** Draft — measured 2026-11-04 on bundle 2's branch by its enforcement review
  ([bug 0575](./fixed/0575-a-fragment-the-link-check-cannot-judge-passes.md)); no red test yet.
- **Severity:** Medium — a false green and a false red, both narrow: a `#L1` on a file GitHub
  renders passes, and an anchor on a rendered file that is not `.md` is reported with a remedy that
  does not work.
- **Origin:** self-found · [bug 0575](./fixed/0575-a-fragment-the-link-check-cannot-judge-passes.md)'s enforcement review.
- **Reported:** 2026-11-04

## Symptom

eess-md treats a file as Markdown when its path ends in `.md`. Everything else that is text is read
by line. GitHub renders more than `.md`: `.markdown`, `.MD`, `.rst`, `.adoc`, `.ipynb`, among
others, where `#L1` reaches nothing, and shows an `.svg` as an image, which has no lines either, (the rendered page has no line anchors, as
[spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md) decision 4 says of Markdown) and
a heading's anchor does. Measured: `[x](./a.markdown#L1)` and `[x](./a.rst#L1)` pass, and
`[x](./a.markdown#section)` is reported as "not Markdown" with the remedy "link a line of it as
`#L5`".

## Root cause

`unloadedVerdict` (`packages/md/src/model/resolve-link.ts`) decides by `path.endsWith('.md')`, the
same test `notInCorpusReasons` uses for `not-markdown`; neither knows which formats a host renders.

## Fix

Not designed. A decision first: whether the anchor rule names the formats its host renders (as it
names the directory page), and what a fragment on a rendered format that eess-md cannot parse
(`.rst`, `.ipynb`) is: not judged, most likely.

## Verification

- [ ] The decision recorded.
- [ ] Red first: `#L1` on a rendered file that is not `.md` is not passed.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
