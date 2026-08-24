---
'@nielspeter/eess-gherkin': patch
---

`packages/gherkin/src/builder.ts` carried a raw `0x00` byte as a composite-key
separator, written where the two-character `\0` escape belonged. The runtime
string is identical either way, so nothing behavioural changes — but every tool
that classifies files by content treated the whole builder as binary, which
means `grep` and `rg` silently skipped it and `git diff` rendered it as
`Bin … bytes` instead of a patch. It had been that way since the package was
created on 2026-07-13.

That is observable to an adopter: searching the installed package for a symbol
defined in that file returned nothing, with no warning and no error.

`check:integrity` now reads every `packages/*/src/**/*.ts` as bytes and reds on
a raw NUL, so the class cannot come back quietly (it has now been filed three
times — bugs 0099, 0144, and this one).
