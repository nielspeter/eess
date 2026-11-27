# Plan 0660: the fixture proofs run side by side on one machine

## Status

- **State:** Draft — filed 2026-11-27 at the maintainer's request; rewritten the same day so it can
  be built from this page alone. Nothing here is measured beyond the times in Problem; the gain is
  an estimate until Phase 0.
- **Priority:** Low — it changes how long a developer waits, not what a green run means. CI already
  runs the gate as shards.
- **Effort:** Medium. The harness assumes one working tree, and a faithful copy of a working tree
  is the hard part.
- **Created:** 2026-11-27
- **Builds on:** [plan 0509](./completed/0509-shard-check-nonvacuity-in-ci.md), which split the
  gate into shards and a merge for CI.

## Problem

`check:nonvacuity` is most of what `npm run validate` costs, and on a developer's machine it runs
one fixture at a time.

- [Spike 0366](../spikes/0366-where-validate-spends-its-time.md) measured it at 359 s of a
  7.8-minute chain, 77%.
- [Spike 0631](../spikes/0631-where-ci-time-goes.md) and
  [spike 0546](../spikes/0546-where-a-corpus-check-spends-its-time.md) measured the same gate in CI,
  where [plan 0509](./completed/0509-shard-check-nonvacuity-in-ci.md) runs it as four shards on
  four runners.
- Measured 2026-11-27 on this repository (Linux, 12 cores): the 13 architecture rows alone take
  226 s in sequence, and one `eess-ts check arch.rules.ts` peaks at 0.9 GB.

The shards cannot simply be started together locally. A fixture plants a probe file in the real
source tree, or edits a real file, runs the real gate, and restores it. Two fixtures in one tree
at once would each see the other's probe.
[Bug 0231](../bugs/fixed/0231-a-killed-nonvacuity-run-leaves-an-invisible-probe-that-reds-other-gates.md)
is what one leftover probe already does to the gates beside it.

## Design

Each shard runs in its own copy of the tree, and the existing merge step checks the split exactly
as it does in CI.

### What already exists, and is reused unchanged

`scripts/lib/nonvacuity-shards.mjs` and `scripts/check-nonvacuity.mjs` already do everything but
make the copies:

| what                                         | how CI asks for it today                                  |
| -------------------------------------------- | --------------------------------------------------------- |
| run shard _i_ of _N_                         | `EESS_NONVACUITY_SHARD=i/N`                               |
| write what the shard ran                     | `EESS_NONVACUITY_REPORT=<file>`                           |
| check every fixture ran in exactly one shard | `EESS_NONVACUITY_MERGE=<directory holding the N reports>` |

A local run is the CI run with the runners replaced by directories: N processes, each with its own
working directory and its own two variables, then one merge over the collected reports.

### What a copy must be

A copy is right when a gate run inside it gives the answer it would give in the working tree. That
is four requirements, and each has broken something in this repository before:

1. **It holds the working tree as it stands.** Uncommitted edits and untracked files included: the
   gate must judge what the developer is about to commit, not the last commit.
2. **It is a git repository.** Several gates ask git which files exist or what changed against a
   base. A plain directory copy with no `.git` answers them wrongly or not at all.
3. **Its workspace links point into itself.** `node_modules/@nielspeter/*` are relative links to
   `packages/*`. A copy that shares the original's `node_modules` by one link resolves those into
   the original tree, so a probe planted in the copy would be judged against the original's
   packages. Each copy needs its own `node_modules/@nielspeter` links; everything else in
   `node_modules` can be shared.
4. **It holds each package's `dist`.** The gates run the built CLIs.

**The copy this plan takes:** a detached git worktree outside the repository's directory, with the
working tree's uncommitted state laid over it, a `node_modules` directory whose entries link to
the original's except for the workspace packages, and each `dist` copied. Phase 0 proves or
replaces it.

**Outside the repository's directory, deliberately.** Several gates walk the tree from its root. A
copy inside it would be read by them as part of the corpus.

### Rules the script keeps

- **A plain run stays what it is.** `npm run check:nonvacuity` with nothing set runs the whole set
  in one tree, in sequence. The side-by-side run is a separate script.
- **The developer's working tree is never written.** Probes are planted only in copies, so a killed
  run leaves the working tree as it was.
- **Copies are removed whatever the outcome**, and a copy left by a killed run is recognised by the
  process id in its name and removed on the next run, as `packages/ts/vitest.config.ts` already
  does for its own probe directories.
- **The merge is never skipped or softened.** A missing report reds the run, as it does in CI.

### Decisions left for Phase 0

- **Whether the copy above is faithful.** One check decides it: plant a violating file in copy 1
  only, run the same gate in copies 1 and 2, and require copy 1 red and copy 2 green.
- **How many copies.** Four matches CI. More may not help: four checks at 0.9 GB each already use
  3.6 GB, and one check uses more than one core for part of its run.

## Phases

### Phase 0: measure (time-boxed, about an hour)

No file in the repository changes.

- Make four copies by hand, as described, and record what one costs to create.
- Run the faithfulness check above.
- Run the four shards side by side and record the wall-clock time beside a sequential run on the
  same tree.
- **Stop rule:** if the whole run, copies included, is not under half the sequential time, close
  this plan `Won't-do` with the measurement.

### Phase 1: the script

- `scripts/check-nonvacuity-parallel.mjs` (new): make the copies, run the shards in them, collect
  the reports, run the merge, remove the copies.
- `scripts/lib/tree-copy.mjs` (new) and its `node --test` file: making and removing one copy.
- `package.json`: a `check:nonvacuity:parallel` script.
- It prints each shard's time and the total.

### Phase 2: the developer's chain

- Decide, from Phase 1's numbers, whether `npm run validate` uses it. This phase may end with the
  script left as an opt-in.
- `CLAUDE.md`: the new script, in the section that lists the gates.

## Test inventory

- A file planted in one copy is not visible in another, and not in the working tree.
- A copy holds an uncommitted edit and an untracked file from the working tree.
- A copy's `node_modules/@nielspeter/eess` resolves inside the copy.
- The merge reds when one copy's report is missing.
- A run whose copy cannot be made fails, and says which copy.
- After an interrupted run, the working tree holds no probe file and the next run removes the
  leftover copies.

## Out of scope

- Making one fixture faster. That is
  [plan 0659](./0659-md-a-parsed-document-is-read-back-when-its-text-is-unchanged.md) for the
  corpus rows and [proposal 029](../proposals/029-ts-rules-are-judged-on-facts-and-the-project-loads-only-when-a-rule-needs-it.md)
  for the architecture rows.
- Changing how CI runs the gate.
- Changing which fixtures exist or what each proves.

## Progress ledger

- [ ] Phase 0: measured, and the two open questions decided
- [ ] Phase 1: the side-by-side script
- [ ] Phase 2: decided whether `validate` uses it

Deferred: none
