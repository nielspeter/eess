---
'@nielspeter/eess-gherkin': patch
---

**If you have run a text search over this package's `node_modules` on any version
up to 0.3.0, `dist/builder.js` was silently excluded from it. Re-run it.**

That file carried a raw `0x00` byte, used as a composite-key separator and written
where the two-character `\0` escape belonged. `tsc` copies a template literal's
source bytes into the emit, so the byte reached the published `dist/`. Every tool
that classifies files by content then treats the whole module as binary:

```
$ file node_modules/@nielspeter/eess-gherkin/dist/builder.js
… : data
$ grep -c picomatch node_modules/@nielspeter/eess-gherkin/dist/builder.js
                       # three occurrences in the file; no output, exit 1
```

No warning, no error — a search that skipped the file is indistinguishable from
one that found nothing in it. Which grep you have decides how quiet it is: BSD
grep at least says `Binary file … matches`; ugrep with `-I` (what many agent
harnesses invoke) says nothing at all and exits 1.

**Affected: 0.1.0, 0.1.1, 0.1.2, 0.3.0** — every version published so far,
including `latest`. Fixed from this release on. The rest of the family is clean.

Nothing behavioural changes: `\0` in a template literal is `U+0000`, so the key
separator is byte-identical and no API moves. Only the file becomes text again.

`check:integrity` now reads every file under `packages/*/src` as bytes and reds on
a raw NUL, per package rather than per run, so this cannot return unnoticed in a
future release. It has now been filed four times — bugs 0099 and 0144, an unmerged
2026-08-08 branch that fixed it first, and this.
