# Plan 0647: md: a mention reading that keeps backticks

## Status

- **State:** Draft — authored 2026-11-09 from
  [proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md)'s ask A1, as
  ruled in its fourth Review. It is the first of three plans that own A1 between them; plans
  [0648](./0648-md-a-code-reference-still-appears-in-its-file.md) and
  [0649](./0649-md-a-code-reference-resolves-at-its-lines.md) build on it.
- **Implements:** [proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md)
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
    `codeGroups`** on each mention, as [proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md) names them.
  - **`codeGroups` is computed only under the opt-in.** Without it the field is absent, so a
    reading that did not ask for it cannot be mistaken for one in which no group is code.

## Problem

`mentions(corpus, { pattern })` runs the caller's pattern over a run's joined text, which drops
inline code's backticks (`packages/md/src/model/phrasing.ts:171-172`). So the reference form that
[proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md) measured cannot be
read: `` `name` (`path:line`) `` reaches the pattern as `name (path:line)`. A pattern written
without backticks pairs prose words (2,108 matches here). `inCode` says only that some part of the
match is code, so a caller cannot require that the name is code. An escaped backtick earlier in a
paragraph can also shift the code spans so that a pattern written with backticks matches across
prose (1 in 472 matches here, in
[bug 0608](../bugs/0608-an-emitter-finding-prints-its-message-twice.md) at line 25).

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
  the match sits inside one segment. Under the opt-in a match that holds a backtick crosses a code
  edge, so it has no span. Per-group source offsets are ask C's, as the proposal records.
- **The default reading is untouched.** Every existing test of `mentions()` passes without a
  change; that is the regression gate.

## Files changed

- `packages/md/src/model/phrasing.ts` (if the code-segment ranges come from the walk)
- `packages/md/src/model/mentions.ts`
- `packages/md/src/builders/mentions.ts`
- `packages/md/tests/builders/mentions-keep-backticks.test.ts` (new)
- `examples/md/a-mention-names-its-code.test.ts` (new)
- `scripts/check-nonvacuity.mjs`
- `docs/markdown.md`
- `packages/md/README.md`
- `.changeset/`

## Test inventory

Through the public root, as an adopter calls it:

- [ ] `` `pathSuffixIndex` (`packages/core/src/path-suffix.ts:48`) ``, read with the stock pattern
      under `keepBackticks`, yields one mention whose `groups` hold the name, path and line, and
      whose `codeGroups` holds `name`, `path` and `line`.
- [ ] The same text without the opt-in: the stock pattern yields no mention, and `codeGroups` is
      absent from every mention another pattern finds.
- [ ] The forged case: a paragraph with an escaped backtick before `` `name` `path:1` `` (the
      shape of [bug 0608](../bugs/0608-an-emitter-finding-prints-its-message-twice.md) at line 25)
      yields a match whose `name` group is in prose. `codeGroups` leaves `name` out.
- [ ] A code span holding a backtick (``` `` a`b `` ```) counts as one code span, by its
      interior.
- [ ] A group that did not capture is absent from `codeGroups`.
- [ ] A match across a soft break, and a match inside a link's text, keep `codeGroups` right.
- [ ] Every existing `mentions()` test passes unchanged.
- [ ] Two `check:nonvacuity` rows against `check:examples`, in the shape of
      `examples/md-mention-fix-exactly-one` (`scripts/check-nonvacuity.mjs:1313`). Each sabotages
      the built `dist` and asserts that a named test in the new example goes red:
  - `examples/md-keep-backticks-is-read`: the opt-in ignored, so the backticks are dropped. The
    test that counts one mention goes red.
  - `examples/md-code-groups-exclude-a-forged-span`: the inside-one-span test widened to "touches
    a code span". The forged-case test goes red.
- [ ] The sabotage matrix, run in a worktree with its own install, one mutant at a time against the
      new test files.

## Out of scope

- The two conditions and the `CodeFacts` contract: plans
  [0648](./0648-md-a-code-reference-still-appears-in-its-file.md) and
  [0649](./0649-md-a-code-reference-resolves-at-its-lines.md).
- Per-group source offsets, for ask C's fix.
- A match across table cells, which a run cannot cross (`packages/md/src/model/phrasing.ts:279`).
