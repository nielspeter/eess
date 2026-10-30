# Bug 0566: a reference-style link in front matter whose definition is in the body is hidden

## Status

- **State:** Draft — measured 2026-10-30 on PR #282's build; no red test yet. A first fix was
  built in PR #282 and reverted there (see Fix).
- **Severity:** High — a false green: a broken reference-style link written in a YAML-shaped first
  block passes when its definition is in the body, while the same link written inline, or defined
  in the block, is reported.
- **Origin:** self-found · PR #282's enforcement re-check.
- **Reported:** 2026-10-30

## Symptom

A line-1 `---` block that is a YAML mapping is read as front matter unless it holds Markdown a
reader checks (`isFrontMatter`, `packages/md/src/model/prose.ts:63`, [bug 0087](./fixed/0087-frontmatter-parsed-as-setext-heading.md)). It is judged by
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
`[adr]: ./gone.md` in the body, which is front matter and must stay so.

## Why it is not one line

A YAML flow list has a shortcut reference's shape. PR #282 first judged the block with the body's
definitions appended as stand-ins; its architect re-check measured that `tags: [adr]`,
`versions: [1]` and `title: "[RFC] …"` beside a body definition of the same label were then read
as Markdown, giving a phantom section and link: a false red on common front matter. The
enforcement re-check found the stand-ins also missed labels holding an escape or an entity. The
change was reverted in PR #282, and the test `a YAML list shaped like a reference to a body
definition stays front matter` (`packages/md/tests/reference-links.test.ts`) now pins the
`tags: [adr]` case.

## Fix

Not chosen. The question is when a `[label]` in a YAML value is a link a reader sees. On GitHub,
front matter renders as a table, not as Markdown, so a `[label]` in a YAML value is not a link
there; inside a block scalar meant as Markdown it reads as one elsewhere. A candidate from the
re-check, not measured as a design: judge the block from the whole-document `GFM_ONLY` parse,
asking whether a checked node falls inside the block's lines, which also covers a construct
opened in the block and closed in the body. It must keep `tags: [adr]` front matter.

## Verification

- [ ] The decision (what a `[label]` in a YAML value is) written here before the fix.
- [ ] Red test written first: the "defined in the body" reproduction is reported, or the decision
      records why it is not a link.
- [ ] `tags: [adr]`, `versions: [1]` and `title: "[RFC] …"` beside a body definition stay front
      matter.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
