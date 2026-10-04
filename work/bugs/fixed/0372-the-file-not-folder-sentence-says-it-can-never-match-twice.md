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

**The first fix was wrong on both halves, and review said so before it merged.** Both versions are
kept here, because the wrong one is the more instructive.

### What was first decided, and why it failed

The first fix qualified the cause's claim to "so it can never match **as a folder glob**", and
removed the duplicate `resideInFile()` from the remedy by having it say "Correct the selector to
**name the DIRECTORY you mean**". Product review measured both:

- **The qualifier fixed the wrong axis.** "can never match as a folder glob" is still universal —
  `**/src/domain/user.ts` _does_ match as a folder glob in a project where `user.ts` is a
  directory. The bug was a scope claim that needed limiting by **project**, and it was limited by
  **shape**.
- **The remedy began choosing for the author.** The cause offers TWO edits — `resideInFile()` for
  a file, `/**` for a directory — and the remedy is the last sentence of the `Fix:` line, which is
  where an agent acts. Naming only the directory overrode the cause. For a `.notExist()` rule,
  meaning a file is the common case ("`legacy/old.ts` must not come back"), and an agent told to
  name a directory widens the rule to the parent folder — changing what it asserts. The comment
  directly above that string said the clause had been placed last _because_ that is where an agent
  lands, and the first fix removed the file option from exactly that position.

Test review separately found the decision's central claim unpinned: swapping `resideInFile()` from
the cause into the remedy stayed green across all 3,921 eess-ts tests, because the count ran only
the cardinality route, where cause and remedy are concatenated and the total stays at one.

### What is decided now

**Scope is claimed once, by the headline.** The cause makes no scope claim at all. A cause that
states scope can only repeat the headline or contradict it, and "used where a directory is read"
already says why it fails here.

**The cause owns the concrete edit; the remedy defers to it.** The general rule, now written above
the table where a table author will see it: a route remedy must neither repeat the cause's edit nor
choose between its options. `names-a-file` reads "Apply whichever of those two fixes you meant", and
stays a distinct sentence from `syntactic` so a hand-rolled copy of the table remains detectable.

**The cause keeps `resideInFile()`**, because a non-cardinality rule's remedy is "Correct the glob,
or remove the rule" and names no edit — so the cause is that author's only concrete guidance. Now
pinned by a non-cardinality test.

The full `Fix:` line for an out-of-project file glob, printed from the code after the change:

```
this matches a FILE but is used where a directory is read — use resideInFile() for a file, or
append "/**" to name the files inside a directory. Apply whichever of those two fixes you meant —
this rule has not been enforcing anything. Do not delete it.
```

_The Symptom section's quotation above is formatted for reading — bold, backticks, the selector
abbreviated — and is not the raw emitted text. The block here is raw._

## Related

- [0363](./0363-a-remedy-that-cannot-remediate-survives-one-input-over.md) — gave the
  route table remedies, which is what made the cause tables' remedy clauses an overlap.
- [0358](../0358-an-unused-exclusion-warning-does-not-say-which-instance-it-is-about.md) — the
  other open record about a message that reads wrong rather than computing wrong.

## Verification

- [x] the decision taken on both halves together, since they share one seam — and taken twice,
      because review showed the first decision wrong on both.
- [x] both halves pinned by counting rather than by presence: `resideInFile` occurs once on a word
      boundary (a parens-keyed count passed a remedy saying "use resideInFile"), and "can never
      match" occurs once, with the cause table asserted to make no scope claim of its own.
- [x] the remedy pinned NOT to choose — it may name neither the directory option nor the API.
- [x] the cause pinned to keep the API name, by a **non-cardinality** rule — the route the
      deduplication's reasoning is about, and the one nothing tested.
- [x] three existing assertions moved off quoted prose onto the table. One was a NEGATIVE
      assertion on the old remedy text, which the reword would otherwise have left passing
      forever. **The third was missed** and found by `validate` rather than by me: a
      `toContain('Correct the selector')` in `doctor-and-check-agree-about-a-ratchet.test.ts`,
      a file I did not re-run after the reword because I ran only the file I had edited. A
      phrase quoted from a table entry is a copy of it, and the sweep has to cover every copy —
      run the whole suite after a string change, not the file nearest to hand.
- [x] a sabotage matrix, all red: the swap (14 → 12), the cause regaining a scope claim, the remedy
      choosing the directory option again, and the remedy repeating the name without parens.
- [x] `docs/migrating-to-0.11.md` updated — it quoted the 0.11.0 text, and its own headline
      example is a glob whose author plainly meant a file.
- [x] `npm run validate` green — `0 failed`, which is the evidence; a test count is not.

Deferred: none.
