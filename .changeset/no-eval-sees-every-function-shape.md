---
'@nielspeter/eess-ts': patch
---

Body-analysis rules now see two function shapes they previously missed.

`eval` in a concise arrow body (`() => eval(x)`) or in a function expression
(`const a = function () { … }`) passed the `recommended` floor — the preset
described as "the universal safety floor every consumer gets". Two causes: both
match paths walked descendants only, so a concise arrow's body (which _is_ the
expression) was never tested; and a `VariableDeclaration` with a
`FunctionExpression` initializer was collected by nothing.

Affects every body-analysis rule, not only `no-eval` — the traversal fix is
shared. `fromArrowVariableDeclaration` is renamed `fromFunctionInitializerDeclaration`
and kept as a `@deprecated` alias.
