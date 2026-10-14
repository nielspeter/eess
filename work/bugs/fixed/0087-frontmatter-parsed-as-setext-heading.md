# Bug 0087: YAML frontmatter is parsed as a setext heading

## Status

- **State:** Fixed — 2026-10-14. Front matter parses to a `yaml` node, through one parser that
  `corpus()` and the prose readers share.
- **Reported:** 2026-08-09 — self-found while checking whether
  [proposal 001](../../proposals/001-md-corpus-rule-coverage.md) could support
  frontmatter cheaply. It can; the parser is the problem, not the extractor.

## Symptom

Every document with YAML frontmatter reports a **section that does not exist**,
named with the frontmatter's own contents.

Given:

```markdown
---
State: Ready
title: A doc
---

# Doc
```

`docs()` reports two sections:

```
depth 2  line 2  "State: Ready\ntitle: A doc"
depth 1  line 6  "Doc"
```

The depth-2 heading is a fabrication. `haveSection` matches against it,
`MdTable.sectionPath` inherits it, and `headerRegion()` splits on `/^##\s/m`
(ATX only) so it does _not_ see the same boundary — two views of one document
that disagree.

## Reproduction

```js
import { corpus, docs } from '@nielspeter/eess-md'
const c = corpus({ roots: ['docs/**'], cwd: fixtureDir })
console.log(c.documents()[0].sections)
// → [{ depth: 2, line: 2, name: 'State: Ready\ntitle: A doc' }, { depth: 1, line: 6, name: 'Doc' }]
```

Verified 2026-08-09 against the built workspace package.

## Root cause

`packages/md/src/corpus.ts:77-80` parses with `fromMarkdown` using the GFM
extensions only:

```ts
const tree = fromMarkdown(text, {
  extensions: [gfmExt],
  mdastExtensions: [gfmMdast],
})
```

There is no frontmatter extension, so CommonMark rules apply to the `---`
fences: the opening `---` becomes a `thematicBreak`, and the **closing** `---`
makes the text above it a **setext heading** (depth 2). The mdast top level for
the fixture is `thematicBreak, heading, heading, paragraph`.

The corpus has never modelled frontmatter; it has been silently mis-modelling
it.

## Fix

Add `micromark-extension-frontmatter` + `mdast-util-frontmatter` to the md
package and register them alongside GFM, so frontmatter parses to a `yaml` node
and stops producing headings.

One judgement call: these are the md package's first new runtime dependencies in
a while. Both are part of the micromark/mdast family already depended on, so the
tree does not widen much — but it is a dependency decision, not a pure fix, and
should be stated as one.

Note the two consumers pull in opposite directions and both want this:

- `docs().haveSection()` wants frontmatter **gone** from the section list.
- The term extractor (`vocabulary.ts`) scans **text lines**, so it reads
  frontmatter today and should keep doing so — see proposal 001, where the
  source becomes a `region` value. Fixing the parser must not remove that
  ability; the `yaml` node keeps its raw content and its position.

## Verification

- [x] Red test written first: a frontmatter-bearing fixture asserts its section
      list contains **only** its real headings — failing today with the phantom
      depth-2 entry.
- [x] The `yaml` node carries the frontmatter's raw text and start line.
- [x] `terms()` still matches labels inside frontmatter (the text-line scan is
      unaffected) — a regression test, since proposal 001 depends on it.
- [x] `MdTable.sectionPath` on a frontmatter-bearing document no longer includes
      the phantom section.
- [x] `npm run check:corpus` unchanged on this repo (no corpus document here
      uses frontmatter — so this is a no-op locally, which is exactly why it
      went unnoticed).
- [x] Suite + `npm run validate` green.

Deferred: none

## Fixed — 2026-10-14

- **One parser.** `parseMarkdown` in `packages/md/src/model/prose.ts` now registers GFM and YAML
  front matter, and `corpus()` calls it instead of configuring its own `fromMarkdown`. Before, the
  two were configured separately; adding front matter to one only would have made them disagree
  about where a section is — the two-readers defect plan 0404 removed for link resolution.
- **Red first.** `packages/md/tests/frontmatter.test.ts` failed four ways before the fix — a phantom
  section, no `yaml` node, a phantom `sectionPath` on a table placed before any heading, and a link
  inside the YAML read as a link — and passes after. Removing the extension from the parser reds the
  same four.
- **What still reads front-matter lines**, pinned by tests: `terms()` (the regression proposal 001
  depends on) and `pointers()` — both scan text lines and set aside code only. The ledger reads
  through `proseText`, which also sets aside code only.
- **A decision the fix makes:** a Markdown link written inside front matter is no longer a link. A
  renderer shows YAML as data, not as Markdown, so it was never a link to a reader; it was read only
  because the phantom heading held it. Stated in the changeset.
- **This repository:** `check:corpus` on `main` and on the fix report the same counts — 270
  documents, 2166 links, 715 pointers, 3009 checks.
- **Dependencies:** `micromark-extension-frontmatter` 2.0.0 and `mdast-util-frontmatter` 2.0.1 (MIT).
  The lockfile hoists them and reuses the existing micromark/mdast packages; it adds only `fault`,
  `format` and a nested `escape-string-regexp`.
