# Bug 0374: `eess-mermaid`'s `extend` reads one edge, so a grandchild in a diagram is never selected

## Status

- **State:** Draft — confirmed against the source; no red test yet.
- **Severity:** High — **the same false green as
  [bug 0295](./fixed/0295-extend-and-implement-read-only-the-direct-clause.md), in a sibling
  dialect.** A selector over a diagram drops every class that reaches the named superclass
  through an intermediate one.
- **Origin:** self-found — 0295's record named the family; the fix ruled in
  [ADR-017](../../adr/017-a-heritage-predicate-names-a-relation-not-a-clause.md) and shipped
  in `eess-ts` only, to keep the change reviewable in one sitting.
- **Reported:** 2026-10-04

## Symptom

`extendName` in `packages/mermaid/src/predicates/class.ts:67` returns true only when one
relationship edge joins the class to `superName`. In a diagram drawing
`Base <|-- Mid` and `Mid <|-- Leaf`, `extendName('Base')` selects `Mid` and not `Leaf`.
The `extend` condition in the same builder has the same reading.

ADR-017 decides that a heritage word means one thing across the family: reachability, not
one clause. `eess-mermaid` breaks that today.

## Also to settle

The predicate treats realization (`<|..`, `..|>`) the same as inheritance. `eess-ts` keeps
`extend` and `implement` apart. Whether a diagram's `extend` should walk a realization edge
is part of this fix, not a separate question.

## Verification

- [ ] a red test: `extendName('Base')` over a three-level diagram selects `Leaf`
- [ ] the condition and the predicate walk the edges, with a cycle in a diagram ending the walk
- [ ] `npm run validate` green.

Deferred: none.
