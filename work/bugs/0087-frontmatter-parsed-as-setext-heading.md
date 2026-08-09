# Bug 0087: YAML frontmatter is parsed as a setext heading

## Status

- **State:** Draft — reproduced against a fixture; root cause read from the
  source. No red test written yet.
- **Reported:** 2026-08-09 — self-found while checking whether
  [proposal 001](../proposals/001-md-corpus-rule-coverage.md) could support
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

`packages/md/src/corpus.ts:95-98` parses with `fromMarkdown` using the GFM
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

- [ ] Red test written first: a frontmatter-bearing fixture asserts its section
      list contains **only** its real headings — failing today with the phantom
      depth-2 entry.
- [ ] The `yaml` node carries the frontmatter's raw text and start line.
- [ ] `terms()` still matches labels inside frontmatter (the text-line scan is
      unaffected) — a regression test, since proposal 001 depends on it.
- [ ] `MdTable.sectionPath` on a frontmatter-bearing document no longer includes
      the phantom section.
- [ ] `npm run check:corpus` unchanged on this repo (no corpus document here
      uses frontmatter — so this is a no-op locally, which is exactly why it
      went unnoticed).
- [ ] Suite + `npm run validate` green.

Deferred: none
