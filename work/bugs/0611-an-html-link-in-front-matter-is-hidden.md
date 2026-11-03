# Bug 0611: an HTML link in front matter is hidden

## Status

- **State:** Draft — measured 2026-11-03 by PR #302's enforcement review, on main and on the
  branch (identical); no red test yet.
- **Severity:** High — a false green: a broken `<a href>` a Markdown reader sees passes.
- **Origin:** self-found · PR #302's enforcement review of [bug 0572](./0572-a-definition-in-front-matter-hides-a-reference-in-the-body.md).
- **Reported:** 2026-11-03

## Symptom

`'---\na: <a href="./gone.md">x</a>\n---\n\n# A\n\n[ok](./b.md)\n'` with `docs/b.md` present:
`links(c).that().areInternal().should().resolve()` examines 1 link and reports nothing. Read as
CommonMark with no front matter, the document holds 2 links and `./gone.md` is broken.

## Root cause

The front-matter guard names a task box, an inline link and a reference
(`checkedMarkdownIn`, `packages/md/src/model/prose.ts:41`), but not an `html` node.
Since [plan 0580](../plans/completed/0580-md-a-raw-html-link-is-resolved.md) Phase 2, `links()`
reads the `href` of an `<a>` or `<area>` in raw HTML, so such a link in the block is something a
reader checks, and the guard leaves the block front matter.

## Fix

Not designed. The direction: the guard asks the same owner `links()` reads HTML links through
(`packages/md/src/model/html-attributes.ts`) whether the block's lines hold an internal `href`,
and an unread one, which counts as something a reader checks.

## Verification

- [ ] Red first: the reproduction reports `./gone.md` and examines 2.
- [ ] An `<a href>` to an external URL in a YAML value leaves the block front matter.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
