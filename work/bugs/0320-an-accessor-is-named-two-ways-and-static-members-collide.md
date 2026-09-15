# Bug 0320: an accessor is named two ways, and a static member is named like its instance twin

## Status

- **State:** Draft — reproduced on 0315's build, and pinned by KNOWN-GAP tests.
- **Severity:** Medium — **an exclusion reaches further than it says.** No spelling names one of two
  same-named members, so `.excluding('Box.get size')` written for the instance getter excludes the
  static getter too, and nothing says so. One accessor also has two names in two reports.
- **Origin:** #140's product, architecture, enforcement, method and testing reviews, 2026-09-15,
  reviewing
  [0315](./fixed/0315-the-function-builder-does-not-collect-constructors-accessors-or-wrapped-functions.md)'s
  fix; split from it.
- **Reported:** 2026-09-15

## Symptom

One class, on 0315's build, under a complexity ceiling of 1; every body has complexity 4:

```ts
export class Box {
  static get size() { … } // line 3
  get size() { … } // line 4
  set size(v: number) { … } // line 5
  static make() { … } // line 6
  make() { … } // line 7
}
```

| line | `classes()` · `maxCyclomaticComplexity(1)` | `functions()` · `maxFunctionComplexity(1)` |
| ---- | ------------------------------------------ | ------------------------------------------ |
| 3    | `Box.size`                                 | `Box.get size`                             |
| 4    | `Box.size`, identity suffixed `#1`         | `Box.get size`, identity suffixed `#1`     |
| 5    | `Box.size`, identity suffixed `#2`         | `Box.set size`                             |
| 6    | `Box.make`                                 | `Box.make`                                 |
| 7    | `Box.make`, identity suffixed `#1`         | `Box.make`, identity suffixed `#1`         |

Measured the same way:

- **An exclusion takes the twins with it.** On the function side `.excluding('Box.get size')` leaves
  lines 5, 6 and 7, and `.excluding('Box.make')` leaves 3, 4 and 5; on the class side
  `.excluding('Box.size')` leaves 6 and 7. None of the three prints anything, the silence
  [0298](./0298-an-exclusion-that-absorbs-several-subjects-says-nothing.md) records for a pattern that matches several subjects.
- **One accessor, two names.** An adopter running both ceilings sees `Box.size` in one report and
  `Box.get size` in the other, and an exclusion written in one spelling does not reach the other
  report.
- **Baselines are not affected.** Each finding's identity is distinct, the second of a name suffixed by
  its position, so a baseline keeps the twins apart.

## Root cause

A member's name says neither whether it is static nor, on the class side, whether it is an accessor.
The class metrics name each callable member `Class.member` in `callableMembers`
(`packages/ts/src/rules/metrics.ts:25`). 0315 names a function-side accessor `get x` or `set x` in
`classMemberFunctions` (`packages/ts/src/models/arch-function.ts`), and marks nothing static. Methods
carried the static collision on both sides before 0315.

## Fix

One member naming for both sides, in one helper both use. #140's architecture review proposed a
`classCallableMembers(cls)` in `helpers/` returning each member's node, kind and name, shared by the
function collection, `rules/metrics.ts` and [0311](./0311-the-class-metric-predicates-and-max-methods-count-their-own-members.md)'s predicates. The name should
tell two members apart: `get` or `set` for an accessor, and a mark for a static member. A name is part
of a finding's identity once it ships, so a rename is breaking for a baselined finding and wants its
migration stated. Whether an exclusion that matches several findings should say so is 0298's question,
for a name as for a pattern.

## Verification

- [x] KNOWN-GAP tests pin today's behaviour —
      `packages/ts/tests/rules/an-accessor-is-named-two-ways-and-static-members-collide.test.ts` ·
      `it('KNOWN GAP — a class metric names an accessor by its name alone, a function metric with get or set')`,
      `it('KNOWN GAP — a static member and an instance member of one name report the same element and message')`,
      whose control asserts the five identities on each side are distinct, and
      `it('KNOWN GAP — an exclusion naming one of two same-named members excludes both')`.
- [ ] the fix, the KNOWN-GAP tests inverted, a sabotage matrix
- [ ] `npm run validate` green.

Deferred: none.
