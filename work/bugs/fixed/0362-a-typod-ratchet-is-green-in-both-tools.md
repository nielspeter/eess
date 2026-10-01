# Bug 0362: a ratchet broken by one character is green in both tools, and 0.10.0 shipped it

## Status

- **State:** Fixed — the syntactic clause restored to both tools through one shared
  predicate, with a red-first row and a four-row sabotage matrix; **then fixed a second
  time**, because the first fix reintroduced the wrong-remedy class one cause over. The
  second fix derives the remedy and the scope from the diagnosis, and carries a seven-row
  matrix of its own. Both fixes ship together — the first was never released.
- **Severity:** High — **a true false green, shipped.** A `.notExist()` rule whose
  selector is `'./src/**'` instead of `'src/**'` reports nothing in `check` and
  nothing in `doctor`. The directory exists, is in the project, and holds
  TypeScript.
- **Origin:** an enforcement review of the fixes that a _previous_ review round had
  asked for — the review-response code, which had been merged without any review of
  its own. Introduced by [0357](./0357-doctor-reports-a-healthy-ratchet-as-a-dead-glob.md)
  and released in eess-ts 0.10.0.
- **Reported:** 2026-09-29

## Symptom

A healthy project, `src/a.ts` loaded. The glob is one character wrong:

| glob            | rule shape         | `doctor`    | `check` |
| --------------- | ------------------ | ----------- | ------- |
| `'./src/**'`    | `.notExist()`      | **nothing** | **0**   |
| `'./src/**'`    | positive assertion | `dead-glob` | 1       |
| `'./legacy/**'` | `.notExist()`      | **nothing** | **0**   |

The same glob on a rule that asserts something positive reports in both tools. Only
the ratchet is silent — and before 0357 `doctor` printed the real cause:
`dot-segment: a "./" segment never occurs in an absolute file path — remove it and
anchor instead`.

## Root cause

0357 added a disk test to the dead-glob path for cardinality rules and placed it
**after** `isDeadSite`, so it narrowed _every_ dead site — including the ones whose
fault is decidable from the glob text with no filesystem at all.

`'./src/**'` classifies `absent` on disk, because picomatch will not cross a `./`
segment, so the new guard read "the ratchet is holding" and dropped the finding. The
two facts are unrelated: the glob is broken in every possible project, and no
filesystem answer can change that.

**`diagnose.ts` states the principle twice about itself** — syntactic faults "are
properties of the glob text, not of what loaded", and survive even an empty project,
because withholding them "buys the reader a second failing round trip". 0357
withheld them for exactly one rule shape: the shape
[0355](./0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md)
is named for, _"a cardinality rule cannot tell 'none exist' from 'my selector
broke'"_. Here it can tell, with certainty, from the text — and went quiet.

## The fix

One shared predicate, `cardinalityDeadSiteIsAtFault(project, glob, hasSyntacticFault)`
in `disk-set.ts`, consumed by both tools — the same placement and the same reason as
`absenceClaimIsContradicted`, which this now wraps. A dead site on a cardinality rule
is a fault when **either** the glob is broken in every project **or** the filesystem
contradicts the absence claim.

The gate side collects the syntactically-broken globs from its own trees, because the
filter there sees an `ArchViolation` — whose `element` is the glob — rather than the
site that carries `kind` and `base`.

## Why no test caught it

`doctor-and-check-agree-about-a-ratchet.test.ts` exercised three globs and **all three
were syntactically valid**. The narrowing was therefore unfalsifiable in the direction
it was wrong — the identical class the `contradictsAbsence` pin was written to
eliminate, one file away, in the same commit.

A fourth row now sits beside the genuinely-absent one deliberately: both match
nothing, and only one is the author's mistake. That is the whole discrimination this
family of bugs is about.

## The sabotage matrix

| row        | the edit                                           | what reddened                                                               |
| ---------- | -------------------------------------------------- | --------------------------------------------------------------------------- |
| S1         | drop the syntactic clause — the shipped 0.10.0 bug | `agree on all four cases`                                                   |
| S2         | `diagnose` stops passing the syntactic fact        | `agree on all four cases`                                                   |
| S3         | the gate side stops collecting broken globs        | `agree on all four cases`                                                   |
| S4 REVERSE | every dead site is at fault (the over-reach)       | 3 tests, including `CONTROL: stays green when the path is genuinely absent` |

S4 is the row that matters as much as S1: the obvious over-correction — treat every
dead selector as a fault — passes the defect test and breaks every healthy ratchet.

## The fix reintroduced the class it was fixing, one cause over

Caught by an enforcement review of this fix, before release. Restoring the syntactic route
gave a second way into `deadSelectorViolation`'s cardinality branch — and that branch's
remedy was selected by `isCardinality` **alone**, which was sound only while
`holds-typescript` was the single route in. Measured on `'./src/**'`:

> **cause:** a `"./"` segment never occurs in an absolute file path — remove it and anchor
> instead
> **Fix:** Widen the tsconfig include to cover this path, or correct the selector — do not
> delete this rule, it is what detected the gap.

Three things wrong in one unsuppressable finding: no `include` can make that glob match, so
the first branch is impossible; the rule "detected" nothing because it never ran; and "can
never match anything in **this** project" understates a fault that holds in **any** project,
by exactly the scope that invites the tsconfig reading.

**And it is the same class this function's own docstring records twelve lines above** — the
remedy that told readers to delete the ratchet, found by three lenses before the last
release. Reintroduced by me, one cause over, **with the same missing assertion**: the row
added for the typo case asserted `diagnose(...).length > 0` and `violations().length > 0`.
Booleans. Colour, not attribution.

The remedy is now derived from the **diagnosis** rather than the rule shape, the scope
from the glob text alone, and the `Fix:` line carries the cause so it names the edit rather
than only the direction. Four review lenses converged on the same over-conditioned
expression independently.

### The second matrix — seven rows, measured

Run against the fixed tree, each row a literal edit to `vacuity-diagnosis.ts` (or, for S7,
`disk-set.ts`), restored from a sha256-verified backup and the restore verified. `t1` is
`doctor-and-check-agree-about-a-ratchet.test.ts`, `t2` the sibling
`a-cardinality-rule-sees-a-dead-selector.test.ts`.

| row | edit                                                             | result                     |
| --- | ---------------------------------------------------------------- | -------------------------- |
| R0  | control, unmodified                                              | green (both files)         |
| S1  | `scope` forced to "in this project" — the shipped 0.10.0 wording | **RED** (2)                |
| S2  | `scope` forced to "in any project" — the over-correction         | **RED** (2)                |
| S3  | threshold widened: any disk answer contradicts                   | green — **equivalent**     |
| S4  | the cause dropped from the `Fix:` line                           | **RED** (1)                |
| S5  | third remedy branch offers deletion again                        | **RED** (3)                |
| S6  | REVERSE — break the non-cardinality remedy                       | green in t1, **RED** in t2 |
| S7  | admission filter widened past `holds-typescript`                 | **RED** (1)                |

**S3 is an equivalent mutation, not an unguarded condition, and the difference is
measurable.** `contradictsAbsence(diagnosis.onDisk)` and a bare `!== undefined` agree on
every input that can reach a reader, because `cardinalityDeadSiteIsAtFault` admits only a
syntactic fault or `holds-typescript` — the messages built for `absent` and `no-typescript`
are constructed and then discarded. The call is kept for the one owner (the hand-copied
`=== 'holds-typescript'` in the first draft is the precedent `disk-set.ts` records about
`isFaultPosition` growing two copies that disagreed), and the narrowing that makes it
equivalent is now itself pinned: **S7 reds**, so widening the filter — surfacing walk
exhaustion, [0359](./0359-a-disk-walk-that-gave-up-reports-nothing-and-now-decides-a-verdict.md),
is the live candidate — fails loudly instead of silently reaching a branch written for a
different cause.

**S6 is a covered-elsewhere row, not an unfalsifiable guard.** It fires nothing against the
file under edit and reds in the sibling. Naming the file that kills it is the point: a
matrix run only against the edited file would have reported this row as proving nothing.

_The previous version of this paragraph read "Three sabotage rows cover it, one reverse"
and published no rows, while the record two paragraphs above indicts exactly that shape
("stated in four places in prose … and enforced by none of them"). Two reviewers called it;
the rows above are the answer._

## Related

- [0357](./0357-doctor-reports-a-healthy-ratchet-as-a-dead-glob.md) — introduced
  it. Its own fix was correct for the case it measured and too broad for the case it
  did not.
- [0355](./0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md)
  — the ruling both share.

## Verification

- [x] reproduced: the table above, both tools, on a project where the named directory
      exists and is loaded.
- [x] the fix verified to preserve the discrimination — a typo reports, a genuinely
      absent path stays green.
- [x] a sabotage matrix, 4 rows including a reverse row, all firing.
- [x] the missing coverage named: three globs, all syntactically valid.
- [x] a changeset — a rule that was silent will now report, **and** (second fix) its
      `Fix:` line changed; the changeset body names both.
- [x] `npm run validate` green.

**Second fix — the wrong remedy one cause over:**

- [x] reproduced: the quoted `cause` / `Fix:` pair above, measured on `'./src/**'`.
- [x] a remedy-**remediates** test, not only remedy-contains — ADR-009 rule 2's corollary:
      `it('the stated fix, applied, clears the finding on both cardinality routes')` applies
      each stated fix (correct the selector; widen the include, via a second tsconfig) and
      asserts the configuration finding clears, with a vacuity guard that the widened
      project really loaded the files.
- [x] the third admission route pinned — a `parent-dir` glob naming a file IN the project.
      It was reaching "widen the tsconfig include" before this fix, which no `include` can
      satisfy; nothing named it and no test drove it.
- [x] the scope guard made falsifiable — the previous condition survived all 3,893 tests in
      the package (measured by test review); S1/S2 above now red in both directions.
- [x] a seven-row matrix published above, including the one equivalent row and the one
      covered-elsewhere row, each named as such rather than counted as a kill.
- [x] `npm run validate` green.

Deferred: three findings recorded rather than fixed here, each with its own record —
[0363](../0363-a-remedy-that-cannot-remediate-survives-one-input-over.md),
[0364](../0364-doctor-states-the-cause-and-never-the-remedy.md),
[0365](../0365-the-kernels-ondisk-union-has-no-consumers.md). See each for why it is not
this fix's scope.
