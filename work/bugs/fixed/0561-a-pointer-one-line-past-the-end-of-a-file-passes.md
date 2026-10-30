# Bug 0561: a code pointer one line past the end of a file that ends in a newline passes

## Status

- **State:** Fixed — 2026-10-30, `linesIn` in `packages/md/src/conditions/pointer-resolve.ts`,
  used at both line-count sites. Found by PR #280's method review, re-measured on the v0.16.0
  build (eess-md 0.13.0), Node 24.22.0.
- **Severity:** High — a false green: a pointer to a line the file does not have passes, and the
  stale-pointer message miscounts the file's lines.
- **Origin:** self-found · PR #280's method review, reading
  [bug 0559](../0559-a-code-pointer-is-matched-from-inside-its-path.md)'s reproduction, where a
  two-line file is reported as having 3 lines.
- **Reported:** 2026-10-30 · **Fixed:** 2026-10-30 (PR #281)

## Symptom

A file holding `a`, `b` and a final newline has two lines. `pointers().should().resolve()` counts
three, so a pointer to line 3 passes, and a pointer to line 4 is reported against "3 lines". An
empty file counts as one line, so a pointer to its line 1 passes.

## Reproduction

`src/two.ts` holding `a\nb\n`, `src/bare.ts` holding `a\nb`, `src/empty.ts` empty, and one document
under `docs/**` listing the pointers `src/two.ts` line 2, 3 and 4, `src/bare.ts` line 3 and
`src/empty.ts` line 1 (written as `path:line` in the probe; given in words here, since a pointer in
this record's prose would be read by the gate). Measured:

```text
p561: examined 5 · violations 2
   line 5 stale code pointer: src/two.ts has 3 lines; "src/two.ts:4" references line 4
   line 6 stale code pointer: src/bare.ts has 2 lines; "src/bare.ts:3" references line 3
```

`src/two.ts` line 3 and `src/empty.ts` line 1 pass. The file without a final newline is counted
right.

## Root cause

Two sites count lines with `split('\n').length`, which counts the empty string after a final
newline as a line, and an empty file as one line:

- `lineCount`, `readCorpusFile(corpus, rel).split('\n').length`
  (`packages/md/src/conditions/pointer-resolve.ts:101`), for a file in the repository;
- `readFileSync(abs, 'utf8').split('\n').length` (`packages/md/src/conditions/pointer-resolve.ts:179`),
  for a file under an external root ([plan 0069](../../plans/completed/0069-spec-corpus-reach.md)'s path).
  Measured by PR #280's enforcement re-check: with an external root holding a two-line file ending
  in a newline, line 3 passes and line 4 is reported against "3 lines".

## Fix

One count for both sites: a final newline ends the last line rather than starting a new one, and
an empty file has no lines. The same count serves the message.

Builds that are green today go red where a pointer cites the phantom line, so the changeset marks
it `**Breaking (@nielspeter/eess-md):**`, a minor on 0.x. This repository stays green: none of its
live pointers that resolve to one file cites that line (PR #280's enforcement re-check).

## Verification

- [x] Red test written first: a pointer to line 3 of a two-line file ending in a newline is
      reported stale. Green before the fix: `packages/md/tests/pointers.test.ts`, the
      `bug 0561` block, ran 4 failed before `linesIn` and passes after.
- [x] A pointer to line 1 of an empty file is reported stale ("has 0 lines").
- [x] The same row under an external root: a pointer to line 6 of the five-line
      `Thing.groovy` fixture is stale.
- [x] No false red: a CRLF file, a file ending in a blank line (`a\nb\n\n`, where line 3 is real)
      and a range ending on the last line all pass (one exact list of findings pins it).
- [x] The message gives the file's real line count (2, not 3). Two existing tests had pinned the
      old count ("3 lines" for a two-line file, "6 lines" for a five-line one, whose own comment
      said 5); both now assert the real count.
- [x] A pointer to the last line of a file with and without a final newline still passes.
- [x] A nonvacuity row reddens on a pointer one line past the end of a file that ends in a
      newline: done-otherwise, in place, not a new row (gate cost, [bug 0552](../0552-nonvacuity-shard-3-runs-near-its-timeout.md)).
      `corpus/pointers/work-root` plants a two-line `.ts` beside its probe and asserts the stale
      finding with "has 2 lines"; with the old count put back into the built file the finding is
      gone, so the row is red.
- [x] A changeset naming `@nielspeter/eess-md`, marked `**Breaking (@nielspeter/eess-md):**`
      (`.changeset/a-pointer-past-the-end-is-stale.md`).
- [x] `npm run validate` green.

Deferred: none
