---
'@nielspeter/eess': patch
'@nielspeter/eess-ts': patch
'@nielspeter/eess-mermaid': patch
---

**Fix: a rule file may import a sibling module under `"type": "module"`.**

TypeScript requires the emitted `.js` specifier for a relative import under
`nodenext`, and Node performs no `.js` → `.ts` substitution — so the specifier
`tsc` demands is the one Node cannot resolve. The failure was
`ERR_MODULE_NOT_FOUND` rather than a `SyntaxError`, which the loader's fallback
does not recognise, so the error rethrew:

```
Error: rules.ts could not be loaded (Cannot find module '/…/sibling.js'
imported from /…/rules.ts), so none of it could be diagnosed.
```

`check`, `doctor` and `explain` all failed, and `explain` failed with a raw
stack. In practice a TypeScript ESM project could use the CLI only while every
rule fitted in one file with no local imports — the moment rules were split to
share a `project()` instance, the CLI stopped working.

The process loader now performs the substitution and the native import is
retried. Resolution is the only thing that changed; execution is untouched, so
a rule file still loads into the CLI's own module registry.

Nothing to change in your rule files. If you split them, this is the release
that lets the sibling line resolve: a relative `import { p } from './sibling.js'`
in `arch.rules.ts`, alongside the package imports it already had.

```ts
import { classes, project } from '@nielspeter/eess-ts'
```

That relative specifier names a file in your tree, not an export of ours, so it
is written here as prose rather than as a checked fence — this repo has no way
to resolve it. The gap that makes that necessary is bug 0280.

Two related repairs ship with it. `doctor` no longer suggests a test runner as
the cause for a file that imports none — the sentence misled the reporter of
this bug into concluding, in writing, that `doctor` refuses any file importing
vitest. And `eess-mermaid`'s config loader carried the same shape and takes the
same fix.
