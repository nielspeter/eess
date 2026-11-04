# Bug 0611: an HTML link in front matter is hidden

## Status

- **State:** Fixed — `links()` examines every link either reading of the block holds
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

**Built 2026-11-04**, as [spike 0613](../../spikes/0613-which-readers-the-front-matter-guard-answers-to.md) decided: `links()` examines every link either reading of a line-1 `---`
block holds. `linksOf` (`packages/md/src/model/links.ts`) adds to the picked reading's links those
only the other reading holds (`otherReading`, `packages/md/src/model/prose.ts`), marked
`onlyWhere`, and `resolve()`'s finding about one names the reading. The document's structure is
unchanged, and `sections().haveLink()` and `beLinkedBack()`'s evidence keep the picked reading,
where the union could only turn a finding green. One change closes [bug 0572](./0572-a-definition-in-front-matter-hides-a-reference-in-the-body.md), [bug 0610](./0610-a-label-defined-in-front-matter-and-the-body-leaves-one-target-unchecked.md), [bug 0611](./0611-an-html-link-in-front-matter-is-hidden.md) and [bug 0612](./0612-a-construct-opened-in-front-matter-swallows-body-links.md),
which share the root cause the spike names: a single reading chosen for links.

## Verification

- [x] Red first: the reproduction reports `./gone.md` and examines 2: `packages/md/tests/front-matter-guard.test.ts` ·
      `it('the 0611 case: an <a href> in a YAML value')` (red on main) and
      `it('the 0611 case: the reproduction examines both links; an external href in YAML adds none')`.
- [ ] done-otherwise: an `<a href>` to an external URL in a YAML value leaves the block front matter.
      The fix does not touch the guard (the block's reading is unchanged for every input), so this
      holds by construction; what is pinned is that such a link adds nothing a link rule examines,
      in the row above.
- [x] A changeset naming `@nielspeter/eess-md`: `.changeset/a-link-either-reader-sees.md`.
- [x] `npm run validate` green.

Deferred: none
