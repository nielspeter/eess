# Spike 0574: what checking a link's fragment needs

Measured 2026-11-01 for [bug 0136](../bugs/0136-link-fragments-are-never-checked.md) and
[bug 0562](../bugs/0562-two-anchors-in-the-docs-site-are-dead.md), time-boxed to about an hour,
then corrected by PR #286's architect and enforcement reviews (see "Corrections"). It ran as
throwaway scripts in a scratch directory against the built packages of `main` at 7ba8bbe3
(eess-md 0.13.0), on Node 24.22.0 (Unicode 17.0), over this repository's `work/`, `adr/` and
`docs/` (the `check:corpus` roots), and over the README files in this repository's `node_modules`.
`github-slugger` 2.0.0 was installed into the scratch directory only. Nothing here is built.

## The question

[Bug 0136](../bugs/0136-link-fragments-are-never-checked.md)'s Fix grew open questions while it
was a Draft. Each is a decision the build needs:

1. Which rule turns a heading into its anchor, when renderers differ?
2. Which headings and other marks give a document its anchors, and what text does the rule read?
3. How does a caller say which renderer its corpus is read by, without eess-md naming tools?
4. What does a rule say about a fragment it cannot judge, and which targets are those?
5. What does the moved-link autofix do with a fragment?
6. What does it cost?

## 1. The slug rules, read from the renderers

**VitePress** 1.6.4, the version installed here, slugs with `slugify` from `@mdit-vue/shared` (a
dependency of `vitepress`, bundled into its build) and passes it to `markdown-it-anchor`:

```js
str
  .normalize('NFKD')
  .replace(rCombining, '')
  .replace(rControl, '')
  .replace(rSpecial, '-')
  .replace(/-{2,}/g, '-')
  .replace(/^-+|-+$/g, '')
  .replace(/^(\d)/, '_$1')
  .toLowerCase()
```

`markdown-it-anchor` runs with `level: 1`, so every heading level is anchored, at any depth,
including one inside a list item or a blockquote. A heading's text is the concatenation of its
`text` and `code_inline` tokens, so an image's alt and raw HTML tags are left out. A duplicate takes
`-1`, `-2`, …; an explicit `{#id}` (the attrs plugin) sets the id and must be unique. `vitepress`
exports `createMarkdownRenderer`: rendering all 50 documents of `docs/` with it took 2.5 s and gave
793 heading ids, none differing from the prototype's (measured by the enforcement review).

Four heading shapes are slugged from markdown-it's tokens, not from the parsed text (measured with
that renderer). A rule could strip a shortcode from the text; the other three it cannot recover:

```text
heading               VitePress id       mdast text, then slugify
## :tada: Release     release            tada-release      (the emoji token is dropped)
## Foo &amp; Bar      foo-amp-bar        foo-bar           (the entity is kept as written)
## Copy&copy;right    copy-copy-right    copy©right
## Notes[^1]          notes-1            notes             (VitePress has no footnote plugin)
```

None occurs in a heading of `docs/` today.

**GitHub** is read through `github-slugger` 2.0.0 (ISC, no dependencies, ESM, about 16 KB), which
mirrors GitHub's rule: lowercase, remove every character on a generated list, turn each space into
`-`, number duplicates `-1`, `-2`, …. The list is generated from Unicode 13.0 (its build pins
`@unicode/unicode-13.0.0`). Measured through `slug()` over every code point, it keeps letters,
marks, digits and connectors as Unicode 13 assigned them, plus 130 symbols, and removes 14,679
letters and marks added since; 🎉 is removed (`slug('🎉 Release')` is `-release`). A regex over
Unicode properties keeps those later letters, so it gives a different answer on each Node version
as V8's Unicode tables move. The package's list does not (its lowercasing is still the runtime's
`toLowerCase`): that determinism, not fidelity, is why it is the dependency rather than a copy. Whether GitHub itself slugs post-Unicode-13 letters as the
package does is not measured (section 7).

## 2. This repository's corpus

The prototype resolved each internal link with a fragment through `resolveLink` with the gate's own
two profiles (`SITE_OPTS` and `REPO_OPTS`, `scripts/check-corpus.mjs:255`), then looked the decoded
fragment up in the target's anchor set: every heading at any depth, slugged by the renderer of the
**linking** document's root (VitePress for `docs/`, GitHub for `work/` and `adr/`, as the gate
already routes, `scripts/check-corpus.mjs:278`), plus every `<a id>`/`<a name>`, plus GitHub's
`user-content-` alias.

```text
39 links with a fragment: 30 to another loaded document, 9 to their own; none to a code file
37 resolve
 2 dead, both on the VitePress site:
   docs/violation-reporting.md:103  /cli#doctor                                   no heading names it
   docs/migrating-to-0.15.md:397    ./markdown.md#a-documents-shape-built-from-blocks
                                    GitHub's slug; VitePress's is a-document-s-shape-built-from-blocks
```

These are [bug 0562](../bugs/0562-two-anchors-in-the-docs-site-are-dead.md)'s two, and no other. One
link resolves on GitHub but would not on VitePress (`work/proposals/001-md-corpus-rule-coverage.md:115`);
it lives in `work/`, which GitHub renders, so it is correct as written. A single rule for the whole
repository would have called it dead, or missed the two above. No link crosses from one root to
another, so the corpus cannot tell the linking document's rule from the target's; the gate's routing
decides it. The repository holds no `{#id}` heading and no fragment on an unloaded file.

## 3. READMEs: the false-red risk

The 566 files `find node_modules -maxdepth 3 -iname 'readme.md' -size -400k` lists (the enforcement
review's wider selection, 570 files, gave the same counts). Same-document anchors only (`#…`),
GitHub's rule:

```text
155 documents hold same-document anchors; 3,918 fragments; 48 match no anchor (1.2%)
```

A hand read of a sample: most are drift a reader also hits, an anchor left behind when a heading
was renamed (`#pow-scales` beside the heading `Power Scales`, `#gold-sponsors` beside `Sponsors`,
`#-built-in-prompts` beside `Built-in prompts`, `#basis` where the document's `<a name>` anchors are
`curveBasis` and its siblings). Two kinds depend on what GitHub does: 11 of the 48 match a heading
in other letter case only, and one points at a raw HTML `<h3>`.

Across documents, the sample holds 68 fragment links: 33 into another `.md` file and 35 line
fragments (`#L…`) on `.js`/`.ts` files. In a corpus that loads only the README, every one of them
targets a file the corpus did not load. Of the 33 `.md` targets, 10 exist in the installed packages
and 23 are missing, which `resolve()` reports already; of the 35 line targets, 27 exist (measured
by the enforcement review). Raw HTML in the sample holds 1,124 more `href="#…"`
fragments, which `links()` does not read at all; that is the raw-HTML link boundary
[proposal 022](../proposals/022-md-a-raw-html-link-is-resolved.md) is about, and nothing here
changes it.

## 4. Cost

Slugging every heading of the 566 READMEs took 59 ms in all. Loading this repository's corpus took
6.4 s on a quiet machine (16 s under load); the anchor sets are noise beside it. Rendering `docs/`
with VitePress takes 2.5 s, which every `check:corpus` run, and so every non-vacuity row that runs
it, would pay: it belongs in a test, not in the gate.

## 5. Decisions

Decided from [ADR-009](../../adr/009-agent-first-failure-surfaces.md) (fail closed),
[ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md),
[ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) rules 3 and 5, and the
existing pattern of `LinkResolveOptions`, which covers site conventions "generically instead of
naming any tool" (`packages/md/src/model/resolve-link.ts:10`). Each can be overruled.

1. **The renderer's rule is an option; GitHub's is the default.** `LinkResolveOptions` gains one
   member, the anchor rule: a pure function from a document's heading texts, in document order, to
   their ids (list in, list out, so the renderer's duplicate numbering and explicit `{#id}` live in
   the rule and a result of the wrong length is a configuration error), plus the alias forms of an
   id the renderer also answers to (GitHub's `user-content-`). The rule is the **linking**
   document's renderer's, since a reader stays in one renderer. The default is GitHub's, built on
   `github-slugger` as a dependency of eess-md and exported from the root, so a caller who wraps it
   keeps its alias. eess-md names no renderer but this default: the rule is github.com's renderer's
   (GitHub Flavored Markdown's specification defines no heading ids), chosen because a
   repository-hosted corpus is read there; any other is the caller's to pass. The rule also names
   the page its host shows for a directory (GitHub's: the directory's `README.md`), and the HTML
   anchors its renderer keeps (decision 2). A renderer's anchor rule is not a
   document's shape, so [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) is not
   engaged. This repository's `check:corpus` passes VitePress's rule for `docs/`, importing
   `slugify` from `@mdit-vue/shared` (bundled into `vitepress`, not installed on its own, so a root
   devDependency in the range `vitepress` declares); the real pin is a test that renders `docs/`
   with VitePress's own `createMarkdownRenderer` and finds the gate's anchor sets equal to its ids,
   so a VitePress upgrade that changes ids reds a test, not the gate's cost.
2. **The anchor set.** Every heading at any depth (not the section index, which leaves headings in
   containers out). The text the rule reads is eess-md's own extraction, the concatenation of the
   heading's text and inline-code values, with raw HTML, image alt and breaks left out; it is not
   `headingName`, which keeps inline HTML (`Setup <Badge/>` would read as `setup-badge`). The text
   is the renderer's input as written, leftover spaces included: VitePress trims them, so
   `## Setup <Badge/>` is `setup` there, while `github-slugger` keeps them, so it is `setup-` under
   the default (section 7). Then the HTML anchors, read from `html` nodes with comments removed, so
   an id inside code or a commented-out anchor is not one, and limited to what the rule says its
   renderer keeps: the default counts `id` and `name` on `<a>` only, the closer reading while
   section 7 is open; this repository's VitePress rule counts `id` on any element, which VitePress
   renders as written. The four VitePress shapes of section 1 are a known divergence of a
   text-based rule; the build pins them and records each one it does not match as a bug. `#top`
   in any letter case and an empty `#` name the top of the page (HTML's rule) and resolve.
3. **One owner computes the verdict; each door decides what it means.** `resolveLink` checks the
   fragment against the target's anchor set and reports the result on the target, as an additive
   field (found, absent with the nearest anchors, or malformed), the way it already reports a
   directory whatever `resolveDirectories` says (`packages/md/src/model/resolve-link.ts:49`).
   `resolve()` reds an absent or malformed fragment; `haveLiveTargets()`, `beLinkedBack()` and
   `mentions()` ignore it, documented, since each asks a different question of the target. The comparison is exact, after percent-decoding:
   letter case included, the stricter reading until section 7 is measured; a malformed escape is a
   finding, never a thrown error. The finding names the fragment, the target, the rule that judged
   it, and the nearest anchors, including one that differs only in letter case. Anchor sets are
   cached per rule, then per document, so the gate's two profiles cannot answer for each other.
4. **What the rule cannot judge.** For `self` and `document` targets the anchor set is there. For
   the rest:
   - A Markdown file the corpus did not load is read for its anchors alone, the way
     `pointerResolves` reads a file outside the roots (`readCorpusFile`,
     `packages/md/src/model/corpus-internals.ts:31`), unless the caller ignored it.
   - A `#L10`, `#L10-L20` or `#L10C5` fragment on a file that is not Markdown is a line, checked
     against `lineCount(readCorpusFile(…))` as a pointer's line is, and a column against its
     line's length
     (`packages/md/src/conditions/pointer-resolve.ts:102`). On a Markdown file it is an anchor like
     any other: GitHub renders the file, and the line form reaches nothing there.
   - A fragment on a directory is checked against the page the rule names for a directory (under
     the default, the directory's `README.md`), loaded or read on demand; a directory with no such
     page, or a rule that names none, leaves it not judged. A directory holding the `tryIndex` file
     already resolves as that document.
   - Anything else (a fragment on an ignored file, on a file of another format, or on a hand-built
     link from outside the corpus) is not judged, and that is a finding in [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)'s existing class
     for what a rule's own instrument could not read: unsuppressable (`bypassFilters`), as eess-md's
     unread mentions are (`packages/md/src/builders/mentions.ts:244`), and one per cause within a
     rule, as [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) rule 5 says. The cause is the target file, and the finding names it, its
     reason and the links it covers. In the README sample this leaves nothing not judged: the 10
     `.md` targets that exist are read, the 23 missing are reported as missing, and the 27 line
     targets that exist are checked.
5. **The autofix carries a fragment only when the new target has it**, at both callers of
   `movedLinkFix` (`resolve()` and `beLinkedBack()`). Otherwise the finding stays, with no fix.
6. **The gate's summary counts fragments**: checked, and not judged, from the same owner.

## 6. The build, split, released together

The decisions are more than one reviewable change, and a bug closes whole, so the build is two, and
both ship in one release: 0136 alone would give an adopter a `resolve()` that checks some fragments
and passes others without a word. Each is a breaking minor of `@nielspeter/eess-md`, since
`resolve()` newly reds on adopters' corpora.

- **[Bug 0136](../bugs/0136-link-fragments-are-never-checked.md), narrowed:** decisions 1–3 and 6
  for `self` and `document` targets, with a red test per break class, the
  [bug 0562](../bugs/0562-two-anchors-in-the-docs-site-are-dead.md) fixes in the same PR (the gate
  goes red on them first), and a non-vacuity row per routing region.
- **[Bug 0575](../bugs/0575-a-fragment-the-link-check-cannot-judge-passes.md):** decisions 4 and 5:
  the unloaded Markdown file, the line form, the directory, the not-judged finding, and the autofix.

## 7. Not measured: what GitHub does

Five questions are GitHub's behaviour, and the only instrument is GitHub:

1. whether a fragment in other letter case reaches a heading;
2. whether a raw HTML heading has an anchor;
3. which HTML `id`s survive GitHub's sanitizer, under their `user-content-` form;
4. how a heading holding an emoji shortcode (`## :tada: Release`) or a letter added after Unicode
   13 is slugged;
5. whether the text GitHub slugs keeps a space that inline HTML leaves behind
   (`## Setup <Badge/>`: `setup` or `setup-`).

Measuring means sending a test document to GitHub (its Markdown API for the HTML ids, a rendered
page for navigation), which is publishing, so it waits for the maintainer's word. Until then the
build takes the reading that fails closed where one exists: exact case (at worst it reports the 11
fragments of section 3 that differ only in case), and no anchor for an HTML heading without an id.
For question 3 the default counts `id` and `name` on `<a>` only, a common README pattern, and not
`id` on other elements; questions 4 and 5 follow the package, and the build's tests pin what it
gives.

## Corrections

PR #286's reviews corrected this record before merge; the first version is in the PR's history.

- Section 1 first said the list keeps 4,753 symbols "emoji among them" and removes 137 later
  letters. Both were wrong: the measurement recompiled the package's regex with the `u` flag, and
  its source is written for non-`u` mode. Driven through `slug()`, it keeps 130 symbols and removes
  14,679 letters and marks. The first version also gave fidelity to GitHub as the reason for the
  dependency; it is determinism.
- The first version's decision 1 was a factory returning a stateful function; decision 3 named only
  `resolve()`; decision 4 cited [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md), whose bounded-instrument rules do not fit a scope the
  caller chose, and left the directory target, the `.md` line form, and on-demand reading
  undecided. Section 5 now decides each.
- The second version credited the default rule to GitHub Flavored Markdown, whose specification
  defines no heading ids; it is github.com's renderer's. It said `## Setup <Badge/>` is `setup`
  under both renderers; under `github-slugger` it is `setup-`. It gave the README sample's
  cross-document links as 74, 39 of them into `.md` files, all read; in the 566-file sample they are
  68 and 33, and only 10 of the 33 exist. It left "the directory's index document" undefined; the
  rule now names the page.
