# Spike 0574: what checking a link's fragment needs

Measured 2026-11-01 for [bug 0136](../bugs/0136-link-fragments-are-never-checked.md) and
[bug 0562](../bugs/0562-two-anchors-in-the-docs-site-are-dead.md), time-boxed to about an hour. It
ran as throwaway scripts in a scratch directory against the built packages of `main` at 7ba8bbe3
(eess-md 0.15), on Node 24.22.0, over this repository's `work/`, `adr/` and `docs/` (the
`check:corpus` roots), and over the 566 README files of the public packages installed in this
repository's `node_modules`. `github-slugger` 2.0.0 was installed into the scratch directory only.
Nothing here is built.

## The question

[Bug 0136](../bugs/0136-link-fragments-are-never-checked.md)'s Fix grew six open questions while it was a Draft. Each is a decision the build needs:

1. Which rule turns a heading into its anchor, when renderers differ?
2. Which headings and other marks give a document its anchors?
3. How does a caller say which renderer its corpus is read by, without eess-md naming tools?
4. What does a rule say about a fragment it cannot judge?
5. What does the moved-link autofix do with a fragment?
6. What does it cost?

## 1. The slug rules, read from the renderers

**VitePress** 1.6.4, the version installed here, bundles its own `slugify`
(`node_modules/vitepress/dist/node/chunk-D3CUZ4fa.js`, line 17690 in this build) and passes it to
`markdown-it-anchor`:

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
`-1`, `-2`, …; an explicit `{#id}` (the attrs plugin) sets the id and must be unique. The function is
not exported from `vitepress`'s public entry points.

**GitHub** is read through `github-slugger` 2.0.0, the package that implements GitHub's rule:
lowercase, remove every character on a generated list, turn each space into `-`, and number
duplicates `-1`, `-2`, …. The list is explicit, generated from one Unicode version, not from Unicode
categories. Measured over every code point, no property-escape regex reproduces it: the closest
(`[^\p{L}\p{M}\p{Nd}\p{Nl}\p{Pc} -]`) differs on 14,932 code points, mostly unassigned code points
and 4,753 symbols the list keeps (emoji among them), and 137 letters and marks of later Unicode
versions it removes. A copy written from categories would drift from GitHub silently; the package
is 10 KB, has no dependencies, is ESM, and comes from the author of the `mdast-util-*` and
`micromark-*` packages eess-md already depends on.

What neither source says, and only GitHub can: whether a fragment written in other letter case
(`#Concurrency` for `## Concurrency`) reaches the heading there, and whether a raw HTML heading
(`<h3>Technology Sponsors</h3>`) gets an anchor. See section 7.

## 2. This repository's corpus

The prototype resolved each internal link with a fragment through `resolveLink` with the gate's own
two profiles (`SITE_OPTS` and `REPO_OPTS`, `scripts/check-corpus.mjs:255`), then looked the decoded
fragment up in the target's anchor set: every heading at any depth, slugged by the root's renderer
(VitePress for `docs/`, GitHub for `work/` and `adr/`), plus every `<a id>`/`<a name>`, plus GitHub's
`user-content-` alias.

```text
39 links with a fragment (every target is a loaded document; none is a code file)
37 resolve
 2 dead, both on the VitePress site:
   docs/violation-reporting.md:103  /cli#doctor                                   no heading names it
   docs/migrating-to-0.15.md:397    ./markdown.md#a-documents-shape-built-from-blocks
                                    GitHub's slug; VitePress's is a-document-s-shape-built-from-blocks
```

These are [bug 0562](../bugs/0562-two-anchors-in-the-docs-site-are-dead.md)'s two, and no other. One
link resolves on GitHub but would not on VitePress (`work/proposals/001-md-corpus-rule-coverage.md:115`);
it lives in `work/`, which GitHub renders, so it is correct as written. A single rule for the whole
repository would have called it dead, or missed the two above.

## 3. Public READMEs: the false-red risk

Same-document anchors only (`#…`), GitHub's rule, over 566 READMEs:

```text
155 documents hold same-document anchors; 3,918 fragments; 48 match no anchor (1.2%)
```

A hand read of a sample: most are drift a reader also hits, an anchor left behind when a heading
was renamed (`#pow-scales` beside the heading `Power Scales`, `#gold-sponsors` beside `Sponsors`,
`#-built-in-prompts` beside `Built-in prompts`, `#basis` where the document's `<a name>` anchors are
`curveBasis` and its siblings). Two kinds depend on what GitHub does and are not settled here: 11 of
the 48 match a heading in other letter case only, and one points at a raw HTML `<h3>`.

## 4. Cost

Slugging every heading of the 566 READMEs took 59 ms in all; the corpus prototype's 16 s was the
corpus load. A per-document anchor set, built once and cached as `resolveLink`'s indexes are
(`packages/md/src/model/resolve-link.ts:108`), costs nothing a corpus run notices.

## 5. Decisions

Decided from [ADR-009](../../adr/009-agent-first-failure-surfaces.md) (fail closed),
[ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md) and the existing pattern of
`LinkResolveOptions`, which covers site conventions "generically instead of naming any tool"
(`packages/md/src/model/resolve-link.ts:10`). Each can be overruled.

1. **The renderer's rule is an option, GitHub's is the default.** `LinkResolveOptions` gains one
   member, a factory for the renderer's heading-id rule: called once per document, it returns a
   function from a heading's text to its id, so the renderer's own duplicate numbering and explicit
   ids live with the rule. The default is GitHub's, through `github-slugger` as a dependency of
   eess-md (section 1). eess-md names no other renderer; this repository's `check:corpus` passes
   VitePress's rule for `docs/`, beside the `rootDir` it already passes, with a test pinning it to
   the bundled function's output on the headings of section 2.
2. **The anchor set** is every heading at any depth (not the section index, which leaves headings in
   containers out), every HTML `id` and `name` attribute in the document, and, under the default
   rule, the `user-content-` form of each. The fragment is percent-decoded first; a malformed escape
   is a finding, never a thrown error. It is compared exactly, letter case included: the stricter
   reading, until section 7 is measured.
3. **Where the fragment is checked.** A `self` target and a `document` target: the fragment must be
   in the target's anchor set, or the finding names the fragment, the document, and the nearest
   anchors.
4. **A fragment the rule cannot judge is a finding, not a pass.** A fragment on a `not-in-corpus`
   target (a file the corpus did not load) has no anchor set to check against; reporting it follows
   [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md)'s rule that
   running out of knowledge is never a pass, and it names the remedy (load the file, or remove the
   fragment). One exception is decided: a `#L10` or `#L10-L20` fragment on a file is a line, checked
   against the file's line count as a pointer's line is
   ([bug 0561](../bugs/fixed/0561-a-pointer-one-line-past-the-end-of-a-file-passes.md)).
5. **The autofix carries a fragment only when the new target has it.** `movedLinkFix` checks the
   fragment against the new document's anchor set; when it is not there, the finding stays and no
   fix is offered, rather than a rewrite onto a document where the anchor does not exist.
6. **The gate's summary counts fragments**, checked and not judged, beside its link count.

## 6. The build, split

The decisions are more than one reviewable change, and a bug closes whole, so the build is two:

- **[Bug 0136](../bugs/0136-link-fragments-are-never-checked.md), narrowed:** decisions 1–3 and 6, with a red test per form, the
  [bug 0562](../bugs/0562-two-anchors-in-the-docs-site-are-dead.md) fixes in the same PR (the gate
  goes red on them first), and a non-vacuity row that reddens on a dead fragment.
- **[Bug 0575](../bugs/0575-a-fragment-the-link-check-cannot-judge-passes.md):** decisions 4 and 5,
  the fragment on a target with no anchor set, and the autofix.

## 7. Not measured: what GitHub does

Two questions are GitHub's behaviour, and the only instrument is GitHub: whether a fragment in other
letter case reaches a heading, and whether a raw HTML heading has an anchor. Measuring means sending
a test document to GitHub (its Markdown API for the HTML ids, a rendered page for navigation), which
is publishing, so it waits for the maintainer's word. Until then the build compares exactly and
anchors only what has an id, the reading that fails closed; at worst it reports the 11 fragments of
section 3 that differ only in letter case, and the one link to an `<h3>`.
