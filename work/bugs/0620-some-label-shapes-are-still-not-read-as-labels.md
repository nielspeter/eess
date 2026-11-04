# Bug 0620: some label shapes are still not read as labels

## Status

- **State:** Draft — measured 2026-11-04 on `fix/0604-0606-adopter-asks`; no red test yet.
- **Severity:** Low — a header ends early or a value runs on only for these shapes, the same class
  as [bug 0604](./fixed/0604-a-field-heading-in-a-non-ascii-label-ends-the-header.md), which fixed
  letters and combining marks.
- **Origin:** self-found · the review of [bug 0604](./fixed/0604-a-field-heading-in-a-non-ascii-label-ends-the-header.md), 2026-11-04.
- **Reported:** 2026-11-04

## Symptom

`LABEL_HEADING` and `PLAIN_LABEL` (`packages/md/src/model/label.ts`) read a label as a letter
followed by letters, combining marks and spaces, then an ASCII colon. These shapes are not read
(the review measured each of them except the hyphen):

- a full-width colon (`Größe：F7`), as written in Chinese and Japanese text;
- a digit (`Phase 2: Done`);
- an apostrophe or a hyphen (`Owner's team: X`, `Go-live: May`);
- a right-to-left mark (U+200F) at the start of the label (`## ‏מצב: גמור`), as some editors write
  in Hebrew or Arabic text.

## Root cause

The label grammar is the character class `[\p{L}\p{M} ]` and the colon `:`. Which of these shapes
are labels is a decision, not a defect in one regex: a digit or a hyphen admitted to the class also
makes more prose lines read as labels, which ends values that run on today.

## Fix

Not designed. Measure each shape over a real corpus first: how many lines become labels, and how
many continued values each one ends.

## Verification

- [ ] Each shape measured over this repository's corpus and recorded here.
- [ ] A row per shape that is admitted, red first.
- [ ] `PLAIN_LABEL`'s doc comment (`packages/md/src/model/label.ts:66`) names combining marks, as
      `LABEL_HEADING`'s does (the review of [bug 0604](./fixed/0604-a-field-heading-in-a-non-ascii-label-ends-the-header.md)).
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
