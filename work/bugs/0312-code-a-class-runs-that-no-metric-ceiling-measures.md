# Bug 0312: a class's static blocks and the functions nested in its property values have no metric ceiling

## Status

- **State:** Draft — reproduced, and pinned by a KNOWN-GAP test.
- **Severity:** Medium — **false green** for code of any size. `maxCyclomaticComplexity`,
  `maxMethodLines` and `maxParameters` pass a static block, a function passed through a call in a
  property's value (`onChange = debounce((e) => {…})`) and a method of an object in a property's
  value (`handlers = { onEvent() {…} }`), however complex or long.
- **Origin:** stated as a limit in
  [0306](./fixed/0306-no-silent-catch-and-no-magic-numbers-walk-their-own-member-list.md)'s fix; the
  enforcement review of 0306 asked for a home, and it was measured then.
- **Reported:** 2026-09-14

## Symptom

`maxCyclomaticComplexity(2)` and `maxMethodLines(0)` over one class, each position holding the same
three `if`s:

| position                               | measured |
| -------------------------------------- | -------- |
| `static { … }`                         | **no**   |
| `onDebounced = debounce((a) => { … })` | **no**   |
| `handlers = { onEvent(a) { … } }`      | **no**   |
| `onDirect = (a) => { … }`              | yes      |

## Root cause

The metrics rules measure callable members — declared methods, constructors and accessors, and
properties whose value is a function (`callableMembers` in `packages/ts/src/rules/metrics.ts`). None
of the three positions is one.

## Fix

A design question, not a missing branch. A static block could be measured as a member named
`Class.static`; a function nested in a property's value could be measured under the property's name,
or each function on its own. Whatever is chosen,
`it('CONTROL — a property that is not a function, and a static block, are not members a metric measures')`
in `packages/ts/tests/rules/class-rules-read-the-code-a-class-runs.test.ts` pins today's treatment of
a static block and moves with the ruling.

## Verification

- [x] KNOWN-GAP test pins today's behaviour —
      `packages/ts/tests/rules/class-code-without-a-metric-ceiling.test.ts` ·
      `it('KNOWN GAP — a static block and a function nested in a property value have no complexity or line ceiling')`,
      with the directly held `onDirect` measured as its control.
- [ ] the ruling, the fix, the KNOWN-GAP test inverted, a sabotage matrix
- [ ] `npm run validate` green.

Deferred: none.
