---
'@nielspeter/eess-ts': patch
---

Pin all six import-glob surfaces, and correct what 0.9 said widened

No behaviour change. Two corrections to what shipped in 0.9.0, found by a retrospective
review of [bug 0349](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0349-a-path-shaped-dependency-ban-passes-silently-under-pnpm-and-yarn.md)
— the only change in that line of work that was merged without any review.

**Two of six import-glob surfaces had no regression protection.** The test table claiming
"every import-glob surface" listed four; `onlyHaveTypeImportsFrom` and the `notImportFrom`
_predicate_ were absent, and both were measured to change under the fix. All six are pinned
now, and reverting the shared matcher reds every one.

**`dependOn` reports less under pnpm and Yarn, and 0.9 did not say so.** Widening a matcher
is fail-closed for a ban and fail-open for a requirement:

```ts
import { dependOn, onlyImportFrom } from '@nielspeter/eess-ts'
```

`dependOn('**/logging/**')` means "this module must import logging" — an import it previously
could not see now satisfies the requirement, so it enforces less than it did. Same inversion
as `onlyImportFrom`, which 0.9 _did_ declare. If you rely on a loose glob in either, tighten
it to name your own paths. `docs/migrating-to-0.9.md` is corrected.
