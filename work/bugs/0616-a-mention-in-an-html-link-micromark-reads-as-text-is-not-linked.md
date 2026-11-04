# Bug 0616: a mention in an HTML link micromark reads as text is called not linked

## Status

- **State:** Draft — deferred from [bug 0601](./fixed/0601-a-mention-inside-an-html-link-is-reported-unread-though-the-link-is-read.md),
  2026-11-04; no red test yet.
- **Severity:** Low — a false red with a wrong remedy, not a false green: the mention is reported
  "not a link" and may be offered a fix that wraps it in a second link.
- **Origin:** self-found · building [bug 0601](./fixed/0601-a-mention-inside-an-html-link-is-reported-unread-though-the-link-is-read.md).
- **Reported:** 2026-11-04

## Symptom

`See <a href=./b.md>issue 12</a> here.` — an unquoted `href` holding `/`, which micromark leaves
as text ([bug 0593](./fixed/0593-the-html-link-recogniser-matches-data-href-and-misses-a-quoted-angle-bracket.md)).
`links()` reports the tag `md/unread-link`, cause `unquoted-slash`
([plan 0580](../plans/completed/0580-md-a-raw-html-link-is-resolved.md), R3). `mentions()` reads the
whole line as plain text, so `beLinked()` says `"issue 12" is not a link`, while GitHub renders a
link around it.

## Root cause

The phrasing walk (`packages/md/src/model/phrasing.ts`) links the text of an `<a>` it meets as an
`html` node ([bug 0601](./fixed/0601-a-mention-inside-an-html-link-is-reported-unread-though-the-link-is-read.md)). An `<a>` micromark left as text is inside a `text` node, so the walk never
meets a tag; the owner's inline scan (`inlineTagStarts`, `packages/md/src/model/html-attributes.ts`)
finds it, but nothing maps its span back onto the text node's segments.

## Fix

Not designed. The direction from [bug 0601](./fixed/0601-a-mention-inside-an-html-link-is-reported-unread-though-the-link-is-read.md): split the text node at the tag's start and end offsets
the inline scan gives, and treat the text between them as the `<a>`'s; or report such a mention
`md/unread-mention`, cause `html-link`, as `links()` reports the tag unread, which at least gives
the right remedy.

## Verification

- [ ] Red first: the symptom's mention is not reported "not a link".
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
