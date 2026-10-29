# Plan 0550: a plain mention is fixed to the one record it names

## Status

- **State:** Done — built 2026-10-26 (PR #265) → completed/; frozen 2026-10-26 on Phase 0's measurements, Decision 2's one amendment and
  the maintainer's acceptance of the residual, with no open question. Written 2026-10-25 for [proposal 019](../../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s
  held fix, split from [plan 0549](./0549-a-link-names-the-record-it-mentions.md) after that plan's
  second review round, shaped by adopter feedback the same day (019's addendum of 2026-10-25), and
  revised after a capped third round ("Review — 2026-10-25"). Phase 0 measured 2026-10-26: 150 of
  150 right, and seven wrong fixes outside the sample, all in one record landed verbatim with another
  numbering, a cause the fix cannot read; the maintainer accepted the residual the same day.
- **Implements:** [proposal 019](../../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)
- **Priority:** Medium — each corpus measured holds 3,000 to 4,700 plain mentions, which no one links
  by hand; [plan 0542](./0542-this-repositorys-record-mentions-are-migrated.md) waits on it here.
- **Effort:** Medium, one PR in eess-md: a `span` on a mention, a fix option on `beLinked()` with its
  refusals, a shared path helper, a worked example, docs, one sabotage row. No kernel change.
- **Created:** 2026-10-25
- **Builds after:** [plan 0549](./0549-a-link-names-the-record-it-mentions.md).
- **Builds before:** [plan 0542](./0542-this-repositorys-record-mentions-are-migrated.md).

## Problem

`beLinked()` reports a plain mention and repairs nothing. eess already repairs what it can prove:
`movedLinkFix` rewrites a broken link to the one file with its name
(`packages/md/src/model/resolve-link.ts:257-280`, [plan 0066](./0066-eess-deterministic-autofix.md)),
and `pointer-resolve` declines because its repair is a choice (`packages/md/src/conditions/pointer-resolve.ts:63`).
A plain mention sits between: the fix is unambiguous only relative to the records the caller
declares, and a source left undeclared makes it confidently wrong. That is why the fix was held.

## Decisions

### 1. The fix sits on `beLinked()`, over the caller's declared records

```ts
mentions(c, { pattern })
  .that()
  .satisfy(not(areSelfMentions({ mention: keyOf, document: keyOfPath })))
  .should()
  .beLinked({
    fix: {
      records, // every source's records, one Selection
      key: { mention: keyOf, record: (r) => r.key }, // digits as written
      target: (r) => r.target, // a repository path or an absolute URL
      foreign: /\b(upstream|eess-ts|their)\b/i, // required: how this project names another one
    },
  })
```

The fix sits on the finding it repairs, as `movedLinkFix` sits on `resolve()`'s, and matches through
the kernel's `matchSelections` (`packages/core/src/internal.ts:73`). Not a kernel hook: a plain mention
is not on [plan 0549](./0549-a-link-names-the-record-it-mentions.md)'s join's left side, and putting
it there would report it twice. Not a factory shared with the join: [plan 0549](./0549-a-link-names-the-record-it-mentions.md)'s
second review round found it read a title the caller did not name, made correct own-URL links red,
and still let two calls diverge.

`foreign` is required: a project that names no other project's records says so with a pattern that
matches nothing, such as `/(?!)/`, so leaving the refusal out is never silent. Required in the type
is not enough, since Node imports a rule file without checking its types
([ADR-015](../../../adr/015-the-kernel-extends-resolution-never-execution.md)): a `fix` whose `foreign`
is missing or not a `RegExp`, or one that matches the empty string (it would refuse every fix),
throws an `ArchConfigError` when `beLinked()` is called. The empty-match half is the door
`validateMentionPattern` uses for `pattern` (`packages/md/src/model/mentions.ts:57-64`), with its own
check and message, since that function's message speaks of mentions. The missing and non-`RegExp`
halves are stricter than `pattern`, which throws a `TypeError` there
([bug 0551](../../bugs/0551-an-untyped-mention-pattern-throws-a-typeerror.md)). `foreign` is read
through a private copy with the caller's `g` and `y` dropped, as `validateMentionPattern` makes one
(`packages/md/src/model/mentions.ts:58`), so no `lastIndex` is shared.

### 2. What is fixed, and what is refused

A finding carries an `ArchFix` only when exactly one record holds the mention's key. It is refused,
and the finding says why, when:

- two or more records hold the key (it names each candidate's target), or none does: a record moved
  under the same number reads as none, and a `key.mention` that returns `undefined` names no record
  by the caller's own key. Each is reported, never guessed;
- `foreign` matches in the text around the mention: its own paragraph; in a table, its own row and
  the header row; in a list, its own item and the paragraphs of each item it is nested under, at
  any depth; a whole blockquote; the paragraph directly before a top-level list or table, for a
  mention at any depth in it; and the heading of
  each section that contains it, the title included (`sectionPathAt`,
  `packages/md/src/model/sections.ts:99`). A project's name is often only in a heading or a list's
  lead-in, so the mention's own sentence misses it. This fails safe: a match too wide costs a reader
  one link by hand. (Amended at Phase 0, in answer to measurement 2's width test, not under the
  stop rules: the whole table and the whole list, read first, refused 376 here, 17 of 20 sampled
  naming no other project, 15 of those because one row naming ts-archunit refused every row of a
  board. The narrowing has a cost: four of the seven wrong fixes Phase 0 found were refused by the
  whole-table reading and are fixed by this one; see Phase 0.)
- the mention is in inline code (a quoted example moves to a fence), follows `!` (the fix would write
  an image), its `span` is not exact, or it sits in a table cell and its target holds a `|`.

Self-mentions and frozen folders are the caller's selection (`areSelfMentions`, `resideInFile()`),
which the fix runs over; the example shows both. The key keeps the digits as written: keyed by value,
a four-digit mention of an upstream record joins a three-digit local one, and nothing afterwards can
see it. The example's key does not normalise, and a test row holds it.

Two configuration findings, each one per run and `bypassFilters`, so `.warn()` and exclusions cannot
hide them: `records` is empty, whatever the mentions; or the fix's keys meet no record over every
selected mention, linked ones included, so a corpus with nothing plain left is not one. Each names the
selection and a sample key from each side, instead of one "no record" per mention. Over zero selected
mentions the kernel's empty-selection finding speaks, not these. The `--fix` door passes
configuration findings through (`packages/ts/src/cli/commands/check.ts:412-419`); both mean zero
fixes, so nothing is applied on them.

The replacement is `[<text>](../<target>)`. A path target is made relative to the mention's document by
a helper extracted from `movedLinkFix` into `packages/md/src/model/resolve-link.ts`, so the arch rule
`eess/md-one-link-resolver` (`arch.rules.ts:291-304`) keeps its meaning; a URL target, detected with
`EXTERNAL_RE` ([plan 0549](./0549-a-link-names-the-record-it-mentions.md) exports it), is written
verbatim; a path with a space or `)` is written in `<…>`. The fix's `describe` is fixed, with the
target last, so a dry run can be grouped: `<file>:<line> link "<mention>" → <target>`.

### 3. The residual is accepted, and its guard is the dry run

A mention of another project's record that no part of Decision 2's text names, in a project that
holds the same number, is fixed to the local record, and [plan 0549](./0549-a-link-names-the-record-it-mentions.md)'s
join then agrees: a fix-written link is green by construction, since the join judges it by the key
the fix chose it by. A qualifier further away (two paragraphs up, in another section, in a sentence
that only implies the project) is not read. Nor does anything stop a caller giving the fix a
narrower `records` than the join's sources. A number from another numbering (a branch's, an older
one, a record landed verbatim) that the corpus also holds is fixed to the record that holds it now:
Phase 0 found none in 150 and seven in one record landed verbatim, and the maintainer accepted it
on 2026-10-26. All of this is accepted, knowingly:

- adopters asked for a dry run grouped by target, and sampled, before applying. `eess-ts check --fix`
  without `--apply` is a dry run (`packages/ts/src/cli/commands/check.ts:457-469`), and the fixed
  `describe` makes it groupable on the day this ships; the docs give the pipeline:

  ```sh
  eess-ts check rules.ts --fix | grep 'would fix' | sed 's/.* → //' | sort | uniq -c | sort -rn
  ```

  **Corrected 2026-10-27, by dogfooding:** this pipeline does not group by record. The target is
  written relative to the mentioning document, so one record cited from two folders lands in two
  groups. The docs' pipeline now groups by the target's file name, and says where that is one
  record; grouping by record is [proposal 020](../../proposals/020-a-fix-dry-run-a-reader-can-review.md)'s,
  whose addendum of 2026-10-27 records the measurement.

  A grouped dry run in the tool, and the fix in the JSON report, are
  [proposal 020](../../proposals/020-a-fix-dry-run-a-reader-can-review.md);

- `foreign` refuses the qualified cases the feedback found;
- the docs say all of it, under "What this cannot see", with the dry run named as the guard.

## Phases

### Phase 0 — measured before the freeze

Three measurements over this repository and ts-archunit's record list, by throwaway scripts, recorded
here with their counts, seeds and durations. They license
[plan 0542](./0542-this-repositorys-record-mentions-are-migrated.md)'s migration of this repository,
not the fix's correctness for another project's sources; the docs say so.

1. **Anachronisms**, over every candidate fix (3,079 at [spike 0540](../../spikes/0540-one-join-over-every-source.md)):
   a mention first written before the local record it would link to existed is suspect, not wrong
   by construction (corrected at Phase 0: some are a number claimed on an open branch, written
   before its record merged). Its date is the mention's first appearance in its file (`git log --follow -S`,
   earliest commit), not `git blame`, which dates a line's last edit. The instrument is first shown
   to find one anachronism planted in a scratch clone. The list goes to
   [plan 0542](./0542-this-repositorys-record-mentions-are-migrated.md), which names how its run
   leaves those mentions out (`--fix --apply` has no per-fix filter); eess-md cannot read git, and
   the docs name the class. The duration is named before it runs: about 560 files.
2. **What `foreign` refuses.** The candidates Decision 2's qualifier reading refuses here, counted
   and a sample of them read: each is a mention [plan 0542](./0542-this-repositorys-record-mentions-are-migrated.md)
   links by hand, so the count is its cost, and a refusal that names no other project is a reading
   too wide.
3. **The correctness sample.** From the candidates less the anachronisms and the refusals, 150 fixes at random with a
   recorded seed, in proportion to the strata (kind; a local record, or one only ts-archunit holds),
   so that zero wrong bounds the wrong rate among decidable mentions below 2% at 95% confidence
   (1 − 0.05^(1/150) ≈ 1.98%). The reader is a separate agent on a different model from the one that
   wrote the script and this plan, and blind: it names the record the author meant from the
   paragraph before it is shown the fix's (as run, two steps: a blind note, then a judge shown the
   target; see the record below). "Cannot tell" does not count toward the 150, drawing
   continues until 150 are decided, and its rate is reported as the share fixed unverified.

**Stop rules.** A wrong fix is classified by cause and becomes a fixture row that must carry no fix
(for the cause Phase 0 found, the maintainer's decision of 2026-10-26 replaces this with a row that
asserts the fix, below).
A cause the fix can refuse by a fact it reads amends Decision 2 once, and the sample is redrawn with
a fresh seed; a second wrong cause, or one the fix cannot read, keeps the fix held and the plan goes
back for a decision. A cannot-tell rate above 10% of draws keeps the fix held: a target a reader
cannot recover is a judgment case, which `ArchFix`'s contract (`packages/core/src/violation.ts:9-13`)
excludes.

**Files:** this plan only.

**Measured 2026-10-26** on `main` at c9e55336, Node 24.22.0, ts-archunit at b4084c9, by throwaway
scripts over the built packages, which were not kept: the seeds below name the draws, the lists are
recorded by value in [plan 0542](./0542-this-repositorys-record-mentions-are-migrated.md)'s
Appendix and the verdicts in this plan's. Each run took under 7 s but the anachronism pass, 36.1 s
(named before it ran: one to two minutes).

- **The candidates.** 4,704 plain mentions, the corpus gate's own count. 3,098 have exactly one
  record (2,920 local, 178 only in ts-archunit), 1,601 have one in both, 5 have none.
  [Spike 0540](../../spikes/0540-one-join-over-every-source.md) counted 4,682 plain mentions and 3,079
  one-record ones; recounted at its commit with this script, the plain total grew by 99 with the
  corpus and lost 77 to the spike's instrument, whose script was not kept. The mechanical refusals
  take 152: inline code 76, an inexact span 76 (every one a soft break), after `!` and `|` in a
  cell none.
- **What `foreign` refuses.** `foreign = /\b(?:ts-archunit|upstream)\b/i`: ts-archunit is the one
  other project this corpus numbers records of. A ts-archunit-qualified mention is refused although
  ts-archunit is a declared source, since the fix cannot tell which list a qualified number is
  from. The first reading refused 376, 3 of 20 sampled (seed 5502) naming another project; by
  measurement 2's own test that is too wide, and Decision 2's reading was amended (in answer to that
  test; the stop rules' amendment is a different one, for a wrong fix). The amended reading refuses
  156 (67 local, 89 ts-archunit), a subset of the 376, and keeps every true refusal of the first
  sample. It is still wide by the same test: 9 of 20 sampled (seed 7731) name another project, 7 are
  refused by a title or heading that does, 3 by their own item naming ts-archunit about something
  else, 1 by "upstream" as a common word. That width is kept on purpose, since it fails safe and the
  headings are an adopter's case; its cost is the 156 linked by hand. Of the 213 local mentions it
  now fixes, 20 read (seed 9142) are all this repository's. **Its cost on the other side:** four
  of the seven wrong fixes below (lines 121 to 124 of one table) were refused by the whole-table
  reading.
- **Anachronisms.** The instrument found a planted case in a scratch clone, both files renamed.
  136 of the 2,920 local candidates, in 35 files, every one reaching `main` a PR or more before its
  record; 128 are not otherwise refused and leave the frame, listed in
  [plan 0542](./0542-this-repositorys-record-mentions-are-migrated.md)'s Appendix. 53 of the 136 date
  the text in the file, not the instance, as `git log -S` does. 13 other candidates could not be
  dated; all 13 are refused by `span`. Not every anachronism is wrong: some are a number claimed on a
  branch before its record merged.
- **The correctness sample.** Frame 2,662 (3,098 less 152, 156 and 128); 150 drawn in proportion
  with seed 4417 (adr 32, bug 53, plan 50, spike 12 local; bug 2, plan 1 only in ts-archunit), and
  50 more as a reserve. A first draw (seed 20261026) was made before the amendment and replaced
  unjudged. The verdict is two steps. A Sonnet reader, shown only each mention's file, wrote what the
  author meant; it was not reliable on its own. Then a Fable judge, on a different model from the
  one that wrote the scripts and this plan, read each mention in its file, the first note as a hint
  only, and the fix's target, local or in ts-archunit's clone, and said whether the target is what
  the author meant, quoting the deciding words (all 206 quotes found verbatim in their files).
  **150 right, 0 wrong, 0 cannot tell**: zero in 150 bounds the wrong rate below 2% at 95%, mostly
  over local records, since 3 draws are ts-archunit's. The reserve: 49 right, 1 wrong ([spike 0001](../../spikes/0001-eess-over-ts-archunit/README.md)).
- **Readers set aside, kept here.** A first Sonnet reader matched each mention to the record list,
  the fix's own method (0 wrong, 1 cannot tell); a second, given the record list, looked the
  number up by script before answering (1 wrong). The second's one wrong,
  `work/bugs/fixed/0247-the-source-text-guard-checks-nul-but-not-utf8.md:206`, was a misreading: the
  mention drawn on that line is the one the author says is this repository's, and the quoted
  number from another branch starts on line 205, crosses a soft break and is refused by `span`.
  The plan went back to the maintainer on that one before the judge found it right.
- **Wrong, all in one file.** `work/spikes/0001-eess-over-ts-archunit/CONCLUSION.md`, a record
  landed verbatim from a branch that was never pushed, whose own note says its numbers predate a
  renumbering. Listed by script, every one-record mention in that spike's folder the fix would
  write: seven, all in this file, lines 121 to 124 of one table, 144, 146 and 161 (plans of that
  numbering, which ts-archunit happens to hold, and bugs, which this repository holds); each would
  be fixed to another record. The judge read 121, 122, 144, 146 and 161 wrong (the reserve's one
  wrong is line 144); 123 and 124 sit in the same table under the same note. 124 and 146 are also
  anachronisms, so this repository's run leaves them out either way; the fix itself does not read
  dates. Every other mention there is refused. Line 161 was found before the amendment, so the stop
  rule was met then; 121 to 124 became fixable by the amendment. `work/bugs/BUGS.md:245`, which a
  reader could not tell, the judge read right.

```text
> The numbers below are from before a renumbering and do NOT mean what they say …
| Plan 0085 — the migration | **Draft**, P3, blocked | this branch |
| Plan 0084 — port the fork to parity | **Superseded** by ADR-009 | this branch |
```

**Stop rule: met, by a cause the fix cannot read.** A number from another numbering, said only in
prose, here a record landed verbatim, is fixed to the record that holds the number now. The rule
was met when line 161 was found, before the amendment, and the plan should then have gone back;
it went on instead, which departs from the rule, and went back to the maintainer only on the
misread draw.

**Decided 2026-10-26 by the maintainer, in the working session: the residual is accepted**
(Decision 3), over holding the fix and over a second amendment refusing a mention in quotation
marks. Asked on the facts then held, 1 wrong in 150 and [spike 0001](../../spikes/0001-eess-over-ts-archunit/README.md)'s three; corrected the same
day to 0 in 150 and seven wrong fixes, all in that one file, four of them made by the amendment, and
reported to the maintainer with the decision standing. The cause becomes an example row asserting
the fix, so the residual is visible and a change to it is seen; this repository's run leaves
[spike 0001](../../spikes/0001-eess-over-ts-archunit/README.md) out by selection
([plan 0542](./0542-this-repositorys-record-mentions-are-migrated.md)).

### Phase 1 — `span`

`MdMentionRef` gains `span?: { start, end }`, the match's source offsets, present only when the source
slice equals the matched text (no escape, entity, emphasis or soft break inside); reading it on an
unread mention throws the builder's UNKNOWN, through a getter of its own.

**Files:** `packages/md/src/model/phrasing.ts`, `packages/md/src/model/mentions.ts`,
`packages/md/src/builders/mentions.ts`.

### Phase 2 — the fix

`beLinked({ fix })` with Decision 2's refusals and configuration findings; the text around a mention
(its paragraph, row and header, item and parent items, blockquote, lead-in and containing sections'
headings) from the model; the shared path
helper; `BeLinkedOptions` and a re-export of the kernel's `Selection`, which the option names and the
example annotates (`check:family`; the example may import only `@nielspeter/eess-md`,
`arch.rules.ts:174-180`).

**Files:** `packages/md/src/conditions/be-linked.ts`, `packages/md/src/builders/mentions.ts`,
`packages/md/src/model/mentions.ts`, `packages/md/src/model/resolve-link.ts`,
`packages/md/src/index.ts`.

### Phase 3 — the worked example, the round trip, and docs

`examples/md/a-plain-mention-is-fixed.test.ts`, public blocks only, asserts each row's finding and
whether it carries a fix, with the fix's replacement and `describe`. One record (fixed), in `clean/`;
in `violating-<row>/` each: a key two sources hold, a qualifier beside the number, one only in a
containing section's heading, one in a list's parent item, one in a table's header, a four-digit
mention beside a three-digit record, a moved record (each refused); a list item and a table row
whose sibling names another project (each fixed); a document whose note says its numbers predate
a renumbering, with a table row naming a plan of that numbering that the records hold (fixed: the
accepted residual, its replacement and `describe` asserted); a self-mention and a frozen folder are
not selected.

The round trip, applied and then judged, is not the example's: `applyFixes` is
`@nielspeter/eess/internal`'s (`packages/core/src/internal.ts:24`), and it writes the files it is
handed. It lives in `packages/md/tests/`, on a temporary copy of a disk fixture, as
`packages/md/tests/autofix.test.ts` does.

`docs/markdown.md` gains the fix, its refusals, `foreign`, the dry run as the guard with its pipeline,
and under "What this cannot see": a qualifier Decision 2 does not read, an undeclared project's
record, a number from another numbering, a fix-written link green by construction, the anachronism
class, and Phase 0's licence.

**Files:** the example and its fixtures (new), `packages/md/tests/builders/mention-fix.test.ts`
(new), `docs/markdown.md`, `packages/md/README.md`.

### Phase 4 — the matrices

One `check:nonvacuity` row: the fix's exactly-one test rewritten to at-least-one in the built
`packages/md/dist/conditions/be-linked.js`, by `withRewrittenFile` (`scripts/check-nonvacuity.mjs:650`)
with its `from` string asserted present, must turn the example's two-sources test red, read by its
title. The example imports `@nielspeter/eess-md`, so it loads `dist`; the unit tests import `src` and
cannot see the rewrite. The examples harness swaps folders and so proves a finding, never a fix; this
is the property the fix was held for. Its added duration is recorded, since a row's cost multiplies
across shards.

**Files:** `scripts/check-nonvacuity.mjs`.

## Files Changed

| file                                                                     | phase |
| ------------------------------------------------------------------------ | ----- |
| `packages/md/src/model/phrasing.ts`, `packages/md/src/model/mentions.ts` | 1, 2  |
| `packages/md/src/builders/mentions.ts`                                   | 1, 2  |
| `packages/md/src/conditions/be-linked.ts`                                | 2     |
| `packages/md/src/model/resolve-link.ts`                                  | 2     |
| `packages/md/src/index.ts`                                               | 2     |
| `packages/md/tests/builders/mentions.test.ts`                            | 1, 2  |
| `packages/md/tests/builders/mention-fix.test.ts` (new)                   | 3     |
| `examples/md/a-plain-mention-is-fixed.test.ts` (new)                     | 3     |
| `docs/markdown.md`, `packages/md/README.md`                              | 3     |
| `scripts/check-nonvacuity.mjs`                                           | 4     |
| `.changeset/*.md` (eess-md minor)                                        | —     |

## Test inventory

Each drives `mentions(corpus, { pattern })` and `beLinked({ fix })`; the round trip applies through
`applyFixes`, the door `eess-ts check --fix --apply` uses.

| test                                                                                                                                                                                                                                                                                              | phase |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `span` is the source slice for a plain mention, and absent with an escape, an entity, emphasis or a soft break                                                                                                                                                                                    | 1     |
| an unread mention under a predicate reading `span` is reported, not dropped                                                                                                                                                                                                                       | 1     |
| one record: a fix; applied to a temporary copy, the written target is that record's and the join is green over it                                                                                                                                                                                 | 3     |
| two records: no fix, both targets named; none: no fix, said so; a key that is `undefined`: no fix, said so                                                                                                                                                                                        | 2     |
| `foreign` in the mention's paragraph, a list's parent item, a grandparent item, a table's header, another cell of its own row, another paragraph of its blockquote, a list's lead-in for a nested item, a table's lead-in, and only in a containing section's heading two levels up: each refused | 2     |
| `foreign` in a sibling list item or another table row only: fixed                                                                                                                                                                                                                                 | 2     |
| a `g` `foreign` refuses two qualified mentions in one block; a missing `foreign` (an untyped object), a non-`RegExp` one and an empty-matching one each throw `ArchConfigError` at build                                                                                                          | 2     |
| a four-digit mention beside a three-digit record of the same value: no fix                                                                                                                                                                                                                        | 2     |
| inline code, after `!`, without a `span`, and in a table cell with a `\|` in its target: no fix                                                                                                                                                                                                   | 2     |
| two mentions on one line are both fixed                                                                                                                                                                                                                                                           | 2     |
| a URL target written verbatim; a path relative to the mention's document; a path with a space in `<…>`                                                                                                                                                                                            | 2     |
| `describe` is exactly `<file>:<line> link "<mention>" → <target>`                                                                                                                                                                                                                                 | 2     |
| an empty `records` is a configuration finding with or without plain mentions; keys that meet no record over linked and plain mentions alike is another; a corpus with no plain mention left and keys that meet trips neither                                                                      | 2     |
| the example's rows                                                                                                                                                                                                                                                                                | 3     |

**Sabotage, before the PR:** dropping the `span` guard gives a mention with an escape a fix at the
wrong offsets; reading only the mention's own paragraph lets the heading, parent-item and table-header
qualifiers through; reading only the direct parent item lets the grandparent's through, reading
only the mention's cell lets the rest of its row through, and reading only the mention's paragraph
of a blockquote lets the rest through; reading the whole table or list refuses the sibling rows;
each must turn its test red. The exactly-one sabotage is committed (Phase 4).

## Release

| package               | bump  | why                                                    |
| --------------------- | ----- | ------------------------------------------------------ |
| `@nielspeter/eess-md` | minor | a fix option on `beLinked()`, an optional `span` field |
| every other package   | none  | nothing a consumer can observe                         |

## Out of scope

- **A dry run grouped by target, and the fix in the JSON report:** [proposal 020](../../proposals/020-a-fix-dry-run-a-reader-can-review.md).
- **This repository's migration**, and how its run leaves the anachronisms out: [plan 0542](./0542-this-repositorys-record-mentions-are-migrated.md).
- **eess-md's own door to applying fixes:** [bug 0537](../../bugs/0537-eess-md-alone-has-no-run-level-services.md);
  fixes are applied through `eess-ts check --fix --apply`, as `movedLinkFix`'s are.

## Review — 2026-10-25

One capped round, architect and enforcement separately, on this plan as split from
[plan 0549](./0549-a-link-names-the-record-it-mentions.md) (architect: Ship as Draft with three
Important; enforcement: Changes needed, Critical 1). Kept, not edited away:

- **Enforcement C1:** the guard named in Decision 3 was a flat dry run, while the adopters asked for
  one grouped by target and [proposal 020](../../proposals/020-a-fix-dry-run-a-reader-can-review.md) records that a flat list hides the error a reader can catch.
  The fix's `describe` is now fixed with the target last, tested, and the docs give the grouping
  pipeline until [proposal 020](../../proposals/020-a-fix-dry-run-a-reader-can-review.md).
- **Enforcement I2:** `foreign` read only the innermost block, missing a parent list item, a table
  header, a blockquote and a lead-in. It now reads the top-level block, the lead-in and the
  containing sections' headings; what it still does not read is named in Decision 3.
- **Enforcement I3:** `foreign` could be left out or carry `g`. It is required, read through a copy,
  and an empty-matching one is a configuration finding.
- **Architect I1:** `EXTERNAL_RE` is exported by [plan 0549](./0549-a-link-names-the-record-it-mentions.md), which builds first.
- **Architect I2:** the example cannot import `applyFixes`; the round trip moved to `packages/md/tests/`.
- **Architect I3, enforcement M1:** the committed sabotage row named a test that reads `src`; it now
  names the example's, which loads `dist`.
- **Verification pass (enforcement):** the m2 sabotage of
  [plan 0549](./0549-a-link-names-the-record-it-mentions.md) can fire; `foreign` is refused at run
  time, not only in the type, by a thrown `ArchConfigError`; Phase 0 counts what `foreign` refuses.
- **Architect re-check:** only the empty-match refusal shares `pattern`'s door; `pattern`'s own
  missing and non-`RegExp` cases throw a `TypeError`, recorded as
  [bug 0551](../../bugs/0551-an-untyped-mention-pattern-throws-a-typeerror.md), not fixed here.
- **Minors:** an `undefined` key, the configuration findings' kind and precedence, the planted
  anachronism, one amendment before the plan goes back, the exclusion mechanism left to [plan 0542](./0542-this-repositorys-record-mentions-are-migrated.md),
  `|` in a table cell, and which headings are read.

## Built — 2026-10-26

What the build did that the plan did not say, kept here rather than edited into it:

- **`span` is decided per mention, by a source map.** Each character of a text node is mapped to its
  source offset, stepping over a line's container prefix (indent, `>`), a `\r`, and an escape's
  backslash; an entity's character maps to nothing. A mention has a span when its first character
  maps and the source from there is the matched text, the one check that makes a fix replace
  exactly what it read. (The first build tested a whole text node, so one wrapped list item lost
  every fix in it; architect I2.) A file that starts with a byte-order mark gets no span at all, so
  no fix: recorded, fail-safe.
- **The context reader is its own module**, `packages/md/src/model/mention-context.ts`, not
  `model/mentions.ts`: Decision 2's reading, ported line for line from Phase 0's measured script, so
  what ships is what was measured.
- **How a refusal reads.** A finding without a fix ends `— not fixed: <why>`; with no `fix` option
  the message is [plan 0539](./0539-a-mention-of-a-record-is-a-link.md)'s, unchanged. The two configuration findings are `md/mention-fix-config`,
  and either one turns every fix off for the run.
- **The example.** `clean/` is the fixable case; ten `violating-` folders hold the refusals and the
  fixed rows at other places (sibling item, sibling row, the renumbered residual), so every swap
  changes what a test reads. Two folders carry one linked mention whose key meets a record, or the
  keys-meet configuration finding, right on a one-mention corpus, would speak instead of the row.
  The harness's swap check on it alone took 20 s, all ten load-bearing; `check:nonvacuity` runs the
  file 1 + 2 × 10 = 21 times, about 17 s.
- **Phase 4's row** is `examples/md-mention-fix-exactly-one`, under `check:examples`. Rewriting
  `candidates.length !== 1` to `< 1` in the built `be-linked.js` turned only
  `violating-two-sources` red; the row runs the example twice, before and after, about 1.6 s.
- **Code review (architect and enforcement, 2026-10-26), what changed:**
  - a hard line break reads as a line break, so a project's name before one is still read
    (enforcement I1);
  - a target is written only where a link destination keeps it: `<`, `>`, `\`, a line break, and
    `#` or `?` in a path are refused; a space or parenthesis goes in `<…>`; an absolute path or one
    climbing out of the repository is refused (enforcement I2, M1; architect M5);
  - a mention right after `]`, or holding a bracket, is refused (enforcement M2, architect M5);
  - one record listed twice under one target is one record (enforcement M4);
  - the configuration finding has the kernel's `file: ''`, the rule's name in its element, and the
    rule's `because` and `docs` (architect I1, M2, M3);
  - `records`, `key` and `target` are checked when `beLinked()` is called, beside `foreign`
    (architect M1); `phrasingOf` takes `source` as required (architect M6); each key is computed
    once per mention (architect M7);
  - the docs name what `foreign` does not read (an image's alt text, a link's URL, a heading in a
    list item) and say "green by construction" holds only over one list of records (enforcement
    M5, architect M4); the changeset names every export (architect M8).
- **Verification round, what changed:** the source map took any `&name;` as an entity, so a literal
  one micromark keeps (`&bug0001;`) moved every later place, and a fix landed on another copy of the
  same text; the text check cannot see that. A literal `&` at an entity's shape now ends the walk,
  and any other character there means the entity decoded (enforcement N1). A mention after an odd
  run of backslashes is refused, since the link's `[` would be escaped (enforcement N2).
  `findMentions` takes `source` as required, and an unreachable zero-mention guard is gone
  (architect). A file with a byte-order mark is still refused with the generic reason: recorded.
  The last check, about 154k fuzzed inputs, found no fix at a wrong place; it found that a link
  beside `*` or `_` can change their emphasis, so a mention touching `*`, `_` or `~` is refused.
- **A re-parse check on every fix, the maintainer's choice on 2026-10-26.** The last re-check's
  structural fuzz (each fix applied, the tree compared) found what no character beside a mention
  shows: a fix's `)` closing a `(` that a link definition's title left open, so the paragraph became
  that title (H1), and a fix's `[` ending an e-mail address GFM then linked (H2). Asked whether to
  close them now or record them, the maintainer chose the check. `model/fix-check.ts` keeps a fix
  only when the document parses the same with exactly its new link added: blocks and their visible
  text, definitions by label, URL and title, emphasis, reference labels, and links by URL and text.
  Its review found that checking only the whole set let a fix through that is safe only beside
  another, while `.excluding()` or an overlap can apply it alone (shown through the public API); so
  each fix is checked alone, over the top-level block it sits in and one on each side, a table row
  as a table of that one row, and the fixes kept are checked together over the whole document. Its
  parses skip the parse memo, so a written text never pushes a corpus text out. Cost over this
  repository, measured each step, 4,427 fixes and none refused: 0.45 s without the check, 4.9 s
  checking the set only, 118 s checking each fix over the whole document, 85 s over its block and
  neighbours, 11 s with a table row read alone, 12 s once every kept set, a single fix included, is
  read over the whole document too (the architect's verification: the stretch is argued and fuzzed,
  not proved, and that parse is its backstop; no input is known that only it refuses, so no
  sabotage can redden it, and it stays because it can only refuse). A set that fails whole costs
  one more parse per fix; it never ran here. The cost grows with the fixes, not the corpus, so a
  corpus with no plain mention left pays nothing; [plan 0542](./0542-this-repositorys-record-mentions-are-migrated.md)'s
  migration run is where the 12 s falls. A stretch that does not start the document is read from a
  fresh line, so a `---` there is not front matter (enforcement). With it came the architect's last minors: the inexact-span
  message names the `&` case, the docs say how far an ambiguous `&` reaches, a mention whose own
  text starts or ends with `*`, `_`, `~` or `\` is refused, and a target holding an entity is
  refused by name.
- **Sabotage, run before the PR** on the unit tests (they read `src`), each file restored after.
  Each turned only its row red:

  | sabotage                                                        | red                                               |
  | --------------------------------------------------------------- | ------------------------------------------------- |
  | `foreign` read in the mention's own block only                  | parent, header, blockquote, lead-in, heading rows |
  | only the direct parent item read                                | the parent and grandparent row                    |
  | only the mention's own cell read                                | the header and other-cell row                     |
  | only the mention's paragraph of a blockquote read               | the blockquote row                                |
  | the whole table or list read                                    | the sibling row                                   |
  | the span's source-equals-text check dropped                     | the span rows                                     |
  | no lead-in read                                                 | the lead-in row                                   |
  | a hard break read as nothing                                    | the hard-break row                                |
  | the `!`, `]`, `\|`-in-a-cell or inline-code check dropped, each | its own row                                       |
  | an undefined key let through                                    | the undefined-key row                             |
  | the destination or repository-path guard dropped                | the targets row                                   |
  | duplicates not merged                                           | the listed-twice row                              |
  | `records` or `target` not checked at build                      | the build-time row                                |
  | the configuration findings dropped                              | both configuration rows                           |
  | the entity step taken for a literal `&`                         | the literal-`&` span row                          |
  | the backslash check dropped                                     | the backslash row                                 |
  | the emphasis check dropped                                      | the emphasis row                                  |
  | the re-parse check dropped                                      | the definition-title and e-mail rows              |
  | the alone check replaced by the set check                       | the safe-only-beside-another row                  |
  | the fresh-line start dropped                                    | the thematic-break row                            |
  | the edge-mark check dropped                                     | the edge-mark row                                 |

  One guard fired nothing and was deleted, not kept: that a span's characters map to consecutive
  offsets. The source-equals-text check already guarantees the replacement, so no input can tell
  the two apart.

## Progress ledger

- [x] Phase 0 — the anachronism count, what `foreign` refuses, and the correctness sample, recorded;
      the stop rule fired and the maintainer accepted the residual (2026-10-26)
- [x] Phase 1 — `span`
- [x] Phase 2 — `beLinked({ fix })`, its refusals and configuration findings, the shared helper, exports
- [x] Phase 3 — the worked example, the round trip, and docs
- [x] Phase 4 — the committed sabotage row, its duration recorded
- [x] Every row of the Test inventory written and green, and every sabotage row red
- [x] The eess-md minor changeset

## Appendix — the correctness sample, 2026-10-26

The judge's verdict on each draw (d001–d150 the sample, d151–d200 the reserve, seed 4417) and on the six cases outside it (x1–x6), with the target the fix would write (`ts-archunit:` abbreviates `https://github.com/nielspeter/ts-archunit/blob/main/`). Fenced, so the corpus gate does not count it.

```tsv
id	location	mention	target	verdict	reason
d001	work/bugs/fixed/0506-a-section-matcher-with-a-g-flag-skips-every-other-document.md:51	Plan 0496	work/plans/completed/0496-sections-as-elements.md	right	Plan 0496 is the md sections plan whose build strips the flags; this repo's record
d002	work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md:31	spike 0392	work/spikes/0392-what-makes-an-accepted-entry-portable.md	right	Same file links spike 0392 to this target two lines later
d003	work/spikes/0390-a-or-e-where-the-file-enters-a-findings-identity.md:39	bug 0388	work/bugs/0388-a-baseline-entry-forgives-the-same-finding-in-any-file.md	right	Spike 0390 is about baseline identity, bug 0388's subject
d004	work/proposals/017-md-blocks-to-check-a-documents-shape.md:793	plan 0495	work/plans/completed/0495-a-value-agrees-with-its-folder.md	right	Block 5 is 'a value agrees with its folder', plan 0495's title
d005	work/plans/completed/0496-sections-as-elements.md:132	plan 0505	work/plans/completed/0505-a-field-read-inside-a-named-section.md	right	Target is the named-section field plan; linked earlier in same file
d006	work/plans/0534-the-adr-a-finding-is-identified-by-the-code-it-matched.md:145	bug 0159	work/bugs/0159-violation-identities-collide-across-distinct-findings.md	right	Identity collisions are bug 0159's subject; plan 0534 is the identity ADR plan
d007	work/plans/0191-flip-the-inert-finding.md:90	plan 0102	ts-archunit:plans/completed/0102-a-detector-that-cannot-fire-says-so.md	right	ts-archunit plan 0102 introduced INERT_FINDING_EMIT; eess has no plan 0102
d008	work/plans/completed/0503-in-sections-boxes-by-section.md:63	ADR-022	adr/022-eess-mds-root-fixes-no-documents-shape.md	right	ADR-022 clause 1 is exactly that the md root fixes no shape
d009	work/bugs/0279-the-barrel-criterion-has-no-memory-and-no-adopter-signal.md:137	ADR-011	adr/011-the-kernels-public-api-is-explicit.md	right	ADR-011 governs the kernel's public barrel
d010	work/plans/completed/0496-sections-as-elements.md:30	ADR-023	adr/023-a-predicate-and-a-condition-that-share-a-word.md	right	ADR-023 names the predicate-prefixed twins
d011	work/spikes/0386-strings-that-name-code.md:106	spike 0385	work/spikes/0385-what-makes-an-exclusion-switch-a-rule-off.md	right	Same file links spike 0385 to this target at line 95
d012	work/bugs/0544-one-way-crossvalidate-presets-cannot-declare-non-empty.md:39	bug 0400	work/bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md	right	Bug 0400 changed what a one-way correspondence counts as examined
d013	work/proposals/017-md-blocks-to-check-a-documents-shape.md:989	plan 0496	work/plans/completed/0496-sections-as-elements.md	right	Plan 0496 built haveSection depth; linked in same proposal's table
d014	work/proposals/017-md-blocks-to-check-a-documents-shape.md:791	plan 0457	work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md	right	Plan 0457 is linked elsewhere in the table; it shipped the section predicate on md's root
d015	work/plans/0498-honestyatclose-places-a-record-with-block-5.md:167	Bug 0444	work/bugs/fixed/0444-honesty-at-close-reads-state-only-and-says-nothing.md	right	Bug 0444 added the caller's label alias to the state reader
d016	work/plans/0534-the-adr-a-finding-is-identified-by-the-code-it-matched.md:145	Plans 0532	work/plans/0532-a-baseline-entry-matches-only-the-file-it-was-written-for.md	right	Plan 0532 is the file-clause child of plan 0346 named in Out of scope
d017	work/bugs/fixed/0502-links-and-tables-read-a-heading-in-a-list-differently.md:19	plan 0496	work/plans/completed/0496-sections-as-elements.md	right	Linked on the preceding line to the same target
d018	docs/migrating-to-0.15.md:145	bugs 0467	work/bugs/fixed/0467-eess-ts-expectnonempty-does-nothing.md	right	Title matches the row exactly
d019	adr/013-the-kernel-takes-the-fact-not-the-project.md:17	Plan 0188	work/plans/0188-unify-the-duplicated-engine-modules.md	right	Linked at line 7 of the same ADR to this target
d020	work/plans/completed/0235-the-emitter-takes-a-receipt.md:274	ADR-014	adr/014-the-emitter-refuses-a-verdict-without-evidence.md	right	Plan 0235 is ADR-014's receipt design
d021	work/plans/completed/0503-in-sections-boxes-by-section.md:379	ADR-022	adr/022-eess-mds-root-fixes-no-documents-shape.md	right	ADR-022 clause 1 keeps shape words out of the md root
d022	work/plans/completed/0404-md-one-link-resolver-names-each-case.md:14	plan 0406	work/plans/completed/0406-md-a-declared-link-is-answered.md	right	Linked two lines later as the third of three plans
d023	work/bugs/0415-a-plain-label-later-in-a-paragraph-is-neither-read-nor-reported.md:64	Bug 0414	work/bugs/0414-a-label-after-a-soft-break-is-reported-never-read.md	right	Sibling bug on labels after soft breaks, same subject
d024	work/plans/completed/0235-the-emitter-takes-a-receipt.md:641	ADR-014	adr/014-the-emitter-refuses-a-verdict-without-evidence.md	right	ADR-014 is the emitter-evidence ADR this plan builds
d025	work/bugs/fixed/0364-doctor-states-the-cause-and-never-the-remedy.md:33	Bugs 0355	work/bugs/fixed/0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md	right	Dead-selector remedy wording came from bug 0355's disk discriminator
d026	work/plans/completed/0496-sections-as-elements.md:355	ADR-023	adr/023-a-predicate-and-a-condition-that-share-a-word.md	right	ADR-023 gives the predicate prefix naming
d027	adr/020-a-package-supports-a-runtime-only-where-ci-checks-it-there.md:121	Bug 0439	work/bugs/fixed/0439-the-family-fails-to-load-under-bun-from-eess-0-5-1.md	right	ADR-020 is the Bun runtime ADR; bug 0439 is its Bun load bug
d028	work/plans/completed/0237-eess-runtime-use-only-in-rule-files.md:289	plan 0235	work/plans/completed/0235-the-emitter-takes-a-receipt.md	right	Plan 0235 shipped in PR #108 touching many files; same-repo contemporaneous plan
d029	work/proposals/017-md-blocks-to-check-a-documents-shape.md:1002	bugs 0502	work/bugs/fixed/0502-links-and-tables-read-a-heading-in-a-list-differently.md	right	Bug 0502 states it is plan 0503's precondition
d030	work/bugs/0246-one-fixture-plants-a-probe-integrity-cannot-name.md:42	bug 0231	work/bugs/fixed/0231-a-killed-nonvacuity-run-leaves-an-invisible-probe-that-reds-other-gates.md	right	Bug 0246 is the one-fixture residue of bug 0231
d031	work/spikes/0418-where-python-architecture-tools-pass-on-a-broken-rule.md:105	ADR-014	adr/014-the-emitter-refuses-a-verdict-without-evidence.md	right	ADR-014 defines the evidence receipt
d032	work/plans/completed/0058-markdown-dialect-eess-md.md:72	Plan 0051	work/plans/completed/0051-consolidation-eess-monorepo.md	right	Plan 0051 gates 0058/0059 per its own status
d033	work/bugs/fixed/0127-nonvacuity-proves-a-condition-not-a-wired-rule.md:94	bug 0086	work/bugs/fixed/0086-links-to-directories-do-not-resolve.md	right	Bug 0086's fix wired scripts/nonvacuity/bad-corpus-link-routing.mjs as corpus/link-routing
d034	work/plans/completed/0235-the-emitter-takes-a-receipt.md:273	ADR-014	adr/014-the-emitter-refuses-a-verdict-without-evidence.md	right	Plan 0235 implements ADR-014
d035	work/proposals/009-core-a-verdict-cannot-be-assembled-by-hand.md:242	bug 0109	work/bugs/fixed/0109-nonvacuity-fixtures-read-a-crash-as-a-pass.md	right	Bug 0109's fix required the sentinel at the harness
d036	work/plans/completed/0496-sections-as-elements.md:655	plans 0503	work/plans/completed/0503-in-sections-boxes-by-section.md	right	Sibling plan in the same release batch
d037	work/plans/completed/0148-workspace-multi-root-awareness.md:185	plan 0147	work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md	right	Plan 0147 copied the ts-archunit delta and deferred project-relative sites; this repo's plan
d038	work/plans/completed/0495-a-value-agrees-with-its-folder.md:154	ADR-017	adr/017-a-heritage-predicate-names-a-relation-not-a-clause.md	right	ADR-017 rule: one word means one thing across the family
d039	work/plans/completed/0263-adr-014s-residual-enforcement-rows.md:194	ADR-014	adr/014-the-emitter-refuses-a-verdict-without-evidence.md	right	Plan 0263 is ADR-014's residual rows
d040	adr/015-the-kernel-extends-resolution-never-execution.md:48	plan 0165	work/plans/completed/0165-integrate-the-copied-ts-archunit-engine.md	right	This repo's plan 0165 landed with jiti pinned in package-lock; the eess record
d041	work/plans/completed/0456-kernel-notexist-and-dead-glob.md:39	plan 0458	work/plans/completed/0458-the-examples-gate-a-document-shape-from-public-blocks-only.md	right	Plan 0458 is the examples gate, named at line 27
d042	work/plans/completed/0235-the-emitter-takes-a-receipt.md:133	ADR-014	adr/014-the-emitter-refuses-a-verdict-without-evidence.md	right	Quote matches ADR-014's fixture clause
d043	work/plans/completed/0496-sections-as-elements.md:221	bug 0502	work/bugs/fixed/0502-links-and-tables-read-a-heading-in-a-list-differently.md	right	Two heading walks is bug 0502's subject
d044	work/spikes/0386-strings-that-name-code.md:325	bugs 0159	work/bugs/0159-violation-identities-collide-across-distinct-findings.md	right	0159's collisions 1 and 2 named four lines later
d045	work/plans/completed/0495-a-value-agrees-with-its-folder.md:501	bug 0444	work/bugs/fixed/0444-honesty-at-close-reads-state-only-and-says-nothing.md	right	Bug 0444 is the no-state silent pass
d046	work/bugs/0365-the-kernels-ondisk-union-has-no-consumers.md:55	bug 0220	work/bugs/0220-nothing-requires-a-public-symbol-to-be-documented.md	right	Bug 0220 is the undocumented-exports bug with dialect side open
d047	work/bugs/0277-crossvalidates-flat-entries-have-no-standalone-contract.md:5	bug 0276	work/bugs/fixed/0276-the-dialects-re-export-the-receipt-constructors-unevenly.md	right	Bug 0277 is 0276's residual for crossvalidate
d048	work/proposals/016-eess-py-a-python-dialect.md:345	ADR-017	adr/017-a-heritage-predicate-names-a-relation-not-a-clause.md	right	ADR-017 governs extend/implement semantics family-wide
d049	work/plans/completed/0496-sections-as-elements.md:328	bug 0185	work/bugs/fixed/0185-a-kernel-break-reaches-adopters-as-a-dialect-patch.md	right	Bug 0185 requires a break to name dependents
d050	work/proposals/001-md-corpus-rule-coverage.md:839	bug 0127	work/bugs/fixed/0127-nonvacuity-proves-a-condition-not-a-wired-rule.md	right	Bug 0127's status records that conversion
d051	work/plans/completed/0522-the-rest-of-blocks-3-and-14-on-sections.md:12	plan 0496	work/plans/completed/0496-sections-as-elements.md	right	Linked at lines 8 and 14 of the same file
d052	work/proposals/017-md-blocks-to-check-a-documents-shape.md:396	bug 0403	work/bugs/fixed/0403-the-vacuity-matrix-probes-one-dialect-of-five.md	right	Bug 0403 widened the vacuity matrix to the dialects' exports
d053	work/plans/completed/0142-bind-proposals-to-plans.md:17	bugs 0118	work/bugs/fixed/0118-ledger-gate-skips-the-bug-lane.md	right	Bug 0118's fix scans both lanes with each one's vocabulary
d054	work/bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md:27	plan 0457	work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md	right	Plan 0457's out-of-scope says the remedy is composing inside the scope
d055	work/spikes/0386-strings-that-name-code.md:166	ADR-018	adr/018-a-string-that-names-code-is-resolved-or-the-rule-says-why-not.md	right	ADR-018's status says the same, citing spike 0386
d056	work/proposals/017-md-blocks-to-check-a-documents-shape.md:1057	bug 0403	work/bugs/fixed/0403-the-vacuity-matrix-probes-one-dialect-of-five.md	right	Same bug named at line 999's row; md probes needed before new md constructors
d057	work/bugs/0416-the-link-test-reads-an-indented-fence-as-prose.md:6	bug 0414	work/bugs/0414-a-label-after-a-soft-break-is-reported-never-read.md	right	Bug 0414 is this repo's record with the md example, same PR #207 era
d058	work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md:555	plan 0456	work/plans/completed/0456-kernel-notexist-and-dead-glob.md	right	Plan 0456 owns kernel notExist and dead glob
d059	work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:413	spike 0392	work/spikes/0392-what-makes-an-accepted-entry-portable.md	right	Spike 0392 measured for bug 0389, per its opening
d060	work/plans/0449-the-clis-loader-leaves-the-kernels-internal-entry.md:5	plan 0448	work/plans/completed/0448-a-bun-load-guard-and-bug-0439s-fix.md	right	Linked in the same line to this target
d061	work/plans/completed/0263-adr-014s-residual-enforcement-rows.md:77	ADR-014	adr/014-the-emitter-refuses-a-verdict-without-evidence.md	right	ADR-014: a required field, not a registry
d062	work/plans/completed/0458-the-examples-gate-a-document-shape-from-public-blocks-only.md:697	plan 0456	work/plans/completed/0456-kernel-notexist-and-dead-glob.md	right	Plan 0456 adds md notExist
d063	work/bugs/fixed/0241-archconfigerror-has-no-reader.md:157	bug 0190	work/bugs/fixed/0190-the-preset-constructs-nothing-finding-cannot-fire.md	right	Linked under Related in the same file
d064	work/bugs/fixed/0255-an-exclusion-comment-that-cannot-apply-is-inert.md:90	bug 0044	ts-archunit:bugs/fixed/0044-an-inline-exclusion-comment-has-no-feedback-channel.md	right	Only bug 0044 anywhere; its subject is exclusion staleness feedback, engine inherited from ts-archunit
d065	work/proposals/006-mermaid-beyond-classdiagram.md:672	bug 0423	work/bugs/fixed/0423-a-capitalised-mermaid-fence-is-skipped-in-silence.md	right	Title matches: capitalised Mermaid fence
d066	work/plans/completed/0495-a-value-agrees-with-its-folder.md:445	Plan 0498	work/plans/0498-honestyatclose-places-a-record-with-block-5.md	right	Plan 0498 is the placement-half rebuild named throughout plan 0495
d067	work/proposals/promoted/013-md-a-declared-relation-is-reciprocated.md:295	ADR-016	adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md	right	ADR-016's header declares Extends: ADR-009
d068	work/plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md:20	Plan 0413	work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md	right	Linked at line 8 of the same file
d069	work/plans/completed/0486-a-predicate-that-cannot-judge-says-so.md:115	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	right	Plan 0469 is the haveField plan whose tests change
d070	adr/020-a-package-supports-a-runtime-only-where-ci-checks-it-there.md:123	ADR-011	adr/011-the-kernels-public-api-is-explicit.md	right	ADR-011 governs /internal and its break rules
d071	work/plans/completed/0481-this-repository-dogfoods-notexist.md:7	Plan 0456	work/plans/completed/0456-kernel-notexist-and-dead-glob.md	right	Matches plan 0456's title exactly
d072	work/bugs/0530-an-ignore-glob-is-never-judged.md:16	bug 0465	work/bugs/fixed/0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md	right	Title matches
d073	work/bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md:14	bug 0423	work/bugs/fixed/0423-a-capitalised-mermaid-fence-is-skipped-in-silence.md	right	Named as origin at line 9 of the same file
d074	work/bugs/0471-the-header-region-reads-a-body-value-past-a-label-shaped-section.md:7	plan 0468	work/plans/completed/0468-fields-read-a-labelled-value-in-the-callers-forms.md	right	Plan 0468 built the header region the bug describes
d075	work/plans/completed/0096-dogfood-missing-crossvalidate-bindings.md:536	bugs 0097	work/bugs/0097-crossval-presets-bypass-caller-owns-reporting.md	right	Bug 0097 was self-found during plan 0096, per its status
d076	work/plans/completed/0237-eess-runtime-use-only-in-rule-files.md:44	plan 0263	work/plans/completed/0263-adr-014s-residual-enforcement-rows.md	right	Plan 0263 Phase 5 removed throwIfViolations from the barrels
d077	work/bugs/0205-four-emitters-restate-the-suppression-rule-and-disagree.md:111	plan 0188	work/plans/0188-unify-the-duplicated-engine-modules.md	right	Linked two lines later to the same target
d078	work/bugs/BUGS.md:438	bug 0087	work/bugs/fixed/0087-frontmatter-parsed-as-setext-heading.md	right	Bug 0087's fix is the front-matter parser
d079	work/plans/0532-a-baseline-entry-matches-only-the-file-it-was-written-for.md:93	spike 0394	work/spikes/0394-the-phase-2-design-for-a-file-aware-baseline.md	right	Spike 0394 is plan 0346's Phase 2 design, the file-aware baseline
d080	work/proposals/010-ts-performance-at-scale.md:280	ADR-014	adr/014-the-emitter-refuses-a-verdict-without-evidence.md	right	Receipt-shape question belongs to ADR-014's evidence receipt
d081	work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:96	spike 0428	work/spikes/0428-where-mermaid-puts-an-errors-line.md	right	Spike 0428 measured what the worker must carry home
d082	work/plans/completed/0454-box-marks-are-the-callers.md:474	bug 0444	work/bugs/fixed/0444-honesty-at-close-reads-state-only-and-says-nothing.md	right	Title matches
d083	work/proposals/017-md-blocks-to-check-a-documents-shape.md:486	bug 0403	work/bugs/fixed/0403-the-vacuity-matrix-probes-one-dialect-of-five.md	right	Title matches
d084	work/plans/0533-a-match-is-identified-by-its-shape-and-old-baselines-migrate.md:59	plan 0346	work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md	right	Plan 0533 is plan 0346's child carrying its decisions
d085	work/plans/0533-a-match-is-identified-by-its-shape-and-old-baselines-migrate.md:106	spike 0394	work/spikes/0394-the-phase-2-design-for-a-file-aware-baseline.md	right	Spike 0394 decision 2 is rootless baselines, named at line 110
d086	work/bugs/fixed/0409-md-mermaid-blames-the-author-for-a-grammar-gap.md:92	plan 0413	work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md	right	Title matches
d087	work/plans/completed/0454-box-marks-are-the-callers.md:338	Bug 0445	work/bugs/fixed/0445-a-checkbox-state-other-than-space-or-x-is-invisible.md	right	Bug 0445 was fixed in PR #240 with plan 0454
d088	work/plans/completed/0456-kernel-notexist-and-dead-glob.md:1110	Bug 0460	work/bugs/fixed/0460-the-kernel-exempts-a-cardinality-rule-before-it-looks-for-a-dead-glob.md	right	Bug 0460 was fixed in PR #239 with plan 0456
d089	work/proposals/016-eess-py-a-python-dialect.md:713	ADR-017	adr/017-a-heritage-predicate-names-a-relation-not-a-clause.md	right	The ADR-017 note is the extend/implement meanings at line 345
d090	work/bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md:52	ADR-011	adr/011-the-kernels-public-api-is-explicit.md	right	ADR-011 governs the kernel's public surface
d091	work/bugs/fixed/0276-the-dialects-re-export-the-receipt-constructors-unevenly.md:14	ADR-014	adr/014-the-emitter-refuses-a-verdict-without-evidence.md	right	ADR-014 names one kernel constructor and one merge
d092	work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:579	ADR-014	adr/014-the-emitter-refuses-a-verdict-without-evidence.md	right	Plan 0263's title is ADR-014's residual enforcement rows
d093	work/plans/completed/0486-a-predicate-that-cannot-judge-says-so.md:114	ADR-021	adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md	right	Plan 0486 builds ADR-021
d094	work/plans/completed/0448-a-bun-load-guard-and-bug-0439s-fix.md:173	bug 0439	work/bugs/fixed/0439-the-family-fails-to-load-under-bun-from-eess-0-5-1.md	right	Plan 0448's title names bug 0439's fix
d095	work/bugs/0271-one-rule-file-fact-two-spellings-across-the-dialects.md:11	bug 0269	work/bugs/fixed/0269-eess-mermaids-check-door-greenlights-a-builder-that-enforces-nothing.md	right	Bug 0269's fix created eess-mermaid's contributed-no-rules spelling, 2026-09-07
d096	work/plans/0532-a-baseline-entry-matches-only-the-file-it-was-written-for.md:262	plan 0533	work/plans/0533-a-match-is-identified-by-its-shape-and-old-baselines-migrate.md	right	Plan 0533 owns those decisions (its items 10 and 11)
d097	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md:136	ADR-015	adr/015-the-kernel-extends-resolution-never-execution.md	right	Title matches
d098	work/plans/completed/0405-md-select-the-links-a-block-declares.md:9	plan 0406	work/plans/completed/0406-md-a-declared-link-is-answered.md	right	Linked at line 17 of the same file
d099	work/plans/ROADMAP.md:54	bug 0220	work/bugs/0220-nothing-requires-a-public-symbol-to-be-documented.md	right	Roadmap row in this repo; bug 0220 is the doc-coverage gate
d100	work/bugs/fixed/0525-a-box-mark-can-be-declared-only-open-or-done.md:63	ADR-021	adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md	right	Title matches
d101	work/bugs/fixed/0333-the-recommended-floor-reads-functions-only.md:37	bug 0321	work/bugs/fixed/0321-function-positions-no-function-rule-reads.md	right	Bug 0321 is about unread function positions
d102	work/plans/completed/0495-a-value-agrees-with-its-folder.md:634	Plan 0498	work/plans/0498-honestyatclose-places-a-record-with-block-5.md	right	Plan 0498 is honestyAtClose's rebuild, the only planned caller
d103	work/bugs/0347-the-always-loaded-index-does-not-reach-the-doctrine-digest.md:26	bugs 0138	work/bugs/0138-pointer-resolve-proves-existence-not-truth.md	right	Title matches; author says this repo's own
d104	work/bugs/fixed/0499-corpus-does-not-check-its-frozen-globs.md:17	plan 0456	work/plans/completed/0456-kernel-notexist-and-dead-glob.md	right	Plan 0456 added cardinalitySelectorFault
d105	work/plans/0533-a-match-is-identified-by-its-shape-and-old-baselines-migrate.md:256	bug 0159	work/bugs/0159-violation-identities-collide-across-distinct-findings.md	right	Bug 0159 lists the collisions
d106	work/plans/0532-a-baseline-entry-matches-only-the-file-it-was-written-for.md:119	plan 0533	work/plans/0533-a-match-is-identified-by-its-shape-and-old-baselines-migrate.md	right	Plan 0533 owns --migrate
d107	work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:18	spike 0395	work/spikes/0395-what-an-accepted-entry-without-a-file-does-under-per-file-grouping.md	right	Spike 0395 opened for plan 0346's Phase 2 after spike 0394; not yet run
d108	work/plans/0498-honestyatclose-places-a-record-with-block-5.md:194	ADR-022	adr/022-eess-mds-root-fixes-no-documents-shape.md	right	ADR-022 decides where honestyAtClose lives
d109	work/spikes/0386-strings-that-name-code.md:66	bug 0355	work/bugs/fixed/0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md	right	Title restates the author's sentence
d110	work/plans/0498-honestyatclose-places-a-record-with-block-5.md:100	plan 0495	work/plans/completed/0495-a-value-agrees-with-its-folder.md	right	Plan 0495 records D8 at its line 443
d111	work/bugs/fixed/0108-work-readme-lanes-table-lists-one-lane.md:196	Plan 0259	work/plans/0259-a-lifecycle-for-the-proposals-lane.md	right	Linked at line 190 of the same file
d112	work/bugs/0480-codeblocks-checks-only-a-globs-text-on-an-absence-rule.md:5	plan 0456	work/plans/completed/0456-kernel-notexist-and-dead-glob.md	right	Plan 0456 built the selector-fault checks
d113	work/bugs/BUGS.md:451	plan 0346	work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md	right	Plan 0346's status lists plan 0532 as a child of the split
d114	work/bugs/BUGS.md:276	ADR-015	adr/015-the-kernel-extends-resolution-never-execution.md	right	ADR-015 is the rule-file loader ADR
d115	work/plans/completed/0496-sections-as-elements.md:713	bug 0507	work/bugs/fixed/0507-a-boxs-text-stops-at-its-first-paragraph.md	right	Bug 0507 was fixed in the same PR as plan 0496
d116	work/bugs/fixed/0247-the-source-text-guard-checks-nul-but-not-utf8.md:206	bug 0086	work/bugs/fixed/0086-links-to-directories-do-not-resolve.md	right	The mention on line 206 is 'this repo's bug 0086', which the author links to the target; the branch's quoted one starts on line 205
d117	work/bugs/0434-diagramkind-reads-a-lone-cr-as-no-line-end.md:7	plan 0413	work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md	right	Bug recorded while building plan 0413 (mermaidParser)
d118	work/plans/completed/0505-a-field-read-inside-a-named-section.md:50	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	right	Plan 0469 built the header region's findings
d119	work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:696	plan 0533	work/plans/0533-a-match-is-identified-by-its-shape-and-old-baselines-migrate.md	right	Plan 0533's Out of scope says exactly that about bug 0391
d120	work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:777	spike 0394	work/spikes/0394-the-phase-2-design-for-a-file-aware-baseline.md	right	Spike 0394 is plan 0346's Phase 2 spike
d121	work/plans/completed/0145-crossvalidate-stale-wip-detection.md:170	bug 0112	work/bugs/0112-three-crossval-presets-have-no-fixture.md	right	Bug 0112 enumerates the unfixtured crossval presets
d122	work/plans/0532-a-baseline-entry-matches-only-the-file-it-was-written-for.md:99	spike 0394	work/spikes/0394-the-phase-2-design-for-a-file-aware-baseline.md	right	Plan 0532 builds spike 0394's Phase 2 design
d123	work/bugs/0408-a-label-without-its-colon-is-neither-read-nor-reported.md:89	ADR-016	adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md	right	ADR-018 names ADR-016 in prose (contradicts ADR-016); this repo's Extends relation
d124	work/proposals/016-eess-py-a-python-dialect.md:588	ADR-017	adr/017-a-heritage-predicate-names-a-relation-not-a-clause.md	right	ADR-017 rules an ancestor at any depth
d125	work/plans/completed/0148-workspace-multi-root-awareness.md:69	bugs 0033	ts-archunit:bugs/fixed/0033-assignedFrom-does-not-accept-a-project-relative-glob.md	right	Plan 0147 copied ts-archunit's delta; eess has no bug 0033; the slice glob bug is ts-archunit's 0033
d126	work/bugs/0463-a-mermaid-notexist-over-an-empty-diagram-passes.md:25	plan 0456	work/plans/completed/0456-kernel-notexist-and-dead-glob.md	right	Plan 0456 added the md empty-source check
d127	work/spikes/0428-where-mermaid-puts-an-errors-line.md:74	plan 0413	work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md	right	Spike 0428 was measured for plan 0413, per its opening
d128	work/bugs/BUGS.md:452	spike 0386	work/spikes/0386-strings-that-name-code.md	right	Spike 0386 measured 2026-10-05 and covers exclusions, bug 0387's subject
d129	work/proposals/016-eess-py-a-python-dialect.md:77	spike 0417	work/spikes/0417-which-engine-reads-python-for-eess-py.md	right	Linked at line 66 of the same file
d130	work/plans/0534-the-adr-a-finding-is-identified-by-the-code-it-matched.md:146	plan 0346	work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md	right	Plan 0534 is plan 0346's Phase 4 child
d131	work/plans/0533-a-match-is-identified-by-its-shape-and-old-baselines-migrate.md:95	plan 0346	work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md	right	Plan 0533 carries plan 0346's Phase 3 decisions
d132	work/bugs/0450-under-bun-the-resolve-hook-call-would-throw-a-bare-typeerror.md:14	bug 0439	work/bugs/fixed/0439-the-family-fails-to-load-under-bun-from-eess-0-5-1.md	right	Bug 0450 recorded at plan 0448's close, which fixed bug 0439
d133	work/spikes/0485-what-a-predicate-that-cannot-judge-does-to-a-rule.md:4	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	right	Title matches
d134	work/plans/completed/0235-the-emitter-takes-a-receipt.md:246	ADR-014	adr/014-the-emitter-refuses-a-verdict-without-evidence.md	right	Plan 0235 implements ADR-014; throwIfViolations is its row
d135	work/plans/completed/0406-md-a-declared-link-is-answered.md:49	bug 0400	work/bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md	right	Bug 0400 is about a one-way correspondence's examined count
d136	work/plans/0533-a-match-is-identified-by-its-shape-and-old-baselines-migrate.md:66	plan 0346	work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md	right	Plan 0533 carries plan 0346's Phase 1 decisions
d137	work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:454	bug 0185	work/bugs/fixed/0185-a-kernel-break-reaches-adopters-as-a-dialect-patch.md	right	Bug 0185 requires naming dependents
d138	work/proposals/016-eess-py-a-python-dialect.md:102	ADR-012	adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md	right	Title matches
d139	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md:312	plan 0413	work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md	right	Title matches
d140	work/plans/completed/0456-kernel-notexist-and-dead-glob.md:925	bug 0462	work/bugs/fixed/0462-a-notexist-whose-evaluate-is-replaced-keeps-its-exemption.md	right	Bug 0462's fix is marksAssertsCardinality freezing, in plan 0456's PR
d141	work/proposals/014-crossvalidate-tests-in-any-language.md:208	bug 0135	work/bugs/0135-graphql-resolver-binding-is-a-text-grep.md	right	Bug 0135 is the text-grep binding bug
d142	work/plans/completed/0142-bind-proposals-to-plans.md:212	bug 0141	work/bugs/fixed/0141-no-check-binds-accepted-proposals-to-plans.md	right	Plan 0142's title names bug 0141; linked at its line 9
d143	work/plans/completed/0456-kernel-notexist-and-dead-glob.md:890	Bug 0355	work/bugs/fixed/0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md	right	Bug 0355 ruled the disk discriminator
d144	work/plans/ROADMAP.md:58	spike 0394	work/spikes/0394-the-phase-2-design-for-a-file-aware-baseline.md	right	Roadmap row for plan 0346; spike 0394 is its Phase 2 design
d145	docs/markdown.md:1621	bug 0120	work/bugs/0120-no-state-and-cannot-find-it-are-the-same-answer.md	right	Title restates the sentence
d146	docs/presets.md:288	bug 0338	work/bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md	right	Title restates the limit described
d147	work/bugs/BUGS.md:269	ADR-014	adr/014-the-emitter-refuses-a-verdict-without-evidence.md	right	ADR-014's enforcement rows cover evidence-free builders at every door
d148	work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:774	plan 0533	work/plans/0533-a-match-is-identified-by-its-shape-and-old-baselines-migrate.md	right	Plan 0533 is plan 0346's Phases 1 and 3 child
d149	work/bugs/fixed/0284-a-declared-vocabulary-disjoint-from-its-terminal-set-turns-the-gate-off.md:13	bugs 0282	work/bugs/rejected/0282-the-kit-teaches-a-state-vocabulary-its-own-gate-rejects.md	right	Bug 0282 filed and rejected 2026-09-12, the same day; same vocabulary subject
d150	work/bugs/fixed/0502-links-and-tables-read-a-heading-in-a-list-differently.md:112	Plan 0503	work/plans/completed/0503-in-sections-boxes-by-section.md	right	Title matches
d151	work/plans/completed/0495-a-value-agrees-with-its-folder.md:268	ADR-018	adr/018-a-string-that-names-code-is-resolved-or-the-rule-says-why-not.md	right	ADR-018 is Proposed and about resolving globs and strings
d152	work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md:114	plan 0456	work/plans/completed/0456-kernel-notexist-and-dead-glob.md	right	Plan 0456 added globs forwarding and the fault hook
d153	work/plans/completed/0455-a-corpus-built-from-text.md:140	plan 0458	work/plans/completed/0458-the-examples-gate-a-document-shape-from-public-blocks-only.md	right	Title matches
d154	work/plans/completed/0486-a-predicate-that-cannot-judge-says-so.md:200	ADR-021	adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md	right	Plan 0486 builds ADR-021
d155	adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md:61	ADR-017	adr/017-a-heritage-predicate-names-a-relation-not-a-clause.md	right	ADR-017 set the one-word-one-meaning rule
d156	work/plans/completed/0469-havefield-a-document-has-a-value.md:289	plan 0470	work/plans/completed/0470-a-lifted-predicate-carries-its-findings.md	right	Linked at line 280 of the same file
d157	work/bugs/0225-family-re-export-completeness-is-import-driven.md:106	ADR-011	adr/011-the-kernels-public-api-is-explicit.md	right	ADR-011 moved family plumbing behind /internal
d158	work/spikes/0001-eess-over-ts-archunit/CONCLUSION.md:144	bug 0086	work/bugs/fixed/0086-links-to-directories-do-not-resolve.md	wrong	Pre-renumbering number; the note says the NUL-bytes work landed as 0099 and 0144
d159	work/proposals/016-eess-py-a-python-dialect.md:243	Spike 0418	work/spikes/0418-where-python-architecture-tools-pass-on-a-broken-rule.md	right	Spike 0418's Not measured lists agent-actionability
d160	work/proposals/017-md-blocks-to-check-a-documents-shape.md:1002	plan 0496	work/plans/completed/0496-sections-as-elements.md	right	Plan 0496 linked in the 11, 3, 14, 15 row above
d161	work/plans/completed/0235-the-emitter-takes-a-receipt.md:768	bug 0206	work/bugs/fixed/0206-deliver-bypasses-the-kernel-finisher-on-the-default-path.md	right	Plan 0235 closed bug 0206 in PR #108
d162	work/bugs/0120-no-state-and-cannot-find-it-are-the-same-answer.md:24	bug 0119	work/bugs/fixed/0119-placement-check-never-ran.md	right	Title restates the sentence
d163	work/proposals/016-eess-py-a-python-dialect.md:490	spike 0417	work/spikes/0417-which-engine-reads-python-for-eess-py.md	right	Same spike linked at line 66
d164	work/plans/completed/0456-kernel-notexist-and-dead-glob.md:1134	bug 0463	work/bugs/0463-a-mermaid-notexist-over-an-empty-diagram-passes.md	right	Linked under Out of scope in the same plan
d165	work/bugs/fixed/0241-archconfigerror-has-no-reader.md:12	bug 0178	work/bugs/0178-the-kernels-dead-glob-finding-cannot-fire.md	right	Linked under Related in the same file
d166	work/bugs/fixed/0502-links-and-tables-read-a-heading-in-a-list-differently.md:99	plan 0496	work/plans/completed/0496-sections-as-elements.md	right	Plan 0496 holds the corpus heading measurement
d167	work/plans/completed/0235-the-emitter-takes-a-receipt.md:51	ADR-014	adr/014-the-emitter-refuses-a-verdict-without-evidence.md	right	Title matches
d168	work/proposals/PROPOSALS.md:194	ADR-014	adr/014-the-emitter-refuses-a-verdict-without-evidence.md	right	The evidence gate is ADR-014's mechanism
d169	work/plans/0534-the-adr-a-finding-is-identified-by-the-code-it-matched.md:28	spikes 0350	work/spikes/0350-which-baseline-identity-survives-the-right-edits.md	right	Spike 0350 measured identity for bug 0338
d170	work/bugs/fixed/0499-corpus-does-not-check-its-frozen-globs.md:6	plan 0481	work/plans/completed/0481-this-repository-dogfoods-notexist.md	right	Plan 0481's status names the same branch and bugs
d171	work/plans/completed/0059-cross-validation-eess-crossvalidate.md:89	plan 0022	ts-archunit:plans/completed/0022-cross-layer-validation.md	right	ts-archunit plan 0022 built crossLayer; eess has no plan 0022
d172	work/plans/0213-diagram-provenance-for-fence-callers.md:46	Bug 0211	work/bugs/0211-diagram-sniffs-its-input-and-reads-arbitrary-files.md	right	Title matches
d173	work/proposals/006-mermaid-beyond-classdiagram.md:259	bug 0211	work/bugs/0211-diagram-sniffs-its-input-and-reads-arbitrary-files.md	right	Linked at line 248 of the same file
d174	work/proposals/PROPOSALS.md:322	plan 0216	work/plans/completed/0216-dogfood-the-proposals-lane.md	right	Plan 0216 gated the proposals board; named at line 311
d175	work/plans/completed/0456-kernel-notexist-and-dead-glob.md:616	bug 0462	work/bugs/fixed/0462-a-notexist-whose-evaluate-is-replaced-keeps-its-exemption.md	right	Bug 0462 is the frozen notExist bug fixed with plan 0456
d176	work/bugs/fixed/0419-a-waiver-in-a-gherkin-doc-string-suppresses-a-real-finding.md:101	ADR-012	adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md	right	ADR-012 owns the exclusion-comment parser and masker
d177	work/plans/completed/0469-havefield-a-document-has-a-value.md:306	plan 0468	work/plans/completed/0468-fields-read-a-labelled-value-in-the-callers-forms.md	right	Plan 0468 built the header region; linked at line 15
d178	work/bugs/0512-a-section-name-inside-a-kernel-combinator-is-not-scanned.md:14	plan 0503	work/plans/completed/0503-in-sections-boxes-by-section.md	right	Linked at line 6 of the same file
d179	work/bugs/0440-eess-ts-watch-mode-reads-a-stale-sibling-under-bun.md:9	spike 0438	work/spikes/0438-what-the-family-does-under-bun.md	right	Linked at line 5 of the same file
d180	work/plans/completed/0406-md-a-declared-link-is-answered.md:219	ADR-016	adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md	right	ADR-016's header carries Extends as a list item
d181	work/bugs/0408-a-label-without-its-colon-is-neither-read-nor-reported.md:92	plan 0406	work/plans/completed/0406-md-a-declared-link-is-answered.md	right	Plan 0406 keeps Proposed ADR-018 out of the Extends rule
d182	work/proposals/017-md-blocks-to-check-a-documents-shape.md:217	bugs 0197	work/bugs/0197-nothing-binds-a-board-status-to-the-records-state.md	right	Title matches
d183	work/bugs/fixed/0419-a-waiver-in-a-gherkin-doc-string-suppresses-a-real-finding.md:101	ADR-012	adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md	right	ADR-012 is the masker ADR; quoted property is its text
d184	work/bugs/0181-link-checks-cover-one-package-of-six.md:18	Bug 0179	work/bugs/fixed/0179-adopted-doc-tests-resolve-the-repo-root-one-level-short.md	right	Bug 0181 found in the review of the bug 0179 fix, per its header
d185	work/bugs/fixed/0287-four-copies-of-one-fence-lexer-across-three-packages.md:261	ADR-011	adr/011-the-kernels-public-api-is-explicit.md	right	Title matches
d186	work/bugs/BUGS.md:395	bugs 0465	work/bugs/fixed/0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md	right	Bug 0465 is linked in the row above
d187	work/bugs/0271-one-rule-file-fact-two-spellings-across-the-dialects.md:70	ADR-014	adr/014-the-emitter-refuses-a-verdict-without-evidence.md	right	ADR-014 names the emitter finding ids
d188	work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md:629	bug 0174	work/bugs/0174-eess-ts-reports-a-clean-gate-with-no-denominator.md	right	Bug 0174 is the missing-denominator bug
d189	work/plans/completed/0089-family-standalone-sufficiency.md:212	plan 0148	work/plans/completed/0148-workspace-multi-root-awareness.md	right	Title matches
d190	work/bugs/fixed/0444-honesty-at-close-reads-state-only-and-says-nothing.md:5	bugs 0467	work/bugs/fixed/0467-eess-ts-expectnonempty-does-nothing.md	right	Bug 0467's status names the same PR and bug 0444
d191	adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md:115	Bug 0227	work/bugs/0227-eess-ts-is-silent-on-a-malformed-exclusion-start.md	right	Bug 0227 is the divergence between the two exclusion parsers ADR-012 unifies
d192	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md:60	plan 0413	work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md	right	Mermaid conditions belong to the parser plan
d193	work/plans/0498-honestyatclose-places-a-record-with-block-5.md:7	plan 0495	work/plans/completed/0495-a-value-agrees-with-its-folder.md	right	Plan 0495's build notes record the mark and its removal
d194	work/plans/completed/0448-a-bun-load-guard-and-bug-0439s-fix.md:97	bug 0439	work/bugs/fixed/0439-the-family-fails-to-load-under-bun-from-eess-0-5-1.md	right	Plan 0448's title is bug 0439's fix
d195	work/plans/completed/0469-havefield-a-document-has-a-value.md:6	plans 0458	work/plans/completed/0458-the-examples-gate-a-document-shape-from-public-blocks-only.md	right	Plan 0458's status says the same of itself
d196	work/bugs/0277-crossvalidates-flat-entries-have-no-standalone-contract.md:14	Bug 0276	work/bugs/fixed/0276-the-dialects-re-export-the-receipt-constructors-unevenly.md	right	Bug 0277 is 0276's residual, per its status
d197	work/proposals/017-md-blocks-to-check-a-documents-shape.md:388	bug 0415	work/bugs/0415-a-plain-label-later-in-a-paragraph-is-neither-read-nor-reported.md	right	Title matches
d198	work/bugs/fixed/0223-type-module-rule-files-cannot-import-a-sibling.md:169	plan 0165	work/plans/completed/0165-integrate-the-copied-ts-archunit-engine.md	right	Plan 0165 made the jiti separate-registry measurement; this repo's plan
d199	work/plans/0533-a-match-is-identified-by-its-shape-and-old-baselines-migrate.md:58	plan 0346	work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md	right	Plan 0533 carries plan 0346's Phase 1 decisions
d200	work/plans/0532-a-baseline-entry-matches-only-the-file-it-was-written-for.md:178	plan 0346	work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md	right	Plan 0532 is plan 0346's Phase 2 child
x1	work/spikes/0001-eess-over-ts-archunit/CONCLUSION.md:121	Plan 0085	ts-archunit:plans/completed/0085-the-slice-graph-cannot-see-a-re-export.md	wrong	Pre-renumbering number from the spike's deleted branch; the note says 0084/0085 are bugs here, and ts-archunit's 0085 is unrelated
x2	work/spikes/0001-eess-over-ts-archunit/CONCLUSION.md:122	Plan 0084	ts-archunit:plans/completed/0084-cycle-detection-that-ignores-type-only-imports.md	wrong	Pre-renumbering number from the spike's branch; ts-archunit's 0084 is cycle detection
x3	work/spikes/0001-eess-over-ts-archunit/CONCLUSION.md:144	bug 0086	work/bugs/fixed/0086-links-to-directories-do-not-resolve.md	wrong	The note says this record's 0086 landed here as 0099 and 0144; the target is another bug
x4	work/spikes/0001-eess-over-ts-archunit/CONCLUSION.md:146	bug 0087	work/bugs/fixed/0087-frontmatter-parsed-as-setext-heading.md	wrong	The note maps this record's 0087 to a different live artifact; pre-renumbering number
x5	work/spikes/0001-eess-over-ts-archunit/CONCLUSION.md:161	plan 0084	ts-archunit:plans/completed/0084-cycle-detection-that-ignores-type-only-imports.md	wrong	The spike's plan 0084 is port-the-fork-to-parity; the note says no such plan exists here and ts-archunit's 0084 is unrelated
x6	work/bugs/BUGS.md:245	bug 0029	ts-archunit:bugs/fixed/0029-a-throwing-warn-truncates-the-rest-of-the-rule-file.md	right	Plan 0165 says bug 0029 (ruleFileTruncated, double print) reopened under jiti; eess has no bug 0029
```

Deferred: none. The limits found in review are recorded under "What this cannot see" in
`docs/markdown.md`; the grouped dry run and the fix in the JSON report stay
[proposal 020](../../proposals/020-a-fix-dry-run-a-reader-can-review.md)'s, and this repository's migration
[plan 0542](./0542-this-repositorys-record-mentions-are-migrated.md)'s.
