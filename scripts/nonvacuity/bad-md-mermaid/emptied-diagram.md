# NON-VACUITY FIXTURE

Deliberately violating input for the `md↔mermaid` gate — see
`scripts/nonvacuity/bad-md-mermaid.mjs`. A syntactically valid but
content-free `classDiagram` fence: zero classes. Under `completeness: 'both'`
every real `packages/core` class must fail as `rightUnmatched` (the code has
classes the diagram doesn't). Under the unstated `left-to-right` default this
would vacuously pass — an empty left side satisfies "every diagram class has a
matching code class" trivially — which is exactly the hole plan 0096 closes.

```mermaid
classDiagram
%% deliberately empty — no class declarations
```
