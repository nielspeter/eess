# Plan 0556: a value agrees with the document's own path

## Status

- **State:** Draft — written 2026-10-29 from [proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md)'s block 16, at the maintainer's
  order to build it before the next release ("build block 16 first", 2026-10-29). Awaiting review.
- **Implements:** [proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md)
- **Priority:** High — the next release waits on it. Block 16 was held "for the next release", adopter
  1 its only asker ([proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md), "Consumer feedback" and "The maintainer's acceptance —
  2026-10-19").
- **Effort:** Medium. One condition on `docs()`, on the model [plan 0495](./completed/0495-a-value-agrees-with-its-folder.md) built for block 5: its
  findings, an example, and this repository's numbered records as its first user.
- **Created:** 2026-10-29
- **Builds after:** [plan 0469](./completed/0469-havefield-a-document-has-a-value.md) (the field resolver) and
  [plan 0495](./completed/0495-a-value-agrees-with-its-folder.md) (block 5, whose shape this mirrors), both built.
- **Decided by:** [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) (no default shape: the patterns are the caller's),
  [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) (a document whose value cannot be read is reported, never dropped),
  [ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md) (the denominator is what the verdict rests on).

## Problem

A record says its number twice, in its filename and in its title (a plan's file named for its number, and an H1
that names the plan by the same number), and the two drift: a file renamed and its title not, a title copied from a
sibling and its number not changed. [Proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md) names it block 16, "a value agrees with the
document's own path (a number in the filename and in the H1)", and adopter 1 asked for it. Nothing
in eess-md relates a document's path to its content:

- `haveTitle(pattern)` (`packages/md/src/conditions/structure.ts:89`) judges a title's shape, not
  what it says against the path.
- `haveField` judges a value against a vocabulary, and `agreeWithFolder`
  (`packages/md/src/conditions/agree-with-folder.ts:212`) a value against the folder groups it
  belongs in; neither reads a value out of the path itself.
- `beUniqueBy` (block 13) keeps a value to one document, not to its own file.
- `satisfy()` with a hand-written condition can compare the two, as `honestyAtClose` once compared
  `State:` by hand. That is what each adopter writes today, and it has the gaps block 5 had: a title
  or field that cannot be read is skipped or reported as a mismatch, the message cannot say which
  side read what, and a rule that read nothing passes.

## Measured

Run from the repository root at fda86985, over `git ls-files work adr`: every numbered record file
(a file whose name starts with a number) and every `README.md` of a numbered folder, its number read
from its name, its H1 read outside fences, a number after `ADR-` or after `Plan`, `Bug`, `Spike`,
`Proposal` or `Case` in it.

| records | agree | disagree | no H1 | H1 holds no such number |
| ------- | ----- | -------- | ----- | ----------------------- |
| 529     | 526   | 0        | 0     | 3                       |

The three are closed plans that write the title `0061 — …`, `0062 — …` and `0066 — …`, each its own
number in another form. So this repository's rule passes once its title pattern reads both forms, and
those three are the reason the pattern is the caller's ([ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)).

## Design

**A condition on `docs()`,** beside `agreeWithFolder`:

```typescript
import { corpus, docs } from '@nielspeter/eess-md'

const c = corpus({ roots: ['work/**'] })

docs(c)
  .that()
  .resideInFolder('work/plans/**')
  .should()
  .agreeWithPath({
    path: /\/(\d{4})-[^/]*\.md$/, // the record's number, from its path
    value: { title: /^Plan (\d{4}):/ }, // the same number, from its title
    normalize: (v) => String(Number(v)), // 0542 and 542 are one number
  })
  .rule({ id: 'plans/number-in-title' })
```

```typescript
/** Where the document's side of the agreement is read (plan 0556). */
export type PathValueSource =
  /** The title as `haveTitle()` reads it; `title`'s first capture group is the value. */
  | { readonly title: RegExp }
  /**
   * A labelled value, read as `fields()` reads it and resolved as `haveField` resolves it; with
   * `pattern`, its first capture group is the value, else the whole value.
   */
  | { readonly field: Omit<FieldOptions, 'split'>; readonly pattern?: RegExp }

export interface AgreeWithPathOptions {
  /** Matched against the document's path relative to the corpus's `cwd`; its first capture group is the path's value. */
  readonly path: RegExp
  readonly value: PathValueSource
  /** Applied to both values before they are compared. Default: none (exact strings). */
  readonly normalize?: (value: string) => string
}
```

**Why both sources.** Block 16 names the H1, and a number in a title is the case in hand (adopter 1,
and this repository). A value under a label (`**Number:** 0542`, a slug field) is the same judgement
over [plan 0469](./completed/0469-havefield-a-document-has-a-value.md)'s resolver, which block 5 already reads through, so the field form is the
resolver's call and no new reading. One source per rule: a rule that wants both writes two.

**Patterns.** Each `RegExp` is read through a private copy with `g` and `y` dropped, as
`areInTitleLinks` copies its prefixes ([bug 0506](../bugs/fixed/0506-a-section-matcher-with-a-g-flag-skips-every-other-document.md)), and must carry a capture group: one without is a
configuration error the rule throws when it is built, naming the option. The first capture group is
the value; a named group is not given a meaning.

**Findings,** each attributed to the document and its line (the title's, the field's, or line 1 for
the path):

| id   | when                                                | message (shape)                                                                                                    |
| ---- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| P1   | `path` does not match the document's path           | its path holds no value the path pattern reads; narrow the selection, or widen the pattern                         |
| P2   | the title is absent, or `title` does not match it   | it has no title, or its title holds no value the title pattern reads                                               |
| P3   | the field is absent or unreadable                   | the resolver's own message, verbatim, as block 5 reports it                                                        |
| P4   | `pattern` does not match the field's resolved value | its `<label>` value holds no value the pattern reads                                                               |
| P5   | both read, and they differ after `normalize`        | the path says `0542` and the title says `0543`: correct the one that is wrong (rename the file, or edit the title) |
| none | a non-empty selection judged no document            | its own finding, unsuppressable, naming the cause, as `agreeWithFolder`'s `judgedNone` does                        |

A document withheld by P1 to P4 is not counted as agreeing. `examined` is the documents judged
(both values read), so a rule whose patterns read nothing is the zero-judged finding, not a pass
([ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md)); the resolver's side causes for a field (prose that disagrees, a label in a form the rule
does not read) are reported as block 5 reports them. The condition is not dual-use: as a selector it
would be "documents whose path agrees", which no adopter asked for.

**Not a kernel block.** The value sources are md's (titles and labelled fields); eess-ts names files
by its own conditions.

## Phases

1. **The condition.** `agreeWithPath` on `docs()`, the two sources, the pattern copies and the
   configuration refusals, P1 to P5 and the zero-judged finding, `examined` as judged documents.
2. **Dogfood.** A `check:corpus` rule over this repository's numbered records (the 529 above), its
   title pattern reading both forms, and its `check:nonvacuity` row: a probe whose title names another
   number, red with P5 by id, file and message.
3. **Example, docs, release.** An example under `examples/md/` with a clean and a violating fixture per
   judgement it states ([plan 0458](./completed/0458-the-examples-gate-a-document-shape-from-public-blocks-only.md)'s gate), a title example and a field example among them; the eess-md
   README; `docs/markdown.md`; `examples/public-surface.test.ts`; [proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md)'s disposition row for
   block 16; a changeset.

## Files changed

- `packages/md/src/conditions/agree-with-path.ts` (new)
- `packages/md/src/builders/docs.ts`
- `packages/md/src/index.ts` (`AgreeWithPathOptions`, `PathValueSource`)
- `packages/md/tests/conditions/agree-with-path.test.ts` (new)
- `examples/md/a-record-number-agrees-with-its-file.test.ts` (new) and its fixtures
- `examples/public-surface.test.ts`
- `scripts/check-corpus.mjs`, `scripts/check-nonvacuity.mjs`
- `packages/md/README.md`, `docs/markdown.md`
- `work/proposals/017-md-blocks-to-check-a-documents-shape.md` (block 16's row)
- `.changeset/md-agree-with-path.md`

## Test inventory

| finding       | rows                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| P5 disagree   | a title naming another number: red, both values in the message; the same with `normalize` making `0542` and `542` one: green |
| P1 no path    | a selected document whose name holds no number: red, naming the path and the pattern                                         |
| P2 no title   | no H1; an H1 the pattern does not read (`0061 — …` against `^Plan (\d{4}):`): one finding each, not counted as agreeing      |
| P3 field      | the field absent, given twice, in a form the rule does not read: the resolver's messages verbatim                            |
| P4 pattern    | a field whose value the pattern does not read: red                                                                           |
| zero judged   | a title pattern that reads no selected title: the zero-judged finding, not a pass                                            |
| configuration | a pattern with no capture group, in each option: throws, naming it; a `g`/`y` flag: no shared `lastIndex` (two runs agree)   |
| frozen        | a frozen document is judged                                                                                                  |
| evidence      | `examined` counts judged documents, not selected ones                                                                        |

**Sabotage matrix,** each row red on the test its break class names, run in a worktree and recorded
in the Progress ledger: (1) P5 dropped; (2) `normalize` applied to one side only; (3) a withheld
document counted as agreeing; (4) P1 dropped; (5) P2 dropped; (6) P3 read by first occurrence rather
than the resolver; (7) the zero-judged finding dropped; (8) `examined` counting selected documents;
(9) the capture-group refusal removed; (10) frozen documents skipped; (11) the caller's `g` flag kept.

**`check:nonvacuity`:** one row per new rule id `check-corpus.mjs` emits (the rule-id audit reads
them), as Phase 2 says.

## Release

`@nielspeter/eess-md` minor, additive: one method and two types.

## Out of scope

- **A value agreeing with another document's path** (a link's target, a board row's file): that is a
  join, `correspondence()`'s, as [plan 0549](./completed/0549-a-link-names-the-record-it-mentions.md)'s target check is.
- **The slug half of a filename** agreeing with the title's words: no adopter asked; the `path`
  pattern can read it once one does, as a field or title pattern can.
- **A selector form:** not asked for.
- **This repository's `corpus/record-number-unique`:** it keeps a number to one record; this keeps a
  record to its own number.

## Progress ledger

- [ ] Reviewed (architect · enforcement · product)
- [ ] Ready
- [ ] Phase 1 — the condition
- [ ] Phase 2 — dogfood
- [ ] Phase 3 — example, docs, release
