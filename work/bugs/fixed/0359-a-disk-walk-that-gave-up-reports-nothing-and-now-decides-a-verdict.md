# Bug 0359: a disk walk that gave up reports nothing, and since 0355 it decides a verdict

## Status

- **State:** Fixed — the walk that gives up now says so, names what consumed it, and the
  budget sits where its own justification puts it. Two spikes settled the shape (0367) and
  the message (0368); the fix also closed a second, invisible instance of this bug's own
  thesis — a walk of the entire filesystem root. One item deferred to
  [0369](../0369-the-prune-list-has-no-extension-point.md).
- **Severity:** High — **a gate that turns itself off, silently, for a whole
  repository**, with the threshold measured at ~3× a real adopter monorepo rather
  than the remote figure this record first estimated. Above the walk's entry budget every cardinality rule in the run
  loses the [0355](./0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md)
  floor at once, for a reason unrelated to any of their paths, and nothing says so.
- **Origin:** enforcement review of the v0.10 pair, which found it in the comment
  that licensed it.
- **Reported:** 2026-09-29

## Symptom

`buildDiskSet` walks the repository with a budget. On exhaustion
(`packages/ts/src/core/disk-set.ts:299`):

```ts
walk(root.replaceAll('\\', '/'))
if (exhausted) return UNDETERMINED
```

`UNDETERMINED` is a single object whose `classify` answers `'not-determined'` for
**every** glob (`ts/src/core/disk-set.ts:384`), and the result is memoized per project. So
exhaustion is **whole-set, not per-glob**.

Since 0355, `absenceClaimIsContradicted` consumes that classification to decide
whether a `.notExist()` rule reports. `not-determined` means "stay green" — the
right policy for one unanswerable path, and the wrong outcome when it means _the
walk gave up on the entire repository_.

|                                                              | entries (after the walk's own prune list) | share of budget |
| ------------------------------------------------------------ | ----------------------------------------- | --------------- |
| `ENTRY_BUDGET` (`ts/src/core/disk-set.ts:68`)                | **50,000**                                | —               |
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
[spike 0345](../../spikes/0345-what-it-costs-to-load-a-monorepo.md) had to state about itself.

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

[Spike 0360](../../spikes/0360-what-the-disk-walk-actually-costs.md) measured the walk,
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
with the budget where [spike 0360](../../spikes/0360-what-the-disk-walk-actually-costs.md)
measured it belongs, their 16,833 entries are under 2% of it and `.wrangler` costs ~15ms
nobody notices.

**The one addition safe on its own terms** is a directory no tsconfig can include — IDE and
agent state (`.idea`, `.serena`, `.playwright-mcp`). The adopter drew that line themselves
and drew it correctly: they excluded `.claude` and `.github` from their own suggestion,
because `.claude/` holds their project's skills and docs. Worth recording as the test for any
future entry: **not "is it tool output" but "can a tsconfig include it".**

## Fix

**Decided by two spikes.**
[0367](../../spikes/0367-must-the-disk-question-walk-the-whole-repo.md) settled that this is a
report rather than a redesign;
[0368](../../spikes/0368-what-the-exhaustion-finding-can-tell-an-adopter-to-do.md) settled what
the report must SAY, and reordered the fix. The shape is that an instrument which could not
answer must say so — ADR-009's own subject — and that what it says must be actionable, which
is ADR-009 rule 2.

**In measured priority order:**

1. **Report exhaustion, NAMING the top consuming directories.** Not "your repository is too
   large", which is unactionable and would make this a new unsuppressable finding with no
   achievable exit — 0362's defect one layer up.

   **One report, not N, and the mechanism is not the one this record first named.**
   `emptyProjectViolation` is one finding **per rule** — measured, three rules over an empty
   project give three findings ([0368 Result 4](../../spikes/0368-what-the-exhaustion-finding-can-tell-an-adopter-to-do.md));
   the "one finding for the project" claim below was asserted from its name. What actually
   delivers it is `dedupeConfigFindings`, which keys on `(ruleId ?? rule, element)` and states
   its own fan-out: give the exhaustion finding a **project-constant identity** (a fixed `rule`
   label, the repository root as `element`) and N rules collapse to one report. Precision that
   must reach the message: that collapse happens in `check-all.ts`, the **CLI** path, so a direct
   `violations()` caller still sees one per rule — which is right, since each of those rules
   really did lose its floor.

2. **Extend the prune list.** The biggest single win, and this record did not consider it.
   Pruning already removes **88.9%** of entries; the list names 15 directories and misses 17
   ordinary generated ones, including `.wrangler` — which was **58% of the entries** in the
   adopter monorepo that measured closest to the budget. Adding it alone takes that repository
   from 34% of budget to roughly 14%.
3. **Give the prune list an extension point**, so the remedy in (1) is one an adopter can act
   on for output the list will never anticipate.
4. **Raise the budget — last.** Measured against pruning it is the weakest lever: it moves the
   cliff rather than removing it, and the figures supporting it are warm-cache only.

**Today there is no lever at all**, which is why (1) alone would not have been enough: the
budget's docstring says "not tunable" and the public `diskSet(project)` always passes the
constant, while `PRUNE` is referenced nowhere outside `disk-set.ts` — no option, no override.

**What the spike settled, and how.** The question below — whether a verdict may depend on a
bounded walk at all — would have been _dissolved_ rather than answered if `classify(glob)`
could be served by a walk bounded by the glob's own text. It cannot, and the measurement is
one-sided:

- Per-glob pruning is a 250–1000× win for a glob with a literal prefix (5 entries instead of
  50,525) and a **2× loss** for a glob led by `**/`, which can prune nothing.
- **A holding ratchet can never short-circuit.** It matches nothing by definition, so it must
  exhaust the searchable space. The worst case is the case the feature exists for.
- **Every glob in this repo's own rule files is `**/`-led: 9 of 9, zero anchored** — and
[0348](./0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md)
made that convention load-bearing, since the identity-root view applies to `'\*\*/'`-led
  globs only.

So there is no glob-bounded source of truth to swap in, 0355's discriminator does not need
replacing, and **replacing the eager walk with per-glob pruning is measured wrong** — it was
the spike's own hypothesis. The whole-repo walk is what the question requires.

- **A configuration finding.** The strongest option and the most disruptive: a run
  whose disk walk exhausted reports it, unsuppressably, the way an empty project
  does. It is honest, and it fires on every rule in a large repository at once,
  which is the noise ADR-009 rule 4 warns against — one cause, many findings.
- **One finding for the project, not one per rule.** ~~The precedent is
  `emptyProjectViolation`, which exists because the identity of that fault is the
  tsconfig rather than any glob.~~ Exhaustion has the same shape: one walk, one
  failure, one thing to say. **The precedent named here is wrong** — it is per-rule,
  measured; see the Fix above for the mechanism that does deliver one report.
- **A line in the gate summary.** Cheapest, and it is a warning — which ADR-009
  rule 1 says the primary consumer does not read. Adequate for "the walk was
  slow", not for "a gate is off".
- **Extend the prune list.** Not considered when this record was written, and measured in
  0368 as the largest lever available: pruning already removes 88.9% of entries, and the list
  misses 17 ordinary generated directories including the one that dominated a real adopter's
  walk. Needs no new API.
- **Move the budget to where its justification puts it.** Measured in 0360: between
  500,000 and 1,000,000 entries is 0.8–1.5s warm, which puts every realistic
  repository inside it. **Not unbounded** — the cold-cache cost is unmeasured and a
  bound nobody can reach is still a bound. This does not fix the silence; it makes
  the silence unreachable in practice, which is a different and lesser thing.

**The open question is whether a verdict may depend on a bounded walk at all.** Spike 0367
answers the operative half: it may, **provided exhaustion is reported**, because no
unbounded-free alternative exists for the globs people write. What the spike explicitly does
**not** settle is whether the bound could be removed outright — every figure it took is warm,
and the cold-cache cost stays uncosted for the same reason 0360 declined to recommend it. So
**raising** the budget is supported by measurement; **removing** it is not.

0360 makes that question **less pressing and does not answer it**: with the budget
where its justification puts it and exhaustion reported, the bound sits far from any
real tree and reaching it is stated rather than silent. It stays open here rather
than being declared closed by a number — a bound that is merely hard to reach is
still a bound, and this project's whole subject is what happens at the edge nobody
tests.

## Related

- [0355](./0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md)
  — the fix that made this classification verdict-bearing. Its ruling enumerates
  the four classifications and does not say that one of them can apply to
  everything at once.
- [0357](./0357-doctor-reports-a-healthy-ratchet-as-a-dead-glob.md) — the
  same predicate in `doctor`, so exhaustion silences the preview identically.
- [0352](../0352-disk-set-offers-the-repo-root-naming-to-a-glob-the-matcher-refuses.md)
  — the other open defect in what `disk-set` answers.

## A defect in the fix, found by testing a claim instead of asserting it

The docstring said the finding collapses to one report per project via
`dedupeConfigFindings`. Written, not measured — and **false**: setting a constant `rule`
is not enough, because the builder stamps `ruleId` with each rule's own id and the dedupe
key prefers `ruleId`. Three rules produced **three** reports, which is the ADR-009 rule 4
noise this fix claims to avoid.

Caught by writing `it('three rules that all lost the check collapse to one report')`
specifically because the same class of error had already happened twice this round — a
precedent read off a function's name, and a count read off a docstring. Third time, and
the only one of the three caught before it shipped. Fixed by setting `ruleId` as well; the
test now pins 3 before the collapse and 1 after, with the fan-out stated.

## What independent validation of ADR-016 found in this fix

The ADR this fix embodies was validated by a separate agent on a different model, per the
repo's author-≠-verifier rule. It found a defect nothing else had:

**The exhaustion lookup ran for every zero-examined cardinality rule, including rules with no
path glob.** A `.notExist()` selecting by name, decorator or predicate has nothing the disk
can decide — so two things were wrong. It triggered a **whole-repository walk** for an answer
it could not use, falsifying `diskSet`'s own "lazy, only ever reached from an already-firing
fault" docstring. And on exhaustion it was told _"the absence it asserts was never actually
checked"_, which is false: the walk's failure changed nothing for it. The 0.10 changeset
already admits that shape is uncovered; uncovered is honest, **blamed is not**.

Measured red (`expected 1 to be 0`), then guarded by `hasDiskDecidableGlob`, which asks the
same fault-position question `cardinalitySelectorMissedDisk` narrows to — but _before_ the
walk rather than after it. Pinned by `it('a rule with no path glob is neither walked for nor
blamed')`, which asserts zero `readdirSync` calls rather than merely zero findings.

Validation also tightened three tests that passed for the wrong reason: an alternation
(`/generated-output|apps/`) that a **wrong** attribution satisfied, a "not walked at all"
title whose assertions could not tell a skipped walk from a fruitless one, and a
`classify() === 'not-determined'` check that the **pre-fix** code also satisfied. And it
corrected two inflated tiers in the ADR's own table.

## The sabotage matrix

Each row a literal edit to the shipped source, restored from a sha256-verified backup with
the restore verified. `t1` is `a-walk-that-gave-up-says-so.test.ts`, `t2` `the-floor.test.ts`.

| row | edit                                                                    | result                              |
| --- | ----------------------------------------------------------------------- | ----------------------------------- |
| R0  | control, unmodified                                                     | green (both)                        |
| S1  | exhaustion returns the silent `UNDETERMINED` again — the shipped defect | **RED** (4)                         |
| S2  | the cardinality branch ignores exhaustion and goes green                | **RED** (3)                         |
| S3  | the finding stops naming consumers (ADR-009 rule 2)                     | **RED** (2)                         |
| S4  | consumers unsorted, so the named ones are arbitrary                     | **RED** (1)                         |
| S5  | the filesystem-root guard dropped                                       | **RED** in t1 **and** t2            |
| S6  | counting moved AFTER the budget check                                   | **RED** (3)                         |
| S7  | REVERSE — break the non-cardinality remedy this fix must not touch      | green in t1, **RED** in the sibling |

**S1 is the defect test.** It restores the exact pre-fix line and four assertions fail,
which is what makes the fix falsifiable rather than merely present.

**S6 is worth keeping.** Moving the per-subtree count below the budget check looks harmless
and is not: the subtree whose read exhausted the budget would be missing from the list of
what exhausted it — the finding would name everything except the cause.

**S7 is a covered-elsewhere row, not an unfalsifiable guard**, and the distinction is
measured rather than assumed: it fires nothing against this bug's own file and reds
`a-cardinality-rule-sees-a-dead-selector.test.ts` ·
`it('CONTROL: a positive-assertion rule keeps the old remedy')`. A matrix run only against
the file under edit would have reported this row as proving nothing.

## Verification

- [x] the mechanism confirmed: whole-set `UNDETERMINED` at `ts/src/core/disk-set.ts:299`,
      `classify` answering `not-determined` for every glob at `:384-386`, memoized
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
      [spike 0360](../../spikes/0360-what-the-disk-walk-actually-costs.md): 50,000
      entries costs 76 ms against a 5s claim.
- [x] the prune list weighed as an alternative lever and found to trade cost for reach —
      `.next` is already over-pruned for a Next.js project, and since 0355 every prune entry
      is a place this gate cannot see.
- [x] a ruling on which shape — [0367](../../spikes/0367-must-the-disk-question-walk-the-whole-repo.md)
      (a report, not a redesign: no glob-bounded alternative exists for the `**/`-led globs
      people write) and [0368](../../spikes/0368-what-the-exhaustion-finding-can-tell-an-adopter-to-do.md)
      (what the report must SAY, and pruning as the dominant lever).
      **On whether a verdict may depend on a bounded walk: it may, provided exhaustion is
      reported** — and only the operative half is settled. Whether the bound could be
      REMOVED is still uncosted, because every figure taken is warm-cache;
      `done-otherwise`, and the docstring says so at the constant.
- [x] a red-first test: `a-walk-that-gave-up-says-so.test.ts` drives a real rule's
      `violations()` through a real exhausted walk, and was measured RED before the fix
      (`expected 0 to be greater than 0` — the rule was green with nothing said).
- [x] a **remedy-remediates** test, beyond the red one: removing the directory the message
      names clears the finding and the rule resumes reporting. ADR-009 rule 2's corollary,
      and the `every-config-finding-is-classified` gate requires it.
- [x] a changeset — an adopter-visible new finding plus a raised budget.
- [x] `npm run validate` green.

**Found while fixing, and fixed here because the fix exposed it:** a tsconfig with no
repository above it resolved to the FILESYSTEM ROOT and the walk read the entire disk —
always, invisibly, because exhaustion returned the silent `UNDETERMINED`. That is this
bug's own thesis landing in a second place. A narrow guard now returns `not-determined`
without walking. Narrow on purpose: a first draft refused any root lacking `.git` or
`package.json` and reddened two legitimate fixtures, because a bare directory holding only
a tsconfig IS a project.

Deferred: one item, re-homed rather than dropped.

- **An extension point for the prune list** → `deferred→`
  [0369](../0369-the-prune-list-has-no-extension-point.md). 0368 listed it third of four;
  it is not needed for this fix (the remedy names directories the adopter can delete, and
  the default list now covers the measured cases) and it is public API, which wants a
  proposal rather than a bug fix's judgement call.
