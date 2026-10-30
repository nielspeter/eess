# Bug 0564: two identical fixes cancel each other, so neither is applied

## Status

- **State:** Fixed — 2026-10-30, `sameEdit` in `packages/core/src/apply-fixes.ts` folds identical
  fixes before the overlap test. Found by PR #282's architect review.
- **Severity:** Medium — a missing capability: a fix two rules agree on is never applied by
  `--fix --apply`. It reports them as skipped, so nothing passes silently.
- **Origin:** self-found · PR #282's architect review.
- **Reported:** 2026-10-30 · **Fixed:** 2026-10-30 (PR #283)

## Symptom

`applyFixes` drops every fix that overlaps another, so as never to write a guess. Two rules that
find the same broken link propose the same fix: same file, same span, same replacement. Those two
are not in conflict, but they overlap, so both are dropped and the fix is never written.

## Reproduction

`docs/a.md` holds `**Related to:** [b](./old/b.md)`, and `docs/new/b.md` exists. One rule
`links(c).should().resolve()` and one `links(c).that().areLabelled('Related to').should().beLinkedBack()`
both report the link with a fix. Their findings passed to the kernel's `applyFixes` (from
`@nielspeter/eess/internal`) with `write: false`, measured:

```text
fixes: [ '25-35 ./new/b.md', '25-35 ./new/b.md' ]
applyFixes(dry run): {"applied":0,"skipped":2,"files":[],"descriptions":[]}
```

## Root cause

Before PR #283, `const safe = fixes.filter((f) => !fixes.some((o) => o !== f && overlaps(f, o)))`
(`packages/core/src/apply-fixes.ts:49`) treated an identical fix as a conflicting one.

## Fix

Fold identical fixes (same file, start, end and replacement) into one before the overlap test, so
only fixes that disagree are dropped. A kernel change: it serves every dialect's fixes.

## Verification

- [x] Red test written first: two identical fixes give `applied: 1`. `packages/core/tests/apply-fixes.test.ts`,
      red before the fix; with the fold removed it is red again. End to end,
      `packages/md/tests/autofix.test.ts` runs `resolve()` and `beLinkedBack()` over one moved link
      and applies the one fix, once, over the URL and not the title holding the same text.
- [x] Two overlapping fixes that differ are still both dropped: an identical pair beside a fix
      that disagrees with it is all three skipped.
- [x] A changeset naming `@nielspeter/eess` (`.changeset/a-fix-lands-on-the-url-once.md`).
- [x] `npm run validate` green.

Deferred: none
