# Bug 0565: the front-matter guard keeps its own copy of the external-URL test

## Status

- **State:** Draft — found by PR #282's architect re-check, 2026-10-30; no red test yet.
- **Severity:** Low — code drift with no runtime effect today: the two patterns are identical.
- **Origin:** self-found · PR #282's architect re-check.
- **Reported:** 2026-10-30

## Symptom

`packages/md/src/model/prose.ts:32` declares `EXTERNAL`, a copy of `EXTERNAL_RE`
(`packages/md/src/model/links.ts:68`). [Plan 0549](../plans/completed/0549-a-link-names-the-record-it-mentions.md) exported `EXTERNAL_RE` so that
`mentions()` and `links()` could not disagree about which link points outside the repository. The
front-matter guard decides with its own copy which links it must not hide, and since PR #282 it
judges reference-style links with it too, so a change to one pattern would split what the guard
and `links()` call internal.

## Fix

Import `EXTERNAL_RE` in `prose.ts` (`links.ts` does not import `prose.ts`, so no cycle) and remove
the copy.

## Verification

- [ ] `prose.ts` reads `EXTERNAL_RE`; no second copy of the pattern is left in `packages/md/src`.
- [ ] `npm run validate` green.

Deferred: none
