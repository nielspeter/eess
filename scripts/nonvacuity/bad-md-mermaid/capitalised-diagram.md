# NON-VACUITY FIXTURE

Deliberately violating input for the `md↔mermaid` gate — see
`scripts/nonvacuity/bad-md-mermaid.mjs`. The same drift as `drifted-diagram.md`, in a fence tagged
`Mermaid` with a capital M: the selector compared the tag exactly, so this fence was never read
(bug 0423), and this document must fail as `leftUnmatched` too.

```Mermaid
classDiagram
class GhostClassCapitalised {
  <<kernel>>
  +vanish()
}
```
