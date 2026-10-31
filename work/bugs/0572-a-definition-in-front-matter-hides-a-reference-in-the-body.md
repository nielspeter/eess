# Bug 0572: a definition in front matter hides the reference in the body that uses it

## Status

- **State:** Draft — measured 2026-10-31 on PR #285's branch and on main (identical); no red test
  yet.
- **Severity:** High — a false green: a broken reference-style link in the body passes when its
  definition sits in a line-1 `---` block that is read as front matter, while a reader of the
  whole document sees the link and its broken target.
- **Origin:** self-found · PR #285's enforcement and testing reviews.
- **Reported:** 2026-10-31

## Symptom

The front-matter guard asks whether a checked node starts inside the block's lines
(`checkedMarkdownIn`, `packages/md/src/model/prose.ts:39`). A `definition` is not a checked node,
so a block holding one stays front matter. The front-matter parse then has no such definition,
the body's `[x]` is plain text, and `links()` never examines it. This is the mirror of
[bug 0566](./fixed/0566-a-front-matter-reference-defined-in-the-body-is-hidden.md), where the
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
block counts is part of the decision; [bug 0087](./fixed/0087-frontmatter-parsed-as-setext-heading.md)'s
rule (front matter only when it holds nothing a Markdown reader checks) is where it is decided.

## Verification

- [ ] Red test written first: the first reproduction is reported (examined 2, the broken link).
- [ ] The YAML-key form and the first-definition-wins variant, each decided and pinned.
- [ ] Ordinary front matter beside body references stays front matter.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
