# Bug 0500: eess-md `notExist()` with `.expectNonEmpty()` can never be green

## Status

- **State:** Draft — recorded 2026-10-19 from PR #245's product review; measured, no red test yet.
- **Severity:** Low — the rule is red either way, so it never lies about green; it is a trap with no
  finding that names it.
- **Origin:** self-found · PR #245's review (product, M3)
- **Reported:** 2026-10-19

## Symptom

On an eess-md builder, a `notExist()` rule that declares `.expectNonEmpty()` reds on every element
it examines (the absence assertion) and on examining none (the unmet declaration), so no corpus
makes it green. eess-ts reports that combination as a finding of its own since [bug 0467](./fixed/0467-eess-ts-expectnonempty-does-nothing.md)
(`work/bugs/fixed/0467-eess-ts-expectnonempty-does-nothing.md`); [bug 0473](./0473-expectnonempty-is-unread-on-eess-ts-builders-other-than-rulebuilder.md) covers eess-ts's other
builders. Nothing records eess-md's side, and [plan 0457](../plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md)'s docs tell adopters about the difference in
prose.

## Reproduction

Measured 2026-10-19 on PR #245's build:

- a corpus with no open box: `taskItems(c).that().areOpen().should().notExist().expectNonEmpty()`
  gives 1 finding, "this rule declared .expectNonEmpty() but examined zero units …";
- a corpus with one open box: the same rule gives 1 finding, "archive/old.md:3 should not exist".

## Fix

Report the combination on eess-md's builders as eess-ts does (a configuration finding naming it, with
the guard pattern as the remedy), then delete the docs sentence that describes the difference.

## Verification

- [ ] Red test written first: the declaration on a `notExist()` rule is a finding of its own.
- [ ] `npm run validate` green.

Deferred: none
