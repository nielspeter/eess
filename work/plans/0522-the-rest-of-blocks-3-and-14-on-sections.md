# Plan 0522: the rest of blocks 3 and 14, on sections

## Status

- **State:** Draft — written 2026-10-19 at the maintainer's order, relayed by the coordinator: the
  rest of [proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md)'s blocks 3 and 14
  is in this release, built in this plan in the pull request that builds
  [plan 0496](./completed/0496-sections-as-elements.md).
- **Implements:** proposal 017
- **Priority:** Medium — adopters 1 and 3 asked for block 3 and block 14; plan 0496 built only block
  3's `depth` and block 14's table.
- **Effort:** Small. One document condition and five section conditions over plan 0496's index.
- **Created:** 2026-10-19
- **Builds after:** [plan 0496](./completed/0496-sections-as-elements.md) (`sections()`, `sectionsOf`,
  `contains`) and [plan 0503](./completed/0503-in-sections-boxes-by-section.md) (`inSections`, for
  block 3's live pointer).

## Problem

Proposal 017's block 3 asks for three things: `haveSection` with a depth (plan 0496 built it);
`haveTitle(pattern)` testing the H1; and "a document can be required to hold a live code pointer
under a section the caller names (a presence condition on `docs()` plus the liveness check that
exists, since a pointer rule alone is green on a section that has none)". Block 14 asks what a
section holds: non-empty, a code block, a table (plan 0496 built it), a list item, a link. None of the
other five can be stated today, so an adopter checks them by hand.

## Design

All in the vocabulary plan 0496 set: dual-use methods on the builder that owns the element, read in
both phases as `haveSection` and `haveSubsection` are. No free twin is exported, so ADR-023 asks for
no prefixed name.

**On `docs()`, `haveTitle(name?)`.** The title is the document's first section (plan 0496's index:
a heading at the top level, so a heading in a list item is not a title). After `.should()` a document
reds with one cause each: no heading at all; a first heading that is not at depth 1 (`the first
heading, "X" at line 3, is at depth 2`); a title that does not match `name` (a string exactly, or a
`RegExp` read without `g`/`y`, as `haveSection` matches). After `.that()`, the documents whose title
exists and matches. Also on the root as a condition, `haveTitle`, beside `haveSection` and
`haveTable`.

**On `sections()`, what a section holds.** Each reads the section's lines after its heading through
`endLine`, subsections included:

| method                     | a section holds                                                             |
| -------------------------- | --------------------------------------------------------------------------- |
| `haveContent()`            | a top-level block other than a heading, a thematic break or an HTML comment |
| `haveCodeBlock({ lang? })` | a code block, with `lang` compared as ADR-019 says (`tagIsLanguage`)        |
| `haveListItem()`           | a list item, at any depth                                                   |
| `haveLink()`               | an inline link (what `links()` reads)                                       |
| `haveCodePointer()`        | a code pointer (what `pointers()` reads)                                    |

**Block 3's live pointer is two rules, composed:** `sections(c).that().areNamed(X).should().haveCodePointer()`
says the section holds one; `pointers(c).that().satisfy(inSections(sectionsNamed(X))).should().resolve()`
says each is live. The docs show the pair, reading `X` from one `const`.

## Test inventory

`packages/md/tests/section-holds.test.ts`, every row through `docs()` or `sections()` over a
throwaway tree, each condition with a clean case and a violating case, and its message asserted:

- `haveTitle`: clean; no heading; first heading at depth 2; title not matching; a `g`-flagged
  pattern over four documents; a heading in a list item before the real title is not the title; the
  `.that()` phase selects.
- `haveContent`: a section with a paragraph; a section with only a subsection heading and an HTML
  comment reds; one whose content sits in a subsection passes.
- `haveCodeBlock`: any fence; `lang: 'MERMAID'` matches `mermaid`; a fence in the next section does
  not count.
- `haveListItem`, `haveLink`, `haveCodePointer`: present; absent; present only in the next section.
- block 3's pair: the section holds a pointer and the pointer is stale, so the second rule reds.

**Sabotage**, each red on its named test: the title read from the first heading of any depth; the
title's pattern ignored; each content condition reading the whole document instead of the section
(five rows); `haveCodeBlock` ignoring `lang`; `haveContent` counting a heading.

## Out of scope

- Block 15 (sections in a given order) and block 16 (a value agrees with the document's own path):
  held, block 16 for the next release.
- Which H1 counts when a document has two: the first heading is the title, and a second depth-1
  heading is not reported by `haveTitle`.

## Progress ledger

- [ ] `haveTitle` on `docs()` and the root
- [ ] `haveContent`, `haveCodeBlock`, `haveListItem`, `haveLink`, `haveCodePointer` on `sections()`
- [ ] Tests, sabotage rows, docs, changeset; the dogfood measured
- [ ] Close: this plan → `completed/`; ROADMAP and proposal 017's rows

Deferred: none
