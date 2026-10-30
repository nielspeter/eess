# Bug 0561: a code pointer one line past the end of a file that ends in a newline passes

## Status

- **State:** Draft — found by PR #280's method review, re-measured on the v0.16.0 build (eess-md
  0.13.0), Node 24.22.0; no red test yet.
- **Severity:** High — a false green: a pointer to a line the file does not have passes, and the
  stale-pointer message miscounts the file's lines.
- **Origin:** self-found · PR #280's method review, reading
  [bug 0559](./0559-a-code-pointer-is-matched-from-inside-its-path.md)'s reproduction, where a
  two-line file is reported as having 3 lines.
- **Reported:** 2026-10-30

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

`lineCount` is `readCorpusFile(corpus, rel).split('\n').length`
(`packages/md/src/conditions/pointer-resolve.ts:101`), which counts the empty string after a final
newline as a line, and an empty file as one line.

## Fix

Count lines as an editor numbers them: a final newline ends the last line rather than starting a
new one, and an empty file has no lines. The same count serves the message.

## Verification

- [ ] Red test written first: a pointer to line 3 of a two-line file ending in a newline is
      reported stale. Green today.
- [ ] A pointer to line 1 of an empty file is reported stale.
- [ ] The message gives the file's real line count (2, not 3).
- [ ] A pointer to the last line of a file with and without a final newline still passes.
- [ ] A nonvacuity row reddens on a pointer one line past the end.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
