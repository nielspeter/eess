---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts)** — `check` now fails on a rule file that
contributed **no rules**. 0.x, so a minor signals it, not a 1.0 stability claim.

It used to print `✓ eess-ts — 0 rules across 1 file · 0 failing` and exit 0. A
build that was green can now be red — which is the point: it was green over a gate
that checked nothing. `doctor` already refused the same file with "no rules found
in the given files"; the two commands now agree.

**Migration:** if a run starts failing with "contributed no rules", look at what
that file's default export actually contains. The usual cause is a preset spread
without `report: 'builders'`:

```diff
-export default [...recommended(p)]
+export default [...recommended(p, { report: 'builders' })]
```

`...recommended(p)` spreads the preset's _result_, not its builders. On a codebase
with violations that fails loudly already; **on a clean one it spreads an empty
array**, so the file exports `[]` and every rule silently disappears. That is the
case this release turns red.

If the file is deliberately empty, delete it rather than keeping a rule file that
enforces nothing.

**Migrating from `@nielspeter/ts-archunit`?** Its `recommended()` returned builders
unconditionally and had no `report` option, so the line its own `init` scaffolded is
exactly the one above. Adding `report: 'builders'` is the whole fix.
