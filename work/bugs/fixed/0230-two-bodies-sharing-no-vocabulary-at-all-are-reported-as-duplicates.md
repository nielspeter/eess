# Bug 0230: two bodies that share no vocabulary at all are reported as duplicates

## Status

- **State:** Fixed — red test first, guard added, both sabotage directions verified.
- **Severity:** Medium — a small share of findings, but the WORST kind: the two
  bodies have nothing whatever in common except punctuation, so the remedy
  (`extract the shared logic into one function`) names something that does not
  exist. A reader who checks one of these learns the detector cannot be taken
  at its word, which is what gets it switched off.
- **Origin:** self-found · investigating what remained of `no-copy-paste` after
  working this repo's findings from 84 down to 32.
- **Reported:** 2026-09-02

## Symptom

Two functions with the same SHAPE and not one identifier or literal in common
are reported at up to 100% similarity.

Measured on this repo, both real:

```
RuleBuilder.asDeclared (packages/ts/src/core/rule-builder.ts)
  is 100% similar to
InconsistentSiblingsBuilder.scope (packages/ts/src/smells/inconsistent-siblings.ts)
  — 12 varying axes: _conditions -> _folders, _metadata -> _minLines, …
  Fix: extract the shared logic into one function
```

```ts
private asDeclared(): DeclaredRule {          private scope(): SiblingScope {
  return {                                      return {
    predicates: this._predicates,                 project: this.project,
    conditions: this._conditions,                 folders: this._folders,
    misplaced: this._misplaced,                   ignorePaths: this._ignorePaths,
    reachedShould: this._reachedShould,           ignoreTests: this._ignoreTests,
    metadata: this._metadata,                     minLines: this._minLines,
    pattern: this._pattern,                       pattern: this._pattern,
  }                                             }
}                                             }
```

One gathers a rule's declaration; the other gathers a sibling detector's scope.
They share the shape "return an object of six of my own fields" and **zero**
vocabulary. There is no shared logic to extract, and no reader would ever open
these two files together.

## Root cause

`findSimilarPairs` has two fast rejections before scoring, and both measure each
body **on its own**:

```
packages/ts/src/smells/similar-pairs.ts
  fast rejection 1  node counts differ too much
  fast rejection 2  min(a.distinctVocabulary, b.distinctVocabulary) < floor
```

Plan 0103's floor asks "does this body carry enough vocabulary to be evidence?"
— a per-body question. Nothing asks the **pairwise** one: _do these two bodies
carry any of the same vocabulary?_ `computeSimilarity` cannot supply it either,
and must not: it scores LCS over syntax KINDS only, which is what makes it a
type-2 clone score in the first place.

So a pair can pass both floors, score 1.00 on shape, and have an empty
vocabulary intersection.

## Measured

Across all 89 pairs the detector produces on this repo at `similarity >= 0.9`,
`minDistinctVocabulary = 8`:

| shared distinct vocabulary | pairs |
| -------------------------- | ----- |
| 0                          | **2** |
| 1–2                        | 0     |
| 3+                         | 87    |

Both zero-vocabulary pairs are false positives (`asDeclared` ~ `scope`, and
`RuleBuilder.assertionAdvice` ~ `TerminalBuilder.describeRule`). The gap
between 0 and 3 is empty, so the guard has room and does not need a tuned
threshold: `=== 0` is the rule.

For contrast, the pairs nearest the boundary are all real:

| pair                               | shared | verdict |
| ---------------------------------- | ------ | ------- |
| `implement` ~ `haveDecorator`      | 4      | real    |
| `metrics` ceilings                 | 9      | real    |
| `matchers` call sites              | 10     | real    |
| `mustMatchName` ~ `mustNotEndWith` | 14     | real    |

## Break class

A fix must fail when:

1. Two bodies of the same shape sharing **no** identifier or literal are
   reported. (`asDeclared` ~ `scope` is the shipped instance.)
2. And it must still report a pair sharing as few as four vocabulary items —
   `implement` ~ `haveDecorator` — because a guard that reaches that far is
   suppressing real copy-paste. Sabotaging the guard must red a fixture built
   from (1), and widening it past `=== 0` must red a fixture built from (2).

## Fix

One pairwise rejection beside `containsOther`, which is where the other
"unactionable in principle" rejection already lives. `Fingerprint.texts` is
index-parallel to `kinds` and already carries what is needed; no new
computation on the hot path beyond one set intersection per surviving pair.

Not a threshold: `=== 0`. Any non-zero floor would be a tuned number without
evidence, and the measured gap says none is needed.

**Guarded by `minDistinct > 0`, which the red test forced.** A body that is
pure control flow (`return true`) has no vocabulary, so it trivially shares
none — and the suite already pins that two such bodies DO pair when the caller
sets `minDistinctVocabulary(0)`. "These share no vocabulary" is evidence of
unrelatedness only when there was vocabulary to share; whether a
vocabulary-free pair is worth reporting is the caller's decision, and fast
rejection 2 has already applied it. Overriding it here would make that option
silently mean something else.

Measured after: `check:guardrails` on this repo went 32 → 30, dropping exactly
the two pairs named above and nothing else.

## Verification

- [x] Red test: two same-shaped bodies with no shared vocabulary are not
      reported. `packages/ts/tests/smells/shared-vocabulary.test.ts` ·
      `it('reports nothing for two same-shaped records with no shared identifier')`.
      Confirmed red before the guard, and the first fixture had to be widened
      to eight fields a side to clear plan 0103's floor at all — which is
      itself the reason the defect is rare.
- [x] Red test that must stay green: the `implement` / `haveDecorator` shape,
      the real finding with the fewest shared items on this repo, is still
      reported.
- [x] `check:guardrails` on this repo drops exactly the two named pairs: 32 → 30.
- [x] Sabotage, both directions. Deleting the guard reds row 1. Widening it
      from `=== 0` to `<= 5` reds row 2 — which is what makes `=== 0` a
      decision rather than a number someone liked.
- [ ] `deferred→`[0229](../0229-a-call-site-whose-arguments-carry-logic-reads-as-copy-paste.md)
      — the other half of the same investigation, filed separately because it
      has no clean fix.

Deferred: 0229.

## Relationship to 0229

[0229](../0229-a-call-site-whose-arguments-carry-logic-reads-as-copy-paste.md)
came out of the same investigation and is a different defect: there the two
bodies DO share vocabulary, all of it the parameter names of a helper they both
call. This one is the opposite end — no shared vocabulary at all. 0229 has no
clean fix and is filed Low; this one does.
