# Bug 0416: the link test reads an indented fence as prose

## Status

- **State:** Draft — measured 2026-10-14 on PR #207's CI run: a ` ```md ` example indented inside
  a list item in [bug 0414](./0414-a-label-after-a-soft-break-is-reported-never-read.md) failed this test, which reported the example's link to `a.md` as broken. No red test yet.
- **Severity:** Medium — a false red (`BUGS.md`'s Medium row). The test reports a link inside a code
  example as a broken link, so an author has to move or reshape a correct example to get green.
- **Origin:** self-found · CI on PR #207, 2026-10-14.
- **Reported:** 2026-10-14

## Symptom

`packages/ts/tests/docs/cross-document-links-resolve.test.ts` strips code before collecting links, so
an example link is not checked. It strips a fence only when the fence opens at column 0. A fence
indented under a list item, which CommonMark reads as a code block inside the item, keeps its body, and
an example link in it is reported as broken.

## Root cause

`FENCE = /^```[\s\S]*?^```/gm` (`packages/ts/tests/docs/cross-document-links-resolve.test.ts:81`)
anchors the fence at the start of a line, with no indentation allowed. It is a regex reading of
Markdown, which is the class of defect [bug 0290](./fixed/0290-a-code-block-nested-in-a-list-is-never-checked.md) fixed in eess-md: a code block nested in a list is
not seen.

The repository's other link gate, `check:corpus`, reads links through eess-md's mdast, and did not
report this one.

## Fix

Not designed. Two candidates:

- read the documents through eess-md (`corpus()` and its links), as `check:corpus` does, so both gates
  agree on what is code;
- or allow up to three spaces of indentation (and the list's content column) in the fence regex.

The first removes a second Markdown reader; the second is smaller and keeps one.

## Verification

- [ ] Red test first: a fixture with an example link inside a fence indented under a list item is not
      reported. A sabotage row goes red when that is undone.
- [ ] A real broken link in prose beside it is still reported.
- [ ] `npm run validate` green.

Deferred: none.
