# Proposal 022 — md: a raw HTML link is resolved

**State:** Draft — filed 2026-10-30 at the maintainer's request; not reviewed.
**Priority:** Medium — once [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)
reports a raw HTML link as unread, nothing passes over one silently; what is left is that a
corpus that writes links in HTML is red with "unread" instead of checked.
**Origin:** self-found · the maintainer, 2026-10-30: "GitHub Flavored Markdown (GFM) is important".
**Affects:** `@nielspeter/eess-md` (the link walk).

## Problem

GFM lets a document hold raw HTML, and GitHub READMEs use it for what Markdown cannot say: a
centred logo with a link, a `<details>` block holding links, a table cell with a line break.
`<a href="./target.md">` in such a block is a link to a reader. eess-md never selects it
([bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)), and once that
bug is fixed it reports it as unread. This proposal is the step after: read the `href` and resolve
it like any other link.

## Measured

On the v0.16.0 build (eess-md 0.13.0), one document holding `<a href="./gone-html.md">raw
html</a>` and one inline link to a missing file: `links(c).should().resolve()` examines 1 link and
reports the inline one only. The reproduction is
[bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s.

## Existing code survey

- **The link walk** reads `link` nodes and counts `linkReference` nodes
  (`packages/md/src/model/links.ts:171`); an `html` node is not scanned.
- **Resolution is `resolveLink`**, one resolver for every case ([plan 0404](../plans/completed/0404-md-one-link-resolver-names-each-case.md)). An `href`
  is a URL like any other, so resolution needs no second resolver: the new part is finding the
  URL in HTML.
- **Unread disclosure exists**: `mentions()` reports a mention inside a raw HTML block as
  `md/unread-mention` (`packages/md/src/builders/mentions.ts:49`).
- **No HTML parser is a dependency** of eess-md today (its dependencies are the mdast and
  micromark packages, `picomatch` and `yaml`).

## Asks

- **A — resolve `href`.** An `href` on an `<a>` element in a raw HTML node is a link: selected by
  `links()` at its own line and resolved with `resolveLink`, so a broken one is reported like an
  inline link.

## Acceptance criteria

- **Break class:** `<a href="./gone.md">` reports a broken link at its line.
- **Break class (false red):** an `href` in a code span or fenced block is not a link; an
  `href` to an external URL is external.
- **Break class:** HTML the reader cannot parse is reported as unread, never skipped; this keeps
  [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s guarantee.
- **Non-vacuity:** a fixture row per break class.

## Open questions

1. **How to read HTML.** A small attribute scan over `html` nodes, which needs no dependency and
   reads a subset of HTML, or an HTML parser as a new dependency. Either must say what it does not
   read.
2. **Other attributes.** `<img src>` is an image, which `links()` does not select for Markdown
   images either; whether both join is a separate question.

## Out of scope

- Links built by script, and HTML outside the Markdown documents.
