# Bug 0311: `haveCyclomaticComplexity` and `maxMethods` count their own list of members

## Status

- **State:** Draft — reproduced, and pinned by KNOWN-GAP tests.
- **Severity:** Medium — a predicate and a ceiling that disagree with the metrics rules beside them.
  Since 0306, `maxCyclomaticComplexity` measures a property whose value is a function. The
  `haveCyclomaticComplexity` predicate does not, so a class whose complex member is
  `onX = (a) => {…}` is not selected. `maxMethods` and `haveMoreMethodsThan` count declared methods,
  so a class of handler properties has none.
- **Origin:** found by the method review of
  [0306](./fixed/0306-no-silent-catch-and-no-magic-numbers-walk-their-own-member-list.md)'s fix, and
  measured then. The complexity half is a disagreement 0306's fix opened: before it, neither the
  predicate nor `maxCyclomaticComplexity` measured a function-valued property. The predicate itself
  is unchanged.
- **Reported:** 2026-09-14

## Symptom

One class of three members, written as methods and as function-valued properties:

| check                                          | methods                | function-valued properties |
| ---------------------------------------------- | ---------------------- | -------------------------- |
| `maxCyclomaticComplexity(2)`                   | `Methods.onX` reported | `Handlers.onX` reported    |
| `haveCyclomaticComplexity({ greaterThan: 2 })` | `true`                 | **`false`**                |
| `haveMoreMethodsThan(1)`                       | `true`                 | **`false`**                |
| `maxMethods(1)`                                | reported               | **not reported**           |

The `maxCyclomaticComplexity(2)` cell for the methods follows from the declared-member walk; the
tests do not run it. The other cells are pinned.

## Root cause

`haveCyclomaticComplexity` (`packages/ts/src/predicates/metrics.ts:10`) lists the bodies of methods,
constructors and accessors itself. `haveMoreMethodsThan` (`packages/ts/src/predicates/metrics.ts:69`)
and `maxMethods` (`packages/ts/src/rules/metrics.ts:230`) count through `methodCount`
(`packages/ts/src/helpers/complexity.ts:79`), which is `cls.getMethods().length`.

## Fix

The predicate reads the callable members the metrics rules measure. Whether a function-valued
property is a method for `maxMethods` and `haveMoreMethodsThan` is the fix's to decide and record: a
count that includes `onClick() {}` and skips `onClick = () => {}` lets a class stay under the ceiling
by changing syntax. #137's second architecture review asks that the member list move from
`packages/ts/src/rules/metrics.ts` to `packages/ts/src/helpers/`, where a predicate can read it
without importing from a rule.

## Verification

- [x] KNOWN-GAP tests pin today's behaviour —
      `packages/ts/tests/rules/class-metric-predicates-count-their-own-members.test.ts` ·
      `it('KNOWN GAP — haveCyclomaticComplexity does not select a class whose complex member is a function-valued property')`
      and `it('KNOWN GAP — maxMethods and haveMoreMethodsThan count declared methods only')`.
- [x] `it('CONTROL — the same members declared as methods are selected and counted')`
- [ ] the fix, the KNOWN-GAP tests inverted, a sabotage matrix
- [ ] `npm run validate` green.

Deferred: none.
