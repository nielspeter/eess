---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** the `eval`, `Function` and `console` security rules —
and the `recommended` floor, which uses the first two — now report the global however its
name is spelled at the site of use (bug 0301). Newly reported:

- `globalThis.eval(…)`, `window['eval'](…)` and the indirect `(0, eval)(…)`, and the same
  through `self` and `global`
- `Function(…)` called without `new`, and `new globalThis.Function(…)`
- `console['log'](…)` and `globalThis.console.log(…)`

A codebase that was green may now report these. A member of an ordinary object that shares
the name, such as `obj.eval()`, is not reported.

`noFunctionConstructor`'s description changes from `new 'Function'` to `Function constructor`,
because it now also matches a call. A finding of that rule already recorded in a baseline is
reported once more; review it and regenerate the baseline. The other rules keep their
descriptions, so their baselines are unaffected.

The rules read names, not bindings, and that cuts both ways (bug 0305). A global bound to a
local name first — `const ev = eval`, `const { log } = console` — is still not reported. And a
local declaration that shadows a global is reported as if it were the global: a local function
named `Function`, called without `new`, is newly reported by this change, alongside the local
`class Function` and `const console` that were reported before.
