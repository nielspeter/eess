---
'@nielspeter/eess': minor
'@nielspeter/eess-md': patch
'@nielspeter/eess-crossvalidate': patch
---

One path-suffix resolver, shared by the dialects that had written it twice

`eess-md` resolved `path:line` code pointers against the repo's file index;
`eess-crossvalidate` resolved `.feature` citations against a feature set. Same
algorithm, same three-way answer (exact / unique suffix / ambiguous), same
exact-wins precedence — and, after the ambiguity work in bug 0254, the same
"cite a longer suffix" remedy. Two implementations of one idea.

`pathSuffixIndex` now lives in the kernel behind `@nielspeter/eess/internal`, and
both dialects call it. It is pure string work over a list of paths — no
`ArchProject`, no ts-morph — which is the same argument `PathUniverse` already
makes for living there.

**No behaviour changes.** Both dialects' existing tests pass unchanged (119 and
92, none edited), and the messages were already identical. `eess-crossvalidate`'s
internal `resolveFeature` is deleted; it was not reachable through the package's
`exports` map, so nothing an adopter could import has moved.

One small improvement rode along: `resolveFeature` rebuilt its path list on every
citation, and the index is built once per binding.

`@nielspeter/eess` takes a `minor` because `/internal` is a published subpath and
this adds an export to it. The dialects take a `patch` — they lost private code
and gained nothing an adopter can observe.
