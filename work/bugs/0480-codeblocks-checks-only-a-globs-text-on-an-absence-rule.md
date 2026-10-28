# Bug 0480: `codeBlocks()` checks only a glob's text on an absence rule

## Status

- **State:** Draft — recorded 2026-10-18 from [plan 0456](../plans/completed/0456-kernel-notexist-and-dead-glob.md)'s enforcement review.
- **Severity:** Low — a `codeBlocks()` absence rule whose folder glob names Markdown the corpus did
  not load stays green; the same selector on `docs()` reds.
- **Origin:** self-found · [plan 0456](../plans/completed/0456-kernel-notexist-and-dead-glob.md)'s review, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

[Plan 0456](../plans/completed/0456-kernel-notexist-and-dead-glob.md) gives eess-md's corpus builders three checks for an absence rule that examined nothing: a
fault in the glob's text, Markdown under the glob that the corpus did not load, and a backslash
written as a path separator. `codeBlocks()` gets the first only
(`packages/md/src/builders/code-blocks.ts`, `mdSelectorFault(this.globs(), undefined)`), because
`ParsedCodeBlocks` carries no file index (`packages/md/src/model/code-block-parse.ts`).

So `codeBlocks(parsed).that().resideInFolder('archive/**').should().notExist()` is green when
`archive/` holds Markdown outside the corpus's `roots`, where
`docs(c).that().resideInFolder('archive/**').should().notExist()` reds naming the unloaded files.
The README states the limit ([plan 0456](../plans/completed/0456-kernel-notexist-and-dead-glob.md)).

## Fix

Carry the corpus (or its file index and loaded paths) on `ParsedCodeBlocks`, so `codeBlocks()` can
pass it to `mdSelectorFault` as the corpus builders do. [Plan 0457](../plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md) replaces `onDocument` with
`inDocuments`; this is a separate change to the parsed set's shape.

## Verification

- [ ] Red first: the `codeBlocks()` rule above is green over a repository holding `archive/a.md`
      outside the roots
- [ ] Green: it reds naming the unloaded file, and adding the root turns it green

Deferred: none
