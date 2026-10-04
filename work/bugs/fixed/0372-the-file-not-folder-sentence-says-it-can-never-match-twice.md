# Bug 0372: the `file-not-folder` finding claims its scope twice, and names its remedy twice

## Status

- **State:** Fixed — the cause clause now qualifies its claim to the shape ("as a folder glob")
  instead of repeating the headline's scope unqualified, and the remedy no longer repeats the
  API name the cause already gives. Both halves pinned. Filed out of
  [0363](./0363-a-remedy-that-cannot-remediate-survives-one-input-over.md) on product
  review's call: pre-existing wording whose audience 0363 widened, not something 0363 broke.
- **Severity:** Low — **no wrong verdict and no unactionable instruction.** The remedy names a
  real API verbatim, so a reader who reaches the end knows the lever. What is wrong is an
  incoherent headline and a repeated clause.
- **Origin:** product review of PR #168, which measured the sentence and declined to reword
  shipped prose inside a fix.
- **Reported:** 2026-10-01

## Symptom

The measured output for a `parent-dir` glob naming a file, pasted so the next reader does not
re-derive it:

> This rule's selector `'**/apps/legacy/src/old**'` **can never match anything in this
> project**, so the absence it asserts was never actually checked — this matches a FILE but is
> used where a directory is read, so **it can never match** — use `resideInFile()` for a file,
> or append `"/**"` to name the files inside a directory. **Correct the selector to name the
> DIRECTORY you mean, or use `resideInFile()` if you meant the file** — this rule has not been
> enforcing anything. Do not delete it.

Two problems, one seam:

1. **The scope is claimed twice, and the two claims differ in strength.** The headline says "in
   this project" (because `ROUTE_HOLDS_IN_ANY_PROJECT['names-a-file']` is `false`, correctly —
   the same glob matches where that name is a directory). The cause clause then says "it can
   never match", unqualified. On the one route whose point is _the tsconfig is not your lever_,
   the headline is the phrasing the code's own comment says "invites a tsconfig reading".
2. **`resideInFile()` appears twice** — once in `FAULT_ADVICE['file-not-folder']` and once in
   `CARDINALITY_REMEDY['names-a-file']`. Harmless, and a concrete name repeated beats a vague
   paraphrase, which is why #168 left it; the duplication arrived when that review replaced
   "the file-level predicate" with the real API name.

## Why it was not fixed in 0363

PR #168 changed **neither half** of that sentence for this route. `isSyntacticFault('file-not-folder')`
was already `false` on main, so the headline already read "in this project", and
`FAULT_ADVICE['file-not-folder']` is untouched. What #168 changed is **which inputs reach the
sentence** — out-of-project globs, and globs naming non-TypeScript files. Pre-existing wording,
widened audience.

Two further reasons recorded by the reviewer: the cause tables are read by both tools and by the
existing test corpus, so rewording is a second adopter-visible string change in a release that
has just had its break marked and its bump raised — two declarations for one defect, the second
cosmetic. And after the remedy began naming `resideInFile()` verbatim, what remains is an
incoherent headline rather than an unactionable instruction.

## Fix

**Both halves, decided together as the record asked.**

**The scope claim is qualified to the shape.** `FAULT_ADVICE['file-not-folder']` now reads "so it
can never match **as a folder glob**". The headline's "in this project" was already right — the
fault is contingent on the filesystem, since the same text matches fine where that name is a
directory — so the unqualified clause was the half that overstated.

**The duplication is removed from the REMEDY, not the cause.** Which way round matters, and the
reason decides it: for a cardinality rule the `Fix:` line is `${cause}. ${remedy}`, so
`resideInFile()` was appearing twice inside **one sentence**. The cause keeps it, because a
non-cardinality rule's remedy is "Correct the glob, or remove the rule" and names no edit at all
— strip the cause and that author loses the only concrete guidance they get. So
`CARDINALITY_REMEDY['names-a-file']` dropped the clause instead:

> Correct the selector to name the DIRECTORY you mean — this rule has not been enforcing
> anything. Do not delete it.

**Measured after the change**, the full `Fix:` line for an out-of-project file glob:

> this matches a FILE but is used where a directory is read, so it can never match as a folder
> glob — use resideInFile() for a file, or append "/\*\*" to name the files inside a directory.
> Correct the selector to name the DIRECTORY you mean — this rule has not been enforcing
> anything. Do not delete it.

## Related

- [0363](./0363-a-remedy-that-cannot-remediate-survives-one-input-over.md) — gave the
  route table remedies, which is what made the cause tables' remedy clauses an overlap.
- [0358](../0358-an-unused-exclusion-warning-does-not-say-which-instance-it-is-about.md) — the
  other open record about a message that reads wrong rather than computing wrong.

## Verification

- [x] the decision taken on both halves together, since they share one seam.
- [x] both halves pinned — `it('the Fix line names resideInFile() once, not twice')` counts the
      occurrences rather than asserting presence, and `it('the scope is claimed once, and
qualified to the shape')` asserts the qualifier AND that the unqualified form is gone.
      Nothing pinned either before: the whole suite stayed at 3,919 tests across both edits,
      which is how a wording change ships unnoticed.
- [x] a two-row sabotage matrix, both red: removing the qualifier reds one, restoring the
      duplication reds the other.
- [x] the change declared — both tools emit this text and an adopter may match on it.
- [x] the measured sentence re-pasted in the Fix above, so the record shows before and after.
- [x] `npm run validate` green.

Deferred: none.
