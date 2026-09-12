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
other, and a token the author treats as closing is not in `terminalStates` — so the
record is never classified done and every close check silently selects nothing.

**An earlier version of this record said `isDoneItem` "can never return `true` by
state". That is false, measured.** `isDoneItem`
(`packages/md/src/rules/ledger.ts:200-208`) calls `findState` with
**`terminalStates`**, which under a partial override is still the live default — so
a record carrying `Done` closes correctly and reports correctly. What breaks is
narrower: **a record whose state token comes from the vocabulary the author
declared can never be classified done, and nothing reports the incoherence.**

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

**An earlier version specified this as `states` and `terminalStates` "whose
intersection is empty, while `states` is non-empty". That predicate is wrong in
both directions, and two reviewers measured it.**

- **It under-fires.** The same silent green occurs with a **non-empty**
  intersection. An adopter who keeps the printed vocabulary and adds their own
  tokens — which is what `ledger/unknown-state`'s message steers them to do — gets
  `doneItems: 0` and zero findings while the intersection is non-empty. That is the
  commoner configuration, so the check would ship and the defect would survive it.
- **It over-fires.** It reds on `terminalStates: []`, which
  `packages/md/src/rules/ledger.ts:116-125` documents as "a real, supported input,
  not a caller error" for a lane where nothing is ledger-closed by design, and which
  `scripts/lib/lane-coverage.mjs:147` deliberately exempts.

### The guard already exists in this repo, and is not in the shipped package

`findLaneDoneVacuity` (`scripts/lib/lane-coverage.mjs:138-160`) is exactly it. It
fires when a lane **scanned zero done-items while declaring a real
`terminalStates` vocabulary**, skips the structurally-exempt empty-terminal lane,
and gives the caller an explicit `expectEmptyDone` escape. Its own message states
the reason: every predicate and peek `honestyAtClose` runs for a lane shares the
same done/state determination.

So the corruption to gate is **zero done-items on a corpus that declares a real
terminal vocabulary and contains records** — not set intersection. Nothing like it
exists anywhere in `packages/md`.

This is the branch's recurring shape once more: the protection is written, and it
is in this repo's gate script rather than in the package an adopter installs — the
same asymmetry as the per-lane `LANES` table and the missing reference
`check-ledger.mjs` ([0151](./0151-honesty-at-close-options-undiscoverable-past-source.md)).

### What it catches — and the claim retracted here

**An earlier version of this section said the same signature covers
[0286](./0286-a-fenced-example-can-turn-the-close-checks-off.md)'s first route, and
that "two of the three fail-opens on this branch are one missing guard". Measured
false, and the measurement that produced it was a fixture of my own making.**

`findLaneDoneVacuity` is a **lane-wide denominator** guard:
`scripts/lib/lane-coverage.mjs:149` is `if (lane.doneItems > 0) continue`, and
`doneItems` is summed across the whole lane. **One** correctly-closed record
anywhere in the lane makes it non-zero and the guard silent, while every victim in
that lane stays unreported.

Measured, a two-record lane closed in place — one victim carrying two undisposed
boxes behind a fenced example, one ordinary correctly-closed record:

|                           | value      |
| ------------------------- | ---------- |
| `doneItems`               | 1          |
| `honestyAtClose` findings | **0**      |
| `findLaneDoneVacuity`     | **silent** |

So the guard fires only at **total lane blackout**. That is a real break class and a
worthwhile one, and it is not this record's. The earlier claim held only because the
probe behind it was a **single-record** corpus, which is the one shape in which the
victims are the entire done population — the same over-generalisation this branch
has now produced repeatedly, this time from a fixture written to test the claim.

This record's own verification box asks that a remedy be **corrective**: after
applying it, the record is classified done and its open box reports. Applying this
guard to a mixed lane changes nothing, so it does not meet that bar either.

**What remains true.** The asymmetry is still real and still worth filing: the
lane-blackout guard exists in this repo's gate script and in no shipped package. But
it is an _adjacent_ protection, not this record's fix, and the per-record corruption
this record files is still unowned.

### The prior question, re-ordered

An earlier version leaned toward reporting the incoherent pair and treated
requiring `terminalStates` as the costlier alternative. **That ordering is
backwards:** reporting the pair fixes only the empty-intersection shape, while
requiring the option whenever `states` is passed removes both. Shipping the
existing guard is the third option and the cheapest, since it is already written.

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
- [x] **Falsified this record's own mechanism sentence** — a record carrying `Done`
      under the disjoint pair still closes and still reports.
- [x] **Falsified this record's own corruption predicate** — it under-fires on the
      commoner non-empty-intersection configuration and over-fires on a documented
      supported one.
- [x] Located the lane-blackout guard at `scripts/lib/lane-coverage.mjs:138`, and
      confirmed nothing equivalent exists in `packages/md`.
- [x] **Falsified this record's own claim that the guard covers 0286's first route
      and that two fail-opens are one missing guard** — measured silent on a
      two-record lane; it fires only at total lane blackout.
- [ ] Red first, in [0283](./0283-ledger-findings-name-no-remedy-and-one-names-a-false-cause.md)'s
      honest form, **not** "the finding names both options" — a constant string
      satisfies that, which is the trap 0283 warns about and an earlier version of
      this box walked into. Assert instead: the finding fires **by rule id** on a
      corpus with zero done-items under a declared real terminal vocabulary, and the
      remedy it names is **corrective** — after applying it the record is classified
      done and its open box reports.
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
