# Bug 0359: a disk walk that gave up reports nothing, and since 0355 it decides a verdict

## Status

- **State:** Draft — measured; the mechanism and the threshold are both confirmed.
- **Severity:** High — **a gate that turns itself off, silently, for a whole
  repository**, with the threshold measured at ~3× a real adopter monorepo rather
  than the remote figure this record first estimated. Above the walk's entry budget every cardinality rule in the run
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

|                                                              | entries (after the walk's own prune list) | share of budget |
| ------------------------------------------------------------ | ----------------------------------------- | --------------- |
| `ENTRY_BUDGET` (`ts/src/core/disk-set.ts:46`)                | **50,000**                                | —               |
| this repository                                              | ~3,500                                    | 7%              |
| **an adopter's monorepo** — 15 packages, 5,815 tracked files | **16,770**                                | **34%**         |

**The adopter row is measured, and it moves this record's own estimate by an order of
magnitude.** A first version of this table carried only eess's own number and put the
threshold at "roughly 14× this repository", which reads as remote. Against a real monorepo
the budget is **about 3× away** — and a tree that has grown, or one with a generated-code
directory the prune list does not name, is inside it.

That is also exactly the population that writes ratchets: large enough to have deleted
things, and large enough that nobody reads a green. Nobody discovers this by accident; they
discover it by their ratchets having been green for a year.

**Asked for and supplied by the adopter within the hour**, after the 0.10 release note told
them to check. Worth recording as method as well as data: the number existed and nobody on
our side could produce it, because eess's own tree cannot exhibit the shape — the same limit
[spike 0345](../spikes/0345-what-it-costs-to-load-a-monorepo.md) had to state about itself.

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
- [x] **an adopter's monorepo measured at 16,770 — 34% of budget**, supplied on request
      after the 0.10 release note told them to check. The threshold is ~3× a real
      monorepo, not the ~14× this record first estimated from eess's own tree.
- [x] the adopter's own mitigation confirmed as adequate for now: 26 `.notExist()`
      instances planted against and verified red, plus four permanent `prove:rules`
      probes. That is what a run should be doing FOR them, which is this bug.
- [ ] a ruling on which shape, and on whether a verdict may depend on a bounded walk
- [ ] a red-first test: a project whose walk exhausts, asserting the run says so
- [ ] a changeset
- [ ] `npm run validate` green.

Deferred: none.
