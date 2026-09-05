# Bug 0257: path-suffix resolution is implemented twice, in two dialects, with two shapes

## Status

- **State:** Draft — a duplication finding, not a defect. Nothing is wrong today.
- **Severity:** Low — both implementations are correct and tested. It is filed
  because the second one was just _widened_ rather than converged, and the next
  dialect that needs the algorithm will be the third.
- **Origin:** self-found · architect review of
  [0254](./fixed/0254-an-ambiguous-pointer-passes-and-is-counted-as-grounded.md),
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
[`review-proposal`](../../.claude/skills/review-proposal/SKILL.md) names as the
#1 failure mode, committed in a fix whose own argument was the precedent.

It is Low because the duplication predates 0254 (the exact/unique/none paths were
already bespoke) and because neither copy is wrong. What 0254 changed is the
size of the shared surface: before, the two agreed on resolution; now they agree
on resolution **and** classification **and** the remedy text. Three concepts in
two places is where a divergence starts costing something — one dialect gains a
`--suggest-suffix` autofix or a case-insensitive mode and the other silently does
not.

## Fix (not built)

Extract one primitive — _resolve a path against a set of repo-relative paths,
returning exact / unique / ambiguous with the candidates_ — and have both
dialects call it. Placement is the open question and the reason this is a record
rather than a patch:

- **`packages/core`** if it is genuinely dialect-independent. It is pure string
  work over a path set, needs no `ArchProject` and no ts-morph, and
  [ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md)'s test —
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

- [ ] One implementation, called by both dialects; the second copy is deleted,
      not left beside the shared one.
- [ ] Both dialects' existing tests still pass unchanged — the extraction is
      behaviour-preserving or it is not an extraction.
- [ ] A sabotage of the shared primitive reds tests in **both** dialects, which
      is the evidence that both really call it.
- [ ] The ambiguity messages agree, or the record says why they should not.

## Related

- [0254](./fixed/0254-an-ambiguous-pointer-passes-and-is-counted-as-grounded.md)
  — added the third shared concept, and cited the other implementation as its
  own justification for doing so.
- [ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md) — the
  test for whether this belongs in the kernel.
