# Bug 0407: a wrapped code span reads as links to the link test

## Status

- **State:** Draft — measured 2026-10-07 in CI on PR #191. No red test yet.
- **Severity:** Low — a false red, not a false green, and only in this repository's own test. A
  correct record can fail CI while `check:corpus`, which reads the same file, stays green.
- **Origin:** self-found 2026-10-07: plan 0405's draft failed CI on it.
- **Reported:** 2026-10-07

## Symptom

`packages/ts/tests/docs/cross-document-links-resolve.test.ts` ·
`it('every link in adr/, bugs/, plans/, proposals/ and root prose points at a real file')` failed on
PR #191 with:

```
broken links:
  work/plans/0405-md-select-the-links-a-block-declares.md -> a.md
  work/plans/0405-md-select-the-links-a-block-declares.md -> b.md
```

The source was an example inside one code span that wrapped across two lines:

```
… with a labelled block (`**Related to:** [a](a.md) ·
[b](b.md)`, or the label followed by a list) …
```

`check:corpus` passed on the same commit.

## Reproduction

Put an inline code span containing a Markdown link across a line break in any file under `work/`,
then run `npx vitest run tests/docs/cross-document-links-resolve.test.ts` in `packages/ts`.

## Root cause

The test strips code before it reads links. Line 82 of
`packages/ts/tests/docs/cross-document-links-resolve.test.ts` is:

```ts
const INLINE_CODE = /`[^`\n]*`/g
```

The `\n` exclusion stops a code span at the end of a line. CommonMark lets a code span contain line
endings (they become spaces), up to a blank line, which ends the paragraph. So a wrapped span is
left in place and its contents are read as links. `check:corpus` parses Markdown with mdast, which
reads the span correctly, so the two link checkers disagree.

The same pattern also misreads a double-backtick span whose content holds a backtick, a form this
repository uses on purpose for cited test titles. That case is not this bug, and is noted so the fix
can cover it rather than rediscover it.

## Fix

Not designed. The recommended direction is for the test to read Markdown with mdast, as
`check:corpus` does. Simply allowing the pattern to cross line endings is **not** enough: a code
span also cannot cross a blank line and closes only on a backtick run of the same length, so a
pattern that ignores those rules lets one unmatched backtick blank everything up to the next one,
possibly paragraphs later. That would turn this false red into a false green, which is worse.

## Verification

- [ ] Red test written first: a code span wrapped across two lines, containing a link, is not
      reported
- [ ] a link outside any code span on such a line is still reported
- [ ] an unmatched backtick does not hide a real link in a later paragraph
- [ ] `npm run validate` green.

Deferred: none.
