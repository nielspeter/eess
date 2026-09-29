# Bug 0362: a ratchet broken by one character is green in both tools, and 0.10.0 shipped it

## Status

- **State:** Fixed — the syntactic clause restored to both tools through one shared
  predicate, with a red-first row and a four-row sabotage matrix.
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
| S1         | drop the syntactic clause — the shipped 0.10.0 bug | `agree on all three cases`                                                  |
| S2         | `diagnose` stops passing the syntactic fact        | `agree on all three cases`                                                  |
| S3         | the gate side stops collecting broken globs        | `agree on all three cases`                                                  |
| S4 REVERSE | every dead site is at fault (the over-reach)       | 3 tests, including `CONTROL: stays green when the path is genuinely absent` |

S4 is the row that matters as much as S1: the obvious over-correction — treat every
dead selector as a fault — passes the defect test and breaks every healthy ratchet.

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
- [x] a changeset — a rule that was silent will now report.
- [x] `npm run validate` green.

Deferred: none.
