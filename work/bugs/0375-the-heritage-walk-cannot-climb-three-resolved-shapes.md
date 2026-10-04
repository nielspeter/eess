# Bug 0375: the heritage walk cannot climb three shapes the checker does resolve

## Status

- **State:** Draft — measured by a probe that copies the walk; no red test yet.
- **Severity:** High — **0295's false green at a different boundary.** A selector drops a
  descendant, and `examined` stays above zero. Nothing selected before 0295 is dropped:
  the direct check missed these too.
- **Origin:** self-found — enforcement review of the 0295 fix, recorded rather than folded
  in.
- **Reported:** 2026-10-04

## Symptom

[ADR-017](../../adr/017-a-heritage-predicate-names-a-relation-not-a-clause.md) makes
`extend` and `implement` walk the chain. Measured over an in-memory project with every name
resolved, three shapes stop the walk:

| shape                                                                              | rule                        | result    |
| ---------------------------------------------------------------------------------- | --------------------------- | --------- |
| `const Mid = class extends Base {}; class Leaf extends Mid {}`                     | `extend('Base')` on `Leaf`  | **false** |
| `type Both = IBase & IOther; interface I extends Both {}; class C implements I {}` | `implement('IBase')` on `C` | **false** |
| `class ImplBase implements IBase {}; class C implements ImplBase {}`               | `implement('IBase')` on `C` | **false** |

Shapes that do walk, measured in the same probe: a mixin call, `const X = M(Base)`,
`const Alias = Base`, a factory function's return, and `interface X extends AliasOfIBase`.

## Root cause

`packages/ts/src/helpers/heritage.ts`: `classChain` climbs through `getBaseClass()`, which
returns only a `ClassDeclaration`, so a class expression ends it. `interfacesOf` keeps only
`InterfaceDeclaration`s from a clause's symbol, so an intersection (no single symbol) and a
class named in `implements` end it.

## Fix

Not decided. Each shape has an obvious extension — climb a class expression, split an
intersection into its members, walk a class named in `implements` as its own heritage — and
each needs its own decision about whether ADR-017 means it. A class in `implements` is the
least obvious: TypeScript treats it as its instance type, which is structural, not a heritage
link.

## Verification

- [ ] red tests through the public builder, one per shape
- [ ] the fix, or a recorded decision per shape that it is out of the relation
- [ ] `npm run validate` green.

Deferred: none.
