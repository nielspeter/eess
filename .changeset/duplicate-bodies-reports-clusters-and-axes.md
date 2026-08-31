---
'@nielspeter/eess-ts': minor
---

**Breaking for baselines only:** `smells.duplicateBodies()` now reports one
finding per CLUSTER of mutually-similar bodies instead of one per pair. A
two-member cluster keeps the message and identity it already had, so most
baselines are untouched; a group of three or more collapses into a single
finding with a new `duplicate-cluster::` identity, and those entries need
regenerating. Nothing is dropped and no score changed — this is what the
detector says, not what it scores.

Measured on a ~5,600-file production monorepo: **4,770 pair findings became
407** — an 11.7x reduction. The old output had more findings than the 3,810
bodies that produced them, because N mutually-similar bodies carry one
observation and emit N^2/2 lines of it. The eight largest groups alone were 49%
of the output; one group of 89 emitted 398 lines; the worst single function was
named 29 times. On this repo, 220 became 93.

**Findings now say what varies.** A percentage cannot distinguish "one call
target differs" from "every property name differs", and those are opposite
verdicts:

```
isExcludedByComment (core) is 100% similar to isExcludedByComment (ts)
  — identical text: a literal copy
assertHomogeneous   (core) is 100% similar to assertHomogeneous   (ts)
  — 1 varying axis: '...Matcher functions...' -> '...TypeMatcher functions...'
functionContain is 85% similar to haveOnlyReadonlyProperties
  — 12 varying axes: fn -> element, ArchFunction -> PropertyBearingNode, +9 more
```

A systematic rename counts as ONE axis however many times it occurs, because it
is one decision to evaluate. Reported, never filtered on: measured, the bucket
that is mostly convergent idiom carries a median of 6 axes against 4 for the
rest, which is real information and not a classifier.

**Findings are ordered by how likely they are to be worth acting on** — a copy
of one function into another file first. The detector ignores identifiers by
design (that is what makes it a type-2 clone score) and was also ignoring the
declaration's own name, where the evidence was. Bucketed over that corpus:
different-file-same-name is 14% of findings and is where the real copies are;
different-file-different-name is 56% and is mostly shared idiom. A ranking, not
a filter — dropping either bucket loses real duplication.

New public API on `@nielspeter/eess-ts`: `variationBetween`, and the types
`Variation` and `VariationAxis`. `Fingerprint` gains a `texts` field, parallel to
`kinds`; `computeSimilarity` does not read it and must not.
