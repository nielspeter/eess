---
'@nielspeter/eess-ts': patch
---

**Fixed: `smells.duplicateBodies()` reported two functions that share no
identifier or literal at all.**

The detector had two fast rejections before scoring and both measured each body
on its own — plan 0103's `minDistinctVocabulary` asks "does this body carry
enough vocabulary to be evidence?". Nothing asked the pairwise question, "do
these two carry any of the _same_ vocabulary?", and `computeSimilarity` cannot
answer it: it scores syntax kinds only, which is what makes it a type-2 clone
score that survives renaming.

So a pair could reach 100% on shape with an empty vocabulary intersection. The
shipped instance in this repo was a rule builder's `asDeclared()` against a
smell detector's `scope()` — two functions that each gather six of their own
fields into a record, with not one name in common. "Extract the shared logic
into one function" named something that did not exist.

A pair is now rejected when both bodies have vocabulary and share none of it.
`=== 0`, not a threshold: measured across all 89 pairs this repo produces, two
share nothing, none share one or two, and the nearest real finding shares four.
The rejection defers to `minDistinctVocabulary` when either body has no
vocabulary at all — two bodies that are pure control flow share their entire
content, and whether that is worth reporting stays the caller's decision.

For adopters: strictly fewer findings, and only of this shape. No configuration
changes.
