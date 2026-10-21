# Plan 0539: a mention of a record is a link

## Status

- **State:** Draft — written 2026-10-21 for [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s
  ask A with its ask D, after the maintainer's assent to the review's disposition ("plan ask A") and
  instruction to dogfood it here. Every design point below is the review's or
  [spike 0536](../spikes/0536-what-a-mention-of-a-record-needs.md)'s, cited where it is carried.
- **Implements:** proposal 019
- **Priority:** Medium — this repository writes 4,657 mentions of its own records as plain text
  (measured 2026-10-21 with the pattern Phase 4 declares), which nothing checks, and the
  record-authoring skills now tell an agent to link while the corpus shows it not to.
- **Effort:** Medium, one PR. A new element type in eess-md (a model module, a builder, two
  predicates, one condition), its docs and a worked example, and this repository's gate over its own
  corpus with a count ratchet. No kernel change.
- **Created:** 2026-10-21
- **Builds before:** proposal 019's asks B (the target), the fix and C (the relation message), all
  held; this plan ships none of them.

## Problem

A record named as text is checked by nothing; a record named by a link is checked on every run
(`links().should().resolve()`). eess-md has no element for "a match of the project's pattern in a
document's text" and no condition for "it sits in a link", so no project can state "our records are
named by links" in its own rule file and have it fail the build.

What ask A is, and what it is not: it decides presence of a link, a Tier-1 fact. It does not decide
that the link points at the record the mention names; that is ask B, held for a prototype. A link to
the wrong file is green under this plan, exactly as it is today, and the docs say so (Phase 3).

## Decisions carried, not re-made

From proposal 019's review (2026-10-21), its disposition row for A, and spike 0536:

1. **No pattern, lane or key is eess-md's** (ADR-022; spike 0536 section 3). `mentions(corpus, {
pattern })` takes the caller's `RegExp`; the element carries its named captures.
2. **Inline code is read** (proposal 018's review, decision 1; spike 0536 section 1: 23 bare
   stamps, 100 quotations here). A mention in inline code is a finding with its own message.
3. **Positions are facts, not one enum** (019 review, architect I8): `inCode`, and `link` with
   `position: 'whole' | 'opens' | 'later' | 'straddles'`, decided by character offsets, never by
   capture names.
4. **A private global copy of the pattern, not `stateless()`** (019 review, architect I1).
   `pattern.test('')` true at build is an `ArchConfigError`; so is a zero-length match at run time.
5. **A self-mention is a predicate** taking the mention's key and the document's key, so it composes
   with `not()` and `satisfy()` (019 review, architect I9; examples may not hand-build predicates,
   `arch.rules.ts:201-211`).
6. **What cannot be read is reported where a rule's predicates reach it** (ADR-021), as
   `taskItems()` reports unread boxes (`packages/md/src/builders/task-items.ts:71-88`): a mention
   in an HTML block (not an HTML comment), in a reference-style link's text, in image alt text or in
   a link title.
7. **Soft breaks are found**: the match runs over each phrasing run's joined text, newlines
   included; whether `bug⏎0338` is a mention is the caller's pattern's choice (`\s+` or `[ -]`), and
   the docs say which to write.
8. **No fix** (019's disposition: the fix is held with B).
9. **`beLinked()` is not cardinality-exempt**: a rule selecting no mention is the ADR-010 vacuity
   finding, as any empty selection is.

## Phases

### Phase 1 — the model: phrasing runs and mentions

A new module, `packages/md/src/model/phrasing.ts`, owns the inline walk: for each paragraph,
heading and table cell (list items reach it through their paragraphs), a run of segments, each with
its text, its source position and its inline ancestry (link, inline code, emphasis). Fenced and
indented code, front matter and HTML comments are not walked. `links()` keeps its own block walk
(`packages/md/src/model/links.ts:85-200`), which tracks block ancestry and URL spans and does not
need runs; proposal 015's wikilink scan, if built, consumes this module.

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
  /** The link holding the match's last character, and where in its text the match sits. */
  readonly link?: {
    readonly url: string
    readonly position: 'whole' | 'opens' | 'later' | 'straddles'
  }
}

export type MentionUnread = 'html-block' | 'reference-link' | 'image-alt' | 'link-title'
```

`position` by offsets within the run: `whole` when the link's text equals the match; `opens` when
the link's text starts with it; `later` when it lies inside the link's text past its start;
`straddles` when the match starts before the link and ends inside it (`bug [0119](…)`, 41 of 41
correct in spike 0536). Line: the segment's start line plus the newlines before the match inside
it (spike 0536's instrument), since a code span's value folds line endings and a decoded text node's
offsets are not the source's.

**Files:** `packages/md/src/model/phrasing.ts` (new), `packages/md/src/model/mentions.ts` (new).

### Phase 2 — the builder

```ts
export function mentions(corpus: Corpus, options: { readonly pattern: RegExp }): MentionRuleBuilder

mentions(c, { pattern: /\b(?<kind>bug|plan)s?\s+(?<n>\d{3})\b/gi })
  .that()
  .satisfy(not(areSelfMentions({ mention: (m) => key(m), document: (d) => keyOfPath(d.relPath) })))
  .should()
  .beLinked()
  .check()
```

- `MentionRuleBuilder extends CorpusRuleBuilder<MdMention>`: `getElements()` returns readable
  mentions; `collectViolations()` adds a finding per unread mention its predicates reach, through
  `inScope` and `unreadFindings`, the `taskItems()` path.
- Predicates: `areLinked()` (a `link` is present), `areInCode()`, and the free predicate
  `areSelfMentions({ mention, document })`: true when both functions return a key and they are
  equal. `resideInFile()` and `satisfy()` are inherited.
- Condition: `beLinked()`, one finding per mention without a `link`, at its own line. Two
  messages: `bug 0338 is not a link` and `bug 0338 is in inline code, not a link`; the
  `suggestion` says to link it to the record it names, or, for a quoted example, to move it into a
  fenced block. A mention with `link` set in inline code (``[`bug 0338`](…)``) is linked.
- Exports from `packages/md/src/index.ts`: `mentions`, `MentionRuleBuilder`, `MdMention`,
  `MentionUnread`, `areSelfMentions`. `check:family` holds the re-exports.

**Files:** `packages/md/src/builders/mentions.ts` (new), `packages/md/src/predicates/mentions.ts`
(new), `packages/md/src/conditions/be-linked.ts` (new), `packages/md/src/index.ts`.

### Phase 3 — docs and a worked example

- `docs/markdown.md`: a "Mentions" section. The common case in one rule; the pattern and the
  self-mention keys as the caller's; inline code and how to quote an example (a fenced block, or
  the reason-required waiver); `\s+` for soft breaks. **What this cannot see**, as `pointers()`
  writes its limits: a mention its pattern misses (`bug number 338`, a bare `0338`, a year that
  looks like a number), the target (a link to the wrong file is green until ask B), and that the
  waiver's suppressions are disclosed only under eess-ts's runner
  ([bug 0537](../bugs/0537-eess-md-alone-has-no-run-level-services.md)).
- `packages/md/README.md`: `mentions()` in the element list, separated in one line from
  `links().beLinkedBack()`.
- `examples/md/a-mention-of-a-record-is-a-link.test.ts`: passing and failing fixtures, public
  blocks only; registered in `check:nonvacuity` automatically (`scripts/check-nonvacuity.mjs:1050`).

**Files:** `docs/markdown.md`, `packages/md/README.md`, `examples/md/a-mention-of-a-record-is-a-link.test.ts`
(new) with its fixtures.

### Phase 4 — dogfood: this repository's gate, with a count ratchet

`scripts/check-corpus.mjs` gains `corpus/record-mention-is-a-link` over `work/`, `adr/` and `docs/`,
with this repository's pattern and self-mention keys:

```js
const RECORD_MENTION =
  /\b(?<kind>bug|plan|spike)s?\s+(?<n>\d{4})\b|\b(?<kind>proposal)s?\s+(?<n>\d{3})\b|\b(?<kind>ADR)-(?<n>\d{3})\b/gi
```

Measured with it on 2026-10-21: 4,657 unlinked mentions in 434 files (240 live, 194 frozen); 96 live
files hold none.

The repository cannot turn the rule on red, and the kernel baseline is not a safe ratchet for it: a
baseline entry's identity has no file and a set holds one copy of each hash, so one baselined
`bug 0338` forgives it in every file, any number of times ([bug 0388](../bugs/0388-a-baseline-entry-forgives-the-same-finding-in-any-file.md),
plans [0532](./0532-a-baseline-entry-matches-only-the-file-it-was-written-for.md) and
[0533](./0533-a-match-is-identified-by-its-shape-and-old-baselines-migrate.md)); and a metric
ceiling never tightens ([bug 0538](../bugs/0538-a-metric-baseline-never-tightens.md)). So the gate
keeps a per-file ceiling of its own, `scripts/record-mention-ceilings.json` (`{ "path": count }`),
judged both ways:

- a file with more unlinked mentions than its ceiling is red, listing them (a file absent from the
  ledger has a ceiling of 0, so every new record is gated in full from its first commit);
- a file with fewer is red, "lower its ceiling", so a paid-down file cannot grow back;
- a ledger entry for a file that no longer exists is red, as a stale entry;
- `node scripts/check-corpus.mjs --update-record-mention-ceilings` rewrites the ledger, and the diff
  is the review.

The ledger is migration scaffolding: it is deleted, and the rule judged with no ceilings, when it
reaches zero, which is the migration plan's to do after proposal 019's B and fix.

The gate's summary line names the counts: mentions examined, unlinked, files at a ceiling, and the
ledger total, so a green run says how much is still owed.

Sabotage rows in `scripts/check-nonvacuity.mjs`, in the production-script shape
(`scripts/check-nonvacuity.mjs:136-143`): an ephemeral probe record holding one plain mention of an
existing record is red under `corpus/record-mention-is-a-link`; with the mention linked it is
green; a probe ceiling above its file's count is red as "lower its ceiling".

**Files:** `scripts/check-corpus.mjs`, `scripts/record-mention-ceilings.json` (new),
`scripts/check-nonvacuity.mjs`.

### Phase 5 — the vacuity matrix

A `mentions()` row in `scripts/vacuity-matrix.mjs` beside eess-md's (`scripts/vacuity-matrix.mjs:375-387`):
over zero files, a `beLinked()` rule is the vacuity finding, never green.

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
| `scripts/check-corpus.mjs`                                  | 4     |
| `scripts/record-mention-ceilings.json` (new)                | 4     |
| `scripts/check-nonvacuity.mjs`                              | 4     |
| `scripts/vacuity-matrix.mjs`                                | 5     |
| `.changeset/*.md` (eess-md minor)                           | —     |

## Test inventory

Each drives the public entry point, `mentions(corpus, { pattern })`, over `corpusFromText` or a disk
fixture.

| test                                                                                                                                             | phase |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| a plain mention is red at its own line; a linked one beside it is green                                                                          | 2     |
| a mention in inline code is red with the inline-code message                                                                                     | 2     |
| ``[`bug 0338`](…)`` is linked                                                                                                                    | 1, 2  |
| `**bug** 0338` is found and red                                                                                                                  | 1, 2  |
| `bug⏎0338` is found by `\s+` and missed by `[ -]`, each by the caller's pattern                                                                  | 1     |
| a mention's line is its own, on the third line of a paragraph                                                                                    | 1     |
| fenced, indented, front-matter and HTML-comment mentions are not elements                                                                        | 1     |
| an HTML block, a reference-style link, image alt and a link title are red as unread, each with its cause, only where the rule's predicates reach | 2     |
| `position` is `whole`, `opens`, `later` and `straddles` for the four spike shapes                                                                | 1     |
| `areSelfMentions` drops a record's own title, keeps another record's mention in it, and composes through `not()`                                 | 2     |
| a pattern matching the empty string is an `ArchConfigError` at build                                                                             | 2     |
| a caller's `g` pattern used twice gives the same elements (no carried `lastIndex`)                                                               | 1     |
| a rule selecting no mention is the vacuity finding                                                                                               | 2     |
| `groups` carries named captures and omits a group that did not take part                                                                         | 1     |
| the gate: a probe with a plain mention is red; linked, green; a slack ceiling, red                                                               | 4     |

## Release

| package               | bump  | why                                                      |
| --------------------- | ----- | -------------------------------------------------------- |
| `@nielspeter/eess-md` | minor | new public API: `mentions()` and its types and predicate |
| every other package   | none  | nothing a consumer can observe                           |

## Out of scope

- **The target** (proposal 019 ask B), **the fix** and **the relation message** (ask C): held by
  proposal 019's review.
- **Migrating this repository's 4,657 mentions.** The ceilings hold them; the migration follows B
  and the fix, and needs a reader for the mentions that collide with ts-archunit's record numbers
  (spike 0536 section 3).
- **`.claude/skills/` and `kit/`**: not corpus roots ([bug 0535](../bugs/0535-the-corpus-gate-does-not-read-skill-or-kit-files.md)).
- **eess-md's own door to fixes, baselines and waiver disclosure**: [bug 0537](../bugs/0537-eess-md-alone-has-no-run-level-services.md).

## Progress ledger

- [ ] Phase 1 — model: phrasing runs and mentions
- [ ] Phase 2 — builder, predicates, `beLinked()`, exports
- [ ] Phase 3 — docs and the worked example
- [ ] Phase 4 — this repository's gate with the count ratchet, and its sabotage rows
- [ ] Phase 5 — the vacuity-matrix row
- [x] Proposal 019's disposition row for A set to `Accepted, reshaped`, owner this plan (2026-10-21)
- [ ] `npm run validate` green, with its time reported
