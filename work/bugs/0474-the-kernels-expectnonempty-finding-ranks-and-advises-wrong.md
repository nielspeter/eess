# Bug 0474: the kernel's `.expectNonEmpty()` finding outranks a dead glob and advises a remedy that cannot work

## Status

- **State:** Draft — recorded 2026-10-18 from PR #236's review (enforcement). Read from the source; no red test yet.
- **Severity:** Low — loud, not silent. The rule reds either way, but the message sends the author to
  the wrong edit.
- **Origin:** self-found · PR #236's review, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

The kernel's `zeroExaminedFinding` (`packages/core/src/terminal-builder.ts:309-326`) has two problems.

**It ranks the unmet `.expectNonEmpty()` above the dead-glob diagnosis.** A glob typo is therefore
reported as an unmet declaration, not as the glob that matched nothing.

**The unmet text's remedy is wrong on two rule shapes:**

- On a `.notExist()`-shaped rule it says "fix the selection". A non-empty selection then fails the
  condition, so the rule can never pass ([bug 0466](./fixed/0466-expectnonempty-is-offered-for-a-glob-typo-on-a-cardinality-rule.md)).
- On a positive rule it says "remove .expectNonEmpty()". Removing it only swaps the finding for the
  zero-examined one, the shape ts-archunit bug 0069 recorded in eess-ts.

eess-ts was given its own finding for the `.notExist()` shape in [bug 0467](./fixed/0467-eess-ts-expectnonempty-does-nothing.md).

## Fix

- Rank a nameable dead glob above the unmet declaration, as eess-ts's floor does.
- Word the finding per shape. Once [plan 0456](../plans/completed/0456-kernel-notexist-and-dead-glob.md)'s `notExistCondition` lets the kernel recognise a
  `.notExist()`, report that combination as never able to pass, as eess-ts does.

## Verification

- [ ] Red first: a kernel rule with a dead glob and `.expectNonEmpty()` reports the declaration, not the glob
- [ ] Green: the glob is named first, and each shape's remedy works

Deferred: none
