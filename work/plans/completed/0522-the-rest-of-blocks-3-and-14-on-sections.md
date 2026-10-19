# Plan 0522: the rest of blocks 3 and 14, on sections

## Status

- **State:** Done — built on maintainer order 2026-10-19 (`b5874ca`). Written 2026-10-19 at the maintainer's order, relayed by the coordinator: the
  rest of [proposal 017](../../proposals/017-md-blocks-to-check-a-documents-shape.md)'s blocks 3 and 14
  is in this release, built in this plan in the pull request that builds
  [plan 0496](./0496-sections-as-elements.md).
- **Implements:** proposal 017
- **Priority:** Medium — adopters 1 and 3 asked for block 3 and block 14; plan 0496 built only block
  3's `depth` and block 14's table.
- **Effort:** Small. One document condition and five section conditions over plan 0496's index.
- **Created:** 2026-10-19
- **Builds after:** [plan 0496](./0496-sections-as-elements.md) (`sections()`, `sectionsOf`,
  `contains`) and [plan 0503](./0503-in-sections-boxes-by-section.md) (`inSections`, for
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

## Build notes — 2026-10-19

Built on maintainer order 2026-10-19. Not design-reviewed: written and built in the same pass, and reviewed in PR #252. Decisions, each so it can be overruled:

- **Block 3 asks for three things**, read from proposal 017's text: the depth (plan 0496), the title,
  and "a document can be required to hold a live code pointer under a section the caller names".
  The third is a recipe of three rules reading one `const`: `docs().should().haveSection(X)` (the
  document holds the section), `sections().that().areNamed(X).should().haveCodePointer()` (the
  section holds a pointer) and `pointers().satisfy(inSections(…)).should().resolve()` (each pointer is
  live). Corrected 2026-10-19 (PR #252's architect and method reviews): the build first shipped the
  last two only and said they covered the ask "as the proposal words it"; they did not, since a
  document with no such section gave neither rule an element. The test row
  `a document without the section fails the recipe` pins the first rule.
- **`haveTitle` is dual-use on `docs()`** and a root condition beside `haveSection` and `haveTable`.
  No free predicate twin is exported, so ADR-023 asks for none. The title is the first section of
  plan 0496's index, so a heading inside a list item is never a title; a second depth-1 heading is
  not reported.
- **"Non-empty" is `haveContent()`**: a top-level block after the heading other than a heading, a
  thematic break or an HTML comment, subsections' content included.
- **The section-holding methods are dual-use**, as `haveSubsection` is.
- **No example** under `examples/md`: the composed pair is in the docs, and the conditions read as
  the existing sections example does.
- **Tests after the code**; the red is the matrix below.

- **Corrected 2026-10-19 (PR #252's testing review, I3): a section holds what its heading's text
  holds.** `holds()` read from the line after the heading, so `haveLink()` said `## See [b](b.md)` held
  no link while `inSections` placed that link in it. Plans 0496 and 0503 had decided the heading line
  is inside its section, so `holds()` now reads it too; the row `a link or a pointer in the heading's
own text is the section's, as inSections says` pins both sides to one answer.

**The dogfood, measured** 2026-10-19 over `work/`, `docs/` and `adr/` with eess-md's own build: every
one of 548 documents has a depth-1 title (0 findings); every `## Progress ledger` (53), `## Verification`
(331) and `## Status` (441) section holds a list item or content (0 findings); 2 of 5,421 sections
are empty (a proposal's `Evidence` heading, a rejected bug's quoted submission); a title pattern per
lane is not a convention here (older plans write `0061 — …`). So the repository could adopt
`docs().should().haveTitle()` and the ledger, verification and status rules at 0 findings today. None
is adopted in this pull request: each needs its own non-vacuity row, and none was asked for. Adopted 2026-10-19 after PR #252's enforcement review: `haveContent()` on every live proposal's `## Acceptance criteria` (`corpus/proposal-acceptance-criteria-empty`, 17 sections, 0 findings), whose `because` had confessed that an empty section passed; its non-vacuity row empties proposal 006's section.

**Sabotage**, run 2026-10-19 at `b5874ca`, each red on its named test in
`packages/md/tests/section-holds.test.ts`, 7.2 s:

| row | mutant                                             | red (named test)                              |
| --- | -------------------------------------------------- | --------------------------------------------- |
| 1   | the title read from the first heading at any depth | a first heading at depth 2 is no title        |
| 2   | the title's pattern ignored                        | a title that does not match the pattern       |
| 3   | `haveContent` reads the whole document             | haveContent: …                                |
| 4   | `haveCodeBlock` reads the whole document           | haveCodeBlock: …                              |
| 5   | `haveListItem` reads the whole document            | haveListItem: …                               |
| 6   | `haveLink` reads the whole document                | haveLink: …                                   |
| 7   | `haveCodePointer` reads the whole document         | haveCodePointer: …; no pointer in the section |
| 8   | `haveCodeBlock` ignores `lang`                     | haveCodeBlock: …                              |
| 9   | `haveContent` counts a heading                     | haveContent: …                                |

## Progress ledger

- [x] `haveTitle` on `docs()` and the root
- [x] `haveContent`, `haveCodeBlock`, `haveListItem`, `haveLink`, `haveCodePointer` on `sections()`
- [x] Tests, sabotage rows, docs, changeset; the dogfood measured (no rule adopted, reasons above)
- [ ] `npm run validate` green — validation-owed: validate and CI at the pull request's merging head, recorded in the pull request's description
- [x] Close: this plan → `completed/`; ROADMAP and proposal 017's rows

Deferred: none
