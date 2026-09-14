---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** `noProcessEnv`, `functionNoProcessEnv` and `moduleNoProcessEnv`
now report `process.env` read through a string-keyed bracket (`process['env']`) or a global object
(`globalThis.process.env`, and `window`, `self` and `global`) (bug 0297). They matched the text
`process.env` only, so those reads passed.

A green rule may report new findings. The message is unchanged — `access to 'process.env'` — so a
baseline keeps its count of accepted findings. Which read an entry covers can move: identities are
numbered within a member, so a newly reported read above an accepted one takes its ordinal. The
accepted read is then reported as new, and the new one is hidden until the baseline is reviewed.

Still not reported:

- an environment read through a local binding, `const { env } = process` or
  `import { env } from 'node:process'`, which needs the binding followed (bug 0305);
- `import.meta.env`, a bundler convention outside the rule's name.

Reading names rather than bindings cuts the other way too (bug 0305): a local named `global`,
`window` or `self` is read as the global object, so `function f(global: Config) { return
global.process.env }` is newly reported.
