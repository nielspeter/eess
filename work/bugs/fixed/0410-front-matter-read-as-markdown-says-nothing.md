# Bug 0410: front matter read as Markdown says nothing

## Status

- **State:** Fixed — `haveTitle()`'s finding names why the block was read as Markdown (PR #285,
  bundled with [bug 0566](./0566-a-front-matter-reference-defined-in-the-body-is-hidden.md), whose fix reads more blocks as Markdown).
- **Severity:** Low — fails closed. Nothing is hidden: a `---` block that is not front matter is read
  as Markdown, so every box and link in it is still checked. What is silent is the reason a document
  shows a section it does not have.
- **Origin:** self-found · architect and enforcement review of the fix for
  [bug 0087](./0087-frontmatter-parsed-as-setext-heading.md), 2026-10-14.
- **Reported:** 2026-10-14

## Symptom

[Bug 0087](./0087-frontmatter-parsed-as-setext-heading.md)'s fix reads a line-1 `---` block as front matter only when it is a YAML mapping that parses
without error and holds no task box and no link into the repository
(`packages/md/src/model/prose.ts` at the time; the guard is now `notFrontMatterBecause`,
`packages/md/src/model/prose.ts:81`). Anything else falls back to Markdown. The fallback is
right — it keeps the content checked — but it says nothing. Front matter with a YAML error, such as a
duplicate key,

```markdown
---
title: a
title: b
---

# Doc
```

is read as Markdown, so the document reports the phantom depth-2 section [bug 0087](./0087-frontmatter-parsed-as-setext-heading.md) was about,
`title: a\ntitle: b`, with no word that its front matter was not read as front matter.

## Root cause

`parseMarkdown` decides front matter by `isFrontMatter`, and on `false` reparses without the
extension. It returns only a tree; the reason it fell back is not kept anywhere a reader could report
it.

## Fix

The direction both reviewers named: when a document's line-1 `---` block was not read
as front matter, a finding — or at least a note beside the result — says so and why (the YAML error
and its line, or the task box or link it holds), in the style of the ledger's `unterminatedFence` and
[plan 0405](../../plans/completed/0405-md-select-the-links-a-block-declares.md)'s "not read" findings. Whether it fails the build or only notes it is the fix's decision:
the content is checked either way.

Built: the guard keeps its reason, and `frontMatterNotRead` (`packages/md/src/model/prose.ts:108`)
returns it with the block's last line: `its YAML does not parse (DUPLICATE_KEY at line 3)`, `it is
not a YAML mapping`, `it holds no key`, or `it holds a task box` / `a link into the repository at
line N`. The only finding the fallback causes is a phantom heading, so the reason goes where that
finding is made: `titleFault` (`packages/md/src/model/sections.ts:226`) appends "it is in the line-1
`---` block, read as Markdown, not as front matter, because …" when the heading it names (the first
heading at the wrong depth, or a title that does not match) starts inside the block. A first
version gave it only for a heading on line 1 or 2; PR #285's review measured a blank line in the
block pushing the phantom heading to line 4, with no reason given. Like
`unterminatedFence` (`packages/md/src/model/prose.ts:319`), it is a parse-time fact reported by the
rule that depends on it, so no new rule and no new finding: a document whose fallback makes no
phantom heading is not reported, because nothing in its verdict depends on the fallback. One
case stays silent on purpose: a phantom depth-1 title (a YAML comment `# …` on line 2) satisfies a
`haveTitle()` with no name, because it cannot be told from a document that opens with a horizontal
rule and then its title.

## Verification

- [ ] done-otherwise: red test first, through `docs().should().haveTitle()`: a document whose front
      matter has a duplicate key is reported, naming the YAML error and its line, as part of the
      title finding rather than as a separate "front matter not read" finding
      (`packages/md/tests/front-matter-guard.test.ts` · `it('a duplicate key: the YAML error and its line')`;
      red with the reason removed).
- [ ] done-otherwise: a document that opens with a `---` block holding a task box is reported
      when, read as Markdown, the block makes a phantom heading (`it('a task box past a blank line in the block: the box and its line')`),
      and deliberately not when it makes none, since the box is checked like any other
      (`it('a task box on a continuation line makes no phantom title, so nothing needs naming')`).
- [x] valid front matter produces no such report: `it('valid front matter gives no title finding')`.
- [x] `npm run validate` green.

Deferred: none
