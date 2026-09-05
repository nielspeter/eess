# Bug 0257: path-suffix resolution is implemented twice, in two dialects, with two shapes

## Status

- **State:** Fixed — one resolver in the kernel, called by both dialects; the
  second copy is deleted, not left beside it.
- **Severity:** Low — both implementations are correct and tested. It is filed
  because the second one was just _widened_ rather than converged, and the next
  dialect that needs the algorithm will be the third.
- **Origin:** self-found · architect review of
  [0254](./0254-an-ambiguous-pointer-passes-and-is-counted-as-grounded.md),
  which added the ambiguous class to `eess-md` by hand-writing logic
  `eess-crossvalidate` already had.
- **Reported:** 2026-09-05

## Symptom

Two packages answer the same question — _given a path and a set of
repo-relative paths, which one does it name?_ — with the same three-way answer
(exact / unique suffix / ambiguous) and the same remedy in the message.

`packages/crossvalidate/src/shared.ts:47`:

```typescript
export function resolveFeature(path: string, set: FeatureSet): readonly string[] {
  const all = set.features().map((f) => f.relPath)
  if (all.includes(path)) return [path]
  return all.filter((rel) => rel.endsWith(`/${path}`))
}
```

`packages/md/src/conditions/pointer-resolve.ts`'s `uniqueSuffix()` is the same
algorithm with a basename pre-index and a tagged-union return instead of an
array. Both then classify `length > 1` as ambiguous and emit a message telling
the author to cite a longer suffix.

The wordings even agree, which is the tell that this is one concept:

- crossvalidate: ``cites `X` — ambiguous, matches N feature files (…)`` ·
  _"an ambiguous citation cannot be mechanically resolved; cite a longer suffix"_
- eess-md, as of 0254: `ambiguous code pointer: "X" matches N files (…) — cite a
longer suffix so it names one`

## Why it is filed rather than fixed

0254's record used crossvalidate's behaviour as its design justification — _"the
family already knows the right answer"_ — and then re-implemented that answer in
the second dialect instead of extracting it. That is the pattern
[`review-proposal`](../../../.claude/skills/review-proposal/SKILL.md) names as the
#1 failure mode, committed in a fix whose own argument was the precedent.

It is Low because the duplication predates 0254 (the exact/unique/none paths were
already bespoke) and because neither copy is wrong. What 0254 changed is the
size of the shared surface: before, the two agreed on resolution; now they agree
on resolution **and** classification **and** the remedy text. Three concepts in
two places is where a divergence starts costing something — one dialect gains a
`--suggest-suffix` autofix or a case-insensitive mode and the other silently does
not.

## Fix

`packages/core/src/path-suffix.ts` — `pathSuffixIndex(paths)`, returning
`exact` / `unique` / `ambiguous` / `none` with the candidates.

**Placement: the kernel, behind `/internal`.** It is pure string work over a list
of paths — no `ArchProject`, no ts-morph, nothing dialect-shaped — which is
exactly `path-universe.ts`'s own argument for living there, and satisfies
[ADR-013](../../../adr/013-the-kernel-takes-the-fact-not-the-project.md)'s test: the
kernel takes the _fact_ (a list of paths), not the project that produced it. It is
family plumbing rather than public API, so `internal.ts` exports it (ADR-011).

**An index rather than a two-argument function**, because `eess-md` resolves
hundreds of citations against thousands of paths and had built a last-segment
index for exactly that reason. `eess-crossvalidate` gains it: `resolveFeature`
rebuilt its path list on every citation, and `featurePaths(set)` is now built once
per binding.

**What each caller kept.** The policy, which genuinely differs: whether a `none`
is broken, whether an `ambiguous` fails or warns, when to consult external roots,
what the message says. The primitive answers one question — _which path did they
mean?_ — and the ambiguity messages already agreed after bug 0254, so nothing had
to converge.

### The original text, kept

Extract one primitive — _resolve a path against a set of repo-relative paths,
returning exact / unique / ambiguous with the candidates_ — and have both
dialects call it. Placement is the open question and the reason this is a record
rather than a patch:

- **`packages/core`** if it is genuinely dialect-independent. It is pure string
  work over a path set, needs no `ArchProject` and no ts-morph, and
  [ADR-013](../../../adr/013-the-kernel-takes-the-fact-not-the-project.md)'s test —
  does the kernel take the _fact_ rather than the project? — is satisfied: the
  fact is a list of paths.
- **A shared helper in one dialect** if the kernel should not grow a
  path-resolution concept it has lived without.

The message wording should converge with it, or the extraction has only moved
the duplication down a layer.

**Do not take this as a licence to unify the two callers' behaviour.** They
differ where they should: crossvalidate resolves `.feature` files and `eess-md`
resolves any repo file, and `eess-md` additionally supports `exact` mode and
`externalRoots`. The primitive is the classification, not the policy.

## Verification

- [x] One implementation, called by both dialects. **`resolveFeature` is deleted**
      — `grep resolveFeature packages/*/src` returns nothing but this record's
      own history. `eess-md`'s `uniqueSuffix()` and its basename index are gone
      with it.
- [x] Both dialects' existing tests pass **unchanged**: `eess-md` 119,
      `eess-crossvalidate` 92, no test edited. An extraction that needed its
      callers' tests rewritten would not be behaviour-preserving.
- [x] A sabotage of the shared primitive reds **both** dialects: returning only
      the first candidate of an ambiguity fails 2 tests in `eess-md`, 2 in
      `eess-crossvalidate`, and 1 in the kernel. That is the evidence both really
      call it, rather than still carrying their own copies.
- [x] The ambiguity messages already agreed — bug 0254 converged `eess-md`'s
      wording on `eess-crossvalidate`'s, which is what made this duplication
      visible in the first place. Nothing had to change.
- [x] 8 kernel tests over the primitive, covering the cases the callers depend
      on: exact beating an ambiguity it is part of, the `/` boundary, and every
      candidate coming back rather than the first.

**One measurement worth recording, because it reads as a gap and is not.**
Breaking the `/` boundary — so a suffix matches as a bare substring — reds the
kernel's tests and **neither dialect's**. Before this change neither dialect
tested that property either; now it is tested once, where the code lives.
Requiring both callers to re-assert it would rebuild the duplication in the
tests, which is the thing this record is about.

Deferred: none.

## Related

- [0254](./0254-an-ambiguous-pointer-passes-and-is-counted-as-grounded.md)
  — added the third shared concept, and cited the other implementation as its
  own justification for doing so.
- [ADR-013](../../../adr/013-the-kernel-takes-the-fact-not-the-project.md) — the
  test for whether this belongs in the kernel.
