# Bug 0600: `select()` drops an unread mention without a word

## Status

- **State:** Draft — measured 2026-11-01 on `main` at 7daac794; no red test yet.
- **Severity:** High — a false green: a `correspondence()` side built from `mentions().select()`
  misses every mention eess-md cannot read, and nothing says so.
- **Origin:** self-found · the architect's re-check of
  [plan 0580](../plans/0580-md-a-raw-html-link-is-resolved.md)'s freeze, which found that the plan's
  `links()` would copy the gap; that plan closes it for `links()` (its R7) and records `mentions()`'s
  here.
- **Reported:** 2026-11-01

## Symptom

`mentions()` reports a mention it cannot read (inside a raw HTML block, an HTML link, an image's
alt text …) as `md/unread-mention`, unsuppressable
([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)). But
`mentions().select()` is the kernel's `select()` (`packages/core/src/rule-builder.ts:195`), which
returns only the elements, and an unread mention is not one. So the selection omits it and hands
nothing back. [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) rule 6 and
[ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) say a door that hands no
findings back refuses.

## Reproduction

Against `packages/md/dist`, 0.14 s:

```js
const c = corpusFromText({ 'a.md': '# A\n\n<div>\nbug 0001\n</div>\n\nbug 0002.\n' })
const m = () => mentions(c, { pattern: /\bbug (?<id>\d{4})\b/g })
m().select({ label: 'mentions', identify }) // one element, line 7; nothing about line 4
m().should().beLinked().violations() // line 7, and md/unread-mention at line 4
```

## Fix

Not designed. The direction: `mentions().select()` refuses, as a configuration finding naming each
cause, when its predicates reach an unread mention, the way
[plan 0580](../plans/0580-md-a-raw-html-link-is-resolved.md)'s R7 has `links().select()` refuse.
Both use the unread helper that plan shares between the two builders (its R5), so the fix is best
built on it.

## Verification

- [ ] Red first: the reproduction's `select()` refuses, naming line 4's cause.
- [ ] A document with no unread mention selects as today.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
