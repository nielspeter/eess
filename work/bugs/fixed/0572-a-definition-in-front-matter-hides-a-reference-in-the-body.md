# Bug 0572: a definition in front matter hides the reference in the body that uses it

## Status

- **State:** Fixed — a definition in the block that a reference uses takes the block out of front
  matter (2026-11-03). Measured 2026-10-31 on PR #285's branch and on main (identical).
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

## Decision

[Bug 0087](./0087-frontmatter-parsed-as-setext-heading.md)'s rule decides it: a line-1 `---` block
is front matter only when it holds nothing a Markdown reader checks. A definition is checked when a
reference uses it: `links()` examines the reference and resolves the definition's URL. An unused
definition is not examined by `links()` (it reads references only), so it leaves the block front
matter. The definition that counts is the one a reference uses, the first of its label, as
CommonMark and `definitionsOf` both read it; so in the variant, the block's internal definition
wins over the body's external one, and the body's `[g]` is checked against `./gone.md`. An
external definition leaves the block front matter, as an external link does.

## Fix

`checkedMarkdownIn` (`packages/md/src/model/prose.ts:42`) also names a `definition` inside the
block's lines when it is the first of its label, a `linkReference` anywhere in the document uses
that label (`referenceLines`, `:87`), and its URL is not external. The reason reads "it holds the
definition at line N of a link into the repository at line M", M being the first reference's
line. `parseFresh`'s fast path is unchanged: a definition needs a `[`.

## Verification

- [x] Red test written first: the first reproduction is reported (examined 2, the broken link)
      (`packages/md/tests/front-matter-guard.test.ts` · `it('the body reference is examined and its broken target reported')`),
      red on main's `prose.ts` with three more rows of the same describe.
- [x] The YAML-key form and the first-definition-wins variant, each decided and pinned:
      `it('a definition written as a YAML key is read as Markdown too')` and
      `it('the block’s definition wins over a later one in the body, as the first does for a reader')`.
      An unused definition and an external one, decided above, are pinned by
      `it('a definition in the block that no reference uses leaves it front matter')` and
      `it('an external definition in the block that a body reference uses leaves it front matter')`.
- [x] Ordinary front matter beside body references stays front matter:
      `it('ordinary front matter beside a body reference and its body definition stays front matter')`.
- [x] A changeset naming `@nielspeter/eess-md`: `.changeset/a-front-matter-definition-a-reference-uses-is-read.md`.
- [x] `npm run validate` green.

No non-vacuity row: the guard is a library behaviour this repository's gates do not exercise (no
document here opens with such a block), as for [bug 0566](./0566-a-front-matter-reference-defined-in-the-body-is-hidden.md);
the suite rows above are its guard. Found while writing them:
[bug 0609](../0609-a-setext-heading-after-a-definition-is-placed-on-the-definitions-line.md), a
heading after a definition reported a line early.

Deferred: none
