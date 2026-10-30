# Proposal 023 — md: a footnote reference has its definition

**State:** Draft — filed 2026-10-30 at the maintainer's request; not reviewed.
**Priority:** Low — no shipped rule claims to check footnotes, so nothing over-claims; a broken
footnote shows as literal text on GitHub, which a reader notices and a gate does not.
**Origin:** self-found · the maintainer, 2026-10-30: "GitHub Flavored Markdown (GFM) is important".
**Affects:** `@nielspeter/eess-md`.

## Problem

GFM footnotes pair a reference, `[^note]`, with a definition, `[^note]: …`. Two drifts break the
pair:

1. **A reference with no definition.** GFM does not treat it as a reference at all: it renders as
   the literal text `[^note]`. A renamed or deleted definition turns every reference to it into
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
- **Break class (A, false red):** `[^x]` in a code span or fenced block is not reported.
- **Break class (B):** `[^unused]: …` with no reference is reported at the definition's line.
- **Non-vacuity:** a fixture row per break class.

## Open questions

1. **Element or condition.** A `footnotes()` element type (a reference or a definition, with the
   kernel's whole surface), or a `docs()` condition. eess-md's other pairs are element types.
2. **Whether A is a mention.** A is a literal-text case, which `mentions()` with a pattern already
   reaches; the review should decide whether a documented example covers it before new API does.

## Out of scope

- Footnotes in other Markdown flavours (Pandoc inline footnotes).
