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
disposition token on any box, so nothing checks it. An adopter project reported on 2026-10-15 (by
message; not seen here) that it checks this by hand with `taskItems()`, scoped to boxes under an
"Acceptance criteria" or "Verification" heading in done records, with dropped-whole records exempt.

## Open questions

1. **Which boxes are criteria?** The adopter keys on a heading. This repository's plans have no
   "Acceptance criteria" heading; their ledgers mix phases and criteria, and bugs use "Verification".
   A heading list as an option, or a box-level marker, or both?
2. **Where it lives:** an option on `honestyAtClose` (one preset, one pass over the corpus) or a
   sibling preset in `@nielspeter/eess-md/rules/ledger`?
3. **This repository's corpus, measured 2026-10-15** (PR #220's method review): of 37 completed
   plans, none has an acceptance-criteria section (2 headings match `acceptance`, neither a criteria
   list); 6 open boxes remain across them (four `deferred→plan` in 0067, one `validation-owed` in
   0077, one `deferred→bug 0420` in 0412); 293 bugs have a "Verification" heading. A default keyed on
   an "Acceptance criteria" heading would match nothing here, which is ADR-010's vacuity case.
4. **A split criterion.** The method's rule 5 records a split as `deferred→<the new plan>` on the
   first plan's box, and says the criterion has left that plan's scope. A gate must tell that box
   from a deferred criterion: by a split marker, or by the new plan declaring what it took.

## Out of scope

- Rules 1 and 4–6: review discipline, not something a corpus records in a checkable form. Rule 2's
  mechanical half is already `honestyAtClose`'s.

## Progress ledger

- [ ] the four questions answered and the plan frozen

Deferred: none
