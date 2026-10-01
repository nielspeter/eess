# Bug 0372: the `file-not-folder` finding claims its scope twice, and names its remedy twice

## Status

- **State:** Draft — filed out of
  [0363](./fixed/0363-a-remedy-that-cannot-remediate-survives-one-input-over.md) on product
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

One decision covering both, after #168 ships:

- should `FAULT_ADVICE['file-not-folder']` read "so it can never match **as a folder glob**",
  qualifying the second claim instead of repeating the first?
- should that cause entry still carry its own remedy clause ("use `resideInFile()` … or append
  `/**`") now that `CARDINALITY_REMEDY` owns remedies per route? The cause tables predate the
  route table; the overlap is the seam.

Not decided here. It is a wording question about tables two tools and a test corpus read, which
makes it cheap to get wrong and cheap to defer.

## Related

- [0363](./fixed/0363-a-remedy-that-cannot-remediate-survives-one-input-over.md) — gave the
  route table remedies, which is what made the cause tables' remedy clauses an overlap.
- [0358](./0358-an-unused-exclusion-warning-does-not-say-which-instance-it-is-about.md) — the
  other open record about a message that reads wrong rather than computing wrong.

## Verification

- [ ] the decision taken on both halves together, since they share one seam.
- [ ] if reworded: the change declared, because both tools emit it and adopters may match on it.
- [ ] the measured sentence above re-pasted after the change, so the record shows both.
