# Bug 0359: a disk walk that gave up reports nothing, and since 0355 it decides a verdict

## Status

- **State:** Draft — measured; the mechanism and the threshold are both confirmed.
- **Severity:** High — **a gate that turns itself off, silently, for a whole
  repository.** Above the walk's entry budget every cardinality rule in the run
  loses the [0355](./fixed/0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md)
  floor at once, for a reason unrelated to any of their paths, and nothing says so.
- **Origin:** enforcement review of the v0.10 pair, which found it in the comment
  that licensed it.
- **Reported:** 2026-09-29

## Symptom

`buildDiskSet` walks the repository with a budget. On exhaustion
(`packages/ts/src/core/disk-set.ts:230`):

```ts
walk(root.replaceAll('\\', '/'))
if (exhausted) return UNDETERMINED
```

`UNDETERMINED` is a single object whose `classify` answers `'not-determined'` for
**every** glob (`ts/src/core/disk-set.ts:315-317`), and the result is memoized per project. So
exhaustion is **whole-set, not per-glob**.

Since 0355, `absenceClaimIsContradicted` consumes that classification to decide
whether a `.notExist()` rule reports. `not-determined` means "stay green" — the
right policy for one unanswerable path, and the wrong outcome when it means _the
walk gave up on the entire repository_.

|                                |                                                   |
| ------------------------------ | ------------------------------------------------- |
| `ENTRY_BUDGET`                 | **50,000** dirents (`ts/src/core/disk-set.ts:46`) |
| this repository                | ~3,500 entries — about 7% of it                   |
| the threshold, in repositories | roughly 14× this one                              |

A monorepo that size is not absurd. It is also exactly the population that writes
ratchets — "this package is gone", "no one calls this any more" — because it is
large enough to have deleted things. Nobody discovers this by accident; they
discover it by their ratchets having been green for a year.

## Root cause

Two decisions that were each correct when made, and stopped being jointly correct
when 0355 shipped.

1. **The budget exists for a good reason**, and the docstring says it: an unbounded
   walk inside a 5s vitest timeout is worse than the false green the mechanism
   removes.
2. **Exhaustion was cosmetic.** `diskSet` began as message _enrichment_ — it turned
   "no match" into "this path exists and holds TypeScript, but your tsconfig keeps
   it out". Degrading to `not-determined` cost wording and nothing else. The
   docstring said exactly that, and it was true.

0355 promoted the same classification to a verdict input without revisiting the
degradation path. **The comment that made it safe is what made it invisible** —
it told every subsequent reader that nothing but message quality depended on this
number.

That comment is corrected as part of the v0.10 work; this record is the behaviour.

## Fix

Not decided. The shape is that an instrument which could not answer must say so —
ADR-009's own subject.

- **A configuration finding.** The strongest option and the most disruptive: a run
  whose disk walk exhausted reports it, unsuppressably, the way an empty project
  does. It is honest, and it fires on every rule in a large repository at once,
  which is the noise ADR-009 rule 4 warns against — one cause, many findings.
- **One finding for the project, not one per rule.** The precedent is
  `emptyProjectViolation`, which exists because the identity of that fault is the
  tsconfig rather than any glob. Exhaustion has the same shape: one walk, one
  failure, one thing to say.
- **A line in the gate summary.** Cheapest, and it is a warning — which ADR-009
  rule 1 says the primary consumer does not read. Adequate for "the walk was
  slow", not for "a gate is off".
- **Raise or remove the budget.** Does not fix it; moves it. Worth measuring what
  the walk actually costs on a large repository before assuming the budget is the
  right instrument at all.

**The open question is whether a verdict may depend on a bounded walk at all.** If
the answer is no, 0355's discriminator needs a different source of truth and this
is a redesign rather than a report. That question is why this is filed rather than
patched.

## Related

- [0355](./fixed/0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md)
  — the fix that made this classification verdict-bearing. Its ruling enumerates
  the four classifications and does not say that one of them can apply to
  everything at once.
- [0357](./fixed/0357-doctor-reports-a-healthy-ratchet-as-a-dead-glob.md) — the
  same predicate in `doctor`, so exhaustion silences the preview identically.
- [0352](./0352-disk-set-offers-the-repo-root-naming-to-a-glob-the-matcher-refuses.md)
  — the other open defect in what `disk-set` answers.

## Verification

- [x] the mechanism confirmed: whole-set `UNDETERMINED` at `ts/src/core/disk-set.ts:230`,
      `classify` answering `not-determined` for every glob at `:315-317`, memoized
      per project.
- [x] the budget read from source (50,000) and this repository measured against it
      (~7%).
- [ ] a ruling on which shape, and on whether a verdict may depend on a bounded walk
- [ ] a red-first test: a project whose walk exhausts, asserting the run says so
- [ ] a changeset
- [ ] `npm run validate` green.

Deferred: none.
