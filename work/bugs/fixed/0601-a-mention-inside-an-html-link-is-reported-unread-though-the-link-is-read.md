# Bug 0601: a mention inside an HTML link is reported unread though the link is read

## Status

- **State:** Fixed — a mention inside a readable `<a href>…</a>` is linked to the tag's target
  (2026-11-04); the text-to-micromark case is deferred.
- **Severity:** Low — fail-closed: an unsuppressable finding whose remedy (rewrite the link in
  Markdown) is real but should not be needed.
- **Origin:** self-found · [proposal 022](../../proposals/promoted/022-md-a-raw-html-link-is-resolved.md)'s
  review, decision 2, which [plan 0580](../../plans/completed/0580-md-a-raw-html-link-is-resolved.md) leaves out
  of scope.
- **Reported:** 2026-11-01

## Symptom

`mentions()` reports a mention inside `<a href>…</a>` as `md/unread-mention`, cause `html-link`
(`packages/md/src/builders/mentions.ts:44`), because it cannot read the link's target. Once
[plan 0580](../../plans/completed/0580-md-a-raw-html-link-is-resolved.md) lands, `links()` reads that `href`, and
the two builders disagree about the same element: one resolves it, and the other says it cannot be
read. The review's decision 2 says that with one attribute owner, `mentions()` can judge such a
mention as linked.

## Fix

Not designed. The direction: `mentions()` reads an `<a>`'s `href` through
[plan 0580](../../plans/completed/0580-md-a-raw-html-link-is-resolved.md)'s owner, judges
a mention in its text as linked to that target, and keeps `html-link` only for an `<a>` the owner
cannot read. It also takes an `<a>` micromark left as text (`<a href=./x.md>`, an unquoted `/`):
the owner's inline scan finds it, and a mention in it is then judged like one in any HTML link.
That case was
[bug 0593](./0593-the-html-link-recogniser-matches-data-href-and-misses-a-quoted-angle-bracket.md)'s,
deferred here, since only this fix reads the link's target.

**Built 2026-11-04.** The phrasing walk (`packages/md/src/model/phrasing.ts`, `run`) holds the text of
an `<a>` the one HTML reader finishes, with an `href`, until its `</a>`, then gives it to the run
linked to that `href`, its text joined as a heading's is; an `<a>` the block never closes stays
`md/unread-mention`, cause `html-link`. The mention model resolves that link like any other, so
`beLinked()`, `areLinked()` and `areInTitleLinks()` see it. Seven older rows that expected the
readable `<a>`'s mention to be unread were updated, titles kept (one is cited by
[plan 0580](../../plans/completed/0580-md-a-raw-html-link-is-resolved.md)); the shared unread fixture's
`<a>` is now unclosed, so the `html-link` cause stays covered.

## Verification

- [x] Red first: a mention inside a readable `<a href>` is judged linked, not unread:
      `packages/md/tests/builders/mentions-html-link.test.ts` · `it('a mention in a readable inline <a href> is linked, to the tag’s target')`, red on main.
- [x] A mention inside an `<a>` the owner cannot read is still `md/unread-mention`:
      `it('an <a> its block never closes stays md/unread-mention')`.
- [ ] deferred→[bug 0616](../0616-a-mention-in-an-html-link-micromark-reads-as-text-is-not-linked.md): a mention inside
      `<a href=./x.md>` (text to micromark) is judged as one in an HTML link. It needs the text node
      split at the offsets the owner's inline scan gives, a mechanism of its own; today it is a false
      red with a wrong remedy, not a false green.
- [x] A changeset naming `@nielspeter/eess-md`: `.changeset/a-mention-in-an-html-link-is-linked.md`.
- [x] `npm run validate` green.

Deferred: [bug 0616](../0616-a-mention-in-an-html-link-micromark-reads-as-text-is-not-linked.md)
