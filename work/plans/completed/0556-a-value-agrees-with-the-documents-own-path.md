# Plan 0556: a value agrees with the document's own path

## Status

- **State:** Done — built 2026-10-29 (PR #279) → completed/; frozen the same day after review and
  re-check (architect · enforcement · product), with no open question. Written the same day from [proposal 017](../../proposals/017-md-blocks-to-check-a-documents-shape.md)'s block 16, at the maintainer's
  order to build it before the next release ("build block 16 first", 2026-10-29). Reviewed the same
  day and revised: "Review — 2026-10-29" lists what changed.
- **Implements:** [proposal 017](../../proposals/017-md-blocks-to-check-a-documents-shape.md)
- **Priority:** High — the next release waits on it. Block 16 was held "for the next release", adopter
  1 its only asker ([proposal 017](../../proposals/017-md-blocks-to-check-a-documents-shape.md), "Consumer feedback" and "The maintainer's acceptance —
  2026-10-19").
- **Effort:** Medium. One condition on `docs()`, on the model [plan 0495](./0495-a-value-agrees-with-its-folder.md) built for block 5 and as its
  batch review rebuilt it: its findings, an example, and this repository's numbered records as its
  first user.
- **Created:** 2026-10-29
- **Builds after:** [plan 0495](./0495-a-value-agrees-with-its-folder.md) (block 5, whose shape and evidence rule this follows), built.
- **Decided by:** [ADR-022](../../../adr/022-eess-mds-root-fixes-no-documents-shape.md) (no default shape: the patterns are the caller's),
  [ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) (a document whose value cannot be read is reported, never dropped),
  [ADR-010](../../../adr/010-a-pass-is-constructed-from-evidence.md) (the denominator is what the verdict rests on).

## Problem

A record says its number twice, in its filename and in its title (a plan's file named for its
number, and an H1 that names the plan by the same number), and the two drift: a file renamed and its
title not, a title copied from a sibling and its number not changed. [Proposal 017](../../proposals/017-md-blocks-to-check-a-documents-shape.md) names it block
16, "a value agrees with the document's own path (a number in the filename and in the H1)", and
adopter 1 asked for it. Nothing in the family relates a document's path to its content:

- `haveTitle(pattern)` (`packages/md/src/conditions/structure.ts:89`) judges a title's shape, not
  what it says against the path.
- `agreeWithFolder` (`packages/md/src/conditions/agree-with-folder.ts:212`) relates a value to the
  folder groups it belongs in: which glob holds the file, not a value read out of the path.
- `beUniqueBy` (block 13) keeps a value to one document, not to its own file.
- `areSelfMentions` (`packages/md/src/predicates/mentions.ts:20`) takes a document's own key from the
  caller, to leave a record's mention of itself out of the mention rule; it judges nothing, so a
  title whose number is not the file's is simply another mention.
- `satisfy()` with a hand-written condition can compare the two, as `honestyAtClose` once compared
  `State:` by hand. That is what adopters write today, and it has the gaps block 5 had: a title that
  cannot be read is skipped or reported as a mismatch, the message cannot say which side read what,
  and a rule that read nothing passes.

## Measured

Run from the repository root at fda86985, over `git ls-files work adr`: every numbered record file
(a file whose name starts with a number) and every file in a numbered folder, its number read from
the name, its H1 read outside fences. Re-derived by the enforcement review at 3f50c272 (530 then, this
plan being a record).

| records | agree | disagree | no H1 | H1 holds no such number |
| ------- | ----- | -------- | ----- | ----------------------- |
| 529     | 526   | 0        | 0     | 3                       |

The title forms, per lane: ADRs `ADR-NNN:` (24); bugs `Bug NNNN:` (371) and one
[bug 0144](../../bugs/fixed/0144-md-gherkin-nul-bytes-break-grep.md)'s, its number followed by a parenthesis; plans `Plan NNNN:` (86) and the three closed plans titled
`0061 — …`, `0062 — …` and `0066 — …`; spikes `Spike NNNN:` (25) and [spike 0001](../../spikes/0001-eess-over-ts-archunit/README.md)'s
`CONCLUSION.md`, titled `Spike NNNN — conclusion`; proposals `Proposal NNN —` (21). So one anchored pattern
per lane reads every title once the three plans name themselves as their lane does, and exact strings
agree on every record: no `normalize` is needed, and `corpus/record-number-unique` keeps `066` and
`0066` apart on purpose.

## Design

**A condition on `docs()`,** beside `agreeWithFolder`:

```typescript
import { corpus, docs } from '@nielspeter/eess-md'

const c = corpus({ roots: ['notes/**'] })

docs(c)
  .that()
  .resideInFolder('notes/**')
  .and()
  .haveNameMatching(/^\d{4}-/)
  .should()
  .agreeWithPath({
    path: /(?:^|\/)(?<value>\d{4})-[^/]*\.md$/, // the note's number, from its file name
    title: /^Note (?<value>\d{4}):/, // the same number, from its title
  })
  .rule({ id: 'notes/number-in-title' })
```

```typescript
export interface AgreeWithPathOptions {
  /** Matched against the document's path relative to the corpus's `cwd`; its `value` group is the path's value. */
  readonly path: RegExp
  /** Matched against the title as `haveTitle()` reads it; its `value` group is the title's value. */
  readonly title: RegExp
  /** Applied to both values before they are compared. Default: none (exact strings). */
  readonly normalize?: (value: string) => string
}
```

**The value is the named group `value`.** md's other caller pattern, `mentions()`, gives its named
groups the meaning (`packages/md/src/model/mentions.ts:14`), so this does too. A pattern with more
than one form is an alternation, and Node 24 allows the same group name in each branch, so
`/^(?:Plan (?<value>\d{4}):|(?<value>\d{4}) —)/` reads either form; a first-capture-group rule would
read `undefined` from the second branch (measured, Node 24.22.0, by the architect review). A pattern
with no `value` group is refused when `agreeWithPath` is called, naming the option, so the rule fails
at its declaration; `agreeWithFolder` refuses when it runs, and the two differ on purpose, since
counting a pattern's groups needs no corpus. Each pattern is read through `stateless()`
(`packages/md/src/model/name-match.ts:11`), [bug 0506](../../bugs/fixed/0506-a-section-matcher-with-a-g-flag-skips-every-other-document.md)'s owner, so a caller's `g` or `y` flag
shares no `lastIndex`. The match is the leftmost; an unanchored title pattern over a title naming
another record first reads that one, so the docs and every example anchor theirs.

**A value that is not there is never a value.** A pattern that does not match, a `value` group that
did not take part in the match, an empty capture, and a value that `normalize` turns empty are each
"holds no value" on its side, never a value: two empty sides do not agree. `normalize` that throws
propagates, as `agreeWithFolder`'s does. The docs' `Number` example says what it gives up (a value
that is not a number becomes `NaN`, so the example also refuses a non-digit capture by its pattern).

**Findings,** each attributed to the document and its line (the title's; line 1 for the path, and
for a document with no heading):

| id  | when                                     | message (shape)                                                                                                                                                                                                                                                                                             | suppressible |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| P1  | the path holds no value                  | `<path>` holds no value the path pattern reads (`<pattern>`): name the file as the pattern expects, or widen the pattern                                                                                                                                                                                    | yes          |
| P2  | there is no title                        | `titleFault(d)`'s own message, verbatim and called without a name (`packages/md/src/model/sections.ts:231`): "no heading" or "first heading at depth N", each with its note when the heading sits inside a container                                                                                        | yes          |
| P3  | the title holds no value                 | its title `"<title>"` holds no value the title pattern reads (`<pattern>`)                                                                                                                                                                                                                                  | yes          |
| P4  | both read, and they differ               | the path says `0542` and the title says `0543` (raw values; "after normalize" when given): correct the one that is wrong, by renaming the file or editing the title                                                                                                                                         | yes          |
| P5  | a non-empty selection judged no document | one finding for the agreement, at the first selected document, naming each cause with its pattern and counts: a side that read nothing (`the title pattern read none of 529 titles`), or both sides reading but never on the same document (`the path pattern read 3, the title pattern read 2, none both`) | no           |

A document whose path and title both fail reports both, one pass for its author. **One mistake, one
finding:** a side that reads nothing means no document was judged, so P5 fires and names that side,
and that side's P1 or P3 per document is withheld (block 5's F7 reasoning: a pattern that reads
nothing is one mistake, not a finding per record). P2 is never folded in: a document with no title is
the document's fault, not the pattern's, so the title side's count is the documents that have one.
**`examined` is the kernel's,** the documents selected, as [plan 0495](./0495-a-value-agrees-with-its-folder.md)'s batch review rebuilt it
("Decision D1, rebuilt", and `packages/md/src/builders/docs.ts:150`): a count of documents judged hid
three greens there (`.expectEmpty()` over a broken pattern, a broken agreement beside another
condition, and beside a second agreement). "Judged" feeds only P5, which carries `bypassFilters`, so
neither `.excluding()` nor another condition's count can hide it, and it is computed per agreement,
never over the union of a builder's agreements. The path side is a `RegExp`, not a key function as
`beUniqueBy` and `SelfMentionKeys.document` take, so that P1 and P5 can name the pattern. The
condition is not dual-use; a selector form ("documents whose path agrees") can be added later the way
`haveField` dispatches between predicate and condition, with no prefixed twin ([ADR-023](../../../adr/023-a-predicate-and-a-condition-that-share-a-word.md)). It is
Tier 1.

**One agreement hook.** `DocsRuleBuilder` holds its agreements as `FolderAgreement[]`
(`packages/md/src/builders/docs.ts:37`) and calls `start`, `declarationFindings` and `judgedNone`
on each. A small internal `Agreement` interface (`condition`, `start()`, `findings(context)`) is
named, `FolderAgreement` implements it and `PathAgreement` beside it, `declarationViolation` moves
beside the interface, and the builder keeps one list. Forks share an agreement instance, since
`copy()` is shallow (`packages/core/src/rule-builder.ts:302`): this is safe because `start()` resets
the instance's run state and a run is synchronous, and a test row holds it.

**Not a kernel block.** The value is md's reading of a title. eess-ts names files by its own
conditions, and a join to another document's path is `correspondence()`'s.

## Phases

1. **The hook and the condition.** The `Agreement` interface over `FolderAgreement`; `agreeWithPath`
   on `docs()`, the pattern refusals, the value rules, P1 to P5, the kernel's `examined`.
2. **Dogfood.** `corpus/record-number-in-title` in `scripts/check-corpus.mjs`, one rule per lane
   (`adr/`, `work/bugs/`, `work/plans/`, `work/spikes/`, `work/proposals/`), each with its own anchored
   title pattern (the lane's word and the number, a word boundary after it) and no `normalize`,
   selected by lane folder with the three boards (`work/plans/ROADMAP.md`, `work/bugs/BUGS.md`,
   `work/proposals/PROPOSALS.md`) left out by exact path, so that a misnamed record is P1, not dropped.
   The path pattern reads a numbered folder's files by the folder's number ([spike 0001](../../spikes/0001-eess-over-ts-archunit/README.md)'s
   `README.md` and `CONCLUSION.md`). The three closed plans titled `NNNN — …` are retitled as their
   lane titles them. Two forms stay, each one record, and the lane's pattern reads them: [bug 0144](../../bugs/fixed/0144-md-gherkin-nul-bytes-break-grep.md)'s
   number followed by a parenthesis, which the word boundary reads; and [spike 0001](../../spikes/0001-eess-over-ts-archunit/README.md)'s
   `CONCLUSION.md`, whose `—` the spikes pattern reads beside `:` (`^Spike (?<value>\d{4})(?::| —)`),
   since that file is pinned as left out of the mention rule and is not edited. The summary line
   prints each lane's selected and judged counts, so a lane rule removed from the script is seen. Its
   `check:nonvacuity` rows: a probe whose title names another number (P4), and a probe whose file name
   holds no number (P1), each by id, file and message. The rule's added `check:corpus` time is measured
   at build and recorded in the Progress ledger, since every nonvacuity row re-runs the gate.
3. **Example, docs, release.** An example under `examples/md/` with a clean and a violating fixture
   per judgement it states ([plan 0458](./0458-the-examples-gate-a-document-shape-from-public-blocks-only.md)'s gate), an alternation pattern among them; the eess-md README
   (one line on folder against path); `docs/markdown.md`; `examples/public-surface.test.ts`; [proposal
   017](../../proposals/017-md-blocks-to-check-a-documents-shape.md)'s disposition row for block 16; a changeset.

## Files changed

- `packages/md/src/conditions/agreement.ts` (new: the `Agreement` interface and `declarationViolation`)
- `packages/md/src/conditions/agree-with-folder.ts` (implements it)
- `packages/md/src/conditions/agree-with-path.ts` (new)
- `packages/md/src/builders/docs.ts`
- `packages/md/src/index.ts` (`AgreeWithPathOptions`)
- `packages/md/tests/conditions/agree-with-path.test.ts` (new)
- `examples/md/a-record-number-agrees-with-its-file.test.ts` (new) and its fixtures
- `examples/public-surface.test.ts`
- `scripts/check-corpus.mjs`, `scripts/check-nonvacuity.mjs`
- the three closed plans' titles
- `packages/md/README.md`, `docs/markdown.md`
- `work/proposals/017-md-blocks-to-check-a-documents-shape.md` (block 16's row)
- `.changeset/md-agree-with-path.md`

## Test inventory

| finding        | rows                                                                                                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P4 differ      | a title naming another number: red, both raw values in the message; with `normalize` making `0542` and `542` one: green, and the message says "after normalize" when they still differ                                                                              |
| P1 path        | a selected document whose name holds no number: red, naming the path and the pattern                                                                                                                                                                                |
| P2 title       | no heading; a first heading at depth 2; an H1 inside a blockquote: `titleFault`'s two messages and its container note, verbatim                                                                                                                                     |
| P3 title value | a title the pattern does not read: red, quoting the title and the pattern                                                                                                                                                                                           |
| both           | a document failing on both sides: P1 and P3, both reported                                                                                                                                                                                                          |
| empty          | `(?<value>\d*)` matching empty on both sides: P1 and P3, never agreement; a `normalize` returning `''`: withheld as no value                                                                                                                                        |
| alternation    | a title pattern with `value` in its second branch, over each form: agrees; the same on the path side for a numbered folder's file                                                                                                                                   |
| leftmost       | an unanchored title pattern over a title naming another record first: P4, and the anchored pattern: green                                                                                                                                                           |
| one finding    | a title pattern that reads no selected title: exactly one unsuppressable finding, P5 naming the pattern and the count, and no P3; the same for the path                                                                                                             |
| P5 mixed       | half the selection reads only its path, half only its title, under `.excluding(/.*/)`: P5 is the only finding, naming both counts; `bypassFilters` is set                                                                                                           |
| P2 not folded  | a selection where no document has a title: a P2 per document, and P5 names no title-pattern cause                                                                                                                                                                   |
| evidence       | on the mixed selection: beside `beUniqueBy`, red and `examined` is the selection; with `.expectEmpty()`, the kernel's own "declared .expectEmpty() but examined N" finding; beside a second agreement that judges its documents, this agreement's P5 still reported |
| forks          | two forks of one chain run alternately, one judging nothing: that one's P5 and the other's verdicts; a fork that selects nothing: the kernel's zero-examined finding, not P5                                                                                        |
| configuration  | no `value` group, in each option: throws at the call, naming it; a `g`/`y` flag: two runs agree                                                                                                                                                                     |
| frozen         | a frozen document is judged                                                                                                                                                                                                                                         |

**Sabotage matrix,** each row red on the test its break class names, run in a worktree and recorded
in the Progress ledger: (1) P4 dropped; (2) `normalize` applied to one side only; (3) a withheld
document counted as agreeing; (4) P1 dropped; (5) P2 reported as P3, `titleFault` called with the
title pattern; (6) P3 dropped; (7) an empty capture read as a value (red on the both-empty row); (8)
a side's per-document findings kept beside P5 (red on the one-finding row); (9) P5 dropped (red on the
mixed row); (10) P5 made suppressible, `bypassFilters` dropped (red on the mixed row); (11) `examined`
overridden to the documents judged (red on the `.expectEmpty()` evidence row, by the kernel's finding);
(12) P5 computed over the union of a builder's agreements (red on the second-agreement row); (13) P5
raised only when every condition is an agreement (red on the `beUniqueBy` row); (14) the `value`-group
refusal removed; (15) frozen documents skipped; (16) the caller's `g` flag kept; (17) the first capture
group read in place of `value` (red on the alternation row).

**`check:nonvacuity`:** the two Phase 2 rows; the rule-id audit reads the new id from
`scripts/check-corpus.mjs`.

## Release

`@nielspeter/eess-md` minor, additive: one method and one type. The internal `Agreement` interface
changes no public type.

## Out of scope

- **A labelled field as the document's side** (`**Number:** 0542`, a slug field): no adopter asked,
  and the obvious general case, frontmatter, the field resolver does not read. The options take a
  `field` source later without a break.
- **A value agreeing with another document's path** (a link's target, a board row's file): a join,
  `correspondence()`'s, as [plan 0549](./0549-a-link-names-the-record-it-mentions.md)'s target check is.
- **The slug half of a filename** agreeing with the title's words: no adopter asked; the patterns can
  read it once one does.
- **A selector form:** not asked for; see Design.
- **The agreement evidence rule in an ADR.** That an agreement's `examined` is the selection and
  "judged none" its own unsuppressable finding now has two users and lives only in [plan 0495](./0495-a-value-agrees-with-its-folder.md)'s
  build notes, where this plan's first draft missed it. Recorded as [plan 0557](../0557-the-agreement-evidence-rule-joins-adr-010.md).
- **A kernel channel for "judged".** Three conditions hand-roll a zero-judged finding (two in md, one
  in eess-ts); recorded in [plan 0557](../0557-the-agreement-evidence-rule-joins-adr-010.md) beside the rule it would carry.

## Review — 2026-10-29

Architect, enforcement and product, on the first draft at 3f50c272. What changed:

- **`examined` (critical, architect and enforcement).** The first draft counted documents judged,
  which is [plan 0495](./0495-a-value-agrees-with-its-folder.md)'s first D1, deleted after its review measured three fake greens. Now the
  kernel's count stands and "judged" feeds only P6; the evidence rows are 0495's.
- **The value (architect, enforcement).** "The first capture group" read `undefined` from an
  alternation's second branch, and an empty capture on both sides agreed. Now the named group
  `value`, as `mentions()` reads its groups, and a value that is not there is never a value.
- **Scope (product, architect).** The field source had no asker and could not read frontmatter;
  dropped, and the options flattened to `{ path, title, normalize? }`.
- **Reuse (architect).** P2 is `titleFault`'s messages; `stateless()` copies the patterns; one
  `Agreement` interface instead of a second hook.
- **The dogfood (enforcement).** Selected by lane folder less its indexes, so P1 is live; exact strings
  with no `normalize`; the three `NNNN — …` plans retitled rather than every lane's pattern widened.
- **The one-versus-N shape (architect, enforcement).** P5 in place of a finding per document when a
  pattern reads nothing; P6 per cause; suppressibility stated per finding.
- **Recorded, not built here:** the evidence rule's home and a kernel "judged" channel, as
  [plan 0557](../0557-the-agreement-evidence-rule-joins-adr-010.md).

**Re-check, the same day** (architect and enforcement, on b9e62e40; the ids above are the first
revision's): no blocking finding. P5 (a side
read nothing) always came with P6 (judged none), two unsuppressable findings for one mistake, and made
the evidence rows red by itself: folded into one P5 that names each cause, with a mixed-selection row
only it can turn red, the evidence rows built on that selection, and block 5's two missing sabotage
rows. Also: P2's messages as `titleFault` gives them; the fork row; the dogfood's boards left out by
exact path, its two one-record forms stated, per-lane counts printed, its added time measured.

## Build notes

Built 2026-10-29 on `feat/0556-agree-with-path`, as frozen, except where noted:

- **The summary counts the selection per lane, not the judged documents.** Phase 2 said the summary
  line prints each lane's "selected and judged counts"; the judged count is the agreement's own and
  not exposed to the script. The line prints each lane's selected count (`23 adr · 372 bugs · 90 plans
· 26 spikes · 21 proposals`), which is what shows a lane rule removed; a lane that judges none is its
  own finding (P5) whatever the count.
- **The dogfood:** 532 records over the five lanes, green. `check:corpus` takes 7.4 s, against 7.3 s
  before the rule (two runs each), so about 0.1 to 0.2 s per run, paid again by each `check:nonvacuity`
  row that runs the gate. The three plans titled `NNNN — …` now title themselves `Plan NNNN: …`.
- **The sabotage matrix,** run in place on the source with each file restored from a copy and compared
  after (no stash): all red, each on the test its break class names. (1) P4 dropped: the P4 rows. (2)
  `normalize` on one side: the normalize rows. (3) a withheld document counted as agreeing: the P5
  rows. (4) P1 dropped and (6) P3 dropped: their rows and the both-sides row. (5) P3 as `titleFault`
  with the title pattern: the P3 row. (7) an empty capture read as a value: survived at first, since
  the row reached the empty capture without `normalize` and the second guard (a normalized value that
  is empty) caught it; with `String(Number(v))` an empty capture becomes `0` and would agree with a
  title's `0`, so a row with that `normalize` was added, and (7) and (7b, the second guard removed)
  each red one row. (8) a side's per-document findings kept beside P5: the one-finding rows. (9) P5
  dropped and (10) P5 suppressible: the P5 and mixed rows (and block 5's own rows for (10)). (11)
  `examined` overridden: the evidence rows. (12) P5 from a builder's first agreement only, and (13) P5
  only when every condition is an agreement: the second-agreement and `beUniqueBy` rows, in both
  conditions' tests. (14) the `value` refusal removed, (15) frozen documents skipped, (16) the caller's
  `g` flag kept, (17) the first capture group read: one row each.
- **Split for this repository's architecture rules.** The first commit's `evaluate` broke three of
  `check:arch`'s rules (no JSDoc on `start`, cyclomatic complexity 17, 80 code lines), found by the
  full validate after the commit; it now reads each document in `readDocument`, with one function per
  finding, and the matrix above was run again on the split code: all 18 red, each on the same rows.
- **The build review (enforcement and testing, on ef834bc4), and what changed.** Blocking, from
  enforcement: the dogfood turned eight record-mention `check:nonvacuity` rows red, their probe
  records titled `# Probe` under `work/bugs/`; the full validate confirmed exactly those eight. Every
  probe is now titled by its file's number (`titledProbe`). Should-fix: four of the five lanes could be
  dropped from the hand-written list with every gate green, so a numbered record that no title lane
  selects is now `corpus/record-number-in-title-lanes`, with its own `check:nonvacuity` row; dropping
  the ADR lane from a copy of the script reds all 23 ADRs. The docs' `String(Number(v))` example lacked
  the caveat the plan promised, and it collapses every non-number into `NaN`: the docs and the example
  now strip leading zeros and say why, and P4 names the compared values when `normalize` changed them.
  From testing: the reset of `start()` had no row (now one, red with the reset made a no-op and with
  the builder's loop removed); the normalize row proved one side only (now padded differently on each,
  red under either one-sided mutant); and several assertions were tightened (the exact P5 per copy, the
  kernel's zero-examined finding, the frozen row's text, P5's line and element, a title below line 1, a
  real `y`-flag run, an empty title capture). Block 5's reset has the same gap, recorded in
  [plan 0557](../0557-the-agreement-evidence-rule-joins-adr-010.md). Not changed, measured and fail-closed: a numbered file inside a numbered
  folder is read by the folder's number (none exists; the comment says so).
- **How the matrix ran.** In place on the source, each file restored from a copy and compared after,
  not in a worktree as the plan said: the mutations touch only `packages/md/src`, which nothing else
  was reading. Mutant (12) as run is "P5 from a builder's first agreement only"; the plan's "computed
  over the union" is red on the same second-agreement row by construction (its first agreement judges
  one).
- **Rows:** 25 in `packages/md/tests/conditions/agree-with-path.test.ts`, block 5's 34 still green
  after its move onto the `Agreement` interface; the example's four; the three `check:nonvacuity`
  rows, each red by id, file and message.

## Progress ledger

- [x] Reviewed (architect · enforcement · product), 2026-10-29
- [x] Ready (2026-10-29)
- [x] Phase 1 — the hook and the condition
- [x] Phase 2 — dogfood (532 records, about 0.1 to 0.2 s per `check:corpus` run)
- [x] Phase 3 — example, docs, release
- [x] Sabotage matrix, all red (Build notes)

Deferred: none. The agreement evidence rule's home and a kernel "judged" channel are [plan 0557](../0557-the-agreement-evidence-rule-joins-adr-010.md)'s, recorded at review; the labelled-field source is held in Out of scope, no adopter having asked.
