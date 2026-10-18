# Plan 0468: `fields()` reads a labelled value in the forms the caller names

## Status

- **State:** Draft — written 2026-10-18 from proposal 017's block 1; revised the same day after one
  review round (architect · product · enforcement · method).
- **Implements:** proposal 017
- **Priority:** High. All three adopters asked for blocks 1 and 2 (proposal 017, "Consumer
  feedback"). The maintainer asked for these two to be planned on 2026-10-18.
- **Effort:** Medium. One per-document reader in the model, one new constructor, two new label
  forms beside the two the shared grammar already reads, and a scan for forms the caller did not
  name.
- **Created:** 2026-10-18
- **Builds after:**
  - [bug 0403](../bugs/fixed/0403-the-vacuity-matrix-probes-one-dialect-of-five.md), the precondition
    the second Review set for block 1: the vacuity matrix covers eess-md before eess-md gains a
    constructor;
  - [plan 0458](./0458-the-examples-gate-a-document-shape-from-public-blocks-only.md), the examples
    gate, which decision 3 makes the condition for every accepted block.

  Where this sits among proposal 017's plans is the maintainer's to set.

- **Followed by:** [plan 0469](./0469-havefield-a-document-has-a-value.md), `haveField`, which
  resolves this reader's occurrences.

## Problem

Every adopter reads a record's labelled value (`Status`, `Severity`, `Owner`) with a reader it wrote
itself. eess-md has two readers, and neither does the job:

- `terms()` (`packages/md/src/builders/vocabulary.ts:178`) takes a regex and returns the text after
  it. It knows no label forms, cuts its default value at `·—–|`, and reports nothing about a label
  written in a way its regex misses.
- `honestyAtClose` read only `State` (bug 0444). It now takes `label` and `aliases`, and reads a
  `## Label: value` heading in a record's header (bug 0476): a second header reader this plan's
  `readFields` should absorb, with the same header rule.

Adopter 3 counted the forms it uses (live / frozen):

| form                                  | live | frozen |
| ------------------------------------- | ---- | ------ |
| `## Status: v`                        | 601  | 536    |
| `**Status:** v`                       | 124  | 311    |
| `- **Status:** v` or `- **State:** v` | 28   | 59     |
| `**Status**: v`                       | 0    | 40     |
| `**Status: v**`                       | 0    | 14     |

Adopter 2 indents up to three spaces. Values carry emoji, emphasis and trailing prose, and one value
spans four lines.

## Design

Proposal 017's "Decisions this settles" 1 and 2 give the shape. They are the coordinator's decisions,
and the maintainer has not overruled them. The element is a **field**: one element type with two
constructors, and the caller decides where a value ends.

```ts
export type FieldForm = 'bold' | 'heading' | 'bold-line' | 'plain'

export interface FieldOptions {
  /** The label, compared ignoring ASCII case and runs of whitespace. */
  readonly label: string
  readonly aliases?: readonly string[]
  /** The forms to read. Required: eess-md has no default form. */
  readonly forms: readonly FieldForm[]
  /** Where the value ends and how it is cleaned. Replaces the default, `cleanValue`. */
  readonly value?: (raw: string) => string
  /** Splits one value into several, after `value` has cut it. */
  readonly split?: (value: string) => readonly string[]
  /** `'header'`: read only the document's header (below). Default: the whole document. */
  readonly region?: 'header'
}

export function fields(corpus: Corpus, options: FieldOptions): TermRuleBuilder
```

**The forms.** Each form may follow a list marker and up to three spaces of indent.

| form        | reads                                                                  |
| ----------- | ---------------------------------------------------------------------- |
| `bold`      | `**X:** v`, `**X**: v`, `__X__: v`: the shared grammar's wrapped forms |
| `heading`   | `## X: v`, at any heading depth                                        |
| `bold-line` | `**X: v**`, a whole line in bold                                       |
| `plain`     | `X: v`                                                                 |

**One reader, in the model.** `readFields(doc, options)` in `packages/md/src/model/fields.ts` returns
every occurrence in one document:

- each occurrence carries the label as written, its form, its line, its raw text, its cut value and
  its split values;
- `fields()` uses it through `stampedByDocument` (`packages/md/src/builders/links.ts:37`);
- plan 0469's resolver and the unnamed-form scan use the same function, so there is one
  labelled-value reader (decision 4).

`labelPattern`, which the ledger and `links().areLabelled()` share, does not change. The `heading` and
`bold-line` fragments are new and opt-in.

**What the reader reads:**

- **The header region.** With `region: 'header'`, only lines before the header's end are read. The
  header ends at the first heading of depth 2 or more that is not itself written as `## Label: value`.
  So `## Status: open` followed by `## Severity: High` and `## Priority: 2` stays one header. This
  covers 1,080 of adopter 3's 1,137 `## Status:` records.
  - Any `## Label: value` heading counts, not only the labels the caller declares. Adopter 3 measured
    one record where this reads too far (`## ⚠️ RETRACTED: …`, frozen). This is a known limit: when
    the real header has no value and a body line below such a heading has one, that body value is
    read as the header's, and nothing is reported. It is [bug 0471](../bugs/0471-the-header-region-reads-a-body-value-past-a-label-shaped-section.md). When the header does have a value, reading too
    far gives a conflict, which is reported.
  - The unnamed-form scan reads the same region. With the header region, a per-phase `**Status:**`
    further down is neither read nor reported.
  - A field that sits under a named section (`## Status`, with `- **State:** v` under it; 51 of
    adopter 3's records, 7 of them live) is outside the header. `haveField` reports it in either
    position, as plan 0469's "outside the region" cause. A named-section region waits for block 11.

- Fenced code is skipped (`proseText`).
- Frozen documents are read (decision 3: each rule chooses its own documents).
- An HTML block is read as prose. That is bug 0293, a known limit of every eess-md reader, and
  this plan does not fix it.
- A value over several lines continues until a blank line, a heading, a line that is itself a label
  in any form, or the end of its list item. A `heading` value is one line. The element's `line` is
  the label's line.

**Elements.** `MdTerm` gains two fields:

- `label`: the label's text, without the colon and without emphasis, for both constructors;
- `form`: a `FieldForm`, or `'pattern'` for a `terms()` element.

`value` is the cut value and `raw` the text before cutting. A field with `split` yields one element
per value, all on the label's line. `terms()` reads exactly what it reads today.

**The value.** The default, `cleanValue`, removes paired emphasis delimiters (`**x**`, `_x_`,
`` `x` ``, `~~x~~`), never a lone `_` inside a word. It removes a leading or trailing pictograph with its
variation selector, then trims and collapses whitespace. So `in_progress` and `C++` survive. It cuts
nothing. A caller's `value` replaces it; `cleanValue` is exported for a caller to compose. Two helpers
are exported, and neither is a default:

- `untilDelimiter(chars)` cuts at the first delimiter and trims;
- `longestOf(allowed)` takes the longest allowed value the text starts with, ignoring case, and
  trims leading and trailing whitespace first, and returns the trimmed text when none matches, so the check reports it. The reader hands `value` the text after the label untrimmed, as `terms()` does, so a helper that did not trim would match nothing.

**Checking a value: `resolveAgainst`, extended, not a second condition.** `TermRuleBuilder`
already checks set membership (`packages/md/src/builders/vocabulary.ts:172`), normalising both
sides with the vocabulary's `normalize`. It gains one input type:

- `resolveAgainst(allowed: Vocabulary | RegExp)`;
- a `RegExp` must match the whole value, and a copy is compiled without `g`/`y`;
- a `fields()` finding names the value as written, the label and the line. It never lists the set,
  which for a vocabulary built from folders can hold hundreds of terms:

```
'Shipped' (Status, line 3) does not resolve against the vocabulary (5 terms)
'Shipped' (Status, line 3) does not match /(open|fixed)/
```

A `terms()` element keeps today's message unchanged (`packages/md/src/builders/vocabulary.ts:145`).

**A form the caller did not name is a finding, never a silent skip.** This is the second Review's
enforcement condition. The scan:

- covers `bold`, `heading` and `bold-line`. It never covers `plain`: prose that opens "status: …" is
  common, which is why `wrappedLabelOf` leaves the plain form out (`packages/md/src/model/label.ts:60`);
- covers **only the documents the rule selects**. A candidate element for the unnamed occurrence is
  passed through the rule's predicates, so a rule scoped to `bugs/**` never reds on a README's
  `## Status: beta`;
- adds its findings in `collectViolations` without raising `examined`, as `links()` does
  (`packages/md/src/builders/links.ts:140-150`).

```
found `## Status: open` at line 3, in a form this rule does not read (heading); add 'heading' to forms, or rewrite the line
```

A label matching nothing at all gives the kernel's zero-examined finding (ADR-010). Narrowed, and
recorded in proposal 017: an alias the caller did not name cannot be known. Plan 0469's "no field"
finding lists the wrapped labels the document does carry instead.

**Dogfooding.** `check:corpus` gains one rule per lane over the `State` values on this repository's live
plans and bugs. Each rule uses `longestOf(states)` as its `value` and resolves against a vocabulary of
the same states, which are the lane vocabularies `scripts/check-ledger.mjs:59-67` already declares.
`check:ledger` reads every record's state with those vocabularies today, so the rule should be
green on its first run; Phase 3 measures that. A `check:nonvacuity` row changes one bug's State to
`Drfat`.

`Severity` is not dogfooded, because the values are not ready for it. Measured 2026-10-18 over 170
live bold `Severity` lines:

- after `cleanValue` and `untilDelimiter(['—'])`, 7 still match no level, because they write prose
  instead (bugs 0174, 0175, 0177, 0178, 0180, 0181, 0182);
- 22 live bugs have no `Severity` line at all.

Giving each of those a level is a judgement per bug, and not part of this build.

## Phases

1. **Reader.** `model/fields.ts`, the two new fragments, `fields()`, the extended `MdTerm`,
   `cleanValue` and the two helpers.
2. **Findings.** `resolveAgainst` with a `RegExp`, the new message, and the unnamed-form scan scoped to
   the selection.
3. **Dogfood, docs, release.** The `check:corpus` rule and its `check:nonvacuity` row, an example under
   `examples/md/`, the eess-md README, `docs/markdown.md`, a changeset.

## Files changed

- `packages/md/src/model/fields.ts` (new)
- `packages/md/src/model/label.ts`
- `packages/md/src/builders/vocabulary.ts`
- `packages/md/src/index.ts`
- `examples/public-surface.test.ts` (`FieldOptions`, `FieldForm`)
- `examples/md/fields/` (new: clean and violating fixtures)
- `packages/md/tests/builders/fields.test.ts` (new)
- `scripts/check-corpus.mjs`
- `scripts/check-nonvacuity.mjs`
- `packages/md/README.md`
- `docs/markdown.md`
- `.changeset/md-fields.md`

## Test inventory

- **Each form read, with its line:**
  - `bold` in all three spellings;
  - `- **Status:** v`, and three spaces of indent;
  - `heading` at depths 2 and 4;
  - `bold-line`;
  - `plain`.
- **The header region:** `## Status:` then `## Severity:` stays one header; a `## Notes` heading ends
  it; a per-phase `**Status:**` after it is neither read nor reported; `## Status` (no colon) with
  `- **State:** v` under it is outside the header.
- **Not read:** a fenced example; a label in the middle of a paragraph; a heading with no colon,
  such as `## Status at a glance`.
- **Every occurrence yielded.** An alias is reported with its own `label`.
- **Multi-line values:** stop at a blank line, a heading, another label, and the end of the list item.
  A `heading` value stops at its own line.
- **`cleanValue`:** `✅ Fixed`, `**Fixed**`, `~~Fixed~~` and `` `Fixed` `` give `Fixed`; `in_progress` and `C++`
  stay as they are; a typographic apostrophe is kept.
- **Helpers:** `untilDelimiter` on `High — reason`; `longestOf` on `In progress (blocked)` and on
  ` Draft — reason` with its leading space.
- **`split`:** one element per value, each on the label's line.
- **`resolveAgainst`:**
  - the two messages above, verbatim; a `terms()` element's message unchanged;
  - `/fixed/` rejects `unfixed`, because the match is whole-value;
  - a `/g` pattern gives the same result on its second document.
- **Unnamed forms:**
  - `forms: ['bold']` over a selected `## Status:` document gives the finding;
  - the same document outside the selection gives none;
  - an unnamed `plain` line gives none.
- **`terms()`:** existing tests pass unedited; `form: 'pattern'` and `label` without the colon.
- **Sabotage rows**, each turning its named test red:
  1. drop the `heading` fragment;
  2. disable the unnamed-form scan;
  3. let the scan ignore the selection;
  4. let a continuation run past a blank line.

## Release

`@nielspeter/eess-md` minor, flagged `**Breaking**`. `MdTerm` gains two required fields, so an
adopter's test that builds an `MdTerm` literal stops compiling. The fix is one line: add `label` and
`form`. No package in the family builds one (`git grep MdTerm -- packages examples`). The changeset
names the dependants that release requires (bug 0185).

## Out of scope

- **Presence, precedence and conflicts:** plan 0469.
- **Frontmatter:** adopter 3 counts 0 uses, and no adopter asked for it.
- **`honestyAtClose`'s reader:** bug 0444, and the preset rebuild (the second Review, decision 1).
- **A value agreeing with its folder:** block 5, after its ADR.
- **A census of allowed values that no document uses** (a carried item, report-only): left to the
  first adopter who asks.

## Progress ledger

- [ ] Preconditions: plan 0458 shipped (bug 0403 was fixed in PR #237)
- [ ] Phase 1: reader
- [ ] Phase 2: `resolveAgainst` and the unnamed-form scan
- [ ] Phase 3: dogfood rule, non-vacuity row, example, README, docs, changeset
- [ ] Sabotage rows 1–4 red on their named tests; suites green; durations reported
- [ ] Close: this plan → `completed/`; boards

Deferred: none
