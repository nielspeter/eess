# Plan 0430: an acceptance criterion is never deferred

## Status

- **State:** Draft — recorded 2026-10-15 with the method's "Plans close whole" rules, whose rule 3
  this would check. Not designed; the open questions below come first.
- **Priority:** Low — the rule is in the method today; this makes it a gate.
- **Effort:** Small, once the questions are answered.
- **Created:** 2026-10-15

## Problem

`docs/working-method.md`'s rule 3 says an acceptance criterion closes ticked, `done-otherwise` or
`validation-owed`, never `deferred→` or `dropped-on-purpose`. eess-md's `honestyAtClose` accepts any
disposition token on any box, so nothing checks it. An adopter has written the check by hand with
`taskItems()`, scoped to boxes under an "Acceptance criteria" or "Verification" heading in done
records, with dropped-whole records exempt.

## Open questions

1. **Which boxes are criteria?** The adopter keys on a heading. This repository's plans have no
   "Acceptance criteria" heading; their ledgers mix phases and criteria, and bugs use "Verification".
   A heading list as an option, or a box-level marker, or both?
2. **Where it lives:** an option on `honestyAtClose` (one preset, one pass over the corpus) or a
   sibling preset in `@nielspeter/eess-md/rules/ledger`?
3. **Does this repository's own corpus already comply?** Measure before choosing a default: a gate
   that reds on day one needs a migration, and one that matches nothing needs `.expectEmpty()`'s
   expiry (ADR-010).

## Out of scope

- The other five rules: they are review discipline, not something a corpus records in a checkable
  form.

## Progress ledger

- [ ] the three questions answered and the plan frozen

Deferred: none
