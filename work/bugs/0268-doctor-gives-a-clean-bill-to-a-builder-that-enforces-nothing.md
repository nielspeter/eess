# Bug 0268: `doctor` gives a clean bill of health to a builder that enforces nothing

## Status

- **State:** Draft — measured against the real binary while writing ADR-014's
  enforcement row, which had claimed the opposite as its reason to exclude this
  command from the clause.
- **Severity:** Medium — a false green in the one command whose entire slot is
  justified by "a rule that certifies nothing". Not a build gate (`doctor` is a
  diagnostic by decision, plan 0069), so it does not red CI on its own; what it
  does is answer the question an author asks it with the wrong answer.
- **Origin:** self-found · writing the ADR-014 enforcement row for plan 0263
  Phase 2
- **Reported:** 2026-09-07

## Symptom

A rule file whose builder hands back a bare array enforces nothing at all —
that is the case ADR-014 exists for, and the case `eess-ts check`,
`eess-ts baseline`, `eess-ts check --fix` and `checkAll()` now all refuse.

```ts
// __probe_doctor.rules.ts
export default [{ violations: () => [] }]
```

Measured against the built binary on 2026-09-07:

```
$ node_modules/.bin/eess-ts doctor __probe_doctor.rules.ts
No rules that cannot enforce anything.
$ echo $?
0
```

The command's own `--help` line reads `Report rules that cannot enforce
anything`. Handed a rule that can enforce nothing whatsoever, it reports that
there are none.

## Root cause

`runDoctor` builds its findings from `diagnose(loaded)`, and every capability
`diagnose()` inspects is **optional** on the interface it accepts
(`packages/ts/src/core/diagnose.ts`, `DiagnosableRule`): `globs?`,
`assertsSomething?`, `examinedUnits?`, `declaresEmpty?`, `getProject?`. The
structural typing is deliberate and documented — it lets a caller pass the same
`RuleBuilderLike[]` they hand to `checkAll` without coupling to a class.

The consequence is not deliberate. A bare `{ violations: () => [] }` supplies
none of those members, so every diagnosis is skipped in turn and the findings
array comes back empty. **Absence of a capability is read as absence of a
fault** — a fail-open shape of exactly the kind ADR-009 rule 1 names, in the
command written to detect that kind.

The `rules.length === 0` guard does not catch it either, and its own comment
says why it exists: "Nothing to diagnose is not the same as nothing wrong."
That guard covers a file exporting `[]`. A file exporting one object that
diagnoses to nothing walks straight past it.

## Why it matters

The gap is narrow but it sits at the worst possible place. ADR-014's whole
claim is that an evidence-free builder is now refused at every door that hands
a verdict back. `doctor` hands back a _diagnosis_, not a verdict, so it is
legitimately outside that clause — but an author who reaches for the
diagnostic first is told their rule file is fine, and the ADR row was drafted
asserting that `doctor` "already reports rules unable to enforce anything",
which is what this measurement disproves. A wrong exclusion in a binding ADR is
more expensive than the gap it excused.

## Fix

Not decided. Two shapes, and the choice is a real one:

1. **Diagnose the absence.** A rule that implements none of `DiagnosableRule`'s
   optional members is not diagnosable, and "I could not diagnose this" is a
   finding, not a pass — the same argument the load-failure branch already
   makes a few lines below ("this is not a clean bill of health"). Cheapest,
   and it keeps the structural typing.
2. **Read the receipt.** `violations()` now returns a `CollectResult` carrying
   `examined` and its declarations. `doctor` could call it and report a
   receipt-less or evidence-free result as its own `kind`, which would make the
   diagnostic and the gate answer from one derivation rather than two (the
   argument `assertionAdvice()` already records for its own string).

Shape 2 changes what `doctor` runs, and the docstring's history shows that is
not free — the command already had to retract "without running any of them"
once. Shape 1 is honest about less.

## Verification

- [ ] Red test first: `doctor` over a rule file exporting a bare builder exits
      non-zero and names the rule file.
- [ ] The `--format json` path returns the same finding, not just the terminal
      one — every exit path in this command already folds its failures into
      both, and a fix that covers one is the bug this command has had before.
- [ ] `check:nonvacuity` asserts it by rule id, so an emptied fix cannot stay
      green.
- [ ] ADR-014's enforcement row stops excusing `doctor` and points here.

Deferred: none.

## Related

- [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) —
  the clause this command is outside of, and whose row carried the false
  rationale until this record replaced it.
- [Plan 0263](../plans/completed/0263-adr-014s-residual-enforcement-rows.md) — Phase 2
  gated the four verdict doors; this is the diagnostic beside them.
- [0174](./0174-eess-ts-reports-a-clean-gate-with-no-denominator.md) — the same
  family: a surface reporting green without the evidence to say so.
