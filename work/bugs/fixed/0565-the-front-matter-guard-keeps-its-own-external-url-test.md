# Bug 0565: the front-matter guard keeps its own copy of the external-URL test

## Status

- **State:** Fixed — one pattern in `packages/md/src/model/external.ts`, read by both (PR #285).
- **Severity:** Low — code drift with no runtime effect today: the two patterns are identical.
- **Origin:** self-found · PR #282's architect re-check.
- **Reported:** 2026-10-30

## Symptom

`packages/md/src/model/prose.ts` declared `EXTERNAL`, a copy of `EXTERNAL_RE`, which `links.ts`
declared itself. [Plan 0549](../../plans/completed/0549-a-link-names-the-record-it-mentions.md) exported `EXTERNAL_RE` so that
`mentions()` and `links()` could not disagree about which link points outside the repository. The
front-matter guard decides with its own copy which links it must not hide, and since PR #282 it
judges reference-style links with it too, so a change to one pattern would split what the guard
and `links()` call internal.

## Fix

Import `EXTERNAL_RE` in `prose.ts` (`links.ts` does not import `prose.ts`, so no cycle) and remove
the copy.

The premise was wrong: `links.ts` imports `sections.ts`, which, with [bug 0410](./0410-front-matter-read-as-markdown-says-nothing.md)'s fix in the
same PR, imports `prose.ts`, so `prose.ts` importing `links.ts` would close a cycle. Built
instead: `EXTERNAL_RE` moved to its own module (`packages/md/src/model/external.ts:6`), which
`prose.ts` and `links.ts` both import; `links.ts` re-exports it, so its existing importers are
unchanged.

## Verification

- [ ] done-otherwise: `prose.ts` reads `EXTERNAL_RE` from `model/external.ts`, not from `links.ts`
      (see Fix); no second copy of the pattern is left in `packages/md/src` (grep, 2026-10-31: one
      declaration).
- [x] `npm run validate` green.

Deferred: none
