# Plan 0533: a match is identified by its shape, and an old baseline migrates without forgiving anything

## Status

- **State:** Draft — written 2026-10-20 as the fourth record of
  [plan 0346](./0346-a-finding-is-identified-by-the-code-it-matched.md)'s split ("The split", item 4):
  its Phases 1 and 3, together because Phase 1 is what moves entries, and shipping it without the
  migration would leave regenerating as the only path. Everything here was decided in plan 0346, in
  [bug 0338](../bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md)'s Fix,
  or in [spike 0394](../spikes/0394-the-phase-2-design-for-a-file-aware-baseline.md)'s Decision, and
  is cited where it was.
- **Priority:** High — a baseline accepts a different finding into a freed slot. Baseline two
  top-level `eval` calls, fix the first, add a different one, and the new one is accepted silently
  (bug 0338, in the default floor). And the migration is where this fix is honest or not: a
  regenerate re-forgives every inheritance permanently.
- **Effort:** Large, one PR. The shape term in `identifyMatches`, the `HASH_VERSION` bump, a
  `baseline --migrate` command with its report, the refusal to regenerate over an older version in
  `generateBaseline`, and the release's migration page.
- **Created:** 2026-10-20
- **Parent:** [plan 0346](./0346-a-finding-is-identified-by-the-code-it-matched.md), which closes
  when its children do.
- **Builds after:** [plan 0532](./0532-a-baseline-entry-matches-only-the-file-it-was-written-for.md),
  merged into `release/0346-phase2`: this plan's join is on what 0532 defines as a match (plan 0346,
  "The split", item 3). Its PR targets the same branch, and the branch merges to `main` once, as one
  reviewed PR carrying both changesets (spike 0394, decision 3).
- **When it closes:** in the PR that merges `release/0346-phase2` to `main`, with plan 0532, not in
  its own PR into the branch. Its own PR ticks the boxes for what it built; the merge PR moves it to
  `completed/` and ticks bug 0338's boxes, so no record reads done while `main` still holds the
  positional identity (architect review of PR #255, I4).
- **Receives:** [bug 0338](../bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md)'s
  identity — **and does not close it.** 0338 keeps its `PropertyAssignment` box, which nothing here
  addresses (plan 0346, Status). Also owns the migration of everything plan 0532 moves.

## Problem

`identifyMatches` (`packages/ts/src/conditions/match-identity.ts`) composes
`kind::filePath::getElementName(node)::matcherDescription#ordinal`. For a match with nothing named
around it, `getElementName` answers with the node's **kind**, so every such match in a file shares
one bucket and is separated only by its **position** in it. Forgive two, fix the first, add a
different one: the new one takes the freed slot, and nobody reviewed it (bug 0338, measured against
`generateBaseline` and `filterNew`).

Changing the identity moves every existing entry for an unnamed match, and plan 0532's per-file
grouping moves every entry today's code suffixed across files. The naive instruction, "regenerate
your baseline", makes the upgrade itself the deception: every finding is re-forgiven, and the ones
already inheriting are forgiven for good (plan 0346, Phase 3).

## Decisions carried, not re-made

1. **Identity comes from the matched code's AST shape. Never position, never line** (bug 0338's
   Fix; derived from the manifesto's baseline clause, ADR-009 rule 3's corollary and ADR-010). Node
   shape scored 7/7 over seven edits in [spike 0350](../spikes/0350-which-baseline-identity-survives-the-right-edits.md);
   position 5/7, raw text 6/7, line 3/7.
2. **Compose the shape in; do not replace the scope term** (plan 0346, Phase 1): the key becomes
   `kind::file::scope::sha256(shape).slice(0,16)::matcher#ordinal`. Scope discriminates across
   declarations and keeps a renumbering local; shape discriminates within a bucket. Replacing scope
   would accept `added::eval` silently after "fix `runEval`, add `added`" (plan 0346's table).
3. **Hash the shape before composing it** (plan 0346, Phase 1): delimiter safety (a string literal
   can hold `::`), ordering stops mattering, and length is moot because the identity never reaches
   the file (`hashViolation` stores a 16-character digest).
4. **The ordinal survives**: two byte-identical matches in one declaration are interchangeable, so
   forgiving one for the other is not a lie (plan 0346, Phase 1). It therefore counts within
   **(scope, shape)**, not within scope alone: keyed on scope, adding a match would still renumber
   its differently-shaped siblings (decided 2026-10-20 from the enforcement review of PR #255, item
   8; plan 0346's own justification covers byte-identical matches only).
5. **Name the ts-morph coupling as a cause, do not prevent it with a vocabulary** (plan 0346, Phase
   1): record the resolved ts-morph version beside `hashVersion`, and let `unmatchedBaselineFinding`
   offer it as a candidate cause **once the measurement says something moved**. A kind→string map is
   rejected under ADR-009 rule 5. Not blocking the identity change.
6. **The pin is `identityCollisions()`, never `new Set(ids).size`**, with three conditions: its own
   denominator (zero collisions **and** the expected finding count, in one test); filtered on the
   rule under test; and it proves within-run distinctness only, so the seven-edit table is required
   beside it (plan 0346, Phase 1).
7. **The migration carries forward exactly what is forgiven today** (plan 0346, Phase 3): read the
   old baseline, re-run, compute each finding's old-scheme and new-scheme identity, match each entry
   by its **old-scheme hash and its recorded file**, write the new-scheme one. **Not by line**
   (`BaselineEntry.line` is informational), and never a hash-only join, which would carry bug 0388
   forward.
8. **What can be seen as wrong is not carried** (plan 0346, Phase 3): an entry whose match is now in
   a different file (K) is not carried; its finding reports as new. An entry in a `#n`-suffixed slot
   (J) is matched by replaying the **old** grouping and suffixing over each whole batch, in
   production order, and is named; its stored `subject` is rewritten too. The rest (L) cannot be
   shown either way, and the command says so. The command exits non-zero while K or J is above zero.
   **It writes the new-version file even then** (decided 2026-10-20, enforcement review of PR #255,
   item 2): not writing would leave any baseline holding a `#n` slot unmigratable and push its
   adopter to the override, which re-forgives everything. Because a written file plus a one-shot
   exit code would let the J evidence vanish (a CI step with `|| true`), **each carried J entry keeps
   a visible marker in the file** naming it positional and its old slot, the same argument plan 0346
   used to refuse carrying K with a note. The marker stays until a person removes it after reading
   the entry.
   Its report reads: _"N carried; K moved files and are reported as new; J were positional and are
   named; the remaining L cannot be shown either way"_.
9. **An entry that matches no old-scheme identity is reported, not dropped** (plan 0346, Phase 3).
10. **`HASH_VERSION` is bumped**, so an unmigrated baseline can be told apart (plan 0346, Phase 3).
11. **Regenerating over an older version is refused** unless `--migrate`, or an override named in
    the flag itself, is passed. The refusal lives in `generateBaseline`, not only in the CLI: a new
    throw in public API, which the changeset says (plan 0346, Phase 3). **The override is
    `--accept-unverified`** (named here so a test can pin it; enforcement review of PR #255, item 4).
    The refusal's message states what the override costs: every entry it writes is forgiven without
    review, inheritances included. The override's own output names every entry it writes as
    unverified, with their count. After the overlap release (decision 16) the override is the only
    door left for a baseline that skipped a release, so it must say what it does.
12. **`check` against an old baseline is one finding**, "baseline is version 5; run `--migrate`",
    and eess-ts's only: the kernel baseline has no version and gains the file check only (plan 0346,
    Phase 3; spike 0394, decision 2). It has plan 0532 decision 4's properties, in full: an `error`;
    unsuppressable; kept by every filter; never recorded by a regenerate; it survives `.excluding()`
    and `--changed`; and it fails the run when every baselined rule is `.warn()` (enforcement review
    of PR #255, item 3).
13. **Rootless baselines** (spike 0394, decision 2, accepted by the maintainer 2026-10-07):
    `--migrate` on a rootless file assumes a root, **prints** the root it assumed, and **reports**,
    never forgives, every entry whose recorded file does not resolve under it. A kernel-written file
    read by eess-ts has paths relative to the baseline's directory, so `--migrate` rebases them from
    there; **this plan measures first** whether eess-ts and kernel hashes agree, and drops that case
    if they do not. This PR owns the test.
14. **One door cannot be shut, and the release notes name it**: deleting the file and generating
    afresh is indistinguishable from first use (plan 0346, Phase 3).
15. **The command does not imply correctness**: for any entry it does not name, it cannot tell a
    correctly forgiven entry from one already inheriting, and the command's own output and the
    release notes say so (plan 0346, Phase 3; ADR-009 rule 2).
16. **The old derivation ships beside the new one for one release**, and a baseline older than that
    is refused by name (plan 0346, Phase 3).
17. **`accepted` lists move too, and their remedy is the recipe, never "extend `accepted`"**
    (decided 2026-10-20, enforcement review of PR #255, item 1). `accepted` matches on
    `subjectOf(v)`, which is the `identity` when one is set, so decision 2 moves every `accepted`
    entry built from a body-analysis identity. After the upgrade such an entry stops matching and its
    finding escalates to `error`, which fails closed. But the escalation's message today tells the
    adopter to extend `accepted` with the current subjects, and pasting them re-accepts every
    inheritance, which is the regenerate deception this plan exists to stop; `--migrate` cannot
    reach rule source. So, while the old derivation ships (decision 16), an escalated finding whose
    old-scheme identity equals an entry in its rule's `accepted` list is reported with the migration
    page's recipe as its Fix, and without the "extend `accepted`" advice. The recipe is unconditional
    for identity-bearing entries, whatever spike 0395 decides for file-less ones.

## Phases

All in one PR, into `release/0346-phase2`, after plan 0532.

**Phase 1: the shape identity.** `identifyMatches` composes the hashed shape between scope and
matcher. Its callers differ and both are pinned: `body-analysis-module.ts` calls it once per file,
`body-analysis-function.ts` once per function. Rewrite `match-identity.ts`'s opening line, which
claims an identity "that is not a coordinate" for a population where it is one, and retire or
re-measure its "596 matched nodes in a real 808-file project, this is 1:1". Re-measure plan 0346's
"400 files, 4 root and 51 leaf kind names" figure, or stop resting on it: the instrument was not
kept.

**Phase 2: the ts-morph version as a cause.** Recorded beside `hashVersion`; named by
`unmatchedBaselineFinding` only when the overlap measurement says something moved.

**Phase 3: the version and the refusal.** `HASH_VERSION` bumped; `generateBaseline` refuses an
older-version file without `--migrate` or `--accept-unverified`, and says what the override costs;
the override names every entry it writes as unverified, with a count; `check` against an older file
reports one finding naming `--migrate`, with decision 12's properties. The `accepted` escalation of
decision 17. **Then re-check the no-root remedy** (plan 0346, "The split", item 4):
plan 0532's no-root finding tells the adopter to run `--migrate`; with regenerating refused, confirm
that remedy, applied, clears the finding and forgives nothing new.

**Phase 4: `baseline --migrate`.** The join, the K/J/L report, the write and the exit code, the old
grouping replayed for J, the J marker (decision 8), rootless handling (decision 13), and the cross-file entries plan 0532's per-file
grouping moved.

**Phase 5: the release's migration page and README.** With plan 0532's breaks, the release reaches
`RELEASING.md`'s threshold of three breaking changesets, so it carries a migration page covering
`--migrate`, rootless baselines and `accepted` (spike 0394, Decision). The page carries a recipe for
editing `accepted` in rule source, **unconditionally** for identity-bearing entries (decision 17):
read each escalated finding, and replace an entry only after confirming it is the finding that was
accepted. If spike 0395 keeps file-less entries from matching, the recipe covers those too. The README gains an `accepted` section
(spike 0394, Decision: no README documents it today). The page names the door that cannot be shut
and what `--migrate` cannot promise.

**Phase 6: the non-vacuity rows.** Both drive the public door, `eess-ts check` or `eess-ts baseline`
over a committed baseline file, not a library stand-in. Plan 0532's baseline-filter row gains the
same-file case:
baseline finding X, remove it, plant a different finding Y in X's old bucket (same file and kind),
require Y reported; delete the shape term and it reds. A second row reds when the refusal to
regenerate is deleted.

## Files Changed

| file                                                                              | change                                                                                                                  |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `packages/ts/src/conditions/match-identity.ts`                                    | the shape term; its docstring's two claims                                                                              |
| `packages/ts/src/conditions/body-analysis-module.ts`, `body-analysis-function.ts` | only if a caller needs the node passed differently                                                                      |
| `packages/ts/src/helpers/baseline.ts`                                             | `HASH_VERSION`, the ts-morph version field, the refusal, `check`'s one finding, the old derivation kept for one release |
| `packages/ts/src/helpers/baseline-diagnostics.ts`                                 | the ts-morph version as a candidate cause                                                                               |
| `packages/ts/src/helpers/` (a new migration module)                               | the join, the replayed old grouping, the report                                                                         |
| `packages/ts/src/cli/commands/baseline.ts`                                        | `--migrate` and `--accept-unverified`                                                                                   |
| `packages/ts/src/core/terminal-builder.ts`                                        | the `accepted` escalation's Fix for an old-scheme entry (decision 17)                                                   |
| `packages/ts/tests/conditions/match-identity.test.ts` and new test files          | the rows below                                                                                                          |
| `scripts/check-nonvacuity.mjs`, `scripts/nonvacuity/`                             | the same-file case and the refusal row                                                                                  |
| `docs/` (a new migration page), `docs/.vitepress/config.ts`, `README.md`          | Phase 5                                                                                                                 |
| `.changeset/*.md`                                                                 | eess-ts, `**Breaking**`                                                                                                 |

## Test inventory

Every red test drives `filterNew`, `check({ baseline })`, `generateBaseline` or the CLI, never
`isKnown` alone (plan 0346, Phase 2). Each row names its break class and is a planned sabotage row.

| break class                  | the test that must go red                                                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| the headline (shape term)    | baseline two top-level `eval`s, fix the first, add a different one: the new one is reported. Fails before the fix                                                                                                                          |
| the seven edits              | spike 0350's table as a test: identity survives reformatting, insertion above, comments, sibling renames and code movement; breaks when the matched code changes and on fix-one-add-another                                                |
| the ordinal's key            | a differently-shaped match inserted above another in the same declaration leaves the other's identity unchanged; mutant keys the ordinal on scope alone                                                                                    |
| scope composed, not replaced | "fix `runEval`, add `added`" with byte-identical matches in two declarations: `added::eval` reported (plan 0346's table); mutant drops the scope term                                                                                      |
| within-run distinctness      | `identityCollisions()` for the rule is empty **and** the finding count is the expected non-zero number, in one test; mutant collapses the shape to a constant                                                                              |
| bug 0338's silent-catch row  | two silent catches in one file, fix the first, add another: reported                                                                                                                                                                       |
| delimiter safety             | `eval('a::b')` and `eval('a')` in one scope have distinct identities; mutant composes the raw shape                                                                                                                                        |
| the ts-morph cause           | a recorded version that differs **and** an overlap that moved: the cause is named; a differing version with nothing moved: not named                                                                                                       |
| the version bump             | `check` against a version-5 baseline gives exactly one `error` naming `--migrate`, not N new ones; it survives `.excluding()` and `--changed`, a regenerate does not record it, and it fails a run whose baselined rules are all `.warn()` |
| the refusal, library door    | `generateBaseline` over a version-5 file throws, and its message states what `--accept-unverified` costs                                                                                                                                   |
| the override's output        | with `--accept-unverified` it writes, and its output names every entry written as unverified with their count (pinned text, not only "it writes")                                                                                          |
| `accepted` from v5           | an `accepted` entry built from a version-5 identity, after the upgrade: the finding escalates to `error`, its Fix is the migration recipe, and the message does not say "extend `accepted`"                                                |
| the refusal, CLI door        | `eess-ts baseline` over a version-5 file exits non-zero and names `--migrate`                                                                                                                                                              |
| the join keys on file        | bug 0388's fixture, then `--migrate`, then `b` is still reported (plan 0346, Phase 3's break class)                                                                                                                                        |
| the join never keys on line  | an entry whose recorded `line` now points at a different finding is carried to its own finding, not to the one at the line                                                                                                                 |
| K                            | an entry whose match moved file is not carried, its finding reports as new, and the command exits non-zero                                                                                                                                 |
| J                            | an entry in a `#n` slot is matched through the replayed old grouping, named, its `subject` rewritten; the command **writes** the file, exits non-zero, and the written entry carries the J marker, which a later `check` leaves in place   |
| L and the honest limit       | the report states N, K, J and L, and its output says the remaining L cannot be shown either way                                                                                                                                            |
| unmatched entries            | an entry that matches no old-scheme identity is reported, not dropped                                                                                                                                                                      |
| plan 0532's moved entries    | a baseline written by `main` with a cross-file `#1` suffix migrates to the per-file identity and forgives nothing new                                                                                                                      |
| rootless `--migrate`         | the assumed root is printed; an entry whose file does not resolve under it is reported, not carried                                                                                                                                        |
| kernel-written file          | rebased from the baseline's directory, if the measurement keeps the case; otherwise the measurement and the dropped case are recorded in Build notes                                                                                       |
| the no-root remedy           | plan 0532's no-root finding, then `--migrate` as it advises, then `check`: the finding is gone and nothing new is forgiven                                                                                                                 |
| one release of overlap       | a baseline older than the overlap is refused by name                                                                                                                                                                                       |
| `check:nonvacuity`           | the same-file replacement row reds with the shape term deleted; the refusal row reds with the refusal deleted                                                                                                                              |

**Sabotage matrix.** One row per line above, each mutant reverting that mechanism alone, run once in
a worktree after the commit, results recorded here.

## Release

`@nielspeter/eess-ts` minor, `**Breaking**`: every `identifyMatches` identity moves, named scopes
included, not only unnamed matches, so every body-analysis baseline entry moves; `HASH_VERSION`
moves, so `check` against an older baseline reports one finding until `--migrate` runs; a new throw
in `generateBaseline`; and **`accepted` lists in rule source that hold body-analysis identities stop
matching**, which `--migrate` cannot rewrite, so the changeset points at the page's recipe
(decision 17). The kernel is not changed by this plan (decision 12). The changeset says what
`--migrate` cannot promise and names the door it cannot shut. The integration branch's merge to
`main` carries this changeset and plan 0532's together (spike 0394, decision 3).

## Out of scope

- **The element _name_ for an object-literal match** (the `PropertyAssignment` sub-problem): stays
  on bug 0338's own box (plan 0346, Out of scope). This plan fixes its identity, not its displayed
  name or what `.excluding()` matches.
- **Sharing the name derivation with `arch-function.ts`**: the second option inside that same 0338
  box.
- **Collisions 1 and 2 of bug 0159** (`dependency.ts`, duplicate bodies): they do not call
  `identifyMatches`, so this plan does not touch them; they stay in bug 0159.
- **Bug 0391, the root scrub inside a path.** Its fix is undecided, and it is a different derivation
  (the root scrub, not the matched node). It moves hashes too and needs a migration and a
  `HASH_VERSION` decision (bug 0391, Fix). If it is decided before this plan is Ready, it can share
  this plan's version bump rather than force a second migration on adopters; deciding it is not this
  plan's.
- **The ADR**: plan 0534, written after this plan merges, so its rows cite mechanisms that exist.
- **Removing the old derivation** one release after this plan ships (decision 16): not this plan's.
  Its home depends on when the release that ships this plan is cut, so it is not given a number
  here; the release after that one removes it.

## Progress ledger

- [ ] before Ready: bug 0391 decided, or explicitly not, and recorded here, so a decided fix can share
      this plan's `HASH_VERSION` bump instead of forcing a second migration
- [ ] Phase 1 — shape composed into the identity, pinned by the seven-edit table **and** the
      cross-declaration case; `match-identity.ts`'s two claims rewritten or re-measured; the "400
      files" figure re-measured or dropped
- [ ] Phase 2 — the ts-morph version recorded beside `hashVersion`, named as a cause only once
      something moved
- [ ] Phase 3 — `HASH_VERSION` bumped; regenerating over an older version refused in
      `generateBaseline` and the CLI, without `--migrate` or `--accept-unverified`, whose cost the
      refusal states and whose output names each unverified entry; `check` gives one finding with
      decision 12's properties; the `accepted` escalation of decision 17; the no-root remedy
      re-checked with regenerating refused
- [ ] Phase 4 — `--migrate` joins on the old-scheme hash and the recorded file, never the line;
      names K and J; writes the file, exits non-zero while K or J is above zero, and marks each J
      entry; states L and what it cannot promise; handles rootless files as decision 13 says
- [ ] Phase 5 — the migration page, the README's `accepted` section, the door and the limit named
- [ ] Phase 6 — the same-file replacement row and the refusal row in `check:nonvacuity`
- [ ] the sabotage matrix run, every row red, recorded here
- [ ] bug 0338's boxes for what this plan built ticked, and this plan moved to `completed/`, in the
      PR that merges `release/0346-phase2` to `main`; the record stays open for `PropertyAssignment`
- [ ] plan 0532's `--migrate` deferral answered: the command its findings name exists
- [ ] a changeset, `**Breaking**`
- [ ] `validation-owed` — the cost measured: how many body-analysis entries move, on a real adopter baseline. This
      repository keeps no baseline (`check:baseline` runs the floor live), so the input is a third
      party's tree; it must not gate the freeze (plan 0346's ledger)
- [ ] `npm run validate` green at the PR's head

Deferred: none.
