---
'@nielspeter/eess': patch
'@nielspeter/eess-md': patch
'@nielspeter/eess-ts': patch
'@nielspeter/eess-mermaid': patch
---

The family loads under Bun again

Fixes [bug 0439](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0439-the-family-fails-to-load-under-bun-from-eess-0-5-1.md).
From eess 0.5.1 on, importing most entries under Bun failed at link time with
`SyntaxError: Export named 'registerHooks' not found in module 'node:module'`, including eess-md's
`corpus()`, which has nothing to do with the CLI: the kernel imported `registerHooks` by name for the
CLI's resolve hook, and Bun's `node:module` has no such export. The kernel now imports `node:module`
as a namespace. All 28 published entries and both CLIs load under Bun 1.4.3, and CI checks that on
every change (plan 0448). This is a load guard, not a claim: no package claims Bun support yet
(ADR-020), and Node stays every package's runtime.
