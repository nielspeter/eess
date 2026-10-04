# Bug 0374: `eess-mermaid`'s `extend` reads one edge, so a grandchild in a diagram is never selected

## Status

- **State:** Fixed — `extendName`, `extend` and `notExtendStereotype` walk the diagram's
  inheritance and realization edges at any depth. Breaking, marked `minor`.
- **Severity:** High — **the same false green as
  [bug 0295](./0295-extend-and-implement-read-only-the-direct-clause.md), in a sibling
  dialect.** A selector over a diagram drops every class that reaches the named superclass
  through an intermediate one.
- **Origin:** self-found — 0295's record named the family; the fix ruled in
  [ADR-017](../../../adr/017-a-heritage-predicate-names-a-relation-not-a-clause.md) and shipped
  in `eess-ts` only, to keep the change reviewable in one sitting.
- **Reported:** 2026-10-04

## Symptom

`extendName` in `packages/mermaid/src/predicates/class.ts:67` returns true only when one
relationship edge joins the class to `superName`. In a diagram drawing
`Base <|-- Mid` and `Mid <|-- Leaf`, `extendName('Base')` selects `Mid` and not `Leaf`.
The `extend` condition in the same builder has the same reading.

ADR-017 decides that a heritage word means one thing across the family: reachability, not
one clause. `eess-mermaid` breaks that today.

## Fix

`ancestorsOf` in `packages/mermaid/src/models/arch-class.ts` walks inheritance and realization
edges from a class, each class once, so a diagram cycle ends it. The predicate and both
conditions read it; `inheritsBetween` moved there from the conditions so the three share one
reading of an edge. The edge set is unchanged.

## Also to settle — decided: not here

The predicate treats realization (`<|..`, `..|>`) the same as inheritance. `eess-ts` keeps
`extend` and `implement` apart. Whether a diagram's `extend` should walk a realization edge
is part of this fix, not a separate question.

_That last sentence was wrong, and the fix did not follow it (corrected 2026-10-04, at fix)._ Dropping realization narrows
every selection that relies on it — the walkthrough's own diagram draws its interfaces with
`<|..` — which is a fail-open change needing its own decision and migration. The edge set is
kept, pinned by a test, and the question is
deferred→[bug 0377](../0377-eess-mermaid-extend-also-means-implement.md).

## Verification

_Rewritten at fix (2026-10-04): the Draft's three boxes — a red test, the walk with a cycle
ending it, validate — are covered by the boxes below._

- [x] red tests, all four measured red before the walk —
      `packages/mermaid/tests/builders/extend-walks-the-edges.test.ts` ·
      `it('extendName() selects every descendant, in either arrow direction')`,
      `it('extend() as a condition accepts a descendant at any depth')`,
      `it('notExtendStereotype() reports a stereotyped ancestor at any depth')` and
      `it('a cycle in the diagram ends the walk')`. Each chain is three levels deep.
- [x] the condition, the predicate and `notExtendStereotype` walk the edges; a cycle ends the walk.
      `notExtendStereotype` was not in the record as filed — it is the same word, so ADR-017
      rule 6 covers it. At depth its message names the path — for example `Deep extends Base (via Leaf, Mid)` — since the class has no edge to the ancestor to go and find — added after
      enforcement review.
- [x] the edge set pinned unchanged —
      `it('a realization edge is walked like an inheritance edge, as it was before the walk')` and
      `it('a realization edge mid-chain carries extend through it, as 0377 records')`. The second
      was added after enforcement review found the walk had widened the condition's leniency to
      a mixed chain, which 0377 now records.
- [x] sabotage matrix on the final tree, thirteen rows, sha256-verified restores, each run in
      its own process group: walk climbs one edge (8 red); each of the four arrows dropped
      (`<|--` 10, `<|..` 2, `--|>` 4, `..|>` 1) and each read backwards (10, 2, 4, 1); path not
      recorded (3); depth-first instead of breadth-first, so the named path is not the shortest
      (1); a direct parent printing an empty `(via )` (1); visited guard removed — the run
      never finishes, killed at 60s. _Testing review found three of these rows surviving an
      earlier five-row matrix — `..|>` alone (never drawn in any test), DFS, and the empty
      path — and the tests for them were added: a `..|>` edge, a diamond whose longer branch is
      drawn first, and exact per-class messages._
      _A first run killed only `npx` and left two vitest workers spinning for minutes; review
      found them._ A hang rather than a failure is accepted on purpose: a bound on the walk
      would be an ADR-016 instrument that can run out. _First written "and CI's job timeout still reds it" — but no workflow sets a timeout, so the run would hold a runner for GitHub's six-hour default before failing; testing review found it, and the gap is [bug 0378](../0378-ci-jobs-have-no-timeout.md)._
- [x] the `eess-mermaid` and `eess-crossvalidate` suites pass — 115 and 94 tests, counted by
      `vitest run` on the final tree. _An earlier "111" was counted before the realization pin
      was added; method review measured 112 at that commit, and three
      tests from the testing review make 115._
- [x] `npm run validate` green on the final tree (exit 0, 473s; eess-ts 3937 tests).

Deferred: [bug 0377](../0377-eess-mermaid-extend-also-means-implement.md), [bug 0378](../0378-ci-jobs-have-no-timeout.md).
