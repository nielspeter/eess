---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** the security rules — `noEval`, `noFunctionConstructor`,
`noConsole`, `noConsoleLog` and `noProcessEnv`, in every variant, and the `recommended` floor, which
uses `functionNoEval` and `functionNoFunctionConstructor` — now read a global's name through a type
assertion (`as`, `<T>`), a `satisfies` expression and a non-null assertion (`!`), none of which
changes the value at run time, and through more than one leading global object (bug 0308). Newly
reported, for example: `(globalThis as any).process.env`, `process!.env`, `(eval as any)('1')`,
`new (globalThis as any).Function(…)`, `console!.log(…)` and `window.self.eval(…)`.

A green rule may report new findings. Messages are unchanged. As with any rule that reports more, a
newly reported read above an accepted one in the same declaration takes its ordinal in a baseline,
so review that declaration's findings before regenerating it.

Still not read as the global: a cast of a local or of `this`, and a global object's name after the
first segment, such as `settings.window.process.env`. A local named like a global object is still
read as the global (bug 0305).
