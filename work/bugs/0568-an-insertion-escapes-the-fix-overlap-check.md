# Bug 0568: a zero-width fix (an insertion) escapes `applyFixes`' overlap check

## Status

- **State:** Draft — found by PR #283's architect review, 2026-10-30, by reading the code; latent:
  no fix in the family is zero-width today. No red test yet.
- **Severity:** Low — no runtime effect today; the first emitter of an insertion meets it.
- **Origin:** self-found · PR #283's architect review.
- **Reported:** 2026-10-30

## Symptom

`overlaps` (`packages/core/src/apply-fixes.ts:21`) is `a.start < b.end && b.start < a.end`. A fix
with `start === end` (an insertion) overlaps nothing under it, so it is applied beside any other
edit at its offset, and the outcome depends on the order the rules happened to report in.
Corrected 2026-10-30 from a measurement (the first version of this record described it wrongly,
PR #283's re-check): over `abcdef`, with `applyFixes(…, { write: true })` on main's build,

```text
two insertions at 2, X then Z                "abZXcdef" applied 2 skipped 0
two insertions at 2, Z then X                "abXZcdef" applied 2 skipped 0
insertion X, then replacement [2,4)->YY      "abYYdef" applied 2 skipped 0
replacement [2,4)->YY, then insertion X      "abXYYef" applied 2 skipped 0
```

Two insertions come out in reverse report order. An insertion reported before a replacement at
its offset is applied first, and the replacement's span then covers the inserted text: `abYYdef`
loses the insertion and keeps the `d` it should have replaced. Every case reports `skipped 0`.

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
