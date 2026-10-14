# NON-VACUITY FIXTURE

Deliberately violating input for the `md↔mermaid` gate — see
`scripts/nonvacuity/bad-md-mermaid.mjs`. The same drift as `drifted-diagram.md`,
inside a list item: a diagram nested in a list or a blockquote was never read
(bug 0290), so this document must fail as `leftUnmatched` too.

- The design:

  ```mermaid
  classDiagram
  class GhostClassNested {
    <<kernel>>
    +vanish()
  }
  ```
