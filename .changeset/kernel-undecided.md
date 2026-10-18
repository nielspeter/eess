---
'@nielspeter/eess': minor
'@nielspeter/eess-ts': minor
'@nielspeter/eess-gherkin': patch
---

New (ADR-021, plan 0486): a predicate may declare that it cannot judge a subject, with the optional `Predicate.undecided(element)` returning `Undecided[]` (each a file, a line, an element and a message). `not`/`and`/`or` evaluate it in strong Kleene logic, in the kernel and in eess-ts alike. A rule selects only subjects it can decide, and reports each cause once as a finding no `.excluding()`, `.warn()`, baseline or diff-aware mode removes, wherever the rule's verdict depends on it. `.select()`, `matchingElements` and eess-ts's builders, which hand back no findings, throw an `ArchConfigError` naming the cause instead. `not(p).test` refuses a subject `p` cannot judge. The receipt carries `undecided`, the number of such causes. No existing predicate declares the member, so no existing rule changes. `matchingElements` now takes the door's name from its caller (`/internal`; every caller in the family passes one). New in `@nielspeter/eess/internal`, for dialect authors: `membership`, `partition`, `kleene`, `negatedTest`, `undecidedViolations`, `refuseUndecided`, and the types `Membership` and `Door`. eess-ts and eess-gherkin re-export `Undecided`.
