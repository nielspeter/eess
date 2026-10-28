# Bug 0415: a plain label later in a paragraph is neither read nor reported

## Status

- **State:** Draft — reproduced 2026-10-14 against eess-md 0.9.0's build on `main` at `f099539`.
  Found by enforcement review of [bug 0414](./0414-a-label-after-a-soft-break-is-reported-never-read.md). No red test yet, and the fix is not designed.
- **Severity:** Medium — an honesty gap between a stated claim and its mechanism (`BUGS.md`'s Medium
  row). `docs/markdown.md:249` says a rule built with `areLabelled()` reports "the label, exact or
  near, where no block starts — later in a paragraph". For the plain `Label:` form that report never
  happens, and the link goes unexamined with nothing said. It is not filed as High. [Plan 0405](../plans/completed/0405-md-select-the-links-a-block-declares.md)
  deliberately does not read a plain label outside a block's start, because prose often begins
  "related to:". What is wrong is the promise to report it, not the decision not to read it.
- **Origin:** self-found · enforcement review of [bug 0414](./0414-a-label-after-a-soft-break-is-reported-never-read.md), 2026-10-14.
- **Reported:** 2026-10-14

## Symptom

`links(c).that().areLabelled('Related to').should().beLinkedBack()`, where `docs/b.md` declares
`**Related to:** [a](a.md)`:

| `docs/a.md` body                                                 | `examined` | findings |
| ---------------------------------------------------------------- | ---------- | -------- |
| `An intro sentence.` then `Related to: [b](b.md)`, one paragraph | 1          | none     |
| `Related to: [b](b.md)` alone, at a block start                  | 2          | none     |

In the first row `a.md`'s link is neither selected nor reported. The rule passes on `b.md`'s link
alone.

## Reproduction

```ts
import { corpus, links } from '@nielspeter/eess-md'
// docs/a.md: "# Mail\n\nAn intro sentence.\nRelated to: [b](b.md)\n"
// docs/b.md: "# B\n\n**Related to:** [a](a.md)\n"
const r = links(corpus({ roots: ['docs/**'] }))
  .that()
  .areLabelled('Related to')
  .should()
  .beLinkedBack()
  .violations()
r.examined // 1
r.length // 0
```

## Root cause

The scan that reports a label "where no block starts" walks the syntax tree for label-shaped
`strong` nodes (`packages/md/src/model/links.ts:71`, `:152`). A plain `Label:` is text, not a
`strong` node, so the scan never sees it. The docs bullet at `docs/markdown.md:249` does not
distinguish the forms. It already names one plain-form blind spot, the near miss ("the one
misspelling the rule does not catch"), but not this one.

## Fix

Not designed. There are two candidates, and the choice must be measured against this repository's
corpus for false positives first:

- **Report it.** An exact, case-sensitive plain `Label:` at the start of a source line inside a
  paragraph would be reported as unread. The risk is prose that wraps onto a line beginning with the
  label's words and a colon.
- **Name it.** `docs/markdown.md` would name the plain form later in a paragraph as a blind spot,
  beside the plain near miss, so the documented claim matches the mechanism.

[Bug 0414](./0414-a-label-after-a-soft-break-is-reported-never-read.md) keeps the plain form unread at this position whichever is chosen, so the two do not
conflict.

## Verification

- [ ] Red test first, through `links().…violations()`: the first row above is either reported, or
      the docs name it as unread, whichever the fix decides. A sabotage row goes red when that is
      undone.
- [ ] Measured: how many plain `Label:` lines at the start of a soft-break line exist in this
      repository's corpus for the labels its rules declare, and how many would be false positives.
- [ ] `npm run validate` green.

Deferred: none.
