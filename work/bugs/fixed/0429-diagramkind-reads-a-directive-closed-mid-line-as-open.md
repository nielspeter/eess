# Bug 0429: diagramKind reads a directive closed mid-line as still open

## Status

- **State:** Fixed — 2026-10-15, in the PR that closes it. Recorded the same day from PR #219's
  architect review.
- **Severity:** Medium — a selector that goes dead in silence: an `erDiagram` whose directive line ends
  in a comment is not selected by `tableErAgree`, so it is never checked ([bug 0210](./0210-er-fence-selector-is-an-allowlist.md)'s class).
- **Origin:** self-found · the architect review of [plan 0413](../../plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md)'s re-freeze, 2026-10-15.
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
closed mid-line, followed by anything, stayed open to the end of the block, so no kind was found.

## Fix

Close the directive at the first `}%%` on the line, wherever it is, and read what follows it as the
rest of the line. A red test first, through `diagramKind` and through `tableErAgree`'s selection.
[Plan 0413](../../plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md)'s internal preamble walk extends this function, so the fix lands before that build or with
it; it is not part of [plan 0413](../../plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md).

### As built

`declaredLine` closes a directive at its first `}%%`, on the line that opened it or a later one, and
reads the rest of that line as a line of its own: a comment, another directive, or the kind itself.
Measured first in `mermaid` 11.17.2, with the [spike 0425](../../spikes/0425-what-mermaid-in-a-worker-does-under-vitest-and-the-cli.md)/0428 worker harness (`mermaid.parse` per
block, in a scratch directory not kept in the repository): every shape the tests use returned
`{ ok: true }` — a directive closed mid-line by a comment, a multi-line one closed mid-line, two on one
line, the kind on the directive's own line (one-line, multi-line, and after two directives).

Both crossvalidate bindings select by `diagramKind`, so both change. `embeddedDiagramsMatchCode` now
skips a non-class diagram behind such a line instead of reading it as a class diagram (a false red
before, not a false green). `tableErAgree` now selects an `erDiagram` behind one, but compares it only
where eess-mermaid's ER grammar parses it: behind a one-line directive ended by a comment, or two on
one line. With the kind on the directive's own line, or behind a multi-line directive, the grammar
fails and the block is reported as a grammar gap (PR #223's reviews, measured); before, it was skipped
in silence. The one-line case is [bug 0433](../0433-a-kind-on-its-directives-line-is-a-comment-to-eess-mermaids-grammars.md);
the multi-line one was already disclosed under [bug 0409](./0409-md-mermaid-blames-the-author-for-a-grammar-gap.md).

This fix also takes away the block [plan 0413](../../plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md) chose to show Mermaid's `ok` winning over the walk, since
the walk no longer misreads it; [plan 0413](../../plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md) carries a dated note.

## Verification

- [x] Red test: the block above selects as `erDiagram` —
      `packages/mermaid/tests/parser/diagram-kind.test.ts`, with five more shapes; four of the first
      five were red before the fix (two inits on one line already ended in `}%%`). The loop that reads
      several directives on one line is guarded by `'on the line of two inits'`: measured, a single
      `if` in its place reds that row alone.
- [x] The same through `tableErAgree`: `packages/crossvalidate/tests/md-mermaid-er.test.ts`,
      `bad-init-mid-line-extra-attribute.md`. Also through `embeddedDiagramStats`
      (`packages/crossvalidate/tests/md-mermaid.test.ts`, `embedded-mid-line-directive.md`). Both
      measured red with the old `diagram-kind.ts` restored and eess-mermaid rebuilt, green with the
      fix. And the kind on the directive's line, pinned as a grammar-gap finding
      (`bad-init-kind-same-line-extra-attribute.md`), so that outcome is decided, not incidental.
- [x] Changeset: eess-mermaid `patch`; eess-crossvalidate named if its selection changes —
      done-otherwise: both take a `minor` marked `**Breaking**`, as crossvalidate 0.8.0's entries for
      changes made upstream in eess-mermaid and eess-md did (8fc6953, 9287323). Both crossvalidate
      selections change, a green build can go red, and the change reaches an adopter through an
      eess-mermaid upgrade alone, which a patch would deliver under a `^0.x` range.
- [x] `npm run validate` green.

Deferred: none
