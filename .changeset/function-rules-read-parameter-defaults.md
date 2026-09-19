---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** the function rules now read what a function's parameters run at
each call — a parameter's default, and a destructured parameter's defaults and computed keys at any
depth (bug 0314). They read the body only, so `function f(g = eval('w'))` passed `functionNoEval` and
the `recommended` floor. `functionNoSilentCatch` reads the same, and also a concise arrow's body, which
it skipped: `() => list.map(() => { try { … } catch { … } })`.

Affected: every function rule built on the body search — `notContain`, `contain` and `useInsteadOf` on
`functions()`, the function variants in `rules/security`, `rules/errors` and `rules/typescript`, the
`recommended` and `agentGuardrails` presets, and the `inconsistentSiblings` smell. A constructor's
parameter property is read too: `constructor(readonly f = eval('w')) {}`. The metrics measure a body's
shape and are unchanged, and a comment rule already read the parameter list.

A green rule may report new findings, and a requirement may now be met by a call in a default, as a
class member's destructured default meets a class requirement since 0.6.0. Messages are unchanged. The
parameters are read after the body, so a finding a baseline accepted in the body keeps its identity and
a new one is numbered after it.
