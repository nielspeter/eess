---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** the function rules now read what a function's parameters run — a
parameter's default, and a destructured or rest parameter's defaults and computed keys at any depth
(bug 0314). A default runs whenever its argument is omitted, and it is read as the function's code, as a
class member's is. The rules read the body only, so `function f(g = eval('w'))` passed
`functionNoEval` and the `recommended` floor. `functionNoSilentCatch` reads the same, and also a concise
arrow's body, which it skipped: `() => list.map(() => { try { … } catch { … } })`.

Affected: every function rule built on the body search — `notContain`, `contain` and `useInsteadOf` on
`functions()`, the function variants in `rules/security`, `rules/errors` and `rules/typescript`,
`mustCall` in `rules/architecture`, the `contain`, `notContain` and `useInsteadOf` conditions of
`resolvers()` in `@nielspeter/eess-ts/graphql`, the `recommended` and `agentGuardrails` presets, and
the `inconsistentSiblings` smell. A constructor's parameter property is read too:
`constructor(readonly f = eval('w')) {}`. The metrics measure a body's shape and are unchanged, and a
comment rule already read the parameter list.

A green rule may report new findings, and a requirement — `contain`, `mustCall`, the good side of
`useInsteadOf` — may now be met by a call in a default, as a class member's destructured default meets a
class requirement since 0.6.0. Messages are unchanged. Within one function, the parameters are read after
the body, so a finding a baseline accepted there keeps its identity. Across functions that share an
identity scope — a static and an instance method of one name, an object literal's methods — it is not
kept: as with any rule that reports more, a newly reported finding above an accepted one takes its
ordinal, the accepted one is reported as new and the new one is hidden until the baseline is reviewed.
Review those findings before regenerating it.
