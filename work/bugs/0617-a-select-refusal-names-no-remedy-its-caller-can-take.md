# Bug 0617: a `select()` refusal names no remedy its caller can take

## Status

- **State:** Draft — measured 2026-11-04 by the review of
  [bug 0600](./fixed/0600-select-drops-an-unread-mention-without-a-word.md)'s fix; no red test yet.
- **Severity:** Low — fail-closed: the selection refuses, as it must; its message misleads.
- **Origin:** self-found · the enforcement review of [bug 0600](./fixed/0600-select-drops-an-unread-mention-without-a-word.md) and [bug 0601](./fixed/0601-a-mention-inside-an-html-link-is-reported-unread-though-the-link-is-read.md).
- **Reported:** 2026-11-04

## Symptom

`links().select()` and, since [bug 0600](./fixed/0600-select-drops-an-unread-mention-without-a-word.md), `mentions().select()` refuse through the kernel's
`refuseUndecided` when they reach a subject their builder cannot read. The refusal says "a predicate
cannot judge a subject" even when no predicate is involved, and its one remedy is the generic "use
`check()`"; the per-cause remedy the builder's own finding carries ("move the text out of the HTML
block", "write the link in Markdown") is dropped. For this repository's caller,
`scripts/check-corpus.mjs` (the skipped-mention count), "use `check()`" is not a step it can take:
it needs the count of a selection.

## Root cause

`refuseUndecided` (`@nielspeter/eess/internal`) builds one message for every caller and takes each
entry's `message` but no remedy.

## Fix

Not designed. The direction: an entry carries its remedy, as the builders' unread findings do, and
the refusal names the subject's cause rather than a predicate when the builder, not a predicate,
cannot read it.

## Verification

- [ ] Red first: a `mentions().select()` refusal over a raw HTML block names that cause and its
      remedy, and does not say a predicate cannot judge it.
- [ ] The same for `links().select()`.
- [ ] A changeset naming `@nielspeter/eess` and the dialects whose message changes.
- [ ] `npm run validate` green.

Deferred: none
