# Plan 0550: a plain mention is fixed to the one record it names

## Status

- **State:** Draft — written 2026-10-25 for [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s
  held fix, split from [plan 0549](./0549-a-link-names-the-record-it-mentions.md) after that plan's
  second review round, shaped by adopter feedback the same day (019's addendum of 2026-10-25), and
  revised after a capped third round ("Review — 2026-10-25"). It cannot go Ready until Phase 0's
  measurements are recorded here and pass their stop rules.
- **Implements:** [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)
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
(`packages/md/src/model/resolve-link.ts:257-280`, [plan 0066](./completed/0066-eess-deterministic-autofix.md)),
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
([ADR-015](../../adr/015-the-kernel-extends-resolution-never-execution.md)): a `fix` whose `foreign`
is missing or not a `RegExp`, or one that matches the empty string (it would refuse every fix),
throws an `ArchConfigError` when the rule is built, the door `validateMentionPattern` uses for
`pattern` (`packages/md/src/model/mentions.ts:57-62`). Like `pattern`, it is read through a private
copy without `g` or `y` (`packages/md/src/model/mentions.ts:40-53`).

### 2. What is fixed, and what is refused

A finding carries an `ArchFix` only when exactly one record holds the mention's key. It is refused,
and the finding says why, when:

- two or more records hold the key (it names each candidate's target), or none does: a record moved
  under the same number reads as none, and a `key.mention` that returns `undefined` names no record
  by the caller's own key. Each is reported, never guessed;
- `foreign` matches in the text around the mention: its top-level block (the child of the document
  root that holds it, so a whole list with its parent items, a whole table with its header, a whole
  blockquote), the paragraph directly before that block when it is a list or a table, and the
  heading of each section that contains it (`sectionPathAt`, `packages/md/src/model/sections.ts:99`).
  A project's name is often only in a heading or a list's lead-in, so the mention's own sentence
  misses it. This fails safe: a match too wide costs a reader one link by hand;
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

The replacement is `[<text>](<target>)`. A path target is made relative to the mention's document by
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
narrower `records` than the join's sources. All of this is accepted, knowingly:

- adopters asked for a dry run grouped by target, and sampled, before applying. `eess-ts check --fix`
  without `--apply` is a dry run (`packages/ts/src/cli/commands/check.ts:457-469`), and the fixed
  `describe` makes it groupable on the day this ships; the docs give the pipeline:

  ```sh
  eess-ts check rules.ts --fix | grep 'would fix' | sed 's/.* → //' | sort | uniq -c | sort -rn
  ```

  A grouped dry run in the tool, and the fix in the JSON report, are
  [proposal 020](../proposals/020-a-fix-dry-run-a-reader-can-review.md);

- `foreign` refuses the qualified cases the feedback found;
- the docs say all of it, under "What this cannot see", with the dry run named as the guard.

## Phases

### Phase 0 — measured before the freeze

Three measurements over this repository and ts-archunit's record list, by throwaway scripts, recorded
here with their counts, seeds and durations. They license
[plan 0542](./0542-this-repositorys-record-mentions-are-migrated.md)'s migration of this repository,
not the fix's correctness for another project's sources; the docs say so.

1. **Anachronisms**, over every candidate fix (3,079 at [spike 0540](../spikes/0540-one-join-over-every-source.md)):
   a mention first written before the local record it would link to existed is wrong by
   construction. Its date is the mention's first appearance in its file (`git log --follow -S`,
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
   paragraph before it is shown the fix's. "Cannot tell" does not count toward the 150, drawing
   continues until 150 are decided, and its rate is reported as the share fixed unverified.

**Stop rules.** A wrong fix is classified by cause and becomes a fixture row that must carry no fix.
A cause the fix can refuse by a fact it reads amends Decision 2 once, and the sample is redrawn with
a fresh seed; a second wrong cause, or one the fix cannot read, keeps the fix held and the plan goes
back for a decision. A cannot-tell rate above 10% of draws keeps the fix held: a target a reader
cannot recover is a judgment case, which `ArchFix`'s contract (`packages/core/src/violation.ts:9-13`)
excludes.

**Files:** this plan only.

### Phase 1 — `span`

`MdMentionRef` gains `span?: { start, end }`, the match's source offsets, present only when the source
slice equals the matched text (no escape, entity, emphasis or soft break inside); reading it on an
unread mention throws the builder's UNKNOWN, through a getter of its own.

**Files:** `packages/md/src/model/phrasing.ts`, `packages/md/src/model/mentions.ts`,
`packages/md/src/builders/mentions.ts`.

### Phase 2 — the fix

`beLinked({ fix })` with Decision 2's refusals and configuration findings; the text around a mention
(its top-level block, the lead-in, the containing sections' headings) from the model; the shared path
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
mention beside a three-digit record, a moved record (each refused); a self-mention and a frozen
folder are not selected.

The round trip, applied and then judged, is not the example's: `applyFixes` is
`@nielspeter/eess/internal`'s (`packages/core/src/internal.ts:24`), and it writes the files it is
handed. It lives in `packages/md/tests/`, on a temporary copy of a disk fixture, as
`packages/md/tests/autofix.test.ts` does.

`docs/markdown.md` gains the fix, its refusals, `foreign`, the dry run as the guard with its pipeline,
and under "What this cannot see": a qualifier Decision 2 does not read, an undeclared project's
record, a fix-written link green by construction, the anachronism class, and Phase 0's licence.

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

| test                                                                                                                                                                                                                         | phase |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `span` is the source slice for a plain mention, and absent with an escape, an entity, emphasis or a soft break                                                                                                               | 1     |
| an unread mention under a predicate reading `span` is reported, not dropped                                                                                                                                                  | 1     |
| one record: a fix; applied to a temporary copy, the written target is that record's and the join is green over it                                                                                                            | 3     |
| two records: no fix, both targets named; none: no fix, said so; a key that is `undefined`: no fix, said so                                                                                                                   | 2     |
| `foreign` in the mention's paragraph, a list's parent item, a table's header, a list's lead-in, and only in a containing section's heading two levels up: each refused                                                       | 2     |
| a `g` `foreign` refuses two qualified mentions in one block; a missing `foreign` (an untyped object), a non-`RegExp` one and an empty-matching one each throw `ArchConfigError` at build                                     | 2     |
| a four-digit mention beside a three-digit record of the same value: no fix                                                                                                                                                   | 2     |
| inline code, after `!`, without a `span`, and in a table cell with a `\|` in its target: no fix                                                                                                                              | 2     |
| two mentions on one line are both fixed                                                                                                                                                                                      | 2     |
| a URL target written verbatim; a path relative to the mention's document; a path with a space in `<…>`                                                                                                                       | 2     |
| `describe` is exactly `<file>:<line> link "<mention>" → <target>`                                                                                                                                                            | 2     |
| an empty `records` is a configuration finding with or without plain mentions; keys that meet no record over linked and plain mentions alike is another; a corpus with no plain mention left and keys that meet trips neither | 2     |
| the example's rows                                                                                                                                                                                                           | 3     |

**Sabotage, before the PR:** dropping the `span` guard gives a mention with an escape a fix at the
wrong offsets; reading only the mention's own paragraph lets the heading, parent-item and table-header
qualifiers through; each must turn its test red. The exactly-one sabotage is committed (Phase 4).

## Release

| package               | bump  | why                                                    |
| --------------------- | ----- | ------------------------------------------------------ |
| `@nielspeter/eess-md` | minor | a fix option on `beLinked()`, an optional `span` field |
| every other package   | none  | nothing a consumer can observe                         |

## Out of scope

- **A dry run grouped by target, and the fix in the JSON report:** [proposal 020](../proposals/020-a-fix-dry-run-a-reader-can-review.md).
- **This repository's migration**, and how its run leaves the anachronisms out: [plan 0542](./0542-this-repositorys-record-mentions-are-migrated.md).
- **eess-md's own door to applying fixes:** [bug 0537](../bugs/0537-eess-md-alone-has-no-run-level-services.md);
  fixes are applied through `eess-ts check --fix --apply`, as `movedLinkFix`'s are.

## Review — 2026-10-25

One capped round, architect and enforcement separately, on this plan as split from
[plan 0549](./0549-a-link-names-the-record-it-mentions.md) (architect: Ship as Draft with three
Important; enforcement: Changes needed, Critical 1). Kept, not edited away:

- **Enforcement C1:** the guard named in Decision 3 was a flat dry run, while the adopters asked for
  one grouped by target and [proposal 020](../proposals/020-a-fix-dry-run-a-reader-can-review.md) records that a flat list hides the error a reader can catch.
  The fix's `describe` is now fixed with the target last, tested, and the docs give the grouping
  pipeline until [proposal 020](../proposals/020-a-fix-dry-run-a-reader-can-review.md).
- **Enforcement I2:** `foreign` read only the innermost block, missing a parent list item, a table
  header, a blockquote and a lead-in. It now reads the top-level block, the lead-in and the
  containing sections' headings; what it still does not read is named in Decision 3.
- **Enforcement I3:** `foreign` could be left out or carry `g`. It is required, read through a copy,
  and an empty-matching one is a configuration finding.
- **Architect I1:** `EXTERNAL_RE` is exported by [plan 0549](./0549-a-link-names-the-record-it-mentions.md), which builds first.
- **Architect I2:** the example cannot import `applyFixes`; the round trip moved to `packages/md/tests/`.
- **Architect I3, enforcement M1:** the committed sabotage row named a test that reads `src`; it now
  names the example's, which loads `dist`.
- **Verification pass (enforcement):** `self` gains its document, so the m2 sabotage of
  [plan 0549](./0549-a-link-names-the-record-it-mentions.md) can fire; `foreign` is refused at run
  time, not only in the type, by the thrown `ArchConfigError` `pattern` uses; Phase 0 counts what
  `foreign` refuses.
- **Minors:** an `undefined` key, the configuration findings' kind and precedence, the planted
  anachronism, one amendment before the plan goes back, the exclusion mechanism left to [plan 0542](./0542-this-repositorys-record-mentions-are-migrated.md),
  `|` in a table cell, and which headings are read.

## Progress ledger

- [ ] Phase 0 — the anachronism count, what `foreign` refuses, and the correctness sample, recorded
      and passing their stop rules
- [ ] Phase 1 — `span`
- [ ] Phase 2 — `beLinked({ fix })`, its refusals and configuration findings, the shared helper, exports
- [ ] Phase 3 — the worked example, the round trip, and docs
- [ ] Phase 4 — the committed sabotage row, its duration recorded
- [ ] Every row of the Test inventory written and green, and both sabotage rows red
- [ ] The eess-md minor changeset
