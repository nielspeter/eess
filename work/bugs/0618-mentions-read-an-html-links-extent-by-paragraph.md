# Bug 0618: `mentions()` reads an HTML link's extent by paragraph, not as a browser does

## Status

- **State:** Draft — measured 2026-11-04 by the review of
  [bug 0601](./fixed/0601-a-mention-inside-an-html-link-is-reported-unread-though-the-link-is-read.md)'s
  fix, on main as well; no red test yet.
- **Severity:** Low — a false red and a wrong target, neither a pass of something broken.
- **Origin:** self-found · the enforcement review of [bug 0600](./fixed/0600-select-drops-an-unread-mention-without-a-word.md) and [bug 0601](./fixed/0601-a-mention-inside-an-html-link-is-reported-unread-though-the-link-is-read.md).
- **Reported:** 2026-11-04

## Symptom

Two shapes, both before [bug 0601](./fixed/0601-a-mention-inside-an-html-link-is-reported-unread-though-the-link-is-read.md)'s fix and after it:

1. An `<a href>` inside a Markdown link: `[see <a href="./c.md">issue 12</a>](./b.md)`. The mention
   is judged by the Markdown link's target, `./b.md`; a browser follows the inner `<a>`, `./c.md`.
2. An `<a href>` whose `</a>` sits in a later paragraph or list item: the walk reads one block at a
   time, so the `<a>` is unread in its own block, and a mention in the next block is called "not a
   link", though a browser carries the link into it.

## Root cause

The phrasing walk (`packages/md/src/model/phrasing.ts`, `run`) works one block at a time and lets
an enclosing Markdown link win over an inline `<a>`; HTML's own rules for where an `<a>` ends are
not modelled.

## Fix

Not designed. Whether to model HTML's `<a>` extent across blocks, or report both shapes unread, is
the question; reporting them unread is the fail-closed reading.

## Verification

- [ ] Red first: each shape is judged as a browser shows it, or reported `md/unread-mention`.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
