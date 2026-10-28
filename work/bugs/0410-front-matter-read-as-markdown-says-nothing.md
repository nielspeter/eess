# Bug 0410: front matter read as Markdown says nothing

## Status

- **State:** Draft — found by the review of [bug 0087](./fixed/0087-frontmatter-parsed-as-setext-heading.md)'s fix, 2026-10-14, on the same branch. No red
  test yet.
- **Severity:** Low — fails closed. Nothing is hidden: a `---` block that is not front matter is read
  as Markdown, so every box and link in it is still checked. What is silent is the reason a document
  shows a section it does not have.
- **Origin:** self-found · architect and enforcement review of the fix for
  [bug 0087](./fixed/0087-frontmatter-parsed-as-setext-heading.md), 2026-10-14.
- **Reported:** 2026-10-14

## Symptom

[Bug 0087](./fixed/0087-frontmatter-parsed-as-setext-heading.md)'s fix reads a line-1 `---` block as front matter only when it is a YAML mapping that parses
without error and holds no task box and no link into the repository
(`packages/md/src/model/prose.ts:48`). Anything else falls back to Markdown (`:64`). The fallback is
right — it keeps the content checked — but it says nothing. Front matter with a YAML error, such as a
duplicate key,

```markdown
---
title: a
title: b
---

# Doc
```

is read as Markdown, so the document reports the phantom depth-2 section [bug 0087](./fixed/0087-frontmatter-parsed-as-setext-heading.md) was about,
`title: a\ntitle: b`, with no word that its front matter was not read as front matter.

## Root cause

`parseMarkdown` decides front matter by `isFrontMatter`, and on `false` reparses without the
extension. It returns only a tree; the reason it fell back is not kept anywhere a reader could report
it.

## Fix

Not designed. The direction both reviewers named: when a document's line-1 `---` block was not read
as front matter, a finding — or at least a note beside the result — says so and why (the YAML error
and its line, or the task box or link it holds), in the style of the ledger's `unterminatedFence` and
[plan 0405](../plans/completed/0405-md-select-the-links-a-block-declares.md)'s "not read" findings. Whether it fails the build or only notes it is the fix's decision:
the content is checked either way.

## Verification

- [ ] Red test first, through a public entry point: a document whose front matter has a duplicate key
      is reported as "front matter not read", naming the line and the YAML error
- [ ] a document that opens with a horizontal rule and holds a task box is reported the same way, or
      deliberately not — whichever the fix decides, and pinned
- [ ] valid front matter produces no such report
- [ ] `npm run validate` green.

Deferred: none.
