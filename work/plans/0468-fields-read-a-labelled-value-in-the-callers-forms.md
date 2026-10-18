# Plan 0468: `fields()` reads a labelled value in the forms the caller names

## Status

- **State:** Draft — written 2026-10-18 from proposal 017's block 1.
- **Implements:** proposal 017
- **Priority:** High. All three adopters asked for it, and among the asks it would replace the most
  code they wrote by hand (proposal 017, "Consumer feedback").
- **Effort:** Medium. It adds one constructor and one condition on an existing builder, plus three
  label forms in the model.
- **Created:** 2026-10-18
- **Builds after:** [bug 0403](../bugs/0403-the-vacuity-matrix-probes-one-dialect-of-five.md), a
  precondition the second Review set for block 1: the vacuity matrix must enumerate eess-md before
  eess-md gains a constructor. Where it sits among proposal 017's plans is for the maintainer to set.
- **Followed by:** [plan 0469](./0469-havefield-a-document-has-a-value.md), `haveField`, which uses
  this reader.

## Problem

Every adopter reads a record's labelled value, such as `Status`, `Severity` or `Owner`, with a
reader it wrote itself. eess-md has two readers:

- `terms()` (`packages/md/src/builders/vocabulary.ts:178`) takes a regex and returns the text after
  it. It knows nothing about label forms. Its default value cuts at `·—–|`, and it reports nothing
  when a label is written in a way the regex does not match.
- `honestyAtClose` reads only the `State` label (bug 0444).

The forms adopters actually write, counted by adopter 3 across live and frozen records:

| form              | live | frozen |
| ----------------- | ---- | ------ |
| `## Status: v`    | 601  | 536    |
| `**Status:** v`   | 124  | 311    |
| `- **Status:** v` | 28   | 59     |
| `**Status**: v`   | 0    | 40     |
| `**Status: v**`   | 0    | 14     |

Adopter 2 indents fields up to three spaces. Values carry emoji, emphasis and trailing prose, and one
value runs over four lines.

## Design

Decisions 1 and 2 of proposal 017 ("Consumer feedback") settle the shape: the element is **field**,
there is one element type with two constructors, and where a value ends is the caller's choice.

```ts
export type FieldForm = 'bold' | 'heading' | 'bold-value' | 'plain'

export interface FieldOptions {
  /** The label, compared ignoring ASCII case and runs of whitespace. */
  readonly label: string
  readonly aliases?: readonly string[]
  /** The forms to read. Required: eess-md has no default form. */
  readonly forms: readonly FieldForm[]
  /** Where the value ends and how it is cleaned. Default: `cleanValue`. */
  readonly value?: (raw: string) => string
  /** Splits one value into several, after `value` has cut it. */
  readonly split?: (value: string) => readonly string[]
}

export function fields(corpus: Corpus, options: FieldOptions): TermRuleBuilder
```

**The forms.** Each form may follow a list marker and up to three spaces of indent.

| form         | reads                                                                        |
| ------------ | ---------------------------------------------------------------------------- |
| `bold`       | `**X:** v`, `**X**: v`, `__X__: v` (the wrapped forms of the shared grammar) |
| `heading`    | `## X: v`, at any heading depth                                              |
| `bold-value` | `**X: v**`                                                                   |
| `plain`      | `X: v`                                                                       |

These are new fragments in `packages/md/src/model/label.ts`. `labelPattern`, which the ledger and
`links().areLabelled()` share, does not change. That keeps the second Review's rule that the shared
grammar is never widened.

**Elements.** `MdTerm` gains two required fields:

- `label`: the label as it was written;
- `form`: a `FieldForm`, or `'pattern'` for a `terms()` element.

`value` stays the normalised value and `raw` stays the text before normalising. `fields()` yields
every occurrence as its own element, on its own line. Choosing between occurrences is the resolver's
job in plan 0469, not the reader's. `terms()` reads exactly what it reads today; its elements gain
`label` (the matched text) and `form: 'pattern'`.

**Where the value is read:**

- Fenced code is skipped (`proseText`, as `terms()` does).
- Frozen documents are read: each rule chooses its own documents (proposal 017, decision 3).

**A value over several lines** continues until the next blank line, heading or line that is itself a
label in any form, or the end of its list item. The element's `line` is the label's line.

**The value and its end.** The default, `cleanValue`, removes markdown emphasis, backticks, and a
leading or trailing emoji or symbol, then trims and collapses whitespace. It cuts nothing. Two helpers
are exported, and neither is a default:

- `untilDelimiter(chars)` cuts the value at the first of the given delimiters;
- `longestOf(allowed)` takes the longest allowed value the text starts with.

**One condition: `beOneOf(allowed: readonly string[] | RegExp)`.** Values are compared exactly after
the caller's normaliser, so a caller who wants case-insensitive matching lowercases there. The
finding names the value, the label as written, its line and the allowed set:

```
'Shipped' (Status, line 3) is not one of: open, fixed, closed
```

**A form the caller did not name is a finding, never a silent skip.** This is the second Review's
enforcement condition. It follows `links()`'s declaration findings
(`packages/md/src/builders/links.ts:141`): `collectViolations` adds them, and they do not raise
`examined`. For example:

```
found `## Status: open` at line 3, in a form this rule does not read (heading); add 'heading' to forms, or rewrite the line
```

The scan covers the structured forms (`bold`, `heading` and `bold-value`) and never `plain`. Prose that
starts "status: …" is common, which is why `wrappedLabelOf` already leaves the plain form out
(`packages/md/src/model/label.ts:60`). A label that matches nothing at all gives the kernel's
zero-examined finding (ADR-010).

**Dogfooding.** `check:corpus` gains a rule that every `Severity` value on this repository's bugs is
one of the declared levels, written with `untilDelimiter(['—'])`. The rule gets a `check:nonvacuity`
row that changes one bug's Severity to `Hgh`. How many values the rule examines and whether any is off
the set today are measured in Phase 3. Any value that is off the set is fixed in the build or recorded,
never excluded silently.

## Phases

1. **Reader.** The label fragments, `fields()`, the wider `MdTerm`, multi-line values, `cleanValue`
   and the two helpers.
2. **Findings.** `beOneOf` and the scan for unnamed forms.
3. **Dogfood and release.** The `check:corpus` rule, its `check:nonvacuity` row, the eess-md README
   section, a changeset, and, if plan 0458 has shipped, an example under `examples/md/`.

## Files changed

- `packages/md/src/model/label.ts`
- `packages/md/src/builders/vocabulary.ts`
- `packages/md/src/index.ts`
- `packages/md/tests/builders/fields.test.ts` (new)
- `scripts/check-corpus.mjs`
- `scripts/check-nonvacuity.mjs`
- `packages/md/README.md`
- `.changeset/md-fields.md`

## Test inventory

- **Each form read, with its line:** `bold` in all three spellings, `- **Status:** v`, three spaces of
  indent, `heading` at depths 2 and 4, `bold-value`, `plain`.
- **What is not read:** a fenced example; a label inside a paragraph.
- **Several occurrences:** every occurrence is yielded. An alias is reported with `label` as it was
  written.
- **Multi-line values:** stop at a blank line, a heading, another label and the end of a list item.
- **`cleanValue`:** `✅ Fixed`, `**Fixed**` and `` `Fixed` `` all give `Fixed`; a typographic
  apostrophe is kept.
- **The helpers:** `untilDelimiter` on `High — reason`; `longestOf` on `In progress (blocked)`.
- **`split`:** one element per value, each on the label's line.
- **`beOneOf`:** the message above, word for word, for both a set and a regex.
- **Unnamed forms:** `forms: ['bold']` over a `## Status:` document gives the finding. An unnamed
  `plain` line gives none.
- **`terms()`:** its existing tests pass unedited; a new test shows `form: 'pattern'`.
- **Sabotage rows**, each turning its named test red:
  1. drop the `heading` fragment;
  2. disable the unnamed-form scan;
  3. let a continuation run past a blank line.

## Release

`@nielspeter/eess-md` minor, additive. `MdTerm` gains two required fields. That only breaks code that
builds an `MdTerm` literal itself; no package in the family does (measured with
`git grep MdTerm -- packages`).

## Out of scope

- **Presence, precedence between occurrences, and conflicts:** plan 0469.
- **Frontmatter:** adopter 3 counts 0 uses, and no adopter asked for it.
- **`honestyAtClose`'s own reader:** bug 0444, and the preset's rebuild from public blocks
  (proposal 017, second Review, decision 1).
- **A value agreeing with its folder:** block 5, after its ADR.

## Progress ledger

- [ ] Bug 0403 fixed (precondition)
- [ ] Phase 1: reader
- [ ] Phase 2: `beOneOf` and the unnamed-form findings
- [ ] Phase 3: dogfood rule, non-vacuity row, README, changeset, example
- [ ] Sabotage rows 1–3 red on their named tests; suites green; durations reported
- [ ] Close: this plan → `completed/`; boards

Deferred: none
