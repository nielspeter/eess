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

The population it applies to, measured at filing with the gate's own extractor:
**1 of 30** changesets carries a module claim, in 2 fences. Three have a `ts`
fence at all, so two of the three declare no module and are compiled by nothing.
Both of those make live API claims — `embeddedDiagramStats(corpus)` and
`pointers(c).that().areFrozen()` — and both happen to be true today.

(The first version of this record said 3 of 30 carried a claim, then named the
two claim-free fences three lines later. It contradicted itself on one page, and
in the direction that made this residual look smaller than it is.)

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
2. Decide the convention stays review-held, and **ratify** that as the answer.

   Note what option 2 is NOT: writing the disclosure. `RELEASING.md` already says
   the convention is held by review and not by the build, and bug 0273's ledger
   box already calls it Tier 5 — both landed in the PR that filed this record. A
   method review pointed out that an option asking for text which already exists
   cannot distinguish done from not-done. What is open is the DECISION, and
   ratifying it means recording that the demand side was considered and declined,
   with the reason, so the next reader meets a closed question rather than an
   unexplained gap.

**Either is a real close. What is not acceptable is leaving it implied**, which
is what a `[x]` beside "break class 2 dispositioned" did until three reviewers
read it as a mechanism.

## Verification ledger

- [ ] The decision above taken and written down, not assumed.
- [ ] If option 1: red test first — a changeset asserting an export location in
      prose with no module claim, failing before the fix — plus a non-vacuity
      row, since a demand-side rule that never fires is the defect it is for.
- [ ] If option 2: the decision to decline the demand-side rule is recorded with
      its reason — not merely the disclosure, which already exists in
      `RELEASING.md` and in bug 0273's ledger box and would make this box
      un-failable.
