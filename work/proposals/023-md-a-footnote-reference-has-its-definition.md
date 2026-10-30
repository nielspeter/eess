# Proposal 023 — md: a footnote reference has its definition

**State:** Draft — filed 2026-10-30 at the maintainer's request; not reviewed. Amended the same day from PR #280's reviews.
**Priority:** Low — no shipped rule claims to check footnotes, so nothing over-claims; a broken
footnote shows as literal text on GitHub, which a reader notices and a gate does not.
**Origin:** self-found · the maintainer, 2026-10-30: "GitHub Flavored Markdown (GFM) is important".
**Affects:** `@nielspeter/eess-md`.

## Problem

Footnotes pair a reference, `[^note]`, with a definition, `[^note]: …`. They are not in the GFM
spec (Version 0.29-gfm, 2019-04-06, has no footnote section); GitHub renders them, and the parser
eess-md uses reads them (`micromark-extension-gfm`). Two drifts break the pair:

1. **A reference with no definition.** The parser does not treat it as a reference at all, and
   GitHub renders it as the literal text `[^note]`. A renamed or deleted definition turns every reference to it into
   visible brackets.
2. **A definition nothing references.** It renders nowhere on GitHub, so its text is lost from the
   page while it stays in the source.

## Measured

eess-md's own parser (`mdast-util-from-markdown` with `micromark-extension-gfm`), on
`Used[^a] and undefined[^missing].` followed by `[^a]: the a note` and `[^unused]: never
referenced`:

- `[^a]` is a `footnoteReference` with identifier `a`;
- `[^missing]` is part of a `text` node, `" and undefined[^missing]."`, since it has no definition;
- `[^unused]` is a `footnoteDefinition` that no `footnoteReference` names.

So the parse already holds both drifts, and no eess-md element or rule reads them.

## Existing code survey

- **Footnote nodes are known** to the section reader, which does not count a heading inside a
  footnote definition as a section (`packages/md/src/model/sections.ts:124`).
- **No footnote element type exists** in `packages/md/src/builders/`, and no rule reports either
  drift.
- **The nearest shapes** are `links().should().resolve()` (a reference must reach its target) and
  `mentions()` (a text pattern the caller names, so `[^…]` in text can be found today with a
  pattern; that finds the missing-definition case by its literal brackets, outside code).

## Asks

- **A — a reference has its definition.** A rule reports `[^x]` written in prose, outside code,
  whose definition the document does not hold.
- **B — a definition is referenced.** A rule reports a definition no reference names.

## Acceptance criteria

- **Break class (A):** `[^missing]` in prose with no definition is reported at its line.
- **Break class (A, false red):** `[^x]` in a code span or fenced block is not reported; nor is an
  escaped `\[^x]` (measured: the parser unescapes it into the text `Escaped [^x] here.`, so the
  scan reads the source by offset), nor a regex class written in prose (`[^0-9]`, measured: plain
  text).
- **Break class (B):** `[^unused]: …` with no reference is reported at the definition's line.
- **Non-vacuity:** a fixture row per break class.

## Open questions

1. **Element or condition.** A `footnotes()` element type (a reference or a definition, with the
   kernel's whole surface), or a `docs()` condition. eess-md's other pairs are element types.
2. **Whether A is a mention.** A is a literal-text case, which `mentions()` with a pattern already
   reaches; the review should decide whether a documented example covers it before new API does.

## Dogfooding

Whether this repository's `check:corpus` adopts the rule is for the review. Measured by parsing
the 594 tracked Markdown files under `work/`, `adr/` and `docs/`: none holds a footnote reference
or definition, so the gate would read nothing today, and the rows are the proof.

## Out of scope

- Footnotes in other Markdown flavours (Pandoc inline footnotes).
