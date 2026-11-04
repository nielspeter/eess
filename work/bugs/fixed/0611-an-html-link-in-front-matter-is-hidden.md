# Bug 0611: an HTML link in front matter is hidden

## Status

- **State:** Fixed — a link only one reading of the block holds is reported, never judged
  (2026-11-04, [spike 0613](../../spikes/0613-which-readers-the-front-matter-guard-answers-to.md)). Measured 2026-11-03 by PR #302's enforcement review. The `parseFresh` early return this
  record names is not on the union's path: the other reading is parsed whenever the text opens with
  `---`.
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
Since [plan 0580](../../plans/completed/0580-md-a-raw-html-link-is-resolved.md) Phase 2, `links()`
reads the `href` of an `<a>` or `<area>` in raw HTML, so such a link in the block is something a
reader checks, and the guard leaves the block front matter. The reproduction does not reach the
guard at all: `parseFresh` returns a block with no `[` and valid YAML as front matter before the
whole-document parse (`packages/md/src/model/prose.ts:145`), so a fix in the guard alone leaves it
green; that early return must also let a `<` through.

## Fix

Not designed. The direction: the guard asks the same owner `links()` reads HTML links through
(`packages/md/src/model/html-attributes.ts`) whether the block's lines hold an internal `href`,
and an unread one, which counts as something a reader checks.

**Built 2026-11-04**, from [spike 0613](../../spikes/0613-which-readers-the-front-matter-guard-answers-to.md) as corrected by its build's review: a link only one reading of a
line-1 `---` block holds (`oneReadingLinksOf`, `packages/md/src/model/links.ts`, from
`otherReading`, `packages/md/src/model/prose.ts`) is not an element of `links()`, so no condition or
predicate can pass on it; each one a rule's predicates reach is an unsuppressable
`md/link-one-reading-holds` finding (`packages/md/src/model/one-reading-link.ts`), naming the link and
which reading holds it, as an unread link is ([ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)), and `select()` refuses on it. Only internal
links count; an HTML link either reading cannot read is reported as `md/unread-link`. The first build
added such links as elements, and the review measured that a `satisfy()` condition or a
`correspondence()` could then pass on one, red on main, which is why they are findings instead.
The document's structure is unchanged.

The unread form this record's Fix names, an unquoted `<a href=…/…>` in a YAML value, is reported as
`md/unread-link` since the build's review: unread links are in the union too
(`packages/md/tests/front-matter-guard.test.ts` · `it('an unread HTML link in a YAML value, or in a swallowed body, is reported')`).

## Verification

- [ ] done-otherwise: the reproduction reports `./gone.md`; it examines 1, not 2, since a link only one
      reading holds is reported, not examined: `packages/md/tests/front-matter-guard.test.ts` ·
      `it('the 0611 case: an <a href> in a YAML value; an external one adds nothing')` (red on main) and
      the same row.
- [ ] done-otherwise: an `<a href>` to an external URL in a YAML value leaves the block front matter.
      The fix does not touch the guard (the block's reading is unchanged for every input), so this
      holds by construction; what is pinned is that such a link adds nothing a link rule examines,
      in the row above (an external `<a href>` adds nothing).
- [x] A changeset naming `@nielspeter/eess-md`: `.changeset/a-link-either-reader-sees.md`.
- [x] `npm run validate` green.

Deferred: none
