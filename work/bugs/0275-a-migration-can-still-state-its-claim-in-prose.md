# Bug 0275: a migration can still state its claim in prose

## Status

- **State:** Draft — the residual bug 0273 closed around, named rather than
  absorbed.
- **Severity:** Low-to-medium — the mechanism it needs may not be worth its cost,
  and that is the decision this record exists to force rather than assume.
- **Origin:** self-found · architecture, enforcement and method reviews of
  PR #123, independently.

## Symptom

`check:docs-code` compiles the module-claim statements of every `ts` fence under
`.changeset/`, so a claim about where a symbol lives is checked **once written as
a statement**. Nothing requires it to be written.

A changeset whose prose says "`finishPreset` is exported from the same three
places the alias was", with no fence or with a fence that declares no module,
passes green. That is [bug 0273](./fixed/0273-nothing-compiles-a-changesets-migration-snippet.md)'s
original defect verbatim, still available to the next author.

## Measured

Three reviewers reproduced it independently on PR #123. A changeset whose fence
holds only `nopeNotAThing(violations, { report: 'throw' })` is counted as a
fragment and the gate stays green.

The population it applies to, at the time of filing: **3 of 30** changesets carry
a module-claim statement. Two of the unchecked fences make live API claims —
`embeddedDiagramStats(corpus)` and `pointers(c).that().areFrozen()` — and both
happen to be true today.

## The corruption that must produce a violation

A changeset fence that calls an identifier it neither declares nor imports, in a
changeset that also asserts in prose where a symbol is exported.

## Why this is hard, and might be answered with "no"

Telling a migration from any other changeset prose means extracting a claim from
English, which is exactly what bug 0273 called break class 2 and why that bug
answered with a convention rather than a mechanism. The candidate mechanism —
"a `ts` fence calling an undeclared identifier must import it or carry
`eess-docs-code-skip`" — is checkable, but it fires on shapes that are not
migrations at all, and a mechanism that fires on the thing it protects teaches
people to switch it off (ADR-009 rule 1).

So the honest options are two, and picking one is the work:

1. Build the demand-side rule, scoped narrowly enough that it does not red on
   ordinary changeset prose.
2. Decide the convention stays review-held, and say so in `RELEASING.md` where it
   currently says which half is gated.

**Either is a real close. What is not acceptable is leaving it implied**, which
is what a `[x]` beside "break class 2 dispositioned" did until three reviewers
read it as a mechanism.

## Verification ledger

- [ ] The decision above taken and written down, not assumed.
- [ ] If option 1: red test first — a changeset asserting an export location in
      prose with no module claim, failing before the fix — plus a non-vacuity
      row, since a demand-side rule that never fires is the defect it is for.
- [ ] If option 2: `RELEASING.md` and bug 0273's ledger box both say the
      convention is review-held, with no wording that reads as enforcement.
