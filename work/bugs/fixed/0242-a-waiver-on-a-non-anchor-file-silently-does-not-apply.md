# Bug 0242: an exclusion comment placed on a file a finding merely concerns does not apply, and nothing says so

## Status

- **State:** Fixed — but not as this record first described it. Investigating
  the fix changed the finding twice; both revisions are below rather than edited
  away. `Deferred: none` — the two directions this record originally proposed are
  costed and left to their owners, not dropped silently.
- **Severity:** Low — **fails in the safe direction.** The finding keeps firing,
  so the build stays red and nothing is hidden. What is lost is durability: a
  waiver that works today can stop working on another machine.
- **Origin:** self-found · enforcement review of the
  [0239](./0239-a-cluster-finding-carries-one-file-so-diff-aware-drops-the-rest.md)
  fix, 2026-09-03. Named there as the same "file-only filter" class and left
  unaddressed, so it is filed rather than noted in passing.
- **Reported:** 2026-09-03

## Symptom, as finally understood

A duplicate finding is reported at ONE of its members. That location is what an
author reads when placing `// eess-exclude`, and the rendered output names it
plainly:

```
not (…/packages/core/src/combinators.ts:28) is 97% similar to not (…/other.ts)
packages/core/src/combinators.ts:28 — not
```

The anchor was `cluster.members[0]`, and for a pair `pair.a` — **source walk
order**. Three lines below it, the identity is built by sorting the members, with
a comment saying why: so it "survives a filesystem walking the members in a
different order and does not drift as a body is edited."

So one finding carried a **durable identity beside a non-durable location**. The
same duplicate reports at `a.ts` on one machine and `b.ts` on another, and a
waiver committed against the first silently stops suppressing on the second. The
baseline keyed on identity survives that; the waiver keyed on location does not.

## Two corrections this record owes, recorded rather than edited away

**First framing, wrong:** "a developer reading `b.ts`, who sees the duplicate
reported there, writes a waiver and gets silent non-suppression." The finding is
not reported "there" — it is reported at the anchor, and the output says so on
its own line. An author following the finding puts the waiver in the right place.
The realistic mistake is skimming to the _other_ file named in the message text,
which is a smaller and different problem.

**Second framing, also wrong:** that the fix was a choice between widening the
match and reporting the near-miss, and that the two "compose, do both". Both were
investigated and neither is the cheap correct first move:

- **Widening cannot preserve the grant's scope.** `commentCoversViolation`
  (`packages/core/src/exclusion-comments.ts:471`) grants a single-line waiver
  exactly the next line. A related file has no position in the violation —
  `relatedFiles` is `readonly string[]`, shipped in
  [0239](./0239-a-cluster-finding-carries-one-file-so-diff-aware-drops-the-rest.md)
  and now in the JSON contract. So widening either drops the line check for
  related files, coarsening a line-scoped waiver into a file-scoped one — which
  is ADR-009 rule 3's corollary about a marker that goes green from more places
  — or needs a second positioned field days after the last one, for a Low bug.
- **Reporting the near-miss has no data where it would live.** `orphanExclusions`
  is only invoked by `doctor` (`packages/ts/src/cli/commands/doctor.ts:110`),
  which inspects declarations and never runs the rules, so no suppression is
  recorded there. In `check`, `applyFilters` parses comments only for files that
  already have violations — and the case of interest is a comment in a file with
  none. Both would need a scan that does not run today.

Neither is wrong to want. Both are now costed for whoever picks them up, which is
what this record failed to do the first two times.

## Fix

Anchor deterministically, by path then line — the same ordering the identity
already uses, applied to the location it sits beside. `anchorIndex`
(`packages/ts/src/smells/duplicate-report.ts`) takes plain positions rather than
nodes, so the choice is testable without a ts-morph project. Both producers use
it: the cluster path and the pair path, which had the same defect through
`pair.a`.

No API change, no widening of any grant, and a waiver committed against a
duplicate now names the same file on every machine.

**The test is a unit test on purpose.** An end-to-end test cannot tell "sorted"
from "walk order" when the walk is already alphabetical — it would pass against
the very bug it was written for.

**With one exception, found while fixing this and worth stating precisely.** A
test that _deliberately reverses the walk_ can tell, because it stops relying on
the filesystem to disagree with itself. `baseline-portability.test.ts` already
builds exactly that — a second fixture whose source enumeration is reversed — so
it is a differently-derived guard on this fix (ADR-009 rule 5) rather than a
duplicate of the unit test: one asserts the choice as pure data, the other drives
it through a real ts-morph project and reads the reported subject back out.

## Verification

- [x] Red first: `anchorIndex` did not exist; three tests failed on it.
- [x] **The sabotage matrix, enumerated FROM THE DIFF and re-run after two review
      rounds.** The first version had four rows and was enumerated from the fix's
      _claim_; the diff has nineteen behavioural reverts. Baseline: 137 passing
      across `tests/smells/`, `baseline-portability.test.ts` and
      `exclusion-comments-e2e.test.ts`, with nothing red. Every row below reds,
      and the tests named are the ones that red and no others.

      | revert | tests that go red |
      | ------ | ----------------- |
      | the test harness's own reverse switch made a no-op | `a CLUSTER shows the same members…` · `a PAIR reads the same…` · `REPORT ORDER is the same…` |
      | `baseline-portability`'s reverse switch made a no-op | `a pairwise finding keeps its identity…` |
      | the detector bypasses the injected enumeration | those four, plus `the reported folders come out in order` |
      | `anchorIndex` always returns 0 | `picks the same member…` · `breaks a same-file tie by line` · `a CLUSTER shows…` · `the reported folders…` |
      | line compared as TEXT rather than as a number | `a duplicate WITHIN one file shows its members in line order` |
      | the same-file line tie-break dropped | `breaks a same-file tie by line` |
      | cluster anchor reverts to `members[0]` | `a CLUSTER shows the same members and the same evidence` |
      | cluster shown-members unsorted | `a CLUSTER shows the same members and the same evidence` |
      | cluster evidence reverts to `pairs[0]` | `a CLUSTER shows the same members and the same evidence` |
      | `representativePair` does not orient its winner | `a CLUSTER shows the same members and the same evidence` |
      | `orientPair` never swaps | six tests, across all four files |
      | report-order tie-break removed | `REPORT ORDER is the same in either direction` |
      | `groupByFolder` key reverts to `members[0]` | `the reported folders come out in order` |
      | pair `line` from the other endpoint | `the reported file and line locate the reported element` · `a duplicate WITHIN one file…` · `the waiver on the anchor file suppresses…` |
      | pair `file` from the other endpoint | those, plus `reports when only the SECOND file changed` and `the reported folders…` |
      | pair `element` from the other endpoint | four tests, including `distinguishes same-named keys in different object literals` |
      | message names the other endpoint first | `the reported file and line locate the reported element` · `a duplicate WITHIN one file…` |
      | `varianceSummary` drops its `skipped` branch | `says a pair was too large to diff rather than that it differs in nothing` |

      Named rather than counted: a count cannot tell "the right tests went red"
      from "some tests went red", which is the distinction the matrix exists for.

- [x] The headline claim is asserted **on the mechanism**: a committed
      `// eess-exclude` on the anchor keeps suppressing in both walk directions,
      and the assertion names WHICH file's directive did the suppressing rather
      than only that nothing threw — `not.toThrow()` cannot tell "silenced the
      one intended finding" from "silenced everything", which is
      [0233](../0233-an-exclusion-that-suppresses-every-violation-is-silent.md)'s
      open class. Two controls: no waiver reds both ways, and a waiver on the
      non-anchor file suppresses neither way.
- [x] `file`, `line`, `element` and the message's leading body are each
      independently guarded, and a same-file fixture exercises the leg every
      earlier fixture missed — one function per file at line 1 meant no
      same-file comparison ran anywhere.
- [x] Every reversed-walk test asserts its precondition **from the array the
      detector was handed**, and that the detector asked for it. What that does
      not prove — that the detector honoured the order rather than re-sorting
      internally — is stated in both test files rather than left implied.
- [x] The identity is unchanged, so committed baselines are unaffected.
- [x] `npm run validate` green from a run that reached the last step.

## What the gates caught, and the one that is a finding in itself

Three refusals, in order:

1. **The 150-line class rule.** Ordering the pair inline pushed
   `DuplicateBodiesBuilder` past its limit — the same rule that caused
   `duplicate-report.ts` to exist in the first place — so `pairViolation` moved
   beside `clusterViolation`.
2. **`eess/no-unused-exports`.** The move left three helpers with no in-`src`
   caller. `otherFiles` is internal now; `anchorIndex` and `varianceSummary` stay
   exported for their tests and carry directives stating that reason, and the
   waiver census in `arch-rules.test.ts` had to be extended to admit the file —
   a ratchet that refuses a new waiver until it is declared.
3. **A control this fix invalidated, which is the interesting one.**
   `baseline-portability.test.ts`'s reversed-walk test proved its reversal had
   taken effect by asserting the finding's `element` _flipped_. That flip WAS
   bug 0242. Fixing it made the control false, so the test went red for the right
   reason.

   The tempting move is to delete the assertion, and it is the wrong one: without
   it the test passes even if the reversal never happens, which is a green that
   proves nothing. It was **replaced, not removed** — the precondition is now
   read at its source, the enumeration order handed to the detector, which cannot
   go stale the next time the reporting side changes. A second assertion was
   added in its place saying the finding does _not_ move, which is the claim this
   record is about, asserted end to end.

   Recorded because the failure mode generalises: a fix that removes a defect can
   invalidate a test whose control was built ON that defect, and the red looks
   exactly like a regression.

A fourth thing, found by writing one of those waiver reasons out in full rather
than gesturing at "needed by tests". Stating precisely which test consumed
`varianceSummary`, and for what, exposed that its `skipped` branch — the one that
says _too large to diff_ — was rendered by no test at all. `variationBetween`'s
refusal to invent axes was asserted; the words a reader actually sees for it were
not, and the fall-through renders "identical text: a literal copy", which is the
opposite of the truth. `variation.test.ts` pins it now, sabotage-verified by
deleting the branch. A waiver reason worth writing is worth writing exactly: the
imprecise version would have shipped, and the gap with it.

## What review found, which was most of the work

Three reviewers ran against the fix as first written — enforcement, testing,
architecture. Two of them independently landed on the same critical finding, and
the convergence is the point: it was not a matter of taste.

**The cluster half of the fix had no break class.** Reverting `clusterViolation`
to the pre-fix `members[0]` left the entire 3600-test suite green. Not a
theoretical gap — the defect was live under the revert, and measured: instrument
`clusterViolation` to throw when the anchor is not `members[0]` and, across every
cluster fixture in the repo, it never fires. The walk order already _was_ the
path-then-line minimum everywhere, which is precisely the condition this record's
own Fix section names as disqualifying. The Fix section said "Both producers use
it: the cluster path and the pair path" — true of the code, false of the
evidence. A three-file cluster over a reversed walk closes it, and now reds four
separate reverts.

**The replaced control was circular.** Reading the enumeration back from
`layout.project.getSourceFiles()` proves the _fixture_ built a reversed array,
not that the _detector_ read it. Measured: make the builder reach past the
injection to `_project.getSourceFiles()` and the new control stayed green while
no reversed walk reached the detector at all — the old control would have caught
that. The enumeration is counted now, and both layouts must show a read. Worth
recording as a general shape: moving a precondition _upstream_ to escape a
staleness problem can move it upstream of the thing under test.

**The claim was tested everywhere except where it is made.** Every assertion read
a violation's fields; nothing placed the `// eess-exclude` an author would
actually write and asked whether it still suppressed. It does now, with the two
controls that keep it from passing vacuously.

**`line` could come from the wrong endpoint with the whole suite green.** A
stability test cannot see it — forward and reverse both take the wrong endpoint,
so they agree. That needed a correctness assertion instead: the reported file and
line must locate the reported element, and the message must lead with it.

**Two smaller things, both true and both mine.** The waiver census comment had
stale counts, inside a paragraph warning about stale counts — corrected, and the
argument for deriving them rather than writing them down is now in the comment.
And a CONTROL justified itself by something untrue: a constant-zero `anchorIndex`
does not slip past the tie-break test, it reds it.

**One reviewer finding did not survive measurement, and is recorded because the
correction runs the other way.** Enforcement review read `orderedPairs`'
`.groupByFolder()` key as a live defect — sorting on the walk-order endpoint
while the finding reports at the anchor. By inspection that is right. By probe it
is unreachable: `buildViolations` is called only for clusters of two or fewer
members, which carry exactly one pair, and an instrumented run over all 3604
tests recorded zero calls with more than one. The key is corrected anyway, and
the docstring now says plainly that the correction fixes no observable
behaviour. The cluster-level key beside it _was_ a live defect and is fixed with
a test. Review is not authority either; the probe is.

## The second review round, which found that the first round's fixes needed fixing

Three more reviewers ran against the rewritten branch. The pattern is the point:
every finding below is a defect **introduced or left by the repairs made after
round one**, which is the argument for reviewing a fix and not only the thing it
fixes.

**The control I wrote to replace a circular one was itself circular.** Round one
found that reading the enumeration back from the layout proves the fixture built
a reversed array, not that the detector read it; I added a read counter. In the
NEW test file I then wrote a CONTROL that built a _second, fresh_ project and
asserted ts-morph had loaded more than one distinctly-named file — true whatever
the reverse switch does. Measured: neuter the switch and that control still
passed, while four properties guarded only by those tests went invisible across
all 3600 tests. Both new describes had it. There is now one helper that captures
the enumeration handed to the detector and counts the reads, and every
reversed-walk test asserts from it.

**I condemned a silent drop and left the same one a screen below.**
`pairViolation` was made total with the argument that "unreachable today is not a
defence: the type is what stops it becoming reachable" — and `clusterViolation`
kept returning `| undefined` on an equally unreachable lookup, with a caller that
dropped it. `SimilarCluster.members` is typed as a non-empty tuple now, narrowed
once where clusters are constructed, and both producers are total.

**One decision was expressed as three comparators.** `anchorIndex` compared
`{ file, line }` with `<` and a numeric line; a separate `positionKey` built a
zero-padded string; the cluster's shown-members sort had a third inline copy.
They agreed only by accident of the padding width — unpadded, `":10"` sorts
before `":9"`, so two same-file bodies at lines 9 and 10 would have oriented a
finding's axes against the anchor it reports at. One `comparePositions` now, with
a third key on name, because two anonymous functions can share a file _and_ a
line.

**Report order was still the filesystem's.** `clusterRank` sorts findings into
four buckets with a stable sort, so equal-ranked findings — nearly all of them —
kept walk order. The branch had disclosed this in a test comment and nowhere
else, which is the weakest of the available options. It tie-breaks on the anchor
path now, and `localeCompare` is gone from the two expressions this fix rewrote:
its result depends on the runtime's ICU build, which is this record's own failure
class.

**A redundant sort had no break class, so it was deleted rather than tested.**
`comparePairs` sorted each pair's ends internally, which duplicated the
orientation its caller already applies; no sabotage of it went red. Orienting
before comparing removes the branch. An unfalsifiable branch is worth deleting
when the alternative is writing a fixture to justify keeping it.

**And one claim of mine was measured and cut back.** The read counter proves the
detector _asked_ for the injected enumeration, not that it _honoured_ the order:
a detector that re-sorts after reading keeps every reversed-walk test green while
no reversed order reaches the decision. No end-to-end derivation can close that —
the fix exists to remove every observable that varies with walk order — so the
pure-data tests are the primary guard for the ordering rule and the end-to-end
tests guard the wiring. Both test files say so now; the comments previously said
more than the instruments deliver.

## The class question, asked once instead of instance by instance

Enforcement review's closing observation is the most useful thing in either
round, and it is about method rather than about any one defect:

> this branch found a class of defect — _a location that follows the walk_ — fixed
> it in the anchor, and then reasoned about the remaining instances one at a time
> instead of asking the class question of every field in the finding.

That is exactly what happened. The anchor was fixed; then review found the shown
members, then the evidence pair, then the axis direction, then the report order,
then `relatedFiles`, then the `groupByFolder` key — each as a separate discovery,
each costing a round trip. So the question is asked once here, of every field
these two producers set, with the answer for each:

| field                      | what makes it independent of the walk                |
| -------------------------- | ---------------------------------------------------- |
| `element`                  | the anchor's name                                    |
| `file` · `line`            | the anchor's position                                |
| `relatedFiles`             | keyed on the anchor, de-duplicated and sorted        |
| `message` — leading body   | the anchor                                           |
| `message` — shown members  | sorted by the total order, before `MAX_SHOWN` elides |
| `message` — evidence pair  | `representativePair`, chosen by the total order      |
| `message` — axis direction | the pair is oriented before rendering                |
| `identity`                 | member keys sorted (unchanged; it was always sorted) |
| `rule` · `because`         | from the caller's context                            |
| report ORDER               | rank, then the anchor path as tie-break              |

`severity`, `codeFrame`, `suggestion` and `docs` are not set by either producer.

Two comments were left standing that the fix had made false — `clusters.ts`
saying the first member is what the violation anchors to, and `clusterViolation`
saying "the anchor is walk order" three lines above the code that anchors by
path. Both are corrected, and both are the same failure as the stale counts and
the untrue CONTROL: **a claim that was true when written and that nothing
re-reads.** That is the argument for deriving a fact rather than writing it down,
and where it cannot be derived, for a reviewer who checks the sentence against
the code.

## Related

- [0239](./0239-a-cluster-finding-carries-one-file-so-diff-aware-drops-the-rest.md)
  — the same finding's other coordinate. That record made `--changed` see every
  file a duplicate concerns; this one makes the reported location stop moving.
- [0233](../0233-an-exclusion-that-suppresses-every-violation-is-silent.md) — owns
  the "a suppression that suppressed nothing should say so" clause, which is the
  near-miss half costed above.
