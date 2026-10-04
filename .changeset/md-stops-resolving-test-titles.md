---
'@nielspeter/eess-md': minor
'@nielspeter/eess-crossvalidate': none
---

`adrEnforcement` no longer resolves cited `it('…')` titles — only cited file paths

**Breaking.** Fixes
[bug 0111](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0111-md-adr-citations-resolve-by-prefix.md).

`adr/citations-resolve` read test files as text and matched a cited title as a **prefix**:
`it('r')` resolved against any test whose title began with `r`, so a renamed test kept its
citation green. Making it exact was not enough — read as text, a title in a commented-out
test, a string or `submit('…')` still resolved, and telling those apart needs a TypeScript
lexer that a markdown dialect should not carry.

So `eess-md` now checks only that the file paths a Mechanism cell cites exist. Whether a cited
title names a real test is answered by `eess-crossvalidate`'s `adrCitationsResolve`, which
reads the test AST.

**If your ADRs cite test titles, run `adrCitationsResolve` as well.** With `eess-md` alone,
nothing verifies a title. Previously something did, wrongly; a citation that only resolved by
prefix was never checked at all.
