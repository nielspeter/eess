# Bug 0618: `mentions()` reads an HTML link's extent by paragraph, not as a browser does

## Status

- **State:** Draft — measured 2026-11-04 by the review of
  [bug 0601](./fixed/0601-a-mention-inside-an-html-link-is-reported-unread-though-the-link-is-read.md)'s
  fix, on main as well; no red test yet.
- **Severity:** Medium — a false green: a mention a reader sees unlinked can pass `beLinked()`
  (shape 3), and a mention linked to the wrong target can let a rule over the link's target pass
  a crossed link (shape 1); shape 2 is a false red.
- **Origin:** self-found · the enforcement review of [bug 0600](./fixed/0600-select-drops-an-unread-mention-without-a-word.md) and [bug 0601](./fixed/0601-a-mention-inside-an-html-link-is-reported-unread-though-the-link-is-read.md).
- **Reported:** 2026-11-04

## Symptom

Three shapes, all before [bug 0601](./fixed/0601-a-mention-inside-an-html-link-is-reported-unread-though-the-link-is-read.md)'s fix and after it:

1. An `<a href>` inside a Markdown link: `[see <a href="./c.md">issue 12</a>](./b.md)`. The mention
   is judged by the Markdown link's target, `./b.md`; a browser follows the inner `<a>`, `./c.md`.
2. An `<a href>` whose `</a>` sits in a later paragraph or list item: the walk reads one block at a
   time, so the `<a>` is unread in its own block, and a mention in the next block is called "not a
   link", though a browser carries the link into it.
3. A Markdown link whose text holds an `<a>` closed inside it:
   `<a href="./b.md">x [y</a> issue 12](./c.md)` is read as a Markdown link to `./c.md` around
   `issue 12`, so the mention passes `beLinked()`, while a reader sees the `<a>` end first and
   `issue 12` unlinked. Measured by the same review on main as well.

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
