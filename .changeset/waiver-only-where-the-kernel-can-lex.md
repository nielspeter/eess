---
'@nielspeter/eess': minor
'@nielspeter/eess-gherkin': minor
'@nielspeter/eess-ts': minor
'@nielspeter/eess-md': minor
'@nielspeter/eess-mermaid': minor
'@nielspeter/eess-crossvalidate': minor
---

**Breaking (@nielspeter/eess):** an exclusion comment (`eess-exclude`, `eess-exclude-start` /
`-end`) is now read only in files the kernel can lex: JavaScript and TypeScript (including Vue and
Svelte) and Markdown. In any other file, such as `.feature`, `.yml`, `.py`, `.mmd` or `.graphql`, no
directive is read.

This fixes a false green (bug 0419). Such files used to be read as if they were JavaScript, so `//`
text inside a Gherkin doc string or a YAML block scalar, which is data and not a comment, was taken as
a waiver and suppressed a real finding. Gherkin's own `#` comment was never read either.

If a build relied on a `//` waiver in one of these files, its finding now reports again. There is no
supported waiver syntax for these file types yet. Fix the finding, or narrow the rule's selection.

Every dialect that reads exclusion comments through the kernel ships this break to its adopters,
so each takes a minor bump: `@nielspeter/eess-ts` (for findings in files other than code), `@nielspeter/eess-gherkin`
(findings in `.feature` files, fixed by this), `@nielspeter/eess-mermaid` (`.mmd` files) and
`@nielspeter/eess-crossvalidate`.
