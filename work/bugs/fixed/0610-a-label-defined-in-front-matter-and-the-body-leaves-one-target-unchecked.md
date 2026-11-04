# Bug 0610: a label defined in front matter and in the body leaves one target unchecked

## Status

- **State:** Fixed — a link only one reading of the block holds is reported, never judged
  (2026-11-04, [spike 0613](../../spikes/0613-which-readers-the-front-matter-guard-answers-to.md)). Measured 2026-11-03 on main's front-matter guard.
- **Severity:** High — a false green, narrow: a broken target a reader can follow passes.
- **Origin:** self-found · PR #302's enforcement review of [bug 0572](./0572-a-definition-in-front-matter-hides-a-reference-in-the-body.md).
- **Reported:** 2026-11-03

## Symptom

A line-1 `---` block holds `[g]: ./gone.md` (on an indented continuation line of a valid YAML
value), and the body holds `See [g].` and `[g]: https://example.com`. Two readers disagree about
the reference:

- A renderer that drops front matter (GitHub, VitePress) uses the body's definition.
- A reader of the whole document as Markdown uses the first definition, the block's `./gone.md`.

eess-md keeps the block front matter here (a definition is not something the guard counts,
[bug 0087](./0087-frontmatter-parsed-as-setext-heading.md)'s rule), so it checks the body's
definition and never the block's. The block's broken `./gone.md` passes.

**The other direction is live on main** (measured by PR #302's re-check, identical on main and the
branch). When the block is read as Markdown for another reason, the block's definition wins and a
body `[g]: ./gone.md` is never examined, while a renderer that drops front matter shows that broken
link. With `docs/b.md` present, each input below is green under
`links(c).that().areInternal().should().resolve()` (re-measured 2026-11-03):

```text
a task box               '---\na: |\n\n  - [ ] t\n\n  [g]: ./b.md\nb: c\n---\n' + BODY
a YAML error             '---\na: b\na: c\n\n[g]: ./b.md\n---\n' + BODY
an inline internal link  '---\na: |\n\n  [t](./b.md)\n\n  [g]: ./b.md\nb: c\n---\n' + BODY
a reference to a body    '---\na: |\n\n  See [h].\n\n  [g]: ./b.md\nb: c\n---\n' + BODY + '\n[h]: ./b.md\n'
definition (bug 0566's path)

BODY = '\n# A\n\n[ok](./b.md)\n\nSee [g].\n\n[g]: ./gone.md\n'
```

The blank lines matter: written without them, each block reads differently and each input is red
(PR #302's method review measured that).

None of these is pinned yet. [Bug 0572](./0572-a-definition-in-front-matter-hides-a-reference-in-the-body.md)'s withdrawn fix (PR #302) added cases like them; the
rows that hold on main, in the other direction, are pinned in
`packages/md/tests/front-matter-guard.test.ts` ("as main reads it").

## Root cause

`links()` gives a reference one definition, the first of its label (`definitionsOf`,
`packages/md/src/model/definitions.ts:48`), and the front-matter guard picks one reading of the
document. With a label defined on both sides of the block's edge, each reading uses a different
definition, and one of them is never resolved.

## Fix

Not designed. Options: check both definitions when a label is defined on both sides of the edge; or
report the doubly defined label as a finding this rule cannot judge, naming both lines
([ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)'s class). Measured
under the spike [bug 0572](./0572-a-definition-in-front-matter-hides-a-reference-in-the-body.md) names as its next step (not yet run), with [bug 0612](./0612-a-construct-opened-in-front-matter-swallows-body-links.md).

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

## Verification

- [x] Red first: the block's broken `./gone.md` above is reported, or the label is reported as
      doubly defined; and each row of the table, in the other direction: `packages/md/tests/front-matter-guard.test.ts` ·
      `it('the 0572 case: the block’s definition behind an external body one')`
      and `it('the 0610 case: a block read as Markdown for another reason, its body definition shadowed')`
      (the table's three Markdown triggers; the fourth, the [bug 0566](./0566-a-front-matter-reference-defined-in-the-body-is-hidden.md) path, is the same reading).
- [x] [Bug 0572](./0572-a-definition-in-front-matter-hides-a-reference-in-the-body.md)'s rows for this shape (`packages/md/tests/front-matter-guard.test.ts`, "as main
      reads it") still hold, or change with the fix and say why: their findings hold, with the
      one-reading finding beside each now filtered out of what they pin, and the fence row's fixture
      gained the `docs/b.md` its block definition names.
- [x] A changeset naming `@nielspeter/eess-md`: `.changeset/a-link-either-reader-sees.md`.
- [x] `npm run validate` green.

Deferred: none
