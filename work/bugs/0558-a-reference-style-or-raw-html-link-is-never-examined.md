# Bug 0558: a reference-style link or a raw HTML link is never examined, and `resolve()` says nothing

## Status

- **State:** Draft — measured on the v0.16.0 build (eess-md 0.13.0), Node 24.22.0; no red test yet.
  Amended 2026-10-30 after PR #280's method and enforcement reviews.
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

A third way a reference link breaks is the commonest: its definition is deleted, or its label
renamed. The reference then is not a reference at all: the parser leaves `[text][gone]` as plain
text (measured: `A [full][gone] and [collapsed][] and [shortcut].` with no definition is one
`text` node), GitHub shows the brackets literally, and no rule sees it.

Why the HTML half is a bug when [proposal 015](../proposals/015-md-wikilinks-are-read-or-reported.md)
filed wikilinks as a proposal: an `<a href>` renders as a link on GitHub, and `links()` is "rules
over the corpus's markdown links" (`packages/md/src/builders/links.ts:150`); a wikilink renders as
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

The link walk turns a `link` node into an element and only counts a `linkReference` node
(`packages/md/src/model/links.ts:171`), for the declaration scan that `areLabelled()` reports
from. The `definition` node that holds a reference link's URL is never read, and an `html` node is
never scanned. `resolve()` runs over the elements the walk produced, so it cannot see either form.

The family already discloses both forms elsewhere: `mentions()` reports a mention inside a raw
HTML block or a reference-style link's text as `md/unread-mention`
(`packages/md/src/builders/mentions.ts:49`), and `areLabelled()` reports a declaration made of
reference-style links as one it does not read. Its inline-HTML recogniser is
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
   - A `linkReference` is a link with its definition's URL: select it in `links()` and resolve it
     with the same `resolveLink`. Labels match as the spec says, "perform the Unicode case fold"
     (`[ẞ]` matches `[SS]`), with the first of several matching definitions used: take the
     parser's `identifier`, which already normalizes so (`normalizeIdentifier('ẞ')` is `SS`),
     never a comparison of eess-md's own.
   - **The finding names the definition's line**, where the URL the author must edit is, and one
     definition used by several references gives one finding and at most one fix: the fix's span
     lies in the definition, and overlapping fixes are dropped (`packages/core/src/apply-fixes.ts:48`).
   - **A dangling full or collapsed reference is reported**: `[text][label]` or `[label][]` outside
     code whose label has no definition, read from the source text by offset, since the parser
     unescapes `\[a\]\[b\]` into the text `[a][b]`. "reference has no definition" at its line.
   - **A dangling shortcut `[label]` stays out**: `[x]`, `[WIP]`, `[id].vue`, a task box and a
     GitHub alert, `> [!NOTE]` (measured: plain text), are all that shape, and reporting them
     would be false reds. The record says so, and a row pins it.
2. **Report raw HTML links as unread.**
   - An `href` that is not external (`EXTERNAL_RE`, `packages/md/src/model/links.ts:43`) on an
     `<a>` or `<area>`, in an inline or block `html` node, any letter case and quoted or unquoted,
     is reported as unread, so the rule is never green over one without a word. Reuse the
     recogniser at `packages/md/src/model/phrasing.ts:64`, widened to blocks.
   - An external `href` (the centred badge row a README opens with) produces nothing, and an
     `html` node that is one HTML comment is not read (`packages/md/src/model/phrasing.ts:225`).
   - The remedy the finding gives must clear it: write the link in Markdown, with blank lines
     inside the HTML block so it is parsed as Markdown (`<p align="center">`, a blank line,
     `[Guide](./guide.md)`, a blank line, `</p>`).
   - Resolving the `href` is a new capability, [proposal 022](../proposals/022-md-a-raw-html-link-is-resolved.md).
3. **The docs.** `docs/markdown.md:232` and `docs/markdown.md:680` state what `links()` reads, and
   change with it.

Images (`![alt](./x.png)`, `![alt][ref]`, `<img src>`) are not read either, measured; `links()`
does not claim them (`docs/markdown.md:232`), so they are
[proposal 024](../proposals/024-md-an-images-file-exists.md)'s, not this bug's.

**A break.** Builds that are green today go red where a reference link is broken, so the changeset
marks it `**Breaking (@nielspeter/eess-md):**`, a minor on 0.x.

## Verification

- [ ] Red test written first: the reproduction's `[reference link][gone]` and `[shortcut]` produce
      a broken-link finding each, naming their definition's line. Green today.
- [ ] Red test: a dangling full reference `[text][gone]` and a dangling collapsed `[gone][]`, with
      no definition, are each reported at their line. Green today.
- [ ] A dangling shortcut `[WIP]`, an escaped `\[a\]\[b\]`, a task box and `> [!NOTE]` produce
      nothing.
- [ ] Two references to one broken definition give one finding at the definition's line, and at
      most one fix.
- [ ] A label matched by Unicode case fold (`[Text][FOO]` with `[foo]: …`) is resolved.
- [ ] `examined` counts the reference links.
- [ ] Red test: the reproduction's `<a href>` produces an unread finding. Green today.
- [ ] An external `<a href="https://…">` and `<!-- <a href="./x.md"> -->` produce nothing;
      `<A HREF=./x.md>` and a single-quoted `href` are reported.
- [ ] The unread finding's remedy, applied, clears it.
- [ ] A nonvacuity row reddens on a broken reference-style link, and one on an internal
      `<a href>`, each asserting the message, not only the rule id.
- [ ] The declared-block nonvacuity rows still fire only their own finding, since
      `scripts/nonvacuity/bad-declared-block/unreadable.md` holds a definition `resolve()` then reads.
- [ ] A changeset naming `@nielspeter/eess-md`, marked `**Breaking (@nielspeter/eess-md):**`.
- [ ] `npm run validate` green.

Deferred: resolving a raw HTML link → [proposal 022](../proposals/022-md-a-raw-html-link-is-resolved.md);
images → [proposal 024](../proposals/024-md-an-images-file-exists.md).
