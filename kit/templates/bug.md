<!--
  SEED TEMPLATE — delete once real bugs exist to imitate.
  The corpus is the template: once work/bugs/ has a couple of real items, delete
  this. A living example is a truer shape than a frozen form.
-->

# Bug NNNN: <symptom in one line>

## Status

- **State:** Draft — <free prose>
- **Reported:** YYYY-MM-DD — <self-found, or spawned from support case SUP-NNN>

## Symptom

<What's observably wrong, right now, in the code. The behaviour, not the cause.>

## Reproduction

<Exact steps / inputs that trigger it. This becomes the red test.>

## Root cause

<Why it happens. Cite the code as `path:line` — the pointer gate grounds it.>

## Fix

<The smallest change that turns the red test green.>

## Verification

<!-- Red-first is the one discipline models skip: the failing test must exist
     BEFORE the fix. Then green. -->

- [ ] Red test written first (reproduces the defect)
- [ ] Fix turns it green
- [ ] Suite still green (no regression)

Deferred: none
