# Bug 0429: diagramKind reads a directive closed mid-line as still open

## Status

- **State:** Draft — recorded 2026-10-15 from PR #219's architect review. Reproduced; no red test yet.
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

`packages/mermaid/src/parser/diagram-kind.ts:32` opens a directive when a line starts `%%{` and does
not **end** `}%%`, and `diagram-kind.ts:29` closes it only on a line that ends `}%%`. A directive
closed mid-line, followed by anything, stays open to the end of the block, so no kind is found.

## Fix

Close the directive at the first `}%%` on the line, wherever it is, and read what follows it as the
rest of the line. A red test first, through `diagramKind` and through `tableErAgree`'s selection.
Plan 0413's internal preamble walk extends this function, so the fix lands before that build or with
it; it is not part of plan 0413.

## Verification

- [ ] Red test: the block above selects as `erDiagram`
- [ ] The same through `tableErAgree`
- [ ] Changeset: eess-mermaid `patch`; eess-crossvalidate named if its selection changes

Deferred: none
