# Bug 0507: a box's text stops at its first paragraph, so a deferral below it is not seen

## Status

- **State:** Fixed — 2026-10-19, built on maintainer order in the pull request that builds plans
  [0496](../../plans/completed/0496-sections-as-elements.md), [0505](../../plans/completed/0505-a-field-read-inside-a-named-section.md) and [0503](../../plans/completed/0503-in-sections-boxes-by-section.md) (`54204c8`). Reproduced 2026-10-19 on main's build (`9675402`), from adopter 3's
  section input ([proposal 017](../../proposals/017-md-blocks-to-check-a-documents-shape.md), "Adopter 3's section input — 2026-10-18", lesson 4).
- **Severity:** High — `honestyAtClose` is green on a closed record whose `Deferred: none` contradicts
  a deferral written on the box's second line. That is the lie `ledger/deferred-none-lie` exists to
  catch.
- **Origin:** inbound · adopter 3's 2026-10-18 input, reproduced here on our own fixtures.
- **Reported:** 2026-10-19
- **Precondition of:** [plan 0503](../../plans/completed/0503-in-sections-boxes-by-section.md), whose
  `haveTextMatching` reads a box's `text`. Its fix ships in this release batch as its own pull request.

## Symptom

`collectTaskItems` gives a box the text of its **first paragraph** only
(`packages/md/src/model/task-items.ts:26`, `:116`). A second paragraph of the same list item, and a
plain sub-bullet under it, are not part of `text`. Every reader of `text` misses what is written there:
`honestyAtClose`'s disposition check and its deferral check (`packages/md/src/rules/ledger.ts:517`,
`:940`), and any rule over `taskItems()` that tests the text.

## Reproduction

A corpus of `plans/README.md` and one closed plan, `plans/completed/0001-x.md`, read with
`corpus({ cwd, roots: ['plans/**/*.md'] })` and `honestyAtClose(c, { report: false })`:

```markdown
# Plan 0001: x

## Status

- **State:** Done

## Ledger

- [ ] the parser change — done-otherwise

  deferred→plan NNNN

Deferred: none
```

| the box's deferral is written                                 | box `text`                                               | `honestyAtClose`                      |
| ------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------- |
| on the box's own line (`…done-otherwise, deferred→plan NNNN`) | `the parser change — done-otherwise, deferred→plan NNNN` | 1 finding, `ledger/deferred-none-lie` |
| in a second paragraph (above)                                 | `the parser change — done-otherwise`                     | **0 findings**                        |
| in a plain sub-bullet (`  - deferred→plan NNNN`)              | `the parser change — done-otherwise`                     | **0 findings**                        |

The record says nothing is deferred and defers the work, and the gate is green.

The opposite direction fails closed: a disposition written only on a second line (`validation-owed`
there, nothing on the box's line) is reported as an open box with no disposition, a false red.

## Root cause

`text` was defined as "the item's own text (its first paragraph after the box), trimmed; nested
sub-items excluded", so that a nested **box** is its own box. The definition also excludes the item's
other paragraphs and its non-box sub-items, which belong to the box.

## Fix

Not designed. The candidate: a box's text is all of its own content, every paragraph and every
sub-item that is not itself a box, with whitespace collapsed across lines; a nested box stays its own
box. That changes what `honestyAtClose` reads, so the fix measures this repository and the fixtures
first (a closed record whose second-paragraph `deferred→` now contradicts its `Deferred: none` turns
red, which is the point) and ships with a release note.

## Resolution

The candidate, built: a box's `text` is all of its own content after the box, every paragraph of the
list item and every sub-item that is not itself a box, read the same way, with whitespace collapsed
across lines (`restOfItem`, `packages/md/src/model/task-items.ts`). A nested box is its own box, and
everything inside it stays out of its parent. Two choices the bug did not make, recorded so they can
be overruled: fenced code and HTML inside an item are not read (they are not prose, and a `deferred→`
in a code sample is not a deferral); and the first paragraph's own line breaks are collapsed too,
which changes one existing expectation (`packages/md/tests/frontmatter.test.ts`, a box written over
three lines now reads as one).

Measured on this repository with eess-md's build before and after: `check:ledger` reads 444 records and 197 done-items, with 0 findings, both times (measured by PR #252's method review at `54204c8` and its parent `63d6f17`; the build-time figures, 432 and 190, came from the tree before the rebase). Released as a break (`.changeset/md-box-text.md`).

**Sabotage**, each red on its named test in
`packages/md/tests/rules/a-box-reads-all-its-own-text.test.ts`: `restOfItem` returns nothing (red on
the second-paragraph, sub-bullet and second-line-disposition rows); a nested box read into its parent
(red on `a nested box is still its own box`).

## Verification

- [x] Red first: the second-paragraph and sub-bullet rows gave no finding on the unfixed tree, and
      now give one `ledger/deferred-none-lie` each; the second-line disposition was a false
      `ledger/silent-open-box`, and is now read
- [x] A nested box is still its own box, with its own text
- [x] The release note, and this repository's corpus measured before and after (444 records, 0 findings both times)
- [ ] `npm run validate` green — validation-owed: validate and CI at the pull request's merging head, recorded in the pull request's description

Deferred: none
