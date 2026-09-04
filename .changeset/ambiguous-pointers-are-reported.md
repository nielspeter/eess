---
'@nielspeter/eess-md': minor
'@nielspeter/eess-crossvalidate': patch
---

**Breaking (behavioural):** an ambiguous code pointer is now a violation instead of being skipped

`pointers().should().resolve()` in `suffix` mode classified a pointer matching
two or more files as `ambiguous` and returned no violation for it — the source
comment read "reported elsewhere, never failed". There was no elsewhere: nothing
counted, printed or surfaced an ambiguous pointer, and it stayed inside the
denominator the caller reports. In this repo's own corpus that was **16 of 463
live pointers** sitting inside a summary line reading "all ground in code",
having grounded in nothing. Two resolved by hand were pointing at the wrong
file's line and could not have failed.

An ambiguous pointer now produces a violation naming every candidate and the
remedy:

```
ambiguous code pointer: "rule-builder.ts:1" matches 2 files
(packages/core/src/rule-builder.ts, packages/ts/src/core/rule-builder.ts)
— cite a longer suffix so it names one
```

This matches `@nielspeter/eess-crossvalidate`, which has always reported an
ambiguous citation as a violation with the same remedy.

**Why this is marked breaking on a `0.x` minor rather than a patch:** it can turn
a green build red without the consumer changing a line. If your corpus has bare
filenames that match several files, `check()` will now fail on them. Three ways
out, in order of preference:

1. **Cite a longer suffix** — the message names the candidates, so the shortest
   disambiguating prefix is visible without opening either file.
2. **Sanction the region** where the citation is deliberately historical:
   `<!-- eess-exclude-start <rule-id>: reason -->` … `<!-- eess-exclude-end -->`.
   **This requires `.rule({ id })` on the chain**, because an exclusion comment
   matches a violation by rule id and a chain without `.rule()` has none — the
   comment is then silently inert, with no diagnostic. So
   `pointers(c).that().areLive().should().resolve().check()` (the form this
   README shows) must become
   `pointers(c).that().areLive().should().resolve().rule({ id: 'my/pointers' }).check()`
   before any sanction takes effect. This prerequisite is not new, but it was
   only ever written down in `docs/violation-reporting.md`, far from the place
   you need it.
3. **Move that rule to `.warn()`** while you work through them — reports without
   touching the exit code.

No autofix is attached, deliberately — choosing among the candidates is a
judgement, and a deterministic rewrite would pick whichever sorted first.
`exact` mode is unaffected — it never consulted suffix matching, so it cannot
produce an ambiguity.

With `externalRoots` configured, a root that **resolves** the pointer still wins:
an in-repo ambiguity is not evidence about an external checkout. If the roots do
not resolve it — including when none of them is present on disk — the ambiguity
is reported, naming the roots that were searched. Those two exits used to skip
silently and to report a false `not in the repo` respectively; both are fixed
here and both now have tests.

`@nielspeter/eess-crossvalidate` is named as a courtesy, not because the gate
required it: its dependency on `eess-md` is an **optional peer**, and every
import is `import type`, so `check:release`'s dependents graph (which is scoped
to real `dependencies`) never asked for it. Its own ambiguous-citation handling
is separate, pre-existing code. **Nothing about its behaviour changes** — if you
use crossvalidate, there is nothing here to migrate.
