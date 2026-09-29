# Bug 0355: a cardinality rule cannot tell "none exist" from "my selector broke", so a silently-emptied selector stays green

## Status

- **State:** Fixed — the disk discriminator, with a red-first test through the real
  `project()` and a four-row sabotage matrix.
- **Severity:** High — **a true false green.** A `.notExist()` or `.expectEmpty()`
  rule whose selector silently stops matching produces **zero findings** and exit 0.
  Every other rule shape has the ADR-010 evidence floor beneath it; these two are
  exempt from the floor _and_ from the dead-selector diagnosis, by design, and the
  design cannot tell the two cases apart.
- **Origin:** enforcement review of
  [0348](./0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md).
  The reviewer's own framing was that 0348's gate rescues this shape; measurement
  says the gate makes no difference to it, which is what makes it a separate defect
  rather than a correction to that record.
- **Reported:** 2026-09-28

## Symptom

Measured on a two-package monorepo through `project()`, with `'apps/identity/**'` —
a project-relative glob naming a sibling package, which correctly selects nothing
from `apps/api`'s root:

| rule shape                              | findings | exit  |
| --------------------------------------- | -------- | ----- |
| `…should().notImportFrom('**/nope/**')` | **1**    | red   |
| `…should().satisfy(notExist())`         | **0**    | green |

Both rules have the same selector, selecting the same nothing. One reports; the
other is silent. The same holds for a rule carrying `.expectEmpty()`.

## Root cause

Two exemptions, each correct on its own, with no mechanism between them.

1. **The dead-selector diagnosis exempts cardinality rules.**
   `packages/ts/src/core/vacuity-diagnosis.ts:253-255`: "`.notExist()` and friends
   examine zero BECAUSE that is what they assert. Exempt since 0.34.0, and
   `diagnose()` exempts it too — the two must agree or `doctor` and `check`
   disagree about a working rule."
2. **The evidence floor exempts them too**, one line later —
   `if (facts.assertsCardinality()) return violations` (an empty array), and
   `if (!facts.declaresEmpty())` gates the zero-subjects violation, so an
   `.expectEmpty()` rule takes the `undefined` exit.

So for these shapes `examined === 0` is indistinguishable from the assertion being
satisfied — which is exactly right when the author means "none of these exist", and
exactly wrong when the selector broke. **Nothing in the stack asks whether the
selector could have matched anything**, and that is the question that separates the
two readings.

**0348's fix does not touch this.** Measured with the gate on and off: both states
give the `.notExist()` rule zero findings. The gate changes the _other_ shapes from
a generic floor finding to a precise dead-selector one.

## Why it matters more than it looks

`.notExist()` is what an adopter writes for the strongest claims they make — "this
package is gone", "no one calls this any more", "this layer has no direct database
access". Those rules are ratchets: they are supposed to stay green forever, so a
green is unremarkable and nobody looks. A rule that was _designed_ never to fire is
the worst possible host for a selector that silently stopped matching.

And the 0339 / 0348 / 0349 defect class is precisely a selector silently emptying:
a dot-directory checkout, a glob naming segments above the tsconfig root, a package
manager's layout. An adopter on any of those had every `.notExist()` rule pass
vacuously with nothing to read.

## Ruling: ask the filesystem, not the glob

**The `## Fix` this record first carried was wrong, and wrong in the direction that
would have broken every healthy ratchet.** It said "a cardinality rule over an
**unsatisfiable** selector is a configuration finding, whatever it asserts", and
proposed using `isDeadSite`. That does not work, and the reason is the whole
difficulty of this bug:

> `modules(p).that().resideInFolder('**/legacy/**').should().notExist()` — after you
> delete `legacy/`, the glob matches nothing **because the rule is working**.

A holding ratchet and a broken selector are _identical_ from the glob and the path
universe: both match zero. Reporting on unsatisfiability would fire on every
`.notExist()` rule that is doing its job, which is the loudest possible false
positive and would have the exemption reinstated within a release.

**What separates them is the filesystem, and eess already asks it.** `diskSet` walks
the repository and classifies a glob as `holds-typescript`, `no-typescript`,
`absent` or `not-determined` — a fact about disk, independent of what the project
loaded. Measured, on a fixture where `apps/legacy/` exists on disk but sits outside
`apps/api`'s tsconfig `include`:

| case                                                       | subjects | findings today | `diskSet.classify` |
| ---------------------------------------------------------- | -------- | -------------- | ------------------ |
| files **exist on disk**, rule examined 0 — broken selector | 0        | **0**          | `holds-typescript` |
| path **genuinely absent** — the ratchet holding            | 0        | 0              | `absent`           |

So the ruling:

**A cardinality rule that examined zero is a finding only when the path it names
holds TypeScript on disk.** The code you are asserting does not exist is right
there, and your rule did not see it. That is not the assertion holding; it is the
selector failing to reach the thing the assertion is about.

`absent` stays green — that is the ratchet working, and it is the common case.
`no-typescript` stays green: no TypeScript there means no modules there, which is
what the rule asserts. `not-determined` stays green, because blaming the author for
a walk we could not complete is the confidently-wrong remedy `disk-set.ts` exists
not to give.

### What this costs, stated before it is built

The check is **not free**: it needs the disk walk, which `deadSelectorFindings`
reaches only when a rule is already suspect. Ordering matters — ask only after
`examined === 0`, never on the common path.

And it **inherits [0352](../0352-disk-set-offers-the-repo-root-naming-to-a-glob-the-matcher-refuses.md)**:
`disk-set` gates both of its prefixes on `readsRootRelativePath`, so a
project-relative glob naming a sibling package classifies `holds-typescript` when
the matcher refuses it the repo-root naming. For this rule that produces a finding
whose _message_ names the wrong cause. The finding itself is still correct — the
selector genuinely did not reach files that are there — so 0355 does not wait on
0352, but the two should land near each other.

## The sabotage matrix

Four rows and a clean control, each a literal edit to the shipped source, restored
from a sha256-verified backup.

| row        | the edit                                                | what reddened                                                                  |
| ---------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| R0 CONTROL | none                                                    | nothing — green, as a control must be                                          |
| R1         | the exemption is total again (the pre-fix code)         | `reports when the path it asserts about holds TypeScript on disk`              |
| R2         | drop the disk gate: every dead selector reports         | `CONTROL: stays green when the path is genuinely absent — the ratchet holding` |
| R3         | accept any on-disk answer except `not-determined`       | `CONTROL: stays green when the path is genuinely absent`                       |
| R4 REVERSE | break the POSITIVE-assertion path this fix leaves alone | `CONTROL: a positive-assertion condition still reports, as it always did`      |

**R1 is the pass-prevention row.** With the fix removed the rule reports _nothing_ and
the build is green, so the test catches a false green rather than a degraded message.
0348's review measured that a matrix whose every row moves a finding from precise to
degraded proves attribution and never proves the guard stops a bad pass; this one has
the row that does.

**R2 and R3 are the rows that matter most for a fix of this shape**, because the
obvious over-reach — report whenever a cardinality rule examines zero — passes the
defect test and breaks every healthy ratchet. Both red the control that pins it.

## Found while fixing, filed rather than widened

- [0357](../0357-doctor-reports-a-healthy-ratchet-as-a-dead-glob.md) — `doctor` reports
  a _healthy_ `.notExist()` ratchet as a dead glob, where `check` correctly stays
  green. Measured across three globs in both tools. It is **pre-existing**: before
  this fix the two disagreed on two of three rows, and now on one. `diagnose()`
  exempts cardinality in `zeroSubjectsFinding` and not on its dead-glob path, so it
  never reaches the exemption. Not widened into this fix — the same discriminator
  applies, but where the shared derivation should live is a decision, and this pair
  has already grown two hand-maintained copies of one rule once.

## Related

- [0348](./0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md)
  — where this was found, and one of the three ways a selector silently empties.
- [0339](./0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md),
  [0349](./0349-a-path-shaped-dependency-ban-passes-silently-under-pnpm-and-yarn.md)
  — the other two.
- [ADR-010](../../../adr/010-a-pass-is-constructed-from-evidence.md) — the floor these
  two shapes are exempt from, and the reason the exemption needs a companion rather
  than removal.

## Verification

- [x] measured in both directions, through the real `project()`: the table in the
      ruling, plus the same two rules with the gate on and off.
- [x] the ruling derived and **corrected** — the first `## Fix` this record carried
      keyed on glob satisfiability and would have fired on every healthy ratchet.
      Recorded rather than rewritten, because the wrong version is the difficulty of
      this bug.
- [x] a red-first test through the real `project()`, not a hand-built `ArchProject`:
      `packages/ts/tests/core/a-cardinality-rule-sees-a-dead-selector.test.ts`.
      Confirmed red on the defect, green on four controls.
- [x] a sabotage matrix — 4 rows and a clean control, published above, including the
      pass-prevention row and a reverse row.
- [x] `.expectEmpty()` confirmed unaffected: it was never exempt from the
      dead-selector diagnosis and already reported.
- [x] the same question asked of `diagnose()` — measured, and the answer is that
      `doctor` and `check` did **not** already agree. This fix takes them from
      disagreeing on two of three cases to one; the remainder is filed as 0357.
- [x] a changeset — rules that were passing will start failing.
- [x] `npm run validate` green.

Deferred: none.
