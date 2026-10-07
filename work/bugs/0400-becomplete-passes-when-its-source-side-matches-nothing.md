# Bug 0400: `beComplete()` passes when its source side matches nothing

## Status

- **State:** Draft — reproduced 2026-10-07 against this repo's build at `9d18f0e`, with the kernel
  alone and with an eess-md composition. No red test yet.
- **Severity:** High — **a false green.** A `correspondence()` whose checked side selects nothing,
  because a predicate, glob or marker is wrong, passes and reports nothing. The rule looks
  enforced and checks nothing.
- **Origin:** self-found 2026-10-07, measuring the composition proposal 013 describes, after an
  inbound question from a consuming project.
- **Reported:** 2026-10-07

## Symptom

```ts
import { correspondence } from '@nielspeter/eess'
const side = (label: string, names: string[]) => ({
  elements: names.map((name) => ({ name })),
  label,
  identify: (e: { name: string }) => ({ name: e.name }),
})
export default [
  correspondence({ left: side('left', []), right: side('right', ['x']) })
    .should()
    .beComplete({ direction: 'left-to-right' })
    .rule({ id: 'min/empty-left' }),
  correspondence({ left: side('left', []), right: side('right', []) })
    .should()
    .beComplete({ direction: 'both' })
    .rule({ id: 'min/both-empty' }),
]
```

`eess-ts check` over that file prints `✓ eess-ts — 2 rules across 1 file · 0 failing`, exit 0.
Giving the left side one element, `y`, reds as expected: `left "y" has no matching right`.

The same pass, through eess-md: a reciprocity rule whose left side is the links on a
`**Related to:**` line stays green when the predicate's marker is misspelt, while such lines exist.

## Reproduction

The rule file above, run with `node packages/ts/dist/cli/bin.js check <file>` from a directory
that links `@nielspeter/eess` and `@nielspeter/eess-ts` to this repo's packages. About 25 ms.

## Root cause

`beComplete()` is marked cardinality-exempt (`packages/core/src/correspondence.ts:104-115`), so the
zero-examined finding never fires for it. The reason is written down
(`packages/core/src/correspondence.ts:143-156`): an empty selection can be "the correctly computed
input (e.g. release-gate's 'no packages changed this diff' on a clean tree), not a broken
instrument".

That is true of some empty selections and false of others, and nothing tells them apart. It is
[bug 0355](./fixed/0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md)'s class ("a cardinality rule cannot tell 'none exist' from 'my selector broke'"), fixed
for eess-ts's `.notExist()` by asking the disk. `correspondence()` has no such check.

There is a second, smaller defect behind it. `examined` counts both sides
(`packages/core/src/correspondence.ts:139`), but with `direction: 'left-to-right'` nothing on the
right is checked. If the exemption were narrowed, a non-empty right side would still read as
evidence for a check that asserted nothing.

## Fix

Not designed. A rule whose checked side is empty must either be reported, or have declared that
empty is expected (the way `.expectEmpty()` declares it elsewhere), so the release gate's clean
tree stays green by declaration and a broken selector stops passing. `examined` counts only the
sides the direction checks.

## Verification

- [ ] Red test written first: a `left-to-right` `beComplete()` over an empty left side, with no
      declaration, is reported
- [ ] the same rule, declared expected-empty, stays green, and this repo's release gate stays
      green on a clean tree
- [ ] `examined` for a one-directional check counts only the checked side
- [ ] `npm run validate` green.

Deferred: none.
