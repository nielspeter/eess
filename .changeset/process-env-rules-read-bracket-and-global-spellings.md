---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts):** `noProcessEnv`, `functionNoProcessEnv` and `moduleNoProcessEnv`
now report `process.env` read through a string-keyed bracket (`process['env']`) or a global object
(`globalThis.process.env`, and `window`, `self` and `global`) (bug 0297). They matched the text
`process.env` only, so those reads passed.

A green rule may report new findings. The message is unchanged — `access to 'process.env'` — so
baselines keyed on it still match.

Still not reported: an environment read through a local binding, `const { env } = process` or
`import { env } from 'node:process'`, which needs the binding followed (bug 0305); and
`import.meta.env`, a bundler convention outside the rule's name.
