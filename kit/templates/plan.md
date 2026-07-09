<!--
  SEED TEMPLATE — delete once real plans exist to imitate.
  The corpus is the template: the moment work/plans/ has two or three real items,
  this file is scaffolding that has outlived its purpose. Delete it then — a living
  example is a truer shape than a frozen form.
-->

# Plan NNNN: <title>

## Status

- **State:** Draft — <free prose, e.g. "awaiting acceptance criteria">
- **Priority:** P? — <one line why>
- **Effort:** <rough size>
- **Created:** YYYY-MM-DD

<!-- State token is one of: Draft · Ready · Done · Won't-do.
     Draft/Ready are non-terminal; Done/Won't-do are terminal and move the file
     to completed/ (or wont-do/). The ledger gate keys on this token. -->

## Problem

<What's wrong or missing, and why it's worth a plan rather than just doing it.
State the problem, not the solution.>

## Implementation

### Phase 1 — <name>

<What this phase does. Real code sketches beat prose. Cite existing code as
`path:line` so the pointer gate can ground it.>

**Files changed:** <list>

## Out of scope

- <what this plan deliberately does not do, and where that work lives instead>

## Success

- <the observable, checkable definition of done>

## Progress ledger — closing this plan honestly on itself

<!-- Filled in at /close. Every box ends disposed; say the deferral count out loud.
     Disposition tokens: done-otherwise · deferred→<home> · dropped-on-purpose ·
     validation-owed. A `- [ ]` with no token in a Done item is a silent box the
     ledger gate rejects. -->

- [ ] Phase 1
- [ ] Phase 2

Deferred: none
