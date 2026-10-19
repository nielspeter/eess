# Bug 0525: a box mark can be declared only open or done

## Status

- **State:** Fixed — 2026-10-19, on branch `fix/mark-not-judged`, at the coordinator's order before
  the release; merged through PR #253.
- **Severity:** High — it blocks one adopter's upgrade, and both declarations it allows are false:
  one invents thousands of findings, the other claims verification that never happened.
- **Origin:** inbound · the release candidate's trial upgrade of the three adopters, 2026-10-19:
  difference D12, issue E4 in the trial upgrade report (scratchpad, not kept), reproduced here.
- **Reported:** 2026-10-19

## Symptom

Plan 0454 ([box marks are the caller's](../../plans/completed/0454-box-marks-are-the-callers.md))
makes every mark beyond GFM's `[ ]` and `[x]` a finding, `md/undeclared-box-mark`, until the caller
declares it, and a declaration may say only `'open'` or `'done'`.

Adopter 3 keeps 1,680 `[?]` boxes in frozen records, and treats them on purpose as neither open nor
verified. Measured on the trial copy:

- left undeclared: 218 `md/undeclared-box-mark` findings, which `.excluding()` cannot hide;
- declared `'open'`: 3,344 `ledger/silent-open-box` findings over records the adopter exempts;
- declared `'done'`: false, and it breaks the adopter's own live-record test.

The only other remedy the finding offers is to rewrite 1,680 lines in frozen records.

## Cause

`validateMarks` in `packages/md/src/model/task-items.ts` refused any state but `'open'` and
`'done'`, and `BoxMarkState` had only those two. Proposal 017's decision 5 says "the caller declares
each extra mark as blocking a close or not". Plan 0454 read "not blocking a close" as done, so a
mark that blocks no close and is not done had no declaration.

## Fix

A third declarable state, `'unjudged'`:

- `BoxMarkState` is `'open' | 'done' | 'unjudged'`, and `validateMarks` accepts the three and
  refuses anything else, `undefined` included. No state is filled in for a mark, so a mark is
  unjudged only where the caller wrote `'unjudged'`; an undeclared mark is still a finding (ADR-009).
- `collectTaskItems` now validates its `marks` too. Before, it passed any value through as the box's
  `state`, so an untyped caller could forge a state by writing it.
- An unjudged box is a `taskItems()` element with `checked: false`. `areOpen()` and `areChecked()`
  do not select it, so `honestyAtClose` neither asks it for a disposition nor counts it as done, and
  a deferral on it is not a deferral. A rule selects it by its mark or by `state === 'unjudged'`.
- A predicate that selects the unjudged state also reaches an undeclared box (`inScope` reads an
  unread box as each of the three states), so such a rule reports the mark rather than missing it.
- The undeclared mark's remedy names `'unjudged'` beside `'open'` and `'done'`.
- This repository's `finished-not-closed` check counts the boxes of a record that are open or done;
  an unjudged box is neither, so it is left out of the count.

### The name

`'unjudged'` says what the declaration does: no close rule judges the box. Rejected:

- `'undecided'` is ADR-021's word for a predicate that cannot judge a subject, a finding; this is
  a declaration, and it must not read as one.
- `'ignored'` and `'skipped'` name the silent ignore ADR-009 forbids. The box is not ignored: it is
  an element, and a rule can select it.
- `'exempt'` reads as a waiver of a finding, which `.excluding()` and the waiver comments own.
- `'unknown'` sits beside `ledger/unknown-state`, which is a finding.

The undeclared mark's own message already says "no rule can judge it", so the word was in md's
vocabulary; the declaration makes that a choice instead of an omission.

## Verification

- [x] Red first: `packages/md/tests/builders/unjudged-box-mark.test.ts` against the unfixed code,
      12 of 13 failed. The 13th, "collectTaskItems yields it with state unjudged and checked false",
      passed before the fix because `collectTaskItems` did not validate its `marks`, which is the
      forgery this fix closes; its refusal row is held by the sabotage matrix below.
- [x] Green: the same file, 13 passed, with the md suite (751) and the core suite (375). Corrected
      2026-10-19 from "14 passed" (release review, method I4): the file holds 13 tests, 9 `it` calls
      and a 4-row refusal loop, re-measured as 13 passed
- [x] Adopter 3's trial copy rerun with `'?': 'unjudged'` declared: see "Adopter 3 rerun" below
- [x] Sabotage matrix: see below
- [ ] `npm run validate` green — validation-owed: validate and CI at the pull request's merging head,
      recorded in the pull request's description

### Adopter 3 rerun

On adopter 3's trial copy, with this branch's eess-md and kernel builds in place of the release
candidate's and one edit, `'?': 'unjudged'` added to the adopter's shared `BOX_MARKS` constant. The
adopter's `corpus:rules` (248 tests, 205 s):

|                              | Release candidate, `[?]` undeclared | This branch, `[?]` unjudged |
| ---------------------------- | ----------------------------------- | --------------------------- |
| Failing tests                | 5                                   | 2                           |
| `md/undeclared-box-mark`     | 218                                 | 0                           |
| `silent-open-box` from `[?]` | n/a (3,344 when declared `'open'`)  | 0                           |
| `silent-open-box` from `[~]` | 9                                   | the same 9                  |

- All 218 undeclared-mark findings are gone, and none became a silent open box.
- Three of the adopter's own tests turned green: a `[?]` on a pre-convention record is exempt, and a
  `[?]` on a current-era record (plain or ordered list) is reported. The adopter reports a
  current-era `[?]` with its own text scan; an unjudged mark leaves that rule's selection intact.
- The 2 tests still failing carry only the 9 partly done `[~]` boxes in closed records, the trial's
  difference D13: real findings for the adopter, not this bug.

The trial copy was restored afterwards: the edit reverted and the release candidate's packages put
back.

### Sabotage matrix

Committed before the run (`7ef8e39a`); each mutant was applied, the named file run, and the source
restored with `git checkout`. 9 rows, 9 red, in 12 s with bug 0526's two rows.

| Row | Mutant                                                | Named test (in `unjudged-box-mark.test.ts`)                                           | Result |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------- | ------ |
| S1  | `validateMarks` accepts any state                     | a declaration with an undefined state is refused, naming the three states             | red    |
| S2  | an undeclared mark defaults to `'unjudged'`           | an undeclared [?] beside a mark declared unjudged is still a finding                  | red    |
| S3  | `areOpen()` selects unjudged (`state !== 'done'`)     | in a done record it is neither a silent open box nor an undeclared mark               | red    |
| S4  | `areChecked()` selects unjudged (`state !== 'open'`)  | areOpen() and areChecked() do not select an unjudged box                              | red    |
| S5  | an unjudged box is not an element (`isRead` drops it) | an unjudged box is still an element, selected by its state or by its mark             | red    |
| S6  | `inScope` reads an unread box only as open or done    | a predicate selecting the unjudged state reaches an undeclared box                    | red    |
| S7  | `collectTaskItems` does not validate its marks        | a declaration with a state in another letter case is refused, naming the three states | red    |
| S8  | an unjudged box carrying `deferred→` defers           | an unjudged box carrying a deferral is not a deferral                                 | red    |
| S9  | the remedy does not name `'unjudged'`                 | the undeclared mark's remedy names unjudged beside open and done                      | red    |

Deferred: none
