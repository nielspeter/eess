# Bug 0573: `agreeWithPath` blames a phantom title without saying the front matter was not read

## Status

- **State:** Draft — measured 2026-10-31 by PR #285's enforcement re-check; no red test yet.
- **Severity:** Low — fails closed: the finding is right to fire, but it sends the author to the
  wrong fix.
- **Origin:** self-found · PR #285's enforcement re-check.
- **Reported:** 2026-10-31

## Symptom

When a line-1 `---` block is read as Markdown, not as front matter, a YAML comment `# …` in it is a
depth-1 heading, and so the document's title. `haveTitle()`'s findings name why the block was read
as Markdown ([bug 0410](./fixed/0410-front-matter-read-as-markdown-says-nothing.md)). `agreeWithPath`
([plan 0556](../plans/completed/0556-a-value-agrees-with-the-documents-own-path.md)) reads the same
title, but two of its findings, a title with no value (`noTitleValue`,
`packages/md/src/conditions/agree-with-path.ts:104`) and a path and title that differ (`differ`,
`:112`), say nothing about it, and tell the author to rename the file or edit a title that is a
YAML comment.

## Reproduction

As `docs/0001-doc.md`, with a title pattern reading a value, measured on PR #285's branch:

```text
'---\n# page settings\ntags: [adr]\n---\n\n# Doc\n\n[adr]: ./adr.md\n'
  agreeWithPath: "2: the path says doc and the title says page (...): correct the one that is
  wrong, by renaming the file or editing the title"
```

The block is read as Markdown because `tags: [adr]` is a reference to the body's internal
definition. Its finding with no title goes through `titleFault` and does name why.

## Fix

Append the same note `titleFault` gives (`notReadNote`, `packages/md/src/model/sections.ts:251`)
to `noTitleValue` and `differ` when the title starts inside the block, so every finding that names
the title says why it is the title.

## Verification

- [ ] Red test written first, through `agreeWithPath`: the reproduction's finding names why the
      block was read as Markdown.
- [ ] The no-value finding likewise.
- [ ] A title below the block gets no note.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
