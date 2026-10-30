# Bug 0568: a zero-width fix (an insertion) escapes `applyFixes`' overlap check

## Status

- **State:** Draft — found by PR #283's architect review, 2026-10-30, by reading the code; latent:
  no fix in the family is zero-width today. No red test yet.
- **Severity:** Low — no runtime effect today; the first emitter of an insertion meets it.
- **Origin:** self-found · PR #283's architect review.
- **Reported:** 2026-10-30

## Symptom

`overlaps` (`packages/core/src/apply-fixes.ts:21`) is `a.start < b.end && b.start < a.end`. A fix
with `start === end` (an insertion) overlaps nothing under it, so two different insertions at one
offset are both applied, in rule order, which is a guess; and an insertion at `s` beside a
replacement of `[s, e)` is not an overlap either, and the replacement, sorted to the same start,
removes the inserted text.

`movedLinkFix` and `beLinked`'s fix both replace a non-empty span, so nothing in the family
emits an insertion today. [Bug 0564](./fixed/0564-two-identical-fixes-cancel-each-other.md)'s fold already makes two identical insertions one edit.

## Fix

Treat two fixes as overlapping when their spans touch at a zero-width end (`a.start <= b.end &&
b.start <= a.end` where either is zero-width), so a different insertion beside or at another
edit is skipped, not guessed.

## Verification

- [ ] Red test written first: two different insertions at one offset are both skipped; an
      insertion at the start of a replacement is skipped with it.
- [ ] Two identical insertions are still one edit.
- [ ] A changeset naming `@nielspeter/eess`.
- [ ] `npm run validate` green.

Deferred: none
