# Bug 0560: a link that differs from its file only in Unicode normalization is called broken, without saying why

## Status

- **State:** Draft — measured on the v0.16.0 build (eess-md 0.13.0), Node 24.22.0, on Linux; no red
  test yet.
- **Severity:** Medium — whether or not the verdict stands (see Fix), the message does not name
  the cause, so the author looks for a missing file that is there. Amended 2026-10-30 after PR
  #280's method and enforcement reviews.
- **Origin:** self-found · the maintainer's question, 2026-10-30, about letters outside ASCII.
- **Reported:** 2026-10-30

## Symptom

A letter such as `ü` has two encodings: one code point (NFC, `U+00FC`) or `u` followed by a
combining diaeresis (NFD, `U+0075 U+0308`). They look the same in an editor and in a file
browser. A link written in one form to a file named in the other is reported as

```text
broken link: "./übersicht.md" does not resolve to a file in the repo
```

and the file is in the folder, under the name the reader sees in the link. Nothing in the message
says the two differ in encoding only.

## Reproduction

A file `docs/übersicht.md` created with an NFD name, and `docs/home.md` holding `# Home`, a blank
line and `[NFC link to an NFD file](./übersicht.md)` with the link written NFC.
`links(corpus({ cwd, roots: ['docs/**'] })).should().resolve().violations()`, measured on Linux:

```text
links: examined 1 · violations 1
  line 3 broken link: "./übersicht.md" does not resolve to a file in the repo
```

## Root cause

The resolver compares the link's path with the corpus's file index as strings
(`packages/md/src/model/resolve-link.ts`), and the message is built in
`packages/md/src/conditions/resolve.ts:70` with no near-miss check for this case. It has one for a
link that misses by a directory (`directoryHint`).

## Why it matters

Which form a name has depends on the tool that created it: macOS file systems have historically
produced NFD names, and git on macOS is said to store NFC by default (`core.precomposeunicode`;
not measured here, since this was measured on Linux). So the case is likely rare in a repository, and when it happens the message sends the author looking for a file that
exists. Whether the link works for a reader depends on the platform serving it, so the verdict is
a decision to state, not a fix to assume.

## Fix

Not chosen. At least: when the link's path and an indexed file are equal after NFC normalization,
the message says so and names both forms. Whether such a link should resolve instead is the
question to answer first, together with the same question for pointers in
[bug 0559](./0559-a-code-pointer-is-matched-from-inside-its-path.md) and for fragments in
[bug 0136](./0136-link-fragments-are-never-checked.md).

"Resolve instead" is the direction that can make a false green: if GitHub serves such a link as a
404, resolving it would pass a link that is broken for every reader. So it needs a measurement of
what GitHub serves first, and a nonvacuity row if chosen.

## Verification

- [ ] Red test written first: the reproduction's message names the encoding difference. Today it
      says only "does not resolve".
- [ ] The decision (report with the cause, or resolve) is written in the record before the fix,
      with what GitHub serves for such a link measured.
- [ ] The same for a pointer: an NFC pointer to an NFD-named file gets the same verdict and message
      as a link. This row is written after
      [bug 0559](./0559-a-code-pointer-is-matched-from-inside-its-path.md)'s fix: today the pointer
      is truncated before normalization matters, so it cannot be red for this cause first.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
