# Bug 0507: a box's text stops at its first paragraph, so a deferral below it is not seen

## Status

- **State:** Draft — reproduced 2026-10-19 on main's build (`9675402`), from adopter 3's section
  input (proposal 017, "Adopter 3's section input — 2026-10-18", lesson 4). No red test written yet.
- **Severity:** High — `honestyAtClose` is green on a closed record whose `Deferred: none` contradicts
  a deferral written on the box's second line. That is the lie `ledger/deferred-none-lie` exists to
  catch.
- **Origin:** inbound · adopter 3's 2026-10-18 input, reproduced here on our own fixtures.
- **Reported:** 2026-10-19
- **Precondition of:** [plan 0503](../plans/0503-in-sections-boxes-by-section.md), whose
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

  deferred→plan 0002

Deferred: none
```

| the box's deferral is written                                 | box `text`                                               | `honestyAtClose`                      |
| ------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------- |
| on the box's own line (`…done-otherwise, deferred→plan 0002`) | `the parser change — done-otherwise, deferred→plan 0002` | 1 finding, `ledger/deferred-none-lie` |
| in a second paragraph (above)                                 | `the parser change — done-otherwise`                     | **0 findings**                        |
| in a plain sub-bullet (`  - deferred→plan 0002`)              | `the parser change — done-otherwise`                     | **0 findings**                        |

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

## Verification

- [ ] Red first: the second-paragraph and sub-bullet rows above give one `ledger/deferred-none-lie`
- [ ] A nested box is still its own box, with its own text
- [ ] The release note, and this repository's corpus measured before and after; `npm run validate`
      green

Deferred: none
