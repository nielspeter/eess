# Bug 0414: a label after a soft break is reported, never read

## Status

- **State:** Draft — reproduced 2026-10-14 against eess-md 0.9.0's build on `main` at `f099539`. The
  fix direction is decided (below), and it can be overruled. No red test yet.
- **Severity:** Medium — a false red on a common shape, and an honesty gap between the stated claim
  and the mechanism. `packages/md/src/model/label.ts:1-10` says the label grammar is shared, "so
  `**Related to**:` cannot be a label to one and a misspelling to another". Yet the ledger reads a
  label at the start of any source line, while `links().areLabelled()` reads one only at the start
  of a block. It is not High: nothing goes silently unchecked. The label it does not read is
  reported, with a remedy that works.
- **Origin:** inbound · consuming project, 2026-10-14. The consumer swapped its own rule for
  `links().that().areLabelled('Related to')…beLinkedBack()` on eess-md 0.9.0.
- **Reported:** 2026-10-14

## Symptom

A record that opens with a metadata header, one label per line in a single paragraph:

```md
**Status:** Draft
**Related to:** [b](b.md)
```

`links(c).that().areLabelled('Related to').should().beLinkedBack()` gives:

| shape                                   | `examined` | findings                                                                                                                      |
| --------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| the two lines above, one paragraph      | 1          | `the label "Related to" is not at the start of a paragraph or list item, so the links after it are not read as a declaration` |
| the same with a blank line between them | 2          | none                                                                                                                          |

The consumer met it on 7 records and every fixture record, and fixed its side by adding the blank
line.

The ledger reads the same position without complaint. `findState` splits a document's prose into
source lines (`packages/md/src/rules/ledger.ts:223`) and tests each one with the same
`labelPattern('State')` (`:151`). So `**Owner:** x` followed by `**State:** Done` on the next line,
in one paragraph, is a state to `honestyAtClose`. The same line is "not at the start of a paragraph"
to `areLabelled('State')`.

## Reproduction

```ts
import { corpus, links } from '@nielspeter/eess-md'
// docs/a.md: "# Mail\n\n**Status:** Draft\n**Related to:** [b](b.md)\n"
// docs/b.md: "# B\n\n**Related to:** [a](a.md)\n"
const r = links(corpus({ roots: ['docs/**'] }))
  .that()
  .areLabelled('Related to')
  .should()
  .beLinkedBack()
  .violations()
r.examined // 1 — only b.md's link
r // one finding at a.md:4, "not at the start of a paragraph or list item"
```

## Root cause

A link's block is its enclosing paragraph or list item. The block's label text is that block's
**first source line** (`blockOf`, `packages/md/src/model/links.ts:102-107`). A soft break does not end
a paragraph in CommonMark, so `**Related to:**` on the paragraph's second line is never the start of
a block. The syntax-tree scan finds the label-shaped `strong` that is not its paragraph's first
child, and records it as unread by position (`packages/md/src/model/links.ts:149`). The finding is then raised at
`packages/md/src/builders/declaration-findings.ts:152-161`.

Plan 0405 chose the first line on purpose (`docs/markdown.md:249` names "later in a paragraph" as a
place where a label declares nothing). It did not weigh the ledger, which reads per line. And the
grammar it built is already anchored to the start of a line, not of a block (`label.ts`'s
`PREFIX`).

## Fix

**Decided 2026-10-14, overrulable: read it.** A **wrapped** label (`**Label:**`, `**Label**:`,
`__Label__:`) that opens a source line after a soft break starts a block of its own. That block runs
to the next such line or the end of the paragraph.

- Why read, not keep reporting:
  - The grammar is anchored to the start of a line, and the ledger already reads this position, so
    one grammar finally means one position.
  - The metadata header is the shape records commonly take.
  - The current remedy (a blank line) changes nothing a reader sees on GitHub except spacing.
- **The plain form stays unread there.** `Label:` after a soft break is prose, as plain `Label:`
  is everywhere else outside a block's start. Prose that wraps onto a line beginning "Related to:"
  is the false positive the wrapped-only rule exists for.
- **A label mid-line stays reported**, as it is today. So does one in a table cell or a heading.
- **The link on the label's own line belongs to that label, not to the first line's.** Today
  `**Status:** Draft` decides for the whole paragraph. After the fix, a link on the
  `**Related to:**` line is decided by `Related to`.
- **What it changes for adopters.** A link that is reported today becomes selected. A rule that is
  red on this shape today can be green after the fix, and is not hiding anything. A link on a later
  line under a different wrapped label leaves the first line's declaration. That is a narrowing,
  so it needs a changeset marked `**Breaking (@nielspeter/eess-md)…**`.
- **Docs.** `docs/markdown.md:249` loses "later in a paragraph" for the wrapped form and says what
  is read instead.

**Out of scope:** misspellings such as `**Relatd to:**`. The near-miss scan compares case and inner
spacing only, by plan 0405's decision, and the consumer recorded that as expected. Bug 0408 already
owns "a different spelling: reported, or named as a blind spot".

## Verification

- [ ] Red test first, through the public entry point (`links().…violations()`): the two-line header
      selects the `Related to` link at its own line, with no "not at the start" finding. A sabotage
      row goes red when the soft-break split is undone.
- [ ] `**Status:** Draft` followed by `**Related to:** [b](b.md)`: `areLabelled('Status')` does not
      select `b`.
- [ ] A plain `Related to: [x](x.md)` after a soft break is neither selected nor reported.
- [ ] `see **Related to:** [x](x.md)` mid-line is still reported.
- [ ] `areLabelled('State')` and `honestyAtClose` agree on a `**State:**` after a soft break.
- [ ] Plan 0405's non-vacuity rows unchanged, plus the new row.
- [ ] Changeset marked `**Breaking (@nielspeter/eess-md)…**`, `minor`.
- [ ] `npm run validate` green.

Deferred: none.
