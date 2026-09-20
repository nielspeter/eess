# Bug 0330: what a rule reads is ruled in archived bug records, and no ADR says so

## Status

- **State:** Draft — measured; the fix is a decision about where the rulings live, not a patch.
- **Severity:** Low — **no false green.** Nothing eess reports is wrong because of this. The cost is
  that the rule a reader needs cannot be found: each ruling is binding on the next change and its
  only home is a record the corpus gate has frozen, so the next person to widen a search re-derives
  a decision instead of reading it.
- **Origin:** the method review of PR #147, 2026-09-20, which measured the chain and named it.
- **Reported:** 2026-09-20

## Symptom

**What a search reads is settled across eleven bug records, every one of them archived.** The
decisions, in order — linked here because a record arguing the chain cannot be found should not
make the reader hunt for it:

| ruling                                                         | record                                                                                                    |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| a class reads its members' code                                | [0300](./fixed/0300-class-body-search-reads-methods-constructors-and-accessors-only.md)                   |
| a docstring is not code; must-contain reads member code only   | [0307](./fixed/0307-class-body-rules-skip-class-code-outside-its-members.md)                              |
| a destructured parameter's defaults and computed keys are code | [0309](./fixed/0309-a-default-inside-a-destructured-parameter-is-not-read-by-the-class-rules.md)          |
| a function reads what its parameters run                       | [0314](./fixed/0314-the-function-rules-read-no-parameter-default.md)                                      |
| a class's non-method function members are collected            | [0315](./fixed/0315-the-function-builder-does-not-collect-constructors-accessors-or-wrapped-functions.md) |
| a search tests the root it searches                            | [0323](./fixed/0323-the-call-conditions-search-below-the-root.md)                                         |
| one definition of a callback, and it is `extractCallbacks`     | [0324](./fixed/0324-the-callback-conditions-read-a-direct-callback-only.md)                               |
| a class comment rule reads a parameter list, and no docstring  | [0325](./fixed/0325-the-class-search-reads-no-comment-on-a-parameter.md)                                  |

[0329](./0329-the-class-search-reads-no-comment-outside-a-members-parameters.md)
is open and its whole `## Fix` section is "the same design question 0325 answered for parameters,
one level out" — a live record whose premise is in `work/bugs/fixed/`.

**No ADR governs it.** A grep over `adr/` for the subject returns 011 (the kernel's public API) and
014 (evidence at emission), neither of which says what a rule reads.

**The frozen folder is not a place to look up a rule.** `scripts/check-corpus.mjs:159` lists
`'**/fixed/**'` in `FROZEN`, and the gate's own comment says a frozen document's pointers are not
examined at all. So a ruling in `fixed/` is both the binding statement and the one document nothing
re-checks — measured on PR #147, where four citations in archived records drifted and no gate could
have caught it.

## Root cause

The working method has a home for a decision (an ADR) and a home for work (a plan or a bug record),
and [the split is deliberate](../../docs/working-method.md). A ruling made while fixing a bug has
no home of its own, so it stays where it was made. That is right for a one-off judgement and wrong
for a rule the next three changes will each extend: by the third extension the chain is only legible
to whoever walked it.

## Fix

Not decided. Three candidates, and the choice is a judgement about cost:

- **An ADR — "what a rule reads"** — collecting the eleven rulings above as clauses, each with its
  Enforcement row pointing at the test that already pins it. The rows exist; this is mostly
  assembly. It is also the option that makes the next ruling a decision to be recorded rather than a
  paragraph in a bug.
- **A living doc section** — `docs/body-analysis.md` already states most of the outcomes. It could
  carry the rulings and their record numbers, with the ADR left for the principle only.
- **Neither, deliberately** — the outcomes are documented where an adopter reads them, and the
  record numbers are discoverable from the code comments. Then say so here and close this record,
  so the next reader finds the decision not to centralise rather than the absence of one.

Whichever is chosen, the residual to weigh is that a ruling cited by a live record should not be
reachable only through a folder the corpus gate has frozen.

## Related

- [0327](./0327-adr-011-is-written-about-the-kernel-and-the-family-now-has-two-internals.md) —
  the same shape for ADR-011: a decision whose scope the code has outgrown.
- [0329](./0329-the-class-search-reads-no-comment-outside-a-members-parameters.md) — the live record
  whose premise sits in `fixed/`.
- [0337](./0337-agent-guardrails-reads-function-bodies-only.md) — a second preset that does not
  follow 0333's ruling, which is what a ruling nobody can find looks like from the outside.

## Verification

- [x] measured: the nine records above, the `adr/` grep, and `FROZEN` in `scripts/check-corpus.mjs`.
- [ ] a decision on where a read-semantics ruling lives
- [ ] the chosen home written, with the existing rulings in it
- [ ] `npm run validate` green.

Deferred: none.
