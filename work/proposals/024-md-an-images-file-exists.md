# Proposal 024 — md: an image's file exists

**State:** Draft — filed 2026-10-30 from reading the GFM spec and a GFM cheat sheet against
eess-md, at the maintainer's request; not reviewed.
**Priority:** Medium — no shipped rule claims to check images, so nothing over-claims; but a README
whose logo or screenshot was renamed shows a broken image, and no gate notices.
**Origin:** self-found · the maintainer, 2026-10-30: "GitHub Flavored Markdown (GFM) is important",
with the GFM spec (Version 0.29-gfm, 2019-04-06) and a GFM cheat sheet as the reading list.
**Affects:** `@nielspeter/eess-md`.

## Problem

An image points at a file the same way a link does, in three forms: inline `![alt](./logo.png)`,
reference-style `![alt][logo]` with `[logo]: ./logo.png`, and raw HTML `<img src="./logo.png">`,
which READMEs use to set a width. A renamed or deleted image file leaves every one of them broken,
and eess-md reads none of them.

## Measured

On the v0.16.0 build (eess-md 0.13.0), Node 24.22.0, one document holding
`![alt](./gone-inline.png)`, `![alt][logo]` with `[logo]: ./gone-ref.png`, `<img src="./gone-html.png">`
and an inline link to a missing file: `links(c).should().resolve()` examines 1 element and reports
the inline link only. The three missing images produce nothing.

## Existing code survey

- **`links()` reads links, inline and (since [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s part (a)) reference-style, not images** (`packages/md/src/model/links.ts:197`); its docs scope it to
  `[text](url)` (`docs/markdown.md:232`), so images are not claimed.
- **Image nodes are known** elsewhere: the phrasing walk reads an `image` and an `imageReference`
  (`packages/md/src/model/phrasing.ts:191`), and the fix check compares images by URL
  (`packages/md/src/model/fix-check.ts:80`). No element type or rule resolves one.
- **Resolution is `resolveLink`** ([plan 0404](../plans/completed/0404-md-one-link-resolver-names-each-case.md)): an image's URL resolves the way a link's does, so
  no second resolver is needed.
- **The reference form** shares [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s definition lookup, and `<img src>`
  shares [proposal 022](./022-md-a-raw-html-link-is-resolved.md)'s HTML scan.

## Asks

- **A — an image's local file exists.** Inline and reference-style images whose URL is not
  external are resolved, and a missing file is reported at its line (a reference image's at its
  definition's line, as in [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)).
- **B — `<img src>`.** The same for an `src` in raw HTML, on [proposal 022](./022-md-a-raw-html-link-is-resolved.md)'s scan.

## Acceptance criteria

- **Break class:** `![alt](./gone.png)` reports a missing image at its line.
- **Break class:** `![alt][logo]` with a definition to a missing file reports at the definition's
  line.
- **Break class:** `<img src="./gone.png">` reports a missing image (B).
- **Break class:** a dangling `![alt][gone]`, with no definition, is plain text to the parser (as a
  dangling link reference is, [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)) and is reported.
- **Break class (B):** `<picture><source srcset="…">`, GitHub's dark-mode logo: `srcset` is a
  comma list with descriptors, read per entry; read as one path it is a false red, left unread a
  false green.
- **Break class (false red):** an external image (a badge, `https://…`), a `data:` URI and an image
  in a code span or fenced block, and an `<img>` inside an HTML comment, produce nothing; an image
  inside a link (`[![badge](…)](…)`) is judged as an image and its link as a link; and
  `./logo.svg#gh-dark-mode-only` resolves the file (it does today, as a link target).
- **Evidence:** `examined` counts each image read.
- **Non-vacuity:** a fixture row per break class.

## Dogfooding

This repository's Markdown holds six images, all external badges (PR #280's enforcement
re-check), so `check:corpus` would read nothing; the rows are the proof.

## Open questions

1. **Element type or a widened `links()`.** An `images()` element type of its own, or images as
   links of a kind (`links().that().areImages()`). `links()` users would see new findings from the
   second, a break marked as one; the first is additive.
2. **Alt text.** Whether an image without alt text is in scope, as an accessibility rule beside the
   file check, or a separate ask.

## Out of scope

- Whether an image renders (format, size) and remote images' reachability.
