# Bug 0355: a cardinality rule cannot tell "none exist" from "my selector broke", so a silently-emptied selector stays green

## Status

- **State:** Draft — measured in both directions, through the real `project()`.
- **Severity:** High — **a true false green.** A `.notExist()` or `.expectEmpty()`
  rule whose selector silently stops matching produces **zero findings** and exit 0.
  Every other rule shape has the ADR-010 evidence floor beneath it; these two are
  exempt from the floor _and_ from the dead-selector diagnosis, by design, and the
  design cannot tell the two cases apart.
- **Origin:** enforcement review of
  [0348](./fixed/0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md).
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

## Fix

Not decided. The shape is to separate the two questions the exemption currently
conflates:

- **"Did the selector examine zero?"** — legitimate for a cardinality rule.
- **"Could the selector have matched anything at all?"** — a property of the glob
  against the path universe, which `isDeadSite` already computes and which the
  exemption currently discards.

A cardinality rule over a **satisfiable** selector that examined zero is the
author's assertion holding. A cardinality rule over an **unsatisfiable** selector is
a configuration finding, whatever it asserts. The second is decidable today with
machinery that already exists — the exemption is applied before the question is
asked, rather than because the answer says to.

`.expectEmpty()` needs nothing here — measured, it already reports, because
`deadSelectorFindings` does not guard on `declaresEmpty()`. That asymmetry is
itself the argument for the fix: the declaration case was given a guard and the
cardinality case was not, and there is no reason in the records why.

## Related

- [0348](./fixed/0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md)
  — where this was found, and one of the three ways a selector silently empties.
- [0339](./fixed/0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md),
  [0349](./fixed/0349-a-path-shaped-dependency-ban-passes-silently-under-pnpm-and-yarn.md)
  — the other two.
- [ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md) — the floor these
  two shapes are exempt from, and the reason the exemption needs a companion rather
  than removal.

## Verification

- [x] measured in both directions, through the real `project()`: the table above,
      and the same two rules with 0348's `viewsFor` gate forced on and off — the
      cardinality rule is green in all four cells.
- [ ] a ruling on whether an unsatisfiable selector overrides the cardinality
      exemption, and whether `.expectEmpty()` is treated the same
- [ ] a red-first test: a `.notExist()` rule over an unsatisfiable selector must
      report, and over a satisfiable one must stay green
- [ ] the same question asked of `diagnose()`, so `doctor` and `check` keep agreeing
- [ ] a changeset — rules that were passing will start failing
- [ ] `npm run validate` green.

Deferred: none.
