# Bug 0521: `agreeWithFolder`'s "judged none" names the wrong cause in two shapes

## Status

- **State:** Draft — recorded 2026-10-19 from PR #251's final review (enforcement, testing); read
  from the code at 60f5d8a and reproduced by the testing review's surviving mutant J8, no red test yet.
- **Severity:** Low — the rule is red in both shapes, so nothing passes falsely; the message sends the
  author to the wrong remedy ([ADR-009](../../adr/009-agent-first-failure-surfaces.md) rule 2).
- **Origin:** self-found · PR #251's final review
- **Reported:** 2026-10-19

## Symptom

`agreeWithFolder` reports an agreement that selected documents and judged none of them, with one of
two causes ([plan 0495](../plans/completed/0495-a-value-agrees-with-its-folder.md), its build note "Judged none names its cause"): "the field read no value
(check its label, forms or region)", or "N selected documents carry values no group names … declare
them in a `'rest'` group, or select a folder a group binds". Two shapes get the first message although
the field did read a value:

1. **Every selected document's value belongs to a group whose folders match nothing (F7).** A group
   names the value, so the document does not count as "values no group names", and it falls through
   to "read no value". F7 is reported beside it and names the real cause.
2. **Under folder → value, every selected document sits outside every group's folders and carries a
   value a group does name** (`Fixed` in `work/other/`). The real cause is that the selection misses
   the bound folders. The testing review's mutant J8 (`bound === undefined && !named` →
   `bound === undefined` in `judgeDocument`, `packages/md/src/conditions/agree-with-folder.ts`)
   survives because no test covers this shape.

## Fix

A third cause when values were read: "N selected documents carry values a group names, but none
sits in a bound folder: select a folder a group binds". Skip "judged none" when every unjudged
document belongs to a group with a dead folder, since F7 already reports it. One test per shape; the
second also kills J8.

## Verification

- [ ] red test first, per shape, through `docs().should().agreeWithFolder(…)`
- [ ] J8 killed
- [ ] `npm run validate` green
