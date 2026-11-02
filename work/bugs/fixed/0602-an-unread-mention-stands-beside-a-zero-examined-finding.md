# Bug 0602: an unread mention stands beside a zero-examined finding

## Status

- **State:** Fixed — the shared unread helper (`packages/md/src/builders/unread.ts`) counts each
  reached unread finding as undecided, built by [plan 0580](../../plans/0580-md-a-raw-html-link-is-resolved.md)'s Phase 1 (PR #296).
- **Severity:** Medium — the receipt contradicts itself: it says the rule could not read a mention
  and, beside that, that the emptiness was declared or that nothing was examined. The build is red
  either way, but the generic finding sends an author to `.expectEmpty()` or to the selector.
- **Origin:** self-found · the architect's second re-check of
  [plan 0580](../../plans/0580-md-a-raw-html-link-is-resolved.md)'s freeze, which found that sharing
  `mentions()`'s helper unchanged would copy this into `links()`.
- **Reported:** 2026-11-01

## Symptom

[ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) rule 7: a rule whose
only subjects are undecided reports them, and neither the generic zero-examined finding nor a
declared emptiness beside them. Over a document whose only mention is unread, measured against
`packages/md/dist` (0.14 s):

```js
const c = corpusFromText({ 'a.md': '# A\n\n<div>\nbug 0001\n</div>\n' })
const m = () => mentions(c, { pattern: /\bbug (?<id>\d{4})\b/g })
m().should().beLinked().violations() // md/unread-mention, and "this rule examined zero units …"
m().should().notExist().violations() // md/unread-mention, with declaredEmpty: true on the receipt
```

## Root cause

`mentions()`'s `collectViolations` (`packages/md/src/builders/mentions.ts:135`) appends the unread
findings to the kernel's violations and returns a receipt whose `undecided` does not count them. The
terminal runs after it and reads that count: with `examined` 0 and `undecided` unset, it adds the
generic zero-examined finding and sets `declaredEmpty` (`packages/core/src/terminal-builder.ts:290`),
beside the unread findings it was handed.

## Fix

The unread helper that [plan 0580](../../plans/0580-md-a-raw-html-link-is-resolved.md) shares between
`mentions()` and `links()` counts each reached unread finding as undecided, so the terminal withholds
the generic finding and `declaredEmpty`. Built in that plan's Phase 1, since it is the same code path.

## Verification

- [x] Red first: the reproduction's `beLinked()` returns only `md/unread-mention`
      (`packages/md/tests/builders/mentions-html-reader.test.ts`; red with the count removed).
- [x] `notExist()` over it has no `declaredEmpty`.
- [x] A document with a read mention beside an unread one is unchanged.
- [x] A changeset naming `@nielspeter/eess-md` (`.changeset/one-html-reader.md`).
- [x] `npm run validate` green.

Deferred: none
