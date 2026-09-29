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

## The budget's justification is not supported — spike 0360

[Spike 0360](../spikes/0360-what-the-disk-walk-actually-costs.md) measured the walk,
because the budget is defended by a claim about time that had never been measured: "a
failing run that then hangs inside a 5s vitest timeout".

|                                        |                                        |
| -------------------------------------- | -------------------------------------- |
| the budget, 50,000 entries             | **76 ms**                              |
| 6× the budget, 316,000 entries         | **491 ms** — a tenth of the 5s timeout |
| entries needed to reach 5s             | **~3.2 million**                       |
| the adopter's monorepo, 16,770 entries | ~25 ms                                 |

Roughly **1.5 µs per entry**, linear, and the walk is performed **once per project**
(memoized on a `WeakMap`), not per rule. So the budget sits about two orders of
magnitude below what its own reasoning requires, and the price of that misplacement
is this bug.

**That does not reduce this to "raise the number."** At any budget, exhaustion still
answers `not-determined` for every glob, still means green, and still says nothing.
The two changes are independent, and only one of them is optional.

## Pruning is not the cheap lever it looks like — it trades cost for reach

An adopter enumerated every dot-directory outside `node_modules`/`.git` in their tree, with
counts. The headline is striking: **9,753 of their 16,833 entries — 58% — are `.wrangler`
tool state**, across three locations, and `.wrangler` is not on the prune list. `.terraform`
adds 144 across four roots. Extending the list would take them from 34% of budget to ~15%.

That reads as an obvious win and it is not, for a reason the module's own docstring already
states:

> The list cannot be complete — a real TypeScript monorepo may hold a Rust `target/`, a
> Python `.venv`, a `.gradle` — **which is why the entry budget below exists rather than a
> longer list.**

**And since 0355, pruning has a correctness cost it did not have before.** A pruned directory
classifies `absent`, which is the "ratchet holding" answer — silence. So every name added to
the list is a place the 0355 gate can no longer see, and the case it matters for is precisely
a file that is on disk and _not_ loaded.

**`.next` is the worked example, and it is DERIVED rather than observed.** It is on the list,
and a standard Next.js `tsconfig.json` includes `.next/types/**/*.ts`. So for a project that
runs eess over a Next app, generated route types dropped from `include` would sit on disk,
classify `absent`, and a cardinality rule over them would stay green — the exact shape 0355
exists to catch, hidden by a prune entry added when this classification only affected message
wording.

**Nobody has demonstrated it.** The adopter whose data produced this section has two Next
projects and checked: neither is an eess project — no `project()` or `workspace()` is built
over them, and the only architecture test touching them reads `.mdx` with `fs`. So the one
tree that could have tested this cannot, and the case rests on two true premises rather than
on a run. Recorded that way deliberately: this record has already been corrected once for
stating a derived number as a measured one, and the reasoning stands on its own without
being dressed up.

So the adopter's data is evidence for **moving the budget**, not for lengthening the list:
with the budget where [spike 0360](../spikes/0360-what-the-disk-walk-actually-costs.md)
measured it belongs, their 16,833 entries are under 2% of it and `.wrangler` costs ~15ms
nobody notices.

**The one addition safe on its own terms** is a directory no tsconfig can include — IDE and
agent state (`.idea`, `.serena`, `.playwright-mcp`). The adopter drew that line themselves
and drew it correctly: they excluded `.claude` and `.github` from their own suggestion,
because `.claude/` holds their project's skills and docs. Worth recording as the test for any
future entry: **not "is it tool output" but "can a tsconfig include it".**

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
- **Move the budget to where its justification puts it.** Measured in 0360: between
  500,000 and 1,000,000 entries is 0.8–1.5s warm, which puts every realistic
  repository inside it. **Not unbounded** — the cold-cache cost is unmeasured and a
  bound nobody can reach is still a bound. This does not fix the silence; it makes
  the silence unreachable in practice, which is a different and lesser thing.

**The open question is whether a verdict may depend on a bounded walk at all.** If
the answer is no, 0355's discriminator needs a different source of truth and this is
a redesign rather than a report.

0360 makes that question **less pressing and does not answer it**: with the budget
where its justification puts it and exhaustion reported, the bound sits far from any
real tree and reaching it is stated rather than silent. It stays open here rather
than being declared closed by a number — a bound that is merely hard to reach is
still a bound, and this project's whole subject is what happens at the edge nobody
tests.

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
- [x] the budget's justification measured, and found unsupported —
      [spike 0360](../spikes/0360-what-the-disk-walk-actually-costs.md): 50,000
      entries costs 76 ms against a 5s claim.
- [x] the prune list weighed as an alternative lever and found to trade cost for reach —
      `.next` is already over-pruned for a Next.js project, and since 0355 every prune entry
      is a place this gate cannot see.
- [ ] a ruling on which shape, and on whether a verdict may depend on a bounded walk
- [ ] a red-first test: a project whose walk exhausts, asserting the run says so
- [ ] a changeset
- [ ] `npm run validate` green.

Deferred: none.
