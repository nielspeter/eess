# Bug 0600: `select()` drops an unread mention without a word

## Status

- **State:** Fixed — `mentions().select()` refuses when it reaches an unread mention (2026-11-04).
  Measured 2026-11-01 on `main` at 7daac794.
- **Severity:** High — a false green: a `correspondence()` side built from `mentions().select()`
  misses every mention eess-md cannot read, and nothing says so.
- **Origin:** self-found · the architect's re-check of
  [plan 0580](../../plans/completed/0580-md-a-raw-html-link-is-resolved.md)'s freeze, which found that the plan's
  `links()` would copy the gap; that plan closes it for `links()` (its R7) and records `mentions()`'s
  here.
- **Reported:** 2026-11-01

## Symptom

`mentions()` reports a mention it cannot read (inside a raw HTML block, an HTML link, an image's
alt text …) as `md/unread-mention`, unsuppressable
([ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)). But
`mentions().select()` is the kernel's `select()` (`packages/core/src/rule-builder.ts:195`), which
returns only the elements, and an unread mention is not one. So the selection omits it and hands
nothing back. [ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) rule 6 and
[ADR-014](../../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) say a door that hands no
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
[plan 0580](../../plans/completed/0580-md-a-raw-html-link-is-resolved.md)'s R7 has `links().select()` refuse.
Both use the unread helper that plan shares between the two builders (its R5), so the fix is best
built on it.

**Built 2026-11-04.** `MentionRuleBuilder.select` (`packages/md/src/builders/mentions.ts:147`)
takes the unread mentions its predicates reach (`reachedUnread`, the helper [plan 0580](../../plans/completed/0580-md-a-raw-html-link-is-resolved.md)'s R5 shares)
and refuses through the kernel's `refuseUndecided`, one entry per mention naming its line and where
it sits, before the kernel's selection; as `links().select()` does (R7). This repository's gate
(`scripts/check-corpus.mjs`) selects mentions three times: the record-mention join and two counts.
Measured by its validate: a probe holding an unread mention made the gate stop on the refusal. The
gate now catches the refusal, skips the join, and reports in its place that the join did not run
(`corpus/record-mention-target`), beside the unsuppressable `md/unread-mention` the `beLinked()`
rule already reports; the `corpus/record-mention/unread` non-vacuity probe asserts both, and the
`a-link-names-the-record-it-mentions` example now expects its join to refuse.

## Verification

- [x] Red first: the reproduction's `select()` refuses, naming line 4's cause:
      `packages/md/tests/builders/mentions-select-unread.test.ts` · `it('refuses, naming the unread mention’s line and cause')`, red on main.
- [x] A document with no unread mention selects as today: `it('a document with no unread mention selects as before')`;
      and one a predicate leaves out does not refuse: `it('an unread mention a predicate leaves out does not refuse')`.
- [x] A changeset naming `@nielspeter/eess-md`: `.changeset/mentions-select-refuses-an-unread-mention.md`.
- [x] `npm run validate` green.

Deferred: none
