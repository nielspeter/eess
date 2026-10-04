---
'@nielspeter/eess-mermaid': minor
---

`extendName`, `extend` and `notExtendStereotype` walk the diagram's inheritance and realization edges

**Breaking — in both directions, on purpose.** Fixes
[bug 0374](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0374-eess-mermaid-extend-reads-one-edge.md),
under [ADR-017](https://github.com/nielspeter/eess/blob/main/adr/017-a-heritage-predicate-names-a-relation-not-a-clause.md)
rule 6: one word means one thing across the family, and `eess-ts`'s `extend` now means an
ancestor at any depth.

Until this release these read one relationship edge. In a diagram drawing `Base <|-- Mid` and
`Mid <|-- Leaf`, `extendName('Base')` selected `Mid` and not `Leaf`. Now:

- **`extendName(X)` selects more** — every class that reaches `X` through the edges.
- **`.should().extend(X)` accepts more** — a grandchild of `X` passes, including one that
  only realizes a class extending `X` (`X <|-- Mid`, `Mid <|.. Leaf`).
- **`.should().notExtendStereotype(s)` reports more** — an ancestor at any depth carrying `<<s>>`
  counts, not only the direct parent, and the message names the path to it.
- **Under `not(…)` the first two reverse.**

Which edges count is unchanged: inheritance and realization (`<|..`) alike, in either arrow
direction. That `extend` also means "implements" in a diagram is
[bug 0377](https://github.com/nielspeter/eess/blob/main/work/bugs/0377-eess-mermaid-extend-also-means-implement.md).
A cycle drawn in the diagram ends the walk. See `docs/migrating-to-0.12.md`.
