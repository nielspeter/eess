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
out, in order of preference: cite a longer suffix (the message tells you the
candidates); sanction the region with
`<!-- eess-exclude-start <rule-id>: reason -->` where the citation is
deliberately historical; or move that rule to `.warn()` while you work through
them.

No autofix is attached, deliberately — choosing among the candidates is a
judgement, and a deterministic rewrite would pick whichever sorted first.
`exact` mode is unaffected (it never consulted suffix matching), and a corpus
with `externalRoots` still gets to resolve there first: an in-repo ambiguity is
not evidence about an external checkout.

`@nielspeter/eess-crossvalidate` is named here because it depends on `eess-md`;
its own behaviour is unchanged.
