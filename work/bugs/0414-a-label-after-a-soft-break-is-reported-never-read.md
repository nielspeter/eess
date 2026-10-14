# Bug 0414: a label after a soft break is reported, never read

## Status

- **State:** Draft — reproduced 2026-10-14 against eess-md 0.9.0's build on `main` at `f099539`. The
  fix direction is decided (below), and it can be overruled. No red test yet.
- **Severity:** Medium — a false red on a common shape (`BUGS.md`'s Medium row), and two readers of
  one grammar that disagree on position. `packages/md/src/model/label.ts:1-10` promises only that a
  spelling cannot be a label to one reader and a misspelling to another; it never promised the
  readers agree on _where_ in a paragraph a label sits. They do not: the ledger reads a label at the
  start of any source line, while `links().areLabelled()` reads one only at the start of a block. It
  is not High: every wrapped label in this position is reported today, with a remedy that works.
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

The consumer reports meeting it on 7 records and every fixture record, and fixed its side by adding
the blank line.

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

Plan 0405 chose the first line on purpose: "The label is read from the block's first source line"
(`work/plans/completed/0405-md-select-the-links-a-block-declares.md`, its Design), and
`docs/markdown.md:249` names "later in a paragraph" as a place where a label declares nothing. Its
discussion of a shared grammar covers the label's forms, not its position: the ledger's per-line
reading is not weighed there. The grammar it built is anchored to the start of a line, not of a block
(`label.ts`'s `PREFIX`). This record overrules that one decision of plan 0405, for the wrapped forms
only.

## Fix

**Decided 2026-10-14, overrulable: read the wrapped forms there.** Method and enforcement reviewed the
first version of this decision; what they found is folded in below.

- **The rule.** A **wrapped** label (`**Label:**`, `**Label**:`, `__Label__:`) that opens a source
  line after a soft break starts a block of its own, a **sibling** of the line-1 block in `blockPath`,
  not nested under it. It runs to the next such line or the end of the paragraph.
  - Sibling, because nesting would make the `taken` scan (`declaration-findings.ts:110-125`) report
    `**Supersedes:**` "inside the Related to declaration", a false red on the very header this fixes.
  - The blank-line form, which the consumer already uses, is two sibling paragraphs. The fix makes
    the soft-break form read the same way.
- **A label alone on the paragraph's last line encloses the list directly after it**, exactly as a
  label-alone paragraph does today (plan 0405's ownership rule):

  ```md
  **Status:** Draft
  **Related to:**

  - [a](a.md)
  ```

  Without this, the label would fall into the empty-declaration branch, whose "stands alone with no
  list directly under it" would be false (ADR-009 rule 2).

- **The new block keeps every finding a block start has.** Today a near miss, an empty declaration
  or a reference link at this position is still reported, through the position finding. The fix
  suppresses that finding, so these must come from the scans over `blocks`: near miss
  (`declaration-findings.ts:76-85`), empty and stands-alone (`:133-149`), and reference links. The
  split must therefore register the block where those scans read it. Re-filing the link's
  `blockPath` alone would make `**Related To:** [b]` on line 2 silent, a false green. This is the
  fix's break class, and a sabotage row pins it.
- **Message and remedy.** The position finding that remains (mid-line, a table cell, a heading, a
  container line the fix does not split) says "not at the start of a line, paragraph or list item",
  and its remedy "start a line with it" is verified to clear it.
- **Containers.** A blockquote continuation (`> **Status:** x` then `> **Related to:** [b]`) and a
  list item's indented continuation are split the same way: the source line is read from its content
  column, as the walk already does for a block's first line. Each gets a row.
- **The plain form is unchanged.** `Label:` after a soft break is still not read, because prose wrapping
  onto a line that begins "Related to:" is the false positive the wrapped-only rule exists for. So the
  two readers agree for the wrapped forms only. The ledger still reads a plain `State: Done` on a
  soft-break line, and `areLabelled('State')` still does not. That divergence is kept on purpose, and
  a verification row pins it.
  - The plain form at that position is also **not reported**, although `docs/markdown.md:249` says it
    is. That predates this bug and is recorded as
    [bug 0415](./0415-a-plain-label-later-in-a-paragraph-is-neither-read-nor-reported.md).
- **What changes for adopters.** A link reported today becomes selected. A link on a later header line
  under a different wrapped label leaves the first line's declaration: today `**Related to:** [c]`
  then `**Supersedes:** [b]` examines `b` as a Related-to link with no finding. That re-filing is a
  narrowing, so the changeset is marked `**Breaking (@nielspeter/eess-md)…**` and names it.
- **Docs.** `docs/markdown.md:249` loses "later in a paragraph" for the wrapped forms and says what is
  read instead.
- **Dogfooding.** This repository's only `areLabelled` use, the `Extends` rule in
  `scripts/check-corpus.mjs`, reads a list item and a blank-separated paragraph. It is unaffected, so
  `check:corpus` staying green is no evidence for the fix.

**Out of scope:**

- **Misspellings.** The consumer reports that `**Relatd to:**` is not caught, and treats that as
  expected. The near-miss scan compares case and inner spacing only, by plan 0405's decision. Bug
  0408's open box asks whether "a different spelling" is reported or named as a blind spot. This
  record reads that question as covering typos too, and leaves it there.
- **A formatting variant after a soft break** (`**_Related to:_**`, a whole line in bold) is still
  reported by position. That remedy then leads to a formatting finding. Routing a line-start strong
  label to the formatting finding is a separate improvement, not this fix.

## Verification

Through the public entry point (`links().…violations()`) unless stated:

- [ ] Red first: the two-line header selects the `Related to` link at its own line, with no
      "not at the start" finding.
- [ ] `**Related to:** [c]` then `**Supersedes:** [b]`: `b` is not selected by `Related to`, and there
      is no "inside the Related to declaration" finding.
- [ ] `**Status:** x` then `**Related To:** [b]`: the near-miss finding at line 2, with `b` not
      selected. A sabotage row that keeps the new block out of `blocks` turns this red.
- [ ] `**Status:** x` then `**Related to:** none`: "names no record".
- [ ] `**Status:** x` then `**Related to:** [r][ref]`: the reference-links finding.
- [ ] A label alone on the last header line encloses the list after the paragraph.
- [ ] Blockquote and list-continuation rows.
- [ ] `see **Related to:** [x](x.md)` mid-line is still reported, with the new message, and its remedy
      clears it.
- [ ] `areLabelled('State')` and `honestyAtClose` agree on a wrapped `**State:**` after a soft break.
      They disagree on a plain `State:` there, and a row pins that.
- [ ] Plan 0405's `unread-label` fixture (`scripts/nonvacuity/bad-declared-block/unread-label.md`) is
      this shape. It moves to a position that stays unread (mid-line), and a soft-break near-miss row
      is added.
- [ ] `packages/md/tests/builders/declared-block.test.ts`, the test titled "a wrapped label inside a
      paragraph is reported, in either colon form, exact or near", asserts the opposite of the fix. It
      is inverted for the soft-break case and retitled. No ADR cites the title.
- [ ] Changeset marked `**Breaking (@nielspeter/eess-md)…**`, `minor`, naming the re-filing.
- [ ] `npm run validate` green.

Deferred: none.
