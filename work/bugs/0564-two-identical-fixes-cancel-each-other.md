# Bug 0564: two identical fixes cancel each other, so neither is applied

## Status

- **State:** Draft — found by PR #282's architect review, re-measured 2026-10-30; no red test yet.
- **Severity:** Medium — a missing capability: a fix two rules agree on is never applied by
  `--fix --apply`. It reports them as skipped, so nothing passes silently.
- **Origin:** self-found · PR #282's architect review.
- **Reported:** 2026-10-30

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

`const safe = fixes.filter((f) => !fixes.some((o) => o !== f && overlaps(f, o)))`
(`packages/core/src/apply-fixes.ts:49`) treats an identical fix as a conflicting one.

## Fix

Fold identical fixes (same file, start, end and replacement) into one before the overlap test, so
only fixes that disagree are dropped. A kernel change: it serves every dialect's fixes.

## Verification

- [ ] Red test written first: two identical fixes give `applied: 1`. Today `applied: 0, skipped: 2`.
- [ ] Two overlapping fixes that differ are still both dropped.
- [ ] A changeset naming `@nielspeter/eess`.
- [ ] `npm run validate` green.

Deferred: none
