---
'@nielspeter/eess-ts': minor
---

**New:** `crossProject()` / `CrossProjectBuilder` — compare two
independently-derived key sets within one TypeScript project.

**Not marked breaking, and the reason is measured.** No published
`@nielspeter/eess-ts` (`0.1.0`, `0.1.1`, `0.2.0`, `0.2.1`) exports
`correspondence` or `CorrespondenceBuilder`, or even ships
`dist/builders/correspondence-builder.js` — so no eess-ts adopter can perform a
migration, and a `**Breaking**` lead here would head that package's changelog
with a no-op for every reader of it.

**If you are migrating from `@nielspeter/ts-archunit`** (the heritage package
this repo folds in, which does publish `correspondence` at
`dist/index.d.ts:100`), this is that API renamed. Exactly two symbols move:

**Migration:** rename the import and the call. The `.side(…).side(…)` chain and
the behaviour are unchanged — but note the violation `rule:` identity changes
with the name (`correspondence [a <-> b]` → `crossProject [a <-> b]`), and
`hashViolation` keys baselines on it, so regenerate any baseline holding these
findings. `setCorrespondence` and `CorrespondenceResult` keep their names.

```diff
-import { correspondence } from '@nielspeter/eess-ts'
-correspondence(p).side(routes, byName()).side(handlers, byName()).beComplete().check()
+import { crossProject } from '@nielspeter/eess-ts'
+crossProject(p).side(routes, byName()).side(handlers, byName()).beComplete().check()
```

**Why.** The name collided inside the family. `@nielspeter/eess` exports a
different `correspondence({ left, right })` — a kernel primitive that binds two
`Selection`s from any loaders — which `@nielspeter/eess-md` re-exports and
`docs/markdown.md` teaches. Same word, same class name, sibling packages,
incompatible signatures: a reader who learned `correspondence()` from the
markdown page and wrote it in an eess-ts rule file got a different API, and
anyone importing both dialects got a collision.

`crossProject` matches the `crossLayer` / `CrossLayerBuilder` vocabulary it
supersedes, so the family now has three distinct names for three distinct
things: `crossLayer` (deprecated), `crossProject` (two sides, one TS project),
and the kernel's `correspondence` (two selections, any loaders).

The kernel's `correspondence` is untouched, and `eess-md` is unaffected.

Renamed now rather than later because it was never released under the colliding
name — this is free today and a real migration after the next publish.
