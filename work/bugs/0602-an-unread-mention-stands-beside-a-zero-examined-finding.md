# Bug 0602: an unread mention stands beside a zero-examined finding

## Status

- **State:** Draft — measured 2026-11-01 on `main` at 7daac794; closed by
  [plan 0580](../plans/0580-md-a-raw-html-link-is-resolved.md)'s shared unread helper (its R5),
  which `links()` also uses.
- **Severity:** Medium — the receipt contradicts itself: it says the rule could not read a mention
  and, beside that, that the emptiness was declared or that nothing was examined. The build is red
  either way, but the generic finding sends an author to `.expectEmpty()` or to the selector.
- **Origin:** self-found · the architect's second re-check of
  [plan 0580](../plans/0580-md-a-raw-html-link-is-resolved.md)'s freeze, which found that sharing
  `mentions()`'s helper unchanged would copy this into `links()`.
- **Reported:** 2026-11-01

## Symptom

[ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) rule 7: a rule whose
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

`mentions()`'s `collectViolations` (`packages/md/src/builders/mentions.ts:135`) takes the kernel's
finished verdict, which already holds the zero-examined finding and `declaredEmpty`, and appends the
unread findings to it. They are not counted in `undecided`, the count the terminal reads to withhold
both (`packages/core/src/terminal-builder.ts:290`).

## Fix

The unread helper that [plan 0580](../plans/0580-md-a-raw-html-link-is-resolved.md) shares between
`mentions()` and `links()` counts each reached unread finding as undecided, so the terminal withholds
the generic finding and `declaredEmpty`. Built in that plan's Phase 1, since it is the same code path.

## Verification

- [ ] Red first: the reproduction's `beLinked()` returns only `md/unread-mention`.
- [ ] `notExist()` over it has no `declaredEmpty`.
- [ ] A document with a read mention beside an unread one is unchanged.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
