# Bug 0282: the kit instructs a close into two folders its own gate does not know, and the message says the move was never made

## Status

- **State:** Draft — reproduced end to end against the published preset by two
  independent reviewers; no red test yet.
- **Severity:** Medium-to-high — the finding is **false about the filesystem**. It
  names a specific failure that did not happen, carries no remedy, and the only
  move it leaves the author is one that destroys the lane structure the kit taught
  them. Not a fail-open; a lying red.
- **Origin:** self-found · six-lens review of a withdrawn record, reproduced
  independently by the customer, enforcement, product and testing lenses
- **Reported:** 2026-09-12

## Symptom

`kit/skills/close/SKILL.md:57-60` instructs an author to move a closed item to its
lane's done-folder, and lists five:

```
plans/completed/ · bugs/fixed/ · support/delivered/ · proposals/promoted/
  — wont-do/ / rejected/ for the dropped case
```

`DEFAULT_DONE_FOLDERS` (`packages/md/src/rules/ledger.ts:84`) is:

```js
;['/completed/', '/fixed/', '/wont-do/', '/delivered/', '/archived/']
```

`promoted/` and `rejected/` are absent. So a proposal closed exactly as the kit
instructs, in the folder the kit named, produces:

```
Rule: ledger/state-folder-mismatch
State: Done but not in a done-folder — the move-to-done was never made (orphaned close).
work/proposals/promoted/0001-a-proposal.md:5
Why: a done item left in an active lane is an orphaned post-merge move
```

The file is in `work/proposals/promoted/`. **The move was made.** The message
asserts it was not.

## Why this is worse than the token half

[0251](./0251-the-corpus-map-teaches-a-close-vocabulary-the-gate-rejects.md) files
the vocabulary axis of the same contradiction, where the message
(`ledger/unknown-state`) states a true fact and points the reader at the wrong
file. This axis is a grade worse on two counts:

- **The message is false**, not merely misdirecting. "The move-to-done was never
  made" is a claim about the repository, and it is wrong.
- **It has no remedy at all.** Of the two branches `headerStateViolation` emits
  under this rule id, the first names both moves ("move it back to the active lane
  or close it out", `ledger.ts:259`); this one names none (`ledger.ts:269`).

It is also **reached by following the first message's advice.** A reviewer hit
`ledger/unknown-state` on `State: Promoted`, did what that message implies and
edited the token to `Done`, and landed here. The two findings form a cascade, and
the second is the one with the falsehood in it.

## Reproduction

Measured against the published `@nielspeter/eess-md@0.6.1`, seeding from
`kit/templates/work/` and adding `work/proposals/promoted/0001-a-proposal.md` with
`**State:** Promoted`:

| call                                                 | finding                        |
| ---------------------------------------------------- | ------------------------------ |
| kit defaults, no options                             | `ledger/unknown-state`         |
| `states` + `terminalStates` supplied                 | `ledger/state-folder-mismatch` |
| `states` + `terminalStates` + `doneFolders` supplied | none                           |

The middle row is this record. The third row is the fix an adopter must find
unaided: **three** options, none of which `kit/` names anywhere. Grepped, `kit/`
mentions `states`, `terminalStates`, `doneFolders` and `honestyAtClose` in no
file; its seven hits for `check:ledger` all assume a script the adopter already
has, which is [0151](./0151-honesty-at-close-options-undiscoverable-past-source.md).

## Root cause

The preset's three lane facts — vocabulary, terminal states, done-folders — are
three independent options with three independent defaults, and every default is
this repo's **plans** lane. The kit teaches none of them, and its close ritual
grew a proposals lane whose folder names were never reconciled with the preset
that gates it.

The unit an adopter actually has is a **lane descriptor**: states, terminal
states, done-folders and board files together. `scripts/check-ledger.mjs:53`
already carries exactly that as its `LANES` table, one entry per lane, which is
how this repo never meets any of this. The kit exports the method and not the
table.

## The corruption that must produce a violation

Two, and they are different in kind:

1. **The message must stop asserting a move that was not made.** When a terminal
   item sits outside the declared done-folders, the honest finding is that its
   folder is not one the caller declared, and the remedy is to name it in
   `doneFolders` or move the file. A test must fail if the message claims the move
   never happened, and must fail if the finding carries no remedy at all.
2. **A folder any kit skill instructs an author to create must appear in the
   defaults the kit's own gate runs, or in a lane descriptor the kit ships.** The
   red is a fixture where the two disagree.

(1) is a message fix in `packages/md` and is independently shippable. (2) is the
binding, and it shares a prerequisite with 0251: `kit/` is scanned by **no** gate
today — `scripts/check-corpus.mjs:85` is `['work/**', 'adr/**', 'docs/**']` — so
any rule over it requires bringing the tree into a gate's scope and classifying
the new root first. That is the decision, not the rule, and it is the root under
0151, 0251, 0252 and this record.

## Non-vacuity

`scripts/nonvacuity/bad-ledger.mjs:42-47` fires all four `ledger/*` ids and
asserts **rule ids only**. It cannot see a message that lies, and it cannot see a
missing remedy. Fixing (1) without extending that fixture ships the repair behind
a probe that stays green when the repair is reverted.

The shape to copy is `scripts/nonvacuity/bad-emitter-remedies.mjs`, which asserts
per cause that the finding fires **by id** and that **every remedy its message
names actually clears it** — the behavioural half, which is the half that would
have caught this message.

## Verification ledger

- [x] `DEFAULT_DONE_FOLDERS` read from source and confirmed against the published
      package.
- [x] `kit/skills/close/SKILL.md` instructs `promoted/` and `rejected/`; neither is
      in the defaults.
- [x] The three-row table above reproduced end to end from a kit-seeded corpus.
- [x] Confirmed the cascade: editing the token as the first message implies lands
      on this one.
- [x] Confirmed `kit/` names none of the three options, and is inside no gate's
      roots.
- [ ] Red first (1): a terminal item in an undeclared folder, asserting the
      message does not claim the move was never made and that the finding carries a
      remedy naming `doneFolders`.
- [ ] Red first (2): a fixture where a folder a kit skill instructs is absent from
      the kit's declared descriptor.
- [ ] `scripts/nonvacuity/bad-ledger.mjs` extended to read the message and the
      remedy, not only the id.
- [ ] The `kit/`-in-a-gate-root decision, shared with 0251 — **not this record's
      to settle.**

Deferred: none.

## Related

- [0251](./0251-the-corpus-map-teaches-a-close-vocabulary-the-gate-rejects.md) —
  the vocabulary axis of the same contradiction; this record is its second half.
- [0283](./0283-unknown-state-names-the-vocabulary-not-the-option.md) — the first
  message in the cascade, and why it sends the author here.
- [0151](./0151-honesty-at-close-options-undiscoverable-past-source.md) — the kit
  documents no option and ships no reference script, so none of these defaults can
  be overridden by an adopter who follows it.
- [0279](./0279-the-barrel-criterion-has-no-memory-and-no-adopter-signal.md) —
  `kit/` ships by copy through `kit/bootstrap.mjs`, not by npm, so a fix here has
  no channel to an adopter who already bootstrapped.
