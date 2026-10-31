# Bug 0558: a reference-style link or a raw HTML link is never examined, and `resolve()` says nothing

## Status

- **State:** Draft — part (a), reference-style links read as links, fixed 2026-10-30 in PR #282
  (Fix 1's first two bullets); part (b), a dangling reference, done otherwise 2026-10-31 in PR
  #284: it is not a link, so it is found with the family's pattern for text of a named shape,
  `mentions()` and an absence rule, shown in `examples/md/a-reference-with-no-definition-is-reported.test.ts` (see "Part (b), decided"); a match in
  inline code or written escaped is still reported, deferred to [bug 0571](./0571-a-mention-cannot-be-selected-by-how-it-is-written.md). Open: the HTML half
  (Fix 2). Measured on the v0.16.0 build (eess-md
  0.13.0), Node 24.22.0; amended 2026-10-30 after PR #280's method and enforcement reviews.
- **Severity:** High — a false green: `links().should().resolve()` passes over a broken link
  written in a form it does not read, and its count gives no sign that it skipped one.
- **Origin:** self-found · the maintainer's question, 2026-10-30, whether GitHub Flavored Markdown
  is supported; measured by probing each GFM construct against the link check, then against the
  GFM spec (Version 0.29-gfm, 2019-04-06).
- **Reported:** 2026-10-30

## Symptom

`links(c).should().resolve()` reads only inline links, `[text](url)`. Two other ways to write a
link are never selected, never resolved and never reported:

1. **A reference-style link**, whose target is a definition elsewhere in the document,
   `[label]: ./target.md`. The spec has three forms, all measured unexamined: full
   `[text][label]` (a number works as a label, `[text][1]`), collapsed `[label][]`, and shortcut
   `[label]`.
2. **A raw HTML link**, `<a href="./target.md">`, which GFM allows in a document.

The rule's `examined` counts only the inline links, so a document whose broken links are all in
these forms is green with a count that looks complete.

A third way a reference link breaks is a common one: its definition is deleted, or its label
renamed. The reference then is not a reference at all: the parser leaves `[text][gone]` as plain
text (measured: `A [full][gone] and [collapsed][] and [shortcut].` with no definition is one
`text` node), GitHub shows the brackets literally, and no rule sees it.

Why the HTML half is a bug when [proposal 015](../proposals/015-md-wikilinks-are-read-or-reported.md)
filed wikilinks as a proposal: an `<a href>` renders as a link on GitHub, and `links()` is "rules
over the corpus's markdown links" (`packages/md/src/builders/links.ts:149`); a wikilink renders as
text, so no shipped rule claims it.

## Reproduction

One document under `docs/**`, every target missing:

```markdown
# Links

A [reference link][gone] and a [shortcut] link.

[gone]: ./gone-reference.md
[shortcut]: ./gone-shortcut.md

<a href="./gone-html.md">raw html</a>

An inline [control](./gone-inline.md).
```

`links(corpus({ cwd, roots: ['docs/**'] })).should().resolve().violations()`, measured:

```text
links: examined 1 · violations 1
  line 10 broken link: "./gone-inline.md" does not resolve to a file in the repo
```

The reference link, the shortcut link and the HTML link, three broken targets, produce nothing.

## Root cause

Before PR #282, the link walk turned a `link` node into an element and only counted a
`linkReference` node, for the declaration scan that `areLabelled()` reports from; it now makes
the reference a link (`packages/md/src/model/links.ts:195`). The `definition` node that holds a
reference link's URL was never read, and an `html` node is
never scanned. `resolve()` runs over the elements the walk produced, so it cannot see either form.

The family already discloses both forms elsewhere: `mentions()` reports a mention inside a raw
HTML block or a reference-style link's text as `md/unread-mention`
(`packages/md/src/builders/mentions.ts:49`), and before PR #282 `areLabelled()` reported a
declaration made of reference-style links as one it does not read. Its inline-HTML recogniser is
`OPENS_A = /^<a\s[^>]*\bhref\s*=/i` (`packages/md/src/model/phrasing.ts:64`); it reads inline
`<a>` only, and a block-level `html` node is a separate cause there (`'html-block'`). `links()` is
the rule a reader trusts for "every link resolves", and it does neither.

## Why it matters

GitHub READMEs and wikis use reference-style links to keep long URLs out of the prose. A corpus
written that way has a link gate that checks a fraction of its links and says it checked them all.
Four tracked Markdown files in this repository hold a reference definition, counted by parsing
every `git ls-files '*.md'` file with eess-md's parser (PR #280's method review). All four are
fixtures (an example, two eess-md tests, a nonvacuity probe), and none is under `check:corpus`'s
roots (`scripts/check-corpus.mjs:115`), so this repository's own gate does not show the gap; an
adopter's corpus can.

## Fix

Two parts, one root cause:

1. **Resolve reference-style links.**
   - **Decided at the build (2026-10-30, the maintainer):** a reference-style link is a link
     to every `links()` rule, not only to `resolve()` (`mentions()` still reports a mention in a
     reference link's text as unread: it does not join a reference to its definition, and when it
     does it reuses `packages/md/src/model/definitions.ts`). The link walk (`collectLinkBlocks`) feeds `links()`,
     `beLinkedBack()` and `areLabelled()`'s declaration scan alike, so all three read it: each
     element is the reference, at its own line and block, carrying its definition's label and
     line as `.definition`. `beLinkedBack()` then counts a link back written as a reference (a
     false red before), and `areLabelled()` selects a declaration's reference links, so its
     "holds reference-style links" finding goes. The narrower option, `resolve()` alone, would
     have left one link visible to one rule and not the next.
   - A `linkReference` is a link with its definition's URL: select it in `links()` and resolve it
     with the same `resolveLink`. Labels match as the spec says, "perform the Unicode case fold"
     (`[ẞ]` matches `[SS]`), with the first of several matching definitions used: take the
     parser's `identifier`, which already normalizes so (`normalizeIdentifier('ẞ')` is `SS`),
     never a comparison of eess-md's own.
   - **The finding names the definition's line**, where the URL the author must edit is, and one
     definition used by several references gives one finding and at most one fix: the fix's span
     lies in the definition, and overlapping fixes that differ are dropped (`packages/core/src/apply-fixes.ts:65`;
     identical ones are one edit since [bug 0564](./fixed/0564-two-identical-fixes-cancel-each-other.md)).
   - **A dangling full or collapsed reference is reported**: `[text][label]` or `[label][]` outside
     code whose label has no definition, read from the source text by offset, since the parser
     unescapes `\[a\]\[b\]` into the text `[a][b]`. "reference has no definition" at its line,
     counted in `examined`, and not suppressible, as a broken link is not.
   - **Its false reds have a remedy.** `matrix[i][j]` and `int[x][]` in prose are plain text
     (measured) and have the full and collapsed shapes; the finding says to put such text in a
     code span, which clears it, and a row pins that.
   - **A dangling shortcut `[label]` stays out**: `[x]`, `[WIP]`, `[id].vue`, a task box and a
     GitHub alert, `> [!NOTE]` (measured: plain text), are all that shape, and reporting them
     would be false reds. The record says so, and a row pins it.
   - **Part (b), decided (2026-10-31): the three bullets above are superseded.** A first build in
     PR #284 made a dangling reference a `links()` element with no destination, reported by
     `resolve()` and `beLinkedBack()`. Its enforcement review measured a regression (every other
     reader of `links()` took the element for a link: `sections().haveLink()` passed a section
     holding only `matrix[i][j]`, and an `areLabelled()` declaration lost its "names no record"
     finding) and false reds (26 of 29 findings across 566 READMEs were text the author meant:
     d3's `[, accessor]` notation, array indexing). The maintainer: follow the established
     pattern, which is [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)'s: the root offers building blocks, and a shape ships as an
     example. A dangling reference is text of a shape the corpus names, not a link, and the
     family finds such text with `mentions(corpus, { pattern })`; `examples/md/a-reference-with-no-definition-is-reported.test.ts` pairs it with an absence
     rule (`.should().notExist()`, as `examples/md/box-marks.test.ts` does), leaving out matches in
     links with `areLinked()`. It is opt-in, so a corpus whose
     prose holds the shape on purpose writes its own pattern, and its rule id lets a line be
     waived. Its pattern allows empty text, so a README badge whose outer label lost its
     definition (`[![npm][npm-image]][npm-url]`, read as `[][npm-url]`) is reported; link text
     holding balanced brackets (`[a [b] c][gone]`) is beyond one regex and is not. A match in
     inline code or written escaped is still reported, since no public block selects either:
     [bug 0571](./0571-a-mention-cannot-be-selected-by-how-it-is-written.md).
2. **Report raw HTML links as unread.**
   - An `href` that is not external (`EXTERNAL_RE`, `packages/md/src/model/links.ts:69`) on an
     `<a>` or `<area>`, any letter case and quoted or unquoted, is reported as unread, so the rule
     is never green over one without a word. Reuse the recogniser at
     `packages/md/src/model/phrasing.ts:64`, widened to blocks.
   - **The scan reads the source text, not only `html` nodes.** An unquoted `href` holding a `/`
     is not an `html` node to eess-md's parser (micromark 4.0.2): `p <a href=./x.md>x</a>` parses as
     the text `p <a href=./x.md>x` and an `html` node `</a>` (measured). GitHub renders it as a
     link: its Markdown API returns `<p>p <a href="./x.md">x</a></p>` for that input, and the same
     for `<a href=docs/x.md>` and `<A HREF=./x.md>` (measured 2026-10-30). So the scan also reads
     `text` by source offset, as the dangling-reference half does.
   - Reported at the line the `href` sits on inside a multi-line block; not counted in `examined`,
     since it is not judged; and `.expectEmpty()` does not silence it.
   - An external `href` (the centred badge row a README opens with) produces nothing, and an
     `html` node that is one HTML comment is not read (`packages/md/src/model/phrasing.ts:225`).
   - The remedy the finding gives must clear it: write the link in Markdown, with blank lines
     inside the HTML block so it is parsed as Markdown (`<p align="center">`, a blank line,
     `[Guide](./guide.md)`, a blank line, `</p>`).
   - **Open, decided before the fix is built:** some HTML has no Markdown remedy. A README logo
     sized with `width` (`<a href="./docs/"><img src="logo.svg" width="120"></a>`) cannot be
     written in Markdown, and `md/unread-mention`, the precedent, cannot be suppressed
     (`packages/md/src/builders/mentions.ts:259`). So either the unread finding can be suppressed
     per cause, with a reason, or this fix resolves the `href` ([proposal 022](../proposals/022-md-a-raw-html-link-is-resolved.md)'s ask) instead of
     reporting it unread; and [proposal 022](../proposals/022-md-a-raw-html-link-is-resolved.md)'s priority, which assumes "red with unread" is
     acceptable, follows that decision.
   - Resolving the `href` is a new capability, [proposal 022](../proposals/022-md-a-raw-html-link-is-resolved.md).
3. **The docs.** `docs/markdown.md:232` and `docs/markdown.md:690` state what `links()` reads, and
   change with it.

Images (`![alt](./x.png)`, `![alt][ref]`, `<img src>`) are not read either, measured; `links()`
does not claim them (`docs/markdown.md:232`), so they are
[proposal 024](../proposals/024-md-an-images-file-exists.md)'s, not this bug's.

**A break.** Builds that are green today go red where a reference link is broken, so the changeset
marks it `**Breaking (@nielspeter/eess-md):**`, a minor on 0.x.

## Verification

- [x] Red test written first: the reproduction's `[reference link][gone]` and `[shortcut]` produce
      a broken-link finding each, naming their definition's line. `packages/md/tests/reference-links.test.ts`:
      9 tests red before the fix (PR #282), covering the full, collapsed, shortcut and numbered
      forms, `beLinkedBack()`, `areLabelled()` and `haveLink()`; PR #282's reviews added 7 more,
      each red under its own sabotage (one finding per definition under `beLinkedBack()`, the
      first definition wins, a fix never over a title or label, front matter holding a reference
      link, `haveLink()`'s condition form).
- [ ] Red test: a dangling full reference `[text][gone]` and a dangling collapsed `[gone][]`, with
      no definition, are each reported at their line. done-otherwise: by the corpus's own rule,
      `examples/md/a-reference-with-no-definition-is-reported.test.ts` (its `violating-renamed-definition` and `violating-deleted-definition` fixtures,
      proven load-bearing by `check:nonvacuity`'s example swaps), not by `links()`; see "Part (b),
      decided".
- [ ] A dangling shortcut `[WIP]`, a task box and `> [!NOTE]` produce nothing. done-otherwise: the
      example's clean fixture holds a task box, `[WIP]` and an alert, and reports nothing.
- [ ] An escaped `\[a\]\[b\]` produces nothing; `matrix[i][j]` is reported with a code-span remedy
      that clears it. deferred→[bug 0571](./0571-a-mention-cannot-be-selected-by-how-it-is-written.md): both are still reported by the example's rule (measured),
      since no public block selects a match in inline code or written escaped, and the absence
      rule's finding names no remedy beyond its `because`; a waiver comment with the rule's id
      clears a line.
- [x] Two references to one broken definition give one finding at the definition's line, and at
      most one fix (a moved target's fix rewrites the definition's URL).
- [x] A label matched by Unicode case fold (`[Text][FOO]` with `[foo]: …`, and `[STRASSE]` with
      `[straße]: …`) is resolved.
- [x] `examined` counts the reference links.
- [ ] Red test: the reproduction's `<a href>` produces an unread finding. Green today.
- [ ] An external `<a href="https://…">` and `<!-- <a href="./x.md"> -->` produce nothing;
      `<A HREF=./x.md>`, `p <a href=./x.md>` (a text node to the parser) and a single-quoted
      `href` are reported, at the `href`'s own line.
- [ ] The unread finding's remedy, applied, clears it.
- [ ] A nonvacuity row reddens on a broken reference-style link, and one on an internal
      `<a href>`, each asserting the message, not only the rule id. The reference half is in
      (PR #282): `corpus/declared-block/reference-declaration`, in place of the
      `unreadable-declaration` row, asserts the definition's broken-link message and is red on
      the old build. It is fixture-tier: it drives the builder over a fixture root, and this
      repository's own `check:corpus` examines no reference-style link, since its corpus holds
      none; a probe through the production gate was left out for its cost per nonvacuity run
      ([bug 0552](./0552-nonvacuity-shard-3-runs-near-its-timeout.md)). The dangling half needs no row of its own: its example's
      fixtures are swapped by `check:nonvacuity`'s examples row. The `<a href>` half is open.
- [x] The declared-block nonvacuity rows still fire only their own finding: the probe that held
      reference links unread is now `scripts/nonvacuity/bad-declared-block/reference.md`, and all
      ten scenarios pass on the new build.
- [ ] A changeset naming `@nielspeter/eess-md`, marked `**Breaking (@nielspeter/eess-md):**`. Part
      (a)'s is `.changeset/a-reference-link-is-a-link.md`; (b) ships no behaviour (an example), and
      its label-as-written change is `.changeset/a-definitions-label-as-written.md`, a patch; the
      HTML half adds its own.
- [ ] `npm run validate` green.

Deferred: resolving a raw HTML link → [proposal 022](../proposals/022-md-a-raw-html-link-is-resolved.md);
images → [proposal 024](../proposals/024-md-an-images-file-exists.md); selecting a mention in inline code or written escaped →
[bug 0571](./0571-a-mention-cannot-be-selected-by-how-it-is-written.md).
