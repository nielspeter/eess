# Bug 0601: a mention inside an HTML link is reported unread though the link is read

## Status

- **State:** Draft — recorded 2026-11-01 from [plan 0580](../plans/0580-md-a-raw-html-link-is-resolved.md);
  it can be fixed only on that plan's attribute owner (its Phase 1).
- **Severity:** Low — fail-closed: an unsuppressable finding whose remedy (rewrite the link in
  Markdown) is real but should not be needed.
- **Origin:** self-found · [proposal 022](../proposals/022-md-a-raw-html-link-is-resolved.md)'s
  review, decision 2, which [plan 0580](../plans/0580-md-a-raw-html-link-is-resolved.md) leaves out
  of scope.
- **Reported:** 2026-11-01

## Symptom

`mentions()` reports a mention inside `<a href>…</a>` as `md/unread-mention`, cause `html-link`
(`packages/md/src/builders/mentions.ts:44`), because it cannot read the link's target. Once
[plan 0580](../plans/0580-md-a-raw-html-link-is-resolved.md) lands, `links()` reads that `href`, and
the two builders disagree about the same element: one resolves it, and the other says it cannot be
read. The review's decision 2 says that with one attribute owner, `mentions()` can judge such a
mention as linked.

## Fix

Not designed. The direction: `mentions()` reads an `<a>`'s `href` through
[plan 0580](../plans/0580-md-a-raw-html-link-is-resolved.md)'s owner, judges
a mention in its text as linked to that target, and keeps `html-link` only for an `<a>` the owner
cannot read. It also takes an `<a>` micromark left as text (`<a href=./x.md>`, an unquoted `/`):
the owner's inline scan finds it, and a mention in it is then judged like one in any HTML link.
That case was
[bug 0593](./fixed/0593-the-html-link-recogniser-matches-data-href-and-misses-a-quoted-angle-bracket.md)'s,
deferred here, since only this fix reads the link's target.

## Verification

- [ ] Red first: a mention inside a readable `<a href>` is judged linked, not unread.
- [ ] A mention inside an `<a>` the owner cannot read is still `md/unread-mention`.
- [ ] A mention inside `<a href=./x.md>` (text to micromark) is judged as one in an HTML link.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
