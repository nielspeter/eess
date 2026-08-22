# NON-VACUITY FIXTURE

Deliberately violating input for the `md↔mermaid` gate. A fence that declares
`classDiagram` and then is not one. The parse-failure path is a way to fail the
build, so it owes a committed violating fixture like the two comparison submodes
already have — emptying the `catch` to a bare `continue` left every gate green
(measured, review).

```mermaid
classDiagram
class Broken {
  ((((
```
