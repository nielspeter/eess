# ADR-018: A string that names code is resolved, or the rule says why not

- **Status:** Proposed (2026-10-05) — **not ready to rule**: review found the decision below
  over-claims and contradicts ADR-016 and the kernel's position logic (spike 0386, Review). It
  is rewritten after the maintainer decides how exclusions should work. Nothing below binds.
- **Context:** [spike 0386](../work/spikes/0386-strings-that-name-code.md),
  [spike 0385](../work/spikes/0385-what-makes-an-exclusion-switch-a-rule-off.md),
  [bug 0233](../work/bugs/0233-an-exclusion-that-suppresses-every-violation-is-silent.md),
  [bug 0298](../work/bugs/0298-an-exclusion-that-absorbs-several-subjects-says-nothing.md)
- **Extends** [ADR-009](./009-agent-first-failure-surfaces.md) (rule 1, and rule 3's
  corollary) and [ADR-010](./010-a-pass-is-constructed-from-evidence.md) to the strings a rule
  is written in. Applies [ADR-016](./016-a-bounded-instrument-limits-knowledge-never-the-verdict.md)
  where the checker cannot see.

## The question

Every rule is written in strings that name code: a folder glob, a base class, an exclusion, a
cited test. When a string means something other than its author intended — it names nothing,
or everything, or the wrong thing — the rule does not fail. It checks the wrong set, or none,
and is green. Spike 0386 counted these: path globs, exact names, exclusions and doc references
account for most of the High false greens on the board, and exact names compared as text are
the worst ratio (8 High of 12).

The question is whether there is one rule for these strings, or a separate fix for each.

## Decision

**A string that names code is resolved against what the checker can see. When it resolves to
nothing, or to everything, that is a finding — not a silence — unless matching nothing is the
rule's purpose.** Concretely, by what the string names:

1. **An exclusion is resolved against the rule's own violations.** One that matches none is a
   configuration finding (it is stale; the ratchet has closed and the exclusion must go). One
   that matches a probe it could not have been written for — a universal pattern such as
   `/.*/` — is a configuration finding, whatever the rule found today, because the rule can
   never fail. Both are unsuppressable, and `silent()` exempts neither.
2. **An exact name is resolved to a declaration.** A name that matches no declaration the
   checker can see is a finding. A name the checker _cannot_ see past — a symbol from an
   untyped dependency — is disclosed as a limit of the instrument (ADR-016), not refused.
3. **A path or import glob stays a glob.** It is resolved against the project and the disk,
   and a dead one is reported, as today. An absence rule (`.notExist()`, `notImportFrom`) may
   match nothing by design; telling "nothing because the code is gone" from "nothing because
   the glob is broken" is the existing dead-glob machinery's job, not this ADR's.
4. **A pattern that is the rule** — a naming convention, a content matcher — is out of scope:
   it names an open set on purpose, and the ADR-010 floor reports one that selects nothing.

## Why this, and not the alternatives

**Remove globs and patterns.** Considered first, because they are the visible source. Rejected:
globs are how adopters say where a rule applies (they are most of this repo's own rule
inputs), absence rules would need the same machinery under another name, and the bugs in
group A are bugs in machinery that already resolves globs, not evidence that resolving fails.

**A separate fix per bug.** What has happened so far. Each fix decided its own version of the
same question — 0233's first fix decided "every violation excluded", which fired on ten
legitimate allowlists — and each record carried its own principle. One decision, cited by each,
is cheaper and cannot disagree with itself.

**Treat a total suppression as the signal** (0233's original clause). Rejected in spike 0385:
it fires on every allowlist that excludes today's known violators, and those rules can still
fail on the next one. A universal pattern is the property ADR-009 rule 1 names — a check that
cannot fail.

## Consequences

- Bug 0233 becomes an application of rule 1 (the universal half); a stale exclusion becoming a
  finding is the other half, and a breaking change: today it is a warning.
- Rule 2 gives 0373, 0375, 0377 and 0383 one principle: follow the relation from what the name
  resolves to, and disclose where the checker cannot see.
- Whether one exclusion pattern absorbing several subjects must say so stays with 0298.
- Not measured: what rules 1 and 2 cost adopters. This repo has no stale exclusion, no
  universal pattern, and no name that resolves to nothing — but its rule files were written by
  the people who wrote eess.

## Enforcement

| Clause                                                                   | Tier | Mechanism                                                                                                                                                           | Status  |
| ------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **C1** — a universal exclusion pattern is an unsuppressable finding      | 1    | Not built — bug 0233; the trigger was measured to fire on nothing this repo writes (spike 0385)                                                                     | pending |
| **C1** — a stale exclusion is a finding, not a warning                   | 1    | Not built — today a stderr warning in both `applyFilters` copies                                                                                                    | pending |
| **C2** — an exact name that resolves to no declaration is a finding      | 1    | Not built                                                                                                                                                           | pending |
| **C2** — a name past what the checker can see is disclosed, not refused  | 2    | Not built — bug 0373 owns the unresolved-base case                                                                                                                  | pending |
| **C3** — a dead path glob is reported; an absence rule may match nothing | 2    | The existing dead-glob and cardinality findings in `packages/ts/src/core/glob-diagnosis.ts` and `packages/ts/src/core/vacuity-diagnosis.ts` (bugs 0355, 0359, 0363) | gated   |
| **C4** — conventions and content matchers are out of scope               | 4    | Rationale: a pattern that names an open set on purpose; the ADR-010 floor reports one that selects nothing                                                          | n/a     |
