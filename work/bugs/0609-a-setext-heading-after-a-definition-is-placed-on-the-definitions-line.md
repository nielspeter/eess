# Bug 0609: a setext heading after a definition is placed on the definition's line

## Status

- **State:** Draft — measured 2026-11-03 on `main` at 0916c03d, while fixing
  [bug 0572](./0572-a-definition-in-front-matter-hides-a-reference-in-the-body.md); no red test yet.
- **Severity:** Low — a finding names the wrong line, one or more lines early. The verdict is
  right. The shape is rare: a link reference definition directly above a setext heading's text.
- **Origin:** self-found · writing [bug 0572](./0572-a-definition-in-front-matter-hides-a-reference-in-the-body.md)'s red test.
- **Reported:** 2026-11-03

## Symptom

`[x]: ./a.md` on line 1, `b: c` on line 2 and `---` on line 3 is a definition and a depth-2 heading
`b: c`. mdast starts the heading's position at line 1, the definition's, not line 2
(`mdast-util-from-markdown`, measured: `definition@1 heading@1`). eess-md takes a section's line
from that position (`packages/md/src/model/document.ts:143`, through `lineOf` at `:103`), so a finding about the heading names
line 1. It was found through [bug 0572](./0572-a-definition-in-front-matter-hides-a-reference-in-the-body.md)'s withdrawn fix (PR #302), whose title finding named line 4 for a
heading `b: c` on line 5.

## Root cause

CommonMark reads the definition and the heading's text as one paragraph-like run before the
setext underline turns it into a heading; mdast's heading position spans the whole run. eess-md
reads `position.start.line` as the heading's line.

## Fix

Not designed. The direction: a heading's line is the line of its first child's text when the
heading is setext, or the line after the last definition that precedes it in the run. Measure
whether any other node type (a paragraph after definitions) carries the same offset into a
finding.

## Verification

- [ ] Red first: a heading after a definition is reported on its own text's line.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
