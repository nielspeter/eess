# Bug 0429: diagramKind reads a directive closed mid-line as still open

## Status

- **State:** Fixed — 2026-10-15, in the PR that closes it. Recorded the same day from PR #219's
  architect review.
- **Severity:** Medium — a selector that goes dead in silence: an `erDiagram` whose directive line ends
  in a comment is not selected by `tableErAgree`, so it is never checked (bug 0210's class).
- **Origin:** self-found · the architect review of plan 0413's re-freeze, 2026-10-15.
- **Reported:** 2026-10-15

## Symptom

```js
diagramKind('%%{init: {"theme":"dark"}}%% %% note\nerDiagram\n  A ||--o{ B : x') // ''
diagramKind('%%{init: {"theme":"dark"}}%%\nerDiagram\n  A ||--o{ B : x') // 'erDiagram'
```

The first block is valid Mermaid: the review measured the same directive line ahead of a `flowchart`
as `ok` in `mermaid` 11.17.2.

## Root cause

`declaredLine` in `packages/mermaid/src/parser/diagram-kind.ts` opened a directive when a line started
`%%{` and did not **end** `}%%`, and closed it only on a line that ended `}%%`. A directive
closed mid-line, followed by anything, stays open to the end of the block, so no kind is found.

## Fix

Close the directive at the first `}%%` on the line, wherever it is, and read what follows it as the
rest of the line. A red test first, through `diagramKind` and through `tableErAgree`'s selection.
Plan 0413's internal preamble walk extends this function, so the fix lands before that build or with
it; it is not part of plan 0413.

### As built

`declaredLine` closes a directive at its first `}%%`, on the line that opened it or a later one, and
reads the rest of that line as a line of its own: a comment, another directive, or the kind itself.
Measured first in `mermaid` 11.17.2 (the spike 0425/0428 harness), all five shapes the tests use
parse: a directive closed mid-line by a comment, a multi-line one closed mid-line, two on one line,
and the kind on the directive's own line, one-line and multi-line.

Both crossvalidate bindings select by `diagramKind`, so both change: `tableErAgree` now compares an
`erDiagram` behind such a line, and `embeddedDiagramsMatchCode` now skips a non-class diagram behind
one instead of reading it as a class diagram (a false red before, not a false green).

## Verification

- [x] Red test: the block above selects as `erDiagram` —
      `packages/mermaid/tests/parser/diagram-kind.test.ts`, with four more shapes; four of the five
      were red before the fix (two inits on one line already ended in `}%%`, and now guards the loop).
- [x] The same through `tableErAgree`: `packages/crossvalidate/tests/md-mermaid-er.test.ts`,
      `bad-init-mid-line-extra-attribute.md`. Also through `embeddedDiagramStats`
      (`packages/crossvalidate/tests/md-mermaid.test.ts`, `embedded-mid-line-directive.md`). Both
      measured red with the old `diagram-kind.ts` restored and eess-mermaid rebuilt, green with the
      fix.
- [x] Changeset: eess-mermaid `patch`; eess-crossvalidate named if its selection changes —
      done-otherwise: both take a `minor` marked `**Breaking**`, following bug 0424's changeset. Both
      crossvalidate selections change, a green build can go red, and the change reaches an adopter
      through an eess-mermaid upgrade alone, which a patch would deliver under a `^0.x` range.
- [x] `npm run validate` green.

Deferred: none
