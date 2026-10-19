# Bug 0501: names and duplicates plan 0457 left in the kernel and eess-md

## Status

- **State:** Draft — recorded 2026-10-19 from PR #245's architect review (m-1, m-2, m-3). Read from
  the source; none changes a verdict.
- **Severity:** Low — naming and duplication, no wrong verdict.
- **Origin:** self-found · PR #245's review (architect)
- **Reported:** 2026-10-19

## Symptom

Three leftovers, collected because one review found them together:

1. **The kernel hook's name no longer says what it carries.** `RuleBuilder.deadGlobDiagnosis()`
   (`packages/core/src/rule-builder.ts`) now also carries eess-md's scope diagnosis, which is not
   about globs; plan 0457 changed only its docstring. `CollectResult.deadGlob`
   (`packages/core/src/collect-result.ts`) still calls itself "a specific dead-glob explanation". A
   rename (`zeroExaminedDiagnosis`, for instance) is a kernel API change. `CorpusRuleBuilder` owns
   the override, so a later md diagnosis for dead globs on positive rules would have to be combined
   with it, not override it. A scoped `notExist()` ratchet that examined zero still computes the
   diagnosis's step 2 and throws it away: the kernel calls the hook eagerly
   (`packages/core/src/rule-builder.ts:397`), and `zeroExaminedFinding` returns first for a
   cardinality rule.
2. **Hand-written lifts beside the shared one.** `pointers()` keeps private `areLive`/`areFrozen`
   over `MdPointer` (`packages/md/src/builders/pointers.ts`), now hand lifts of the document
   predicates, with different descriptions ("are frozen (historical record)" against "are frozen").
   `terms()`' `resideInFile` (`packages/md/src/builders/vocabulary.ts`) passes the document predicate
   straight to `addPredicate` with the same shape. Each could be `liftToDocument(p, description)`,
   keeping its rule text.
3. **Two fields for one fact.** `ParsedCodeBlocks` carries `documentsLoaded: number` and, since plan
   0457, `documents`; `documentsLoaded` always equals `documents.length`, and
   `CodeBlockRuleBuilder.sourceEmpty()` could read the array.

## Fix

Each item separately: rename the hook in the kernel (with its changeset and dependents named); move
the two hand lifts onto `liftToDocument`; deprecate `documentsLoaded`.

## Verification

- [ ] Red test written first, where an item changes behaviour (item 2: the rule text stays the same).
- [ ] `npm run validate` green.

Deferred: none
