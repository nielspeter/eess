# Bug 0284: a declared vocabulary disjoint from its terminal set turns the close checks off and reports a clean pass

## Status

- **State:** Draft — measured; no red test yet.
- **Severity:** **High** — a **green build on a corrupt record**. Not a false red,
  not a misdirection: `honestyAtClose` examines the record, reads its state,
  classifies nothing as done, finds nothing, and reports a pass with a
  denominator. This is the class ADR-009 exists for and the one this project
  calls disqualifying.
- **Origin:** self-found · six-lens review of bugs 0282/0283, established while
  checking whether a remedy one of those records prescribed was corrective
- **Reported:** 2026-09-12

## Symptom

`states` and `terminalStates` default independently. Override one and not the
other, and the resulting pair can have an **empty intersection** — a vocabulary in
which no declared token is terminal. Under it, `isDoneItem`
(`packages/md/src/rules/ledger.ts:200-208`) can never return `true` by state, so
every close check silently selects nothing.

Measured. A corpus holding one proposal at `work/proposals/promoted/0001-p.md`:

```markdown
- **State:** Promoted — owned by plan 0002

## Verify

- [ ] undisposed box on a closed record
```

called as `honestyAtClose(c, { states: ['Draft', 'Promoted'] })` — `terminalStates`
left to its default `['Done', "Won't-do"]`:

| scanned | with a readable State | done items | findings |
| ------- | --------------------- | ---------- | -------- |
| 1       | 1                     | **0**      | **0**    |

The record is closed, sits in a done-folder, and carries an undisposed open box.
The gate reports clean.

## Why the vacuity guard does not catch it

It cannot, and the guard is not at fault. The gate declares its box rules empty
only after an **independent** peek — `anyOpenBoxOnADoneItem`
(`packages/md/src/rules/ledger.ts:545`) calls `isDoneItem` directly rather than
through `belongsToADoneItem`, deliberately, "so a corruption of
`belongsToADoneItem` itself doesn't also blind this peek". Both paths then agree,
**correctly**, that under this configuration nothing is done.

So ADR-010's evidence requirement is satisfied honestly. The rule examined its
subjects and found no done items, because the caller declared a world with none.
The defect is one level up: **nothing checks that the declaration is coherent.**

A reviewer initially read this as the preset declaring its own emptiness away.
That reading is wrong, the code refutes it, and it is recorded here so the same
misreading is not made again.

## Why an adopter reaches it

This is not a hypothetical misconfiguration. It is what following the tool's own
advice produces.

`ledger/unknown-state` tells an author their token "is not a state this corpus
declares — expected one of …". The remedy is to declare it. An author who declares
exactly the token they were refused, and nothing else, lands here:

```js
honestyAtClose(c, { states: ['Draft', 'Promoted'] }) // green, and wrong
```

`terminalStates` is a second option they were never told about, on a second axis
they had no reason to consider. That the message names no option at all is
[0283](./0283-ledger-findings-name-no-remedy-and-one-names-a-false-cause.md); that
following it can land on a silent green is this record, and it is the worse half.

**This repo never meets it** because `scripts/check-ledger.mjs:53` passes both
options for every lane, from one table. The dogfood is structurally incapable of
reaching the configuration an adopter reaches first.

## The corruption that must produce a violation

A configuration under which no record can be classified done **by state** must be
reported, not silently obeyed. Concretely: `states` and `terminalStates` whose
intersection is empty, while `states` is non-empty.

Two design questions this record does not settle, both for the library author:

1. **Is an empty intersection always wrong?** A corpus closing purely by folder
   placement is coherent with no terminal state at all — `closeInPlace` exists for
   the neighbouring case. If so, the finding is conditional on `doneFolders` also
   matching nothing, or it ships as a declared-empty claim the caller must make.
2. **Should `terminalStates` default at all when `states` is overridden?** A
   default that silently survives an override of its own partner is the shape that
   produces this. Deriving it, or requiring it whenever `states` is passed, removes
   the class rather than reporting it — at the cost of a breaking signature change
   on a published option.

(2) removes the defect; (1) reports it. Answering first is the prior question.

## What the violation must say

Not "unknown state". The author's mistake is a pair that cannot agree, and the
message has to name **both** options and the emptiness, or it reproduces 0283's
defect one level up.

## Non-vacuity

`scripts/nonvacuity/bad-ledger.mjs:42-47` asserts the four `ledger/*` ids fire and
reads nothing else. It cannot see this, because this defect produces **no finding
at all** — it is the absence the fixture would have to assert against. A new
registry row in `scripts/check-nonvacuity.mjs` is required, with a `mustSay` token
only the new check can print; extending the existing fixture is not sufficient,
because a probe that asserts ids fire stays green when a whole check goes dark.

## Verification ledger

- [x] Reproduced: the four-column table above, from a corpus seeded the way
      `kit/` teaches, against the workspace `0.6.1`.
- [x] Confirmed `ledgerStats` reports `doneItems: 0` while `scanned: 1` and
      `withReadableState: 1` — the gate saw the record and classified it as not
      done.
- [x] Confirmed the emptiness declaration is an independent peek, not a circular
      one, and that ADR-010 is therefore satisfied honestly.
- [x] Confirmed this repo cannot reach the configuration: `LANES` supplies both
      options for every lane.
- [x] Confirmed the path from `ledger/unknown-state`'s advice to this
      configuration is one edit.
- [ ] Red first: the disjoint pair produces a finding naming both options.
- [ ] A `check-nonvacuity.mjs` registry row with its own fixture and `mustSay`.
- [ ] The prior question answered: report the incoherent pair, or remove the class
      by changing how `terminalStates` defaults.

Deferred: none.

## Related

- [0283](./0283-ledger-findings-name-no-remedy-and-one-names-a-false-cause.md) — the
  message whose advice leads here, and which names no option at all.
- [0120](./0120-no-state-and-cannot-find-it-are-the-same-answer.md) — the decision
  that an unreadable state is reported rather than skipped. This record is its
  mirror: a state that is readable, declared, and renders the check inert.
- [0151](./0151-honesty-at-close-options-undiscoverable-past-source.md) — none of
  these options is documented where an adopter reads, which is why only one of the
  pair gets passed.
- [0174](./0174-eess-ts-reports-a-clean-gate-with-no-denominator.md) — the open
  half about a green gate proving declaration rather than examination. Here the
  denominator is printed and still says nothing about the check that went dark.
