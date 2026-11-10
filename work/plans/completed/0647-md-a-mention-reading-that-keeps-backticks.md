# Plan 0647: md: a mention reading that keeps backticks

## Status

- **State:** Done — built 2026-11-09 on `build/0647-keep-backticks`, reviewed the same day by the
  testing and method lenses, and closed in the same PR. Previously read: Ready — frozen 2026-11-09
  against `main` 22eae08d at the maintainer's "build plan 0647", with no separate review of the
  freeze (the design is the proposal's, reviewed four times); the freeze added two decisions the
  proposal had not reviewed (where the ranges are computed, `collectMentions`' opt-in). Authored
  the same day from
  [proposal 021](../../proposals/021-a-code-reference-points-at-the-code-it-names.md)'s ask A1, as
  ruled in its fourth Review. It is the first of three plans that own A1 between them; plans
  [0648](./0648-md-a-code-reference-still-appears-in-its-file.md) and
  [0649](../0649-md-a-code-reference-resolves-at-its-lines.md) build on it.
- **Implements:** [proposal 021](../../proposals/021-a-code-reference-points-at-the-code-it-names.md)
  (ask A1: the reading)
- **Priority:** High, as the proposal is. On its own it reports no new finding; the two conditions
  that follow need it.
- **Effort:** Small, about an hour.
- **Created:** 2026-11-09
- **Decided, each overrulable:**
  - **Ask A1 is split into three plans, by what ships alone:**
    - this reading;
    - `appearInTheirFile`, which needs no code facts;
    - `resolveAtTheirLines`, with the `CodeFacts` contract.

    Each one is an additive eess-md change, closable in its own PR, and about an hour or more of
    review. One plan over all three would leave its later phases open while the first shipped.

  - **The opt-in is `keepBackticks: true`** on `MentionOptions`, and **the field is
    `codeGroups`** on each mention, as [proposal 021](../../proposals/021-a-code-reference-points-at-the-code-it-names.md) names them.
  - **`codeGroups` is computed only under the opt-in.** Without it the field is absent, so a
    reading that did not ask for it cannot be mistaken for one in which no group is code.
  - **The ranges are computed where the run's text is joined**, in `findMentions`
    (`packages/md/src/model/mentions.ts`), decided at the freeze. The walk in `phrasing.ts` does not
    change: its segments already say which text is code (`inCode`).
  - **`collectMentions`**, the public lower-level reader (`packages/md/src/index.ts:154`), takes the
    same opt-in as an optional third argument `{ keepBackticks }`, decided at the freeze, so the two
    public readers cannot disagree.

## Problem

`mentions(corpus, { pattern })` runs the caller's pattern over a run's joined text, which drops
inline code's backticks (`packages/md/src/model/phrasing.ts:171-172`). So the reference form that
[proposal 021](../../proposals/021-a-code-reference-points-at-the-code-it-names.md) measured cannot be
read: `` `name` (`path:line`) `` reaches the pattern as `name (path:line)`. A pattern written
without backticks pairs prose words (2,108 matches here). `inCode` says only that some part of the
match is code, so a caller cannot require that the name is code. An escaped backtick earlier in a
paragraph can also shift the code spans so that a pattern written with backticks matches across
prose (1 in 472 matches here, in
[bug 0608](../../bugs/0608-an-emitter-finding-prints-its-message-twice.md) at line 25).

`MdMentionLink.text` already keeps the backticks for a link's text
(`packages/md/src/model/mentions.ts:43-47`), joined by `textOfSegments`
(`packages/md/src/model/phrasing.ts:149-154`). This plan gives a mention's own text the same reading
on request, and tells the caller which of its pattern's groups lie wholly inside one code span.

## Phase 1 — the opt-in and the field

```ts
export interface MentionOptions {
  readonly pattern: RegExp
  readonly resolve?: LinkResolveOptions
  /**
   * Run the pattern over the text with inline code's backticks kept, as `MdMentionLink.text` reads
   * a link's text, and say which of the pattern's named groups lie wholly inside one code span
   * (`codeGroups`). Off by default: the reading every existing rule uses does not change.
   */
  readonly keepBackticks?: boolean
}

export interface MdMentionMatch {
  // ...unchanged...
  /**
   * Under `keepBackticks`: the names of the pattern's groups whose whole capture lies inside one
   * inline-code span, between its backticks. Absent without the opt-in.
   */
  readonly codeGroups?: readonly string[]
}
```

- **The joined text** wraps each `inCode` segment in backticks, as `textOfSegments` does. While it
  joins, it records each code segment's interior range in the joined text.
- **The match** runs the caller's pattern with the `d` flag added to the private global copy
  (`globalCopy`, `packages/md/src/model/mentions.ts:91-97`), so each group has its range. A group's
  name is in `codeGroups` when its range lies inside one code segment's interior. A group that did
  not capture is not in it.
- **The span.** `MdMentionRef.span`, the source offsets for a fix, stays as today: present only when
  the match sits inside one segment. A match that runs across a code span's edge has none; a
  backtick that is prose does not cost a match its span. Per-group source offsets are ask C's, as
  the proposal records.
- **A link's text offset.** `offsetInLink` maps a match into its link's text, which is already
  joined with backticks. Under the opt-in, the segment starts it reads must be the backticked join's,
  so a mention inside a link keeps its `link.at` right. A test pins it.
- **The default reading is untouched.** Every existing test of `mentions()` passes without a
  change; that is the regression gate.

## Files changed

- `packages/md/src/model/mentions.ts`
- `packages/md/src/model/phrasing.ts` (added at the build review: unread text's backticked form)
- `packages/md/src/builders/mentions.ts`
- `packages/md/src/index.ts` (the type `MentionReading`, exported at build, named by no decision)
- `packages/md/tests/builders/mentions-keep-backticks.test.ts` (new)
- `docs/markdown.md`
- `packages/md/README.md`
- `.changeset/`

## Frozen inputs (by value, 2026-11-09)

The stock pattern, from [proposal 021](../../proposals/021-a-code-reference-points-at-the-code-it-names.md)'s
"Ask A1, rewritten 2026-11-09":

```js
const NAMED =
  /`(?<name>[A-Za-z_$][\w$.]*)(?:\([^`)]*\))?`(?<gap>[^`\n]{0,12})`(?<path>[\w./@-]+\.[A-Za-z]+):(?<line>\d+)(?:-(?<end>\d+))?`/
```

The forged case, minimal and in the shape of
[bug 0608](../../bugs/0608-an-emitter-finding-prints-its-message-twice.md)'s line 25. Each
backtick around `alpha` is escaped, so `alpha` is prose, while the pointer is a real code span:

```md
A literal \`alpha\` (`a.ts:1`) stands here.
```

Under the opt-in the joined text reads `` `alpha` (`a.ts:1`) ``, so the stock pattern matches.
`codeGroups` holds `path` and `line`, and not `name`.

## Test inventory

Through the public root, as an adopter calls it, in
`packages/md/tests/builders/mentions-keep-backticks.test.ts` (19 tests at close):

- [x] `` `pathSuffixIndex` (`packages/core/src/path-suffix.ts:48`) ``, read with the stock pattern
      under `keepBackticks`, yields one mention whose `groups` hold the name, path and line, and
      whose `codeGroups` holds `name`, `path` and `line`.
- [x] The same text without the opt-in: the stock pattern yields no mention, and `codeGroups` is
      absent from every mention another pattern finds, `collectMentions`' too.
- [x] The forged case, as frozen above: `codeGroups` holds `path` and `line`, not `name`. Added at
      the build review: [bug 0608](../../bugs/0608-an-emitter-finding-prints-its-message-twice.md)'s
      real shape (lines 23-26, by value: a backslash that ends a code span early), asserting a
      mention is found and none holds `name` in code. The frozen case is an escape in prose, not
      that shape (method review M2).
- [x] A code span holding a backtick counts as one code span, by its interior. Added at build: a
      group that straddles a code span and prose is left out.
- [x] A group that did not capture is absent from `codeGroups`. Added at build: a group spanning
      two code spans is left out, its `groups` pinned; added at the review: a group whose capture
      includes its own backticks is left out.
- [x] A match across a soft break, and a match inside a link's text, keep `codeGroups` right. Added
      at build: a match that opens on a link's first backtick keeps `link.offset` 0. Added at the
      review: a match that opens on the backtick of a code span holding a line break keeps its line.
- [x] `collectMentions` takes the same opt-in (added at the freeze).
- [x] done-otherwise — the span: the build's test could not fail (inline code carries no offsets;
      testing review I2). Replaced at the review by a match that runs from prose onto code (no span)
      beside one in prose (a span).
- [x] Added at the build review (testing C1, a fail-open the plan had not named): text the reading
      cannot see was still joined without backticks, so a pattern written with them never matched
      there and `md/unread-mention` stayed silent. Each unread text now carries its backticked form
      (`packages/md/src/model/phrasing.ts`), read under the opt-in; three tests pin a
      reference-style link, an unclosed `<a>` and an `<a>` that holds another link.
- [x] Added at the review: a caller's pattern that already carries the `d` flag, and one RegExp
      object read first without the opt-in and then with it.
- [x] Every existing `mentions()` test passes unchanged: the whole eess-md suite, 76 files and 1,284
      tests in 13 s, on the close commit's tree (the testing lens counted 1,277 in 14 s on 00461cb1).
- [ ] deferred→[plan 0648](./0648-md-a-code-reference-still-appears-in-its-file.md) The example
      under `examples/md/` and its two `check:nonvacuity` rows. An example would duplicate that
      plan's first condition, which is where a rule first judges this reading. Until 0648 lands, no
      `check:nonvacuity` row covers this reading; the package tests and the matrix below do.
- [x] The sabotage matrix, 2026-11-09, on 1c5ab821 in a worktree with its own `npm ci` and kernel
      build, one mutant at a time against the new test file only, which had 18 tests then (the
      fifteenth row ran after the nineteenth test was added). The restored tree red 0 before and
      after; every mutant red:

  | mutant                                                 | tests red |
  | ------------------------------------------------------ | --------- |
  | the opt-in ignored in the reading                      | 16        |
  | code groups by touch, not by inside                    | 3         |
  | a segment's region opens after its backtick            | 1         |
  | the builder drops the opt-in                           | 15        |
  | `collectMentions` drops the opt-in                     | 1         |
  | `codeGroups` given without the opt-in                  | 2         |
  | a caller's `d` flag not stripped                       | 1         |
  | one cache for both copies                              | 1         |
  | a group may include its own backticks                  | 1         |
  | the line clamp removed                                 | 1         |
  | a span given across segments                           | 1         |
  | unread text read without backticks                     | 1         |
  | a reference link keeps no backticked text              | 1         |
  | an unclosed `<a>` keeps no backticked text             | 1         |
  | an `<a>` holding another link keeps no backticked text | 1         |

  _The build's first matrix had six rows and was enumerated from intent: its third mutant first
  red 0, and the testing review found five more lines in the diff whose mutants survived the
  whole suite. Its counts were taken on the 11-test file, not on 0c3b48bb's 10 as first written
  (method review I1). The rows above add those mutants and the unread-text fix's three._

Deferred: [plan 0648](./0648-md-a-code-reference-still-appears-in-its-file.md) (the example and
its two rows).

## Out of scope

- The two conditions and the `CodeFacts` contract: plans
  [0648](./0648-md-a-code-reference-still-appears-in-its-file.md) and
  [0649](../0649-md-a-code-reference-resolves-at-its-lines.md).
- Per-group source offsets, for ask C's fix.
- A match across table cells, which a run cannot cross (`packages/md/src/model/phrasing.ts:279`).
