# Bug 0377: `eess-mermaid`'s `extend` also means `implement`

## Status

- **State:** Draft — confirmed against the source; today's reading is pinned by tests that
  must invert.
- **Severity:** High — **a condition that passes over drift it should catch.**
  `.should().extend('Base')` passes a class that only _realizes_ `Base` (`Base <|.. Impl`), or
  realizes a class that extends it (`Base <|-- Mid`, `Mid <|.. Leaf`) — `eess-ts`'s `extend`
  reds both. As a selector it selects more, which fails closed; the condition is the false
  green, and the board's scale rates that High whatever its age.
- **Origin:** self-found while fixing
  [bug 0374](./fixed/0374-eess-mermaid-extend-reads-one-edge.md), which raised the question and
  kept the edge set unchanged rather than narrow selections inside a transitivity fix.
- **Reported:** 2026-10-04

## Symptom

`inheritsBetween` in `packages/mermaid/src/models/arch-class.ts` treats realization (`<|..`,
`..|>`) exactly like inheritance (`<|--`, `--|>`). So the dialect's `extendName`, `extend` and
`notExtendStereotype` all read "extends or implements". Since 0374 the walk also carries
`extend` through a realization edge in the middle of a chain, which widened the condition's
leniency from the direct case to the mixed one. The deprecated `fromDiagram()` bridge
(`packages/mermaid/src/bridge/from-diagram.ts`) has its own copy of the arrow set and
direction logic, and emits an `inheritance` rule ("extends") for a realization edge — a fix
changes both places.

[ADR-017](../../adr/017-a-heritage-predicate-names-a-relation-not-a-clause.md) rule 6: one word
means one thing across the family. In `eess-ts`, `extend` and `implement` are separate.

## Why it was not changed in 0374

Dropping realization from `extend` narrows every selector that relies on it, silently — a class
drawn `Operation <|.. AddOperation` (the walkthrough's own diagram) would leave
`extendName('Operation')`. That is a fail-open change, and it needs its own migration, not a
ride inside a transitivity fix. 0374 pins today's reading with
`it('a realization edge is walked like an inheritance edge, as it was before the walk')` and
`it('a realization edge mid-chain carries extend through it, as 0377 records')`, so the change
cannot happen by accident.

## Fix

**What `extend` means is decided:** ADR-017 rule 6 — the same as in `eess-ts`, where `extend`
and `implement` are separate (its C6b row is `pending` on this record). What is open is how to
get there:

- whether a diagram's dashed arrow reliably means `implements` in practice — measure first;
- whether the dialect gains an `implement` word, so a selection that relied on realization has
  somewhere to go;
- how to migrate a change that narrows selectors silently — it is a marked break, and the
  migration has to name the selectors that shrink.

## Verification

- [ ] the open questions above answered, and a design that meets rule 6
- [ ] the fix, with the pin above inverted
- [ ] `npm run validate` green.

Deferred: none.
