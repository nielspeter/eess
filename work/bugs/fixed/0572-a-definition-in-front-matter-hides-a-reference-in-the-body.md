# Bug 0572: a definition in front matter hides the reference in the body that uses it

## Status

- **State:** Fixed — a link only one reading of the block holds is reported, never judged
  (2026-11-04, [spike 0613](../../spikes/0613-which-readers-the-front-matter-guard-answers-to.md)). Measured 2026-10-31 on PR #285's branch and on main. A first fix was withdrawn in PR #302 (Attempt
  1).
- **Severity:** High — a false green: a broken reference-style link in the body passes when its
  definition sits in a line-1 `---` block that is read as front matter, while a reader of the
  whole document sees the link and its broken target.
- **Origin:** self-found · PR #285's enforcement and testing reviews.
- **Reported:** 2026-10-31

## Symptom

The front-matter guard asks whether a checked node starts inside the block's lines
(`checkedMarkdownIn`, `packages/md/src/model/prose.ts:41`). A `definition` is not a checked node,
so a block holding one stays front matter. The front-matter parse then has no such definition,
the body's `[x]` is plain text, and `links()` never examines it. This is the mirror of
[bug 0566](./0566-a-front-matter-reference-defined-in-the-body-is-hidden.md), where the
reference was in the block and the definition in the body.

## Reproduction

`docs/b.md` exists; `links(c).that().areInternal().should().resolve()` over `corpusFromText`. The
reader baseline is the same text with line 1 `---` replaced by `***`, the whole-document parse with
no front matter. Measured by the enforcement review:

```text
'---\na: |\n\n  [x]: ./gone.md\nb: c\n---\n\n# A\n\n[ok](./b.md)\n\nSee [x].\n'
  eess:   examined 1, []
  reader: examined 2, ["4 broken link: \"./gone.md\" does not resolve ..."]

'---\n[x]: ./gone.md\n---\n\n# A\n\nSee [x].\n'   (the definition as a YAML key; a valid mapping)
  eess:   examined 0
  reader: examined 1, broken link at line 2
```

A variant: with `[g]: ./gone.md` in the block and `[g]: https://ex.com` in the body, eess resolves
the body's `[g]` to the body's external definition, while CommonMark's first definition, the
block's, wins for a reader.

## Fix

Not designed. A direction from the review, not measured: also count a `definition` inside the
block's lines whose label a `linkReference` anywhere in the whole document uses and whose URL is
internal, giving "it holds the definition of a link at line N". Whether an unused definition in the
block counts is part of the decision; [bug 0087](./0087-frontmatter-parsed-as-setext-heading.md)'s
rule (front matter only when it holds nothing a Markdown reader checks) is where it is decided.

## Attempt 1 (PR #302, 2026-11-03, withdrawn)

The fix counted a definition in the block when a reference anywhere in the document used it and its
URL was internal, so the block was read as Markdown. It turned the reproduction red, and three
enforcement review rounds each found a document it turned from red on main to green, with a broken
body link a renderer that drops front matter (GitHub, VitePress) shows:

1. **Shadowing.** A label defined in the block and in the body: read as Markdown, the block's
   definition wins, and the body's broken `[g]: ./gone.md` is never examined. Narrowed to "the body
   does not define this label".
2. **Another label shadowed.** `[x]` defined in the block alone turns it, and `[y]`, defined on both
   sides, then resolves to the block's definition. Narrowed to "no used label straddles the block's
   edge".
3. **Swallowing, and nesting.** An unclosed fence, `<!--` or `<pre>` in a YAML value runs on into the
   body once the block is Markdown and swallows a body `[bad](./gone.md)`, labels included, so the
   straddle check cannot see them. And `[see [x]](./gone.md)` stops being a link once the block
   defines `[x]` (no link inside a link).

Each narrowing closed one shape and left another, so per this repository's rule the attempt ended:
what is proven is kept as rows that hold on main
(`packages/md/tests/front-matter-guard.test.ts`, the "as main reads it" describe): four that a
withdrawn version turned green, and one, ordinary front matter, that checks the other direction. What the attempt shows about the design:

- Reading the block as Markdown is not additive. It can remove links the front-matter reading
  examines outside the block, not only add the block's own, so no rule about what the block holds
  can be sufficient by itself.
- The property any fix must keep, from the review: every link the front-matter reading examines
  outside the block is still examined, with the same URL, after the block is read as Markdown;
  where it is not, the guard cannot judge the document
  ([ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)'s class, with
  [bug 0610](./0610-a-label-defined-in-front-matter-and-the-body-leaves-one-target-unchecked.md)).
- Checking it needs both parses' link lists, and `prose.ts` cannot import `links.ts`
  (`links` → `html-attributes` → `prose`), so it needs a layer above both.

**Two readers, never named (added 2026-11-03, PR #302's method review).** The records weigh a
document against two readers and do not say which the guard answers to. This record's reproduction
is a false green for a reader of the whole document as Markdown; a renderer that drops front matter
(GitHub, VitePress) agrees with main there, since it shows no definition for `[x]`. [Bug 0610](./0610-a-label-defined-in-front-matter-and-the-body-leaves-one-target-unchecked.md) (its main-side inputs) and [bug 0612](./0612-a-construct-opened-in-front-matter-swallows-body-links.md) are false greens for that renderer only, and the whole-document reader is
green on them too. On pinned rows 1 and 3 the withdrawn fix agreed with the reader
[bug 0087](./0087-frontmatter-parsed-as-setext-heading.md)'s rule names. So the spike's first
question is which readers the guard answers to; a design that answers to both checks what each
sees.

Next: a time-boxed spike answers that and measures the property above as the guard's rule, and
brings the design back.
Found along the way: [bug 0609](../0609-a-setext-heading-after-a-definition-is-placed-on-the-definitions-line.md),
[bug 0610](./0610-a-label-defined-in-front-matter-and-the-body-leaves-one-target-unchecked.md),
[bug 0611](./0611-an-html-link-in-front-matter-is-hidden.md) and
[bug 0612](./0612-a-construct-opened-in-front-matter-swallows-body-links.md).

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

- [x] Red test written first: the first reproduction is reported (examined 2, the broken link):
      `packages/md/tests/front-matter-guard.test.ts` · `it('the 0572 case: a definition in the block that a body reference uses')`, red on main.
- [x] The YAML-key form and the first-definition-wins variant, each decided and pinned:
      `it('the 0572 case: the definition written as a YAML key')` and
      `it('the 0572 case: the block’s definition behind an external body one')`:
      each reader's definition is reported where only one reading holds it.
- [x] Ordinary front matter beside body references stays front matter: `it('ordinary front matter adds nothing')`,
      and the "as main reads it" row for it.
- [x] A changeset naming `@nielspeter/eess-md`: `.changeset/a-link-either-reader-sees.md`.
- [x] `npm run validate` green.

Deferred: none
