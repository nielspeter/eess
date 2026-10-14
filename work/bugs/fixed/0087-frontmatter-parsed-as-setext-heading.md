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

**What is front matter.** A line-1 `---` block is front matter — a `yaml` node, not a section — only
when it is a YAML mapping that parses with no error and holds no task box and no link into the
repository (`isFrontMatter`, `packages/md/src/model/prose.ts:48`). Anything else is read as Markdown,
exactly as before front matter was parsed (`parseMarkdown`, `:64`).

**Why the conditions — the review round.** The first build registered the front-matter extension
alone. Architect and enforcement both measured that it accepts anything between a line-1 `---` and
the next `---`: a done plan whose body opened with a horizontal rule had its open task box and a dead
link swallowed as "YAML", and `honestyAtClose` and `resolve()` went from red on `main` to green. That
was a regression the fix created, so coding stopped and the rule was settled on paper with both
lenses before it was rebuilt. Their measurements set each condition:

- _No YAML error, not merely a mapping:_ the `yaml` library returns a mapping beside a
  `DUPLICATE_KEY`, an `UNEXPECTED_TOKEN` or a `MULTIPLE_DOCS` error, and the last hides a box and a
  link after a `...` line.
- _No task box and no link into the repository:_ valid YAML can carry `  - [ ] still open` or
  `  [the migration](missing.md)` on an indented continuation line, and `main` checked both.
- _Kept as front matter:_ a `# comment` line and an external URL, both ordinary in real front
  matter; rejecting a heading-like comment would reject real files.

**One parser.** `parseMarkdown` is the only Markdown parser in eess-md: `corpus()` calls it, and the
prose readers default to it, so they cannot disagree about where a section is. (`scripts/check-docs-code.mjs`
parses on its own; it reads code blocks only and never registered front matter.)

**Tests** (`packages/md/tests/frontmatter.test.ts`, 13): the phantom section, the `yaml` node, a
table's `sectionPath`, `terms()` and `pointers()` still reading front-matter lines, a BOM and CRLF;
and every shape that must stay Markdown — a link into the repository, a body opening with a rule, a
box or a link on a continuation line, a box alone, a sequence, a duplicate key, a second document,
an empty block, a blank first line, an unterminated block.

**Sabotage, measured:** the pre-fix parser 4 red; YAML errors ignored 1; the mapping not required 1;
the task box not checked 1; the repository link not checked 1; external links counted 2; the
Markdown never inspected 3. A `linkReference` clause was removed because it could not fire: a
reference link in YAML is already a YAML error.

**This repository:** `check:corpus` reports 270 documents, 2166 links, 715 pointers and 3009 checks on
`main`, and 269, 2166, 714 and 3008 on the fix — the difference of one is this record moving to the
frozen `fixed/` folder, not the parser.

**Dependencies:** `micromark-extension-frontmatter` 2.0.0 and `mdast-util-frontmatter` 2.0.1 (MIT);
`yaml` 2.9.0 (ISC), already in the tree as a development dependency and now a runtime one at the same
version. The lockfile adds `fault`, `format` (0.2.2, unmaintained, no license field) and a nested
`escape-string-regexp`.

**Not fixed here, recorded:** a `---` block that falls back to Markdown does so silently, so
front matter with a YAML error still shows its phantom section without a word — [bug 0410](../0410-front-matter-read-as-markdown-says-nothing.md).
