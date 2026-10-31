# Bug 0566: a reference-style link in front matter whose definition is in the body is hidden

## Status

- **State:** Fixed — the block is judged from the whole document's parse (PR #285). A first fix
  was built in PR #282 and reverted there (see "Why it is not one line").
- **Severity:** High — a false green: a broken reference-style link written in a YAML-shaped first
  block passes when its definition is in the body, while the same link written inline, or defined
  in the block, is reported.
- **Origin:** self-found · PR #282's enforcement re-check.
- **Reported:** 2026-10-30

## Symptom

A line-1 `---` block that is a YAML mapping is read as front matter unless it holds Markdown a
reader checks (`isFrontMatter`, `packages/md/src/model/prose.ts:63`, [bug 0087](./0087-frontmatter-parsed-as-setext-heading.md)). It is judged by
parsing the block alone, so a reference-style link in it counts only when the block also holds
its definition. A reference whose definition is in the body is plain text to that parse, the
block stays front matter, and the link is never read.

## Reproduction

`docs/b.md` exists. Each `docs/a.md` below holds `# A` and `[ok](./b.md)` after its first block,
and `links(c).that().areInternal().should().resolve()` runs over `corpusFromText`. Measured:

```text
defined in the block               examined 2 ["5 broken link: \"./gone.md\" does not resolv"]
defined in the body                examined 1 []
inline in the block                examined 2 ["3 broken link: \"./gone.md\" does not resolv"]
tags: [adr], [adr] defined in body examined 1 []
```

The first three blocks are `a: |` with `See [g].` (and `[g]: ./gone.md` in the block), `See [g].`
with `[g]: ./gone.md` in the body, and `See [g](./gone.md).`. The last is `tags: [adr]` with
`[adr]: ./gone.md` in the body, which this record first said must stay front matter; the Decision
below reads it as Markdown.

## Why it is not one line

A YAML flow list has a shortcut reference's shape. PR #282 first judged the block with the body's
definitions appended as stand-ins; its architect re-check measured that `tags: [adr]`,
`versions: [1]` and `title: "[RFC] …"` beside a body definition of the same label were then read
as Markdown, giving a phantom section and link: a false red on common front matter. The
enforcement re-check found the stand-ins also missed labels holding an escape or an entity. The
change was reverted in PR #282, and the test `a YAML list shaped like a reference to a body
definition stays front matter` (`packages/md/tests/reference-links.test.ts`) now pins the
`tags: [adr]` case.

## Decision

[Bug 0087](./0087-frontmatter-parsed-as-setext-heading.md)'s rule decides it: a line-1 `---` block is front matter only when it holds nothing a
Markdown reader checks, "exactly as before front matter was parsed". Before front matter was
parsed, the whole document was read as Markdown, and `tags: [adr]` beside `[adr]: ./adr.md` was a
link. So a `[label]` in a YAML value is a link when the whole document's Markdown parse reads it
as one: its definition, in the block or in the body, names a file in the repository. An external
definition, or no definition, leaves the block front matter. The cost, accepted on 2026-10-31: a
document whose front matter holds `tags: [adr]` and whose body defines `[adr]` with an internal
URL shows the block as a section and has the link checked; [bug 0410](./0410-front-matter-read-as-markdown-says-nothing.md)'s fix makes the title
finding say why.

## Fix

The question is when a `[label]` in a YAML value is a link a reader sees. On GitHub,
front matter renders as a table, not as Markdown, so a `[label]` in a YAML value is not a link
there; inside a block scalar meant as Markdown it reads as one elsewhere. A candidate from the
re-check, not measured as a design: judge the block from the whole-document `GFM_ONLY` parse,
asking whether a checked node falls inside the block's lines, which also covers a construct
opened in the block and closed in the body.

Built that way: `checkedMarkdownIn` (`packages/md/src/model/prose.ts:39`) walks the whole
document's `GFM_ONLY` parse and names the first task box, inline link or reference into the
repository that falls within the block's lines; a reference counts by its definition's URL, wherever
the definition is. `parseFresh` (`:135`) runs that parse only when the block holds a `[` or its
YAML does not parse, so ordinary front matter costs no second parse. The external-URL test is
`links()`'s own ([bug 0565](./0565-the-front-matter-guard-keeps-its-own-external-url-test.md)).

## Verification

- [x] The decision (what a `[label]` in a YAML value is) written here before the fix: see Decision.
- [x] Red test written first: the "defined in the body" reproduction is reported
      (`packages/md/tests/front-matter-guard.test.ts` · `it('the reference is examined and its broken target reported')`),
      red on main's `prose.ts`.
- [ ] done-otherwise: `tags: [adr]`, `versions: [1]` and `title: "[RFC] …"` beside a body
      definition do not stay front matter; by the Decision they are read as Markdown when the
      definition is internal (measured 2026-10-31: each gives one examined link and its finding),
      and stay front matter when it is external or absent (examined 0). `packages/md/tests/reference-links.test.ts` · `it('a YAML list shaped like a reference to a body definition is read as Markdown, its link checked')`
      pins the first, `packages/md/tests/front-matter-guard.test.ts` · `it('a block whose reference is to an external definition stays front matter')` the second.
- [x] A changeset naming `@nielspeter/eess-md`: `.changeset/front-matter-is-judged-as-a-reader-sees-it.md`, a minor marked breaking.
- [x] `npm run validate` green.

Deferred: none
