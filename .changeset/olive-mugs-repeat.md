---
'@nielspeter/eess-ts': patch
---

Load `eess-ts.config.ts` through jiti so the CLI works in CommonJS-default
projects. `eess-ts init` scaffolds an ESM-syntax config; in a project whose
`package.json` declares `"type": "commonjs"` (what `npm init -y` writes), the
very first `eess-ts check` crashed with "Cannot use import statement outside a
module". Fixes bug 0074.
