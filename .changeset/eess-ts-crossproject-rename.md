---
'@nielspeter/eess-ts': minor
---

**Breaking (@nielspeter/eess-ts)** — `correspondence()` and
`CorrespondenceBuilder` are renamed to **`crossProject()`** and
**`CrossProjectBuilder`**. 0.x, so a minor signals it.

**Migration:** rename the import and the call. Nothing else changes — same
builder, same `.side(…).side(…)` chain, same behaviour.

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
