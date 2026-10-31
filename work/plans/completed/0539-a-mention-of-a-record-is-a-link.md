# Plan 0539: a mention of a record is a link

## Status

- **State:** Done — built on branch `feat/0539-mentions` and closed in [PR #257](https://github.com/nielspeter/eess/pull/257), 2026-10-21: every ledger box ticked, `validate` green. Frozen Ready the same day; written 2026-10-21 for [proposal 019](../../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s ask A with its ask D.
- **Implements:** [proposal 019](../../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)
- **Priority:** Medium — no project can state "our records are named by links" and have it fail the
  build; this repository alone writes thousands of mentions of its own records as plain text (its
  gate's summary will print the live count, [plan 0541](./0541-this-repositorys-record-mentions-are-gated.md)).
- **Effort:** Medium, one PR. A new element type in eess-md (a model module, a builder, a
  predicate, a condition), its docs and a worked example, and a vacuity-matrix row. No kernel
  change.
- **Created:** 2026-10-21
- **Builds before:** [plan 0541](./0541-this-repositorys-record-mentions-are-gated.md); and
  [proposal 019](../../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s asks B (the target), the fix and C (the relation message), all held, B and the fix
  on [bug 0400](../../bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md). This plan
  ships none of them.

## Problem

A record named as text is checked by nothing; a record named by a link is checked by
`links().should().resolve()` wherever a project's corpus gate runs it. eess-md has no element for
"a match of the project's pattern in a document's text" and no condition for "it sits in a link",
so no project can state "our records are named by links" in its own rule file and have it fail the
build.

What ask A is, and what it is not: it decides presence of a link, a Tier-1 fact. It does not decide
that the link points at the record the mention names; that is ask B, held. A link to the wrong file,
an `#anchor` or any external URL is green under this plan, and the docs say so (Phase 3).

## Decisions carried, not re-made

From [proposal 019](../../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s review
(2026-10-21), its disposition row for A,
[spike 0536](../../spikes/0536-what-a-mention-of-a-record-needs.md), and PR #256's reviews:

1. **No pattern, lane or key is eess-md's** ([ADR-022](../../../adr/022-eess-mds-root-fixes-no-documents-shape.md);
   [spike 0536](../../spikes/0536-what-a-mention-of-a-record-needs.md) section 3). `mentions(corpus, { pattern })` takes the caller's `RegExp`; the element
   carries its named captures.
2. **Inline code is read** ([proposal 018](../../proposals/rejected/018-md-a-mention-of-a-record-is-a-link.md)'s
   review, decision 1; [spike 0536](../../spikes/0536-what-a-mention-of-a-record-needs.md) section 1: 23 bare stamps, 100 quotations here). A mention in
   inline code is a finding with its own message.
3. **Two facts only: `inCode` and `link`.** Where in a link's text a mention sits is B's question,
   and nothing in A reads it (PR #256 enforcement M3), so it waits for B with the rule that uses it.
4. **A private global copy of the pattern, not `stateless()`** (019 review, architect I1).
   `pattern.test('')` true at build is an `ArchConfigError`; so is a zero-length match at run time.
5. **A self-mention is a predicate** taking the mention's key and the document's key, so it composes
   with `not()` and `satisfy()` (019 review, architect I9; examples may not hand-build predicates,
   `arch.rules.ts:201-211`).
6. **What cannot be read is reported where a rule's predicates reach it**
   ([ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)), as `taskItems()`
   reports unread boxes (`packages/md/src/builders/task-items.ts:71-88`): a mention in an HTML block
   (not an HTML comment), in a reference-style link's text, in image alt text or in a link title.
   These are unsuppressable, never counted against anything a caller ratchets. `taskItems()`'s
   helpers are typed to boxes (`packages/md/src/builders/box-mark-findings.ts:20-45`), so the
   mention analogue is written beside them on the same pattern: an unread mention carries everything
   a read one does except whether it is linked, so it is tried against the rule's predicates read as
   linked and as not linked, through the kernel's `membership` ([ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)'s truth table); reached
   either way, or undecided, it is one `md/unread-mention` finding with `bypassFilters: true`, at
   its own line, naming its cause.
7. **Soft breaks are found**: the match runs over each phrasing run's joined text, newlines
   included; whether `bug⏎0338` is a mention is the caller's pattern's choice (`\s+` or `[ -]`), and
   the docs say which to write.
8. **No fix** (019's disposition: the fix is held with B).
9. **`beLinked()` is not cardinality-exempt**: a rule selecting no mention is the
   [ADR-010](../../../adr/010-a-pass-is-constructed-from-evidence.md) vacuity finding, as any empty
   selection is.

## Phases

### Phase 1 — the model: phrasing runs and mentions

A new module, `packages/md/src/model/phrasing.ts`, owns the inline walk: for each paragraph,
heading and table cell (list items reach it through their paragraphs), a run of segments, each with
its text, its source position and its inline ancestry (link, inline code). Fenced and indented code,
front matter and HTML comments are not walked. `links()` keeps its own block walk
(`packages/md/src/model/links.ts:87-202`), which tracks block ancestry and URL spans and does not
need runs; [proposal 015](../../proposals/015-md-wikilinks-are-read-or-reported.md)'s wikilink scan, if
built, consumes this module.

`packages/md/src/model/mentions.ts` matches the caller's pattern over each run's joined text:

```ts
export interface MdMention {
  readonly doc: MdDocument
  /** 1-based line of the match's first character. */
  readonly line: number
  /** The matched text, as joined from the run (a soft break is a `\n`). */
  readonly text: string
  /** The pattern's named captures; a group that did not take part is absent. */
  readonly groups: Readonly<Record<string, string>>
  /** The match's source span, present only when its text is found there exactly. */
  readonly span?: { readonly start: number; readonly end: number }
  /** Any part of the match sits in inline code. */
  readonly inCode: boolean
  /** The link holding the match's last character, if any. */
  readonly link?: { readonly url: string }
}

export type MentionUnread = 'html-block' | 'reference-link' | 'image-alt' | 'link-title'
```

A match whose last character sits in a link is linked, which covers the number alone in a link
(41 of 41 such links name the right record, [spike 0536](../../spikes/0536-what-a-mention-of-a-record-needs.md)). Line: the segment's start line plus the
newlines before the match inside it ([spike 0536](../../spikes/0536-what-a-mention-of-a-record-needs.md)'s instrument), since a code span's value folds line
endings and a decoded text node's offsets are not the source's.

**Files:** `packages/md/src/model/phrasing.ts` (new), `packages/md/src/model/mentions.ts` (new).

### Phase 2 — the builder

```ts
export function mentions(corpus: Corpus, options: { readonly pattern: RegExp }): MentionRuleBuilder
```

```ts
mentions(c, { pattern: /\b(?<kind>bug|plan)s?\s+(?<n>\d{3})\b/gi })
  .that()
  .satisfy(not(areSelfMentions({ mention: (m) => key(m), document: (d) => keyOfPath(d.relPath) })))
  .should()
  .beLinked()
  .check()
```

- `MentionRuleBuilder extends CorpusRuleBuilder<MdMention>`: `getElements()` returns readable
  mentions; `collectViolations()` adds a finding per unread mention its predicates reach (Decision
  6), on the shape of `TaskItemRuleBuilder.collectViolations()`
  (`packages/md/src/builders/task-items.ts:71-88`).
- Predicate: the free `areSelfMentions({ mention, document })`, true when both functions return a
  key and they are equal. `resideInFile()` and `satisfy()` are inherited.
- Condition: `beLinked()`, one finding per mention without a `link`, at its own line. Two
  messages, "is not a link" and "is in inline code, not a link", each quoting the mention; the
  `suggestion` says to link it to the record it names, or, for a quoted example, to move it into a
  fenced block.
- Exports from `packages/md/src/index.ts`: `mentions`, `MentionRuleBuilder`, `MdMention`,
  `MentionUnread`, `areSelfMentions`. `check:family` holds the re-exports.

**Files:** `packages/md/src/builders/mentions.ts` (new), `packages/md/src/predicates/mentions.ts`
(new), `packages/md/src/conditions/be-linked.ts` (new), `packages/md/src/index.ts`.

### Phase 3 — docs and a worked example

- `docs/markdown.md`: a "Mentions" section. The common case in one rule; the pattern and the
  self-mention keys as the caller's, including normalising letter case in the keys (an `i` pattern
  captures `ADR` and `adr` alike); inline code and how to quote an example (a fenced block, or the
  reason-required waiver); `\s+` for soft breaks. **What this cannot see**, as `pointers()` writes
  its limits:
  - a mention its pattern misses: `bug number 338`, a bare `0338`, the second number of

    ```
    plans 0532 and 0533
    ```

    and a year that looks like a number;

  - the target: a link to the wrong file, an `#anchor` or any external URL is linked (ask B);
  - that a waiver's suppressions are disclosed only under eess-ts's runner
    ([bug 0537](../../bugs/0537-eess-md-alone-has-no-run-level-services.md)).

- `packages/md/README.md`: `mentions()` in the element list, separated in one line from
  `links().beLinkedBack()`.
- `examples/md/a-mention-of-a-record-is-a-link.test.ts`: passing and failing fixtures, public
  blocks only; registered in `check:nonvacuity` automatically (`scripts/check-nonvacuity.mjs:1050`).

**Files:** `docs/markdown.md`, `packages/md/README.md`, `examples/md/a-mention-of-a-record-is-a-link.test.ts`
(new) with its fixtures.

### Phase 4 — the vacuity matrix

A `mentions()` row in `scripts/vacuity-matrix.mjs` beside eess-md's (`scripts/vacuity-matrix.mjs:375-387`):
over zero files, a `beLinked()` rule is the vacuity finding, never green. `areSelfMentions` builds no
check, so it joins the list of exports the completeness check accepts as not constructors
(`SIBLING_NOT_CONSTRUCTORS`, `scripts/vacuity-matrix.mjs:562-569`).

**Files:** `scripts/vacuity-matrix.mjs`.

## Files Changed

| file                                                        | phase |
| ----------------------------------------------------------- | ----- |
| `packages/md/src/model/phrasing.ts` (new)                   | 1     |
| `packages/md/src/model/mentions.ts` (new)                   | 1     |
| `packages/md/src/builders/mentions.ts` (new)                | 2     |
| `packages/md/src/predicates/mentions.ts` (new)              | 2     |
| `packages/md/src/conditions/be-linked.ts` (new)             | 2     |
| `packages/md/src/index.ts`                                  | 2     |
| `packages/md/tests/builders/mentions.test.ts` (new)         | 1, 2  |
| `docs/markdown.md`, `packages/md/README.md`                 | 3     |
| `examples/md/a-mention-of-a-record-is-a-link.test.ts` (new) | 3     |
| `scripts/vacuity-matrix.mjs`                                | 4     |
| `.changeset/*.md` (eess-md minor)                           | —     |

## Test inventory

Each drives the public entry point, `mentions(corpus, { pattern })`, over `corpusFromText` or a disk
fixture.

| test                                                                                                                                             | phase |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| a plain mention is red at its own line; a linked one beside it is green                                                                          | 2     |
| a mention in inline code is red with the inline-code message                                                                                     | 2     |
| a mention in inline code inside a link is linked                                                                                                 | 1, 2  |
| the number alone in a link is linked                                                                                                             | 1, 2  |
| a mention split by emphasis is found and red                                                                                                     | 1, 2  |
| a mention broken by a soft line break is found by `\s+` and missed by `[ -]`, each by the caller's pattern                                       | 1     |
| a mention's line is its own, on the third line of a paragraph                                                                                    | 1     |
| fenced, indented, front-matter and HTML-comment mentions are not elements                                                                        | 1     |
| an HTML block, a reference-style link, image alt and a link title are red as unread, each with its cause, only where the rule's predicates reach | 2     |
| `areSelfMentions` drops a record's own title, keeps another record's mention in it, and composes through `not()`                                 | 2     |
| a pattern matching the empty string is an `ArchConfigError` at build                                                                             | 2     |
| a caller's `g` pattern used twice gives the same elements (no carried `lastIndex`)                                                               | 1     |
| a rule selecting no mention is the vacuity finding                                                                                               | 2     |
| `groups` carries named captures and omits a group that did not take part                                                                         | 1     |

## Release

| package               | bump  | why                                                      |
| --------------------- | ----- | -------------------------------------------------------- |
| `@nielspeter/eess-md` | minor | new public API: `mentions()` and its types and predicate |
| every other package   | none  | nothing a consumer can observe                           |

## Out of scope

- **This repository's own gate:** [plan 0541](./0541-this-repositorys-record-mentions-are-gated.md).
- **The target** ([proposal 019](../../proposals/019-md-a-mention-is-a-link-built-from-blocks.md) ask B), **the fix** and **the relation message** (ask C): held by
  [proposal 019](../../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s review; B and the fix on [bug 0400](../../bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md).
- **`.claude/skills/` and `kit/`**: not corpus roots ([bug 0535](../../bugs/0535-the-corpus-gate-does-not-read-skill-or-kit-files.md)).
- **eess-md's own door to fixes, baselines and waiver disclosure**: [bug 0537](../../bugs/0537-eess-md-alone-has-no-run-level-services.md).

## Progress ledger

- [x] Phase 1 — model: phrasing runs and mentions. Done otherwise in one respect: `MdMention` and
      `MdUnreadMention` are defined in `model/mentions.ts`, not the builder, because
      `check:arch`'s layer rule forbids a predicate importing from `builders/`; the builder re-exports
      them
- [x] Phase 2 — builder, `areSelfMentions`, `beLinked()`, exports. The plan said `resideInFile()`
      is inherited; it is not (the free predicate takes a document), so the builder gained
      `resideInFile()` and `resideInFolder()`, lifted with `liftToDocument` as `codeBlocks()` does.
      Sabotage, 2026-10-21: `beLinked()` passing everything turned 6 of the 16 tests red; the walk
      skipping inline code turned 2 red; both green again once restored
- [x] Phase 3 — docs and the worked example (`check:docs-code`: 111 fences compile, the two new
      ones included; the example's three tests pass and its fixtures ran in `check:nonvacuity`)
- [x] Phase 4 — the vacuity-matrix row (a configuration finding over an empty corpus) and two
      not-a-constructor entries, `collectMentions` and `areSelfMentions`
- [x] Every row of the Test inventory written and green (16 tests in
      `packages/md/tests/builders/mentions.test.ts`)
- [x] The eess-md minor changeset (`.changeset/mentions-are-links.md`)
- [x] [Proposal 019](../../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s disposition row for A set to `Accepted, reshaped`, owner this plan (2026-10-21)
- [x] `npm run validate` green, 2026-10-21: the chain ran 17.5 minutes and stopped at
      `format:check` on four unformatted new files; after formatting, the steps it had not reached
      (`test`, `test:matrix`, `check:surface`) ran green in 66 seconds. The earlier steps were not
      re-run for a whitespace-only change

- [x] PR #257's review applied (architect · enforcement · testing), 2026-10-21, done otherwise than
      Phase 1 and Decision 6 wrote:
  - `span` removed: unused by ask A and, measured, placed on the wrong text when a block repeated
    it; Decision 3's two facts are what ships.
  - The unread cause list grew and changed: `html-link` (a link written as `<a href>`),
    `definition-title` and `image-title`; a link's own title is read, as linked, not unread. The
    exported type is `UnreadCause`, not the alias `MentionUnread`.
  - A block of exactly one HTML comment is not read; text between two comments on one line is
    (a greedy pattern had dropped it silently).
  - A link with no target, `[x]()` or `[x](#)`, is not linked.
  - Decision 6's reach, as built after a second review round: each predicate is asked about an
    unread mention whose link and code are unknowable (they throw when read). One that decides it
    out without them leaves it out; one that reads them cannot judge it, so it is reported. A first
    version trusted a `docMembership` field, which over-reported (`not(areSelfMentions(…))`,
    `inSections(…)`) and could be forged; it was replaced in the same PR.
  - One walk per document per builder; remedies rewritten so each clears its finding.
  - The test file grew from 16 to 31 tests; the testing review's mutants, rewritten for the new
    code, went from 7 of 27 killed to 36 of 37, the one not applied being a patch for code since replaced (the 35 tests). The example gained a capitalised mention and a
    `violating-unread-html` fixture.
- [x] The unread-reach helper is not generalised across `taskItems()` and `mentions()`:
      dropped-on-purpose, two copies; a third ([proposal 015](../../proposals/015-md-wikilinks-are-read-or-reported.md)'s wikilinks, if built) is the moment to
      extract it.
- [x] Invisible characters inside a mention are recorded, not fixed here: deferred→[bug 0543](../../bugs/0543-an-invisible-character-hides-a-mention.md).

Deferred: [bug 0543](../../bugs/0543-an-invisible-character-hides-a-mention.md). [Proposal 019](../../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s held asks (B, the fix, C) and this repository's own gate were never this plan's; they are in Out of scope with their homes.
