# Bug 0283: `ledger/unknown-state` names the vocabulary it wanted and never the option that would admit yours

## Status

- **State:** Draft — root cause corrected 2026-09-12 after review falsified the
  first one; no red test yet.
- **Severity:** Medium — raised from Low on review. The finding is correct and the
  build fails for a real reason, but the message is the **first** one an adopter
  meets (`docs/markdown.md:454` says so outright), and acting on it as written
  lands them on [0282](./0282-the-kit-instructs-a-close-into-folders-the-gate-does-not-know.md),
  whose message is false.
- **Origin:** self-found · while verifying an external report for
  [0251](./0251-the-corpus-map-teaches-a-close-vocabulary-the-gate-rejects.md)
- **Reported:** 2026-09-12

## Symptom

An adopter whose lane legitimately uses a token outside the default vocabulary
sees, from `packages/md/src/rules/ledger.ts:244-251`:

```
State: Promoted is not a state this corpus declares — expected one of
Draft, Ready, Open, Done, Won't-do. An unreadable state cannot be checked
against its folder, so it is reported rather than skipped.
  Why: a state nobody can read is a check that silently stops running
```

Every word is true and the reader is still sent to the wrong file. "is not a state
this corpus declares" reads as a fact about the record; the remedy is `states` in
the call, and neither the message nor the rationale says so. The author's first
move is to edit the token, which silently reclassifies the record and, measured,
lands them on 0282's false message.

This is the misdirection class [0223](./fixed/0223-type-module-rule-files-cannot-import-a-sibling.md)
was filed for, in a different preset.

## Root cause — corrected

**The first version of this record said it was structurally impossible for any
`honestyAtClose` finding to carry a `Fix:` line. That is false, and two reviewers
measured it independently.** `honestyAtClose` ends at
`finishPreset(mergeCollectResults([...]), options)` (`ledger.ts:582`), so a run
whose header rule examines zero units returns the kernel's own configuration
finding carrying a full `suggestion`. Reproduced against the published package.
A record about a message whose stated cause points away from the real one made
exactly that error about itself; it is corrected here rather than quietly edited.

The true, scoped claim: **none of the four `ledger/*` findings can carry a `Fix:`
line.** All five construction sites (`ledger.ts:244`, `:256`, `:265`, `:309`,
`:394`) go through one module-local five-parameter helper at `ledger.ts:210-223`
carrying `rule`, `doc`, `line`, `message`, `because`. It is the sole exception in
the dialect: every other md condition builds through `mdViolation`
(`packages/md/src/model/violation.ts:13-42`), which threads `suggestion`,
`ruleId`, `docs` and `codeFrame` as well.

**And the missing parameter is not the blocker.** The kernel already stamps a
rule-level suggestion onto any violation lacking one, at
`packages/core/src/execute-rule.ts:127-128`, beside where it back-fills `ruleId`
and `because`. A `.rule({ suggestion })` on the chain would reach
`ledger/unknown-state` today with no helper change at all.

**The reason that cheap fix is wrong is the real finding.** `headerRule` is one
chain whose single condition emits two different rule ids from opposite branches
— `ledger/unknown-state` at `:245` and `ledger/state-folder-mismatch` at `:257`
and `:266`. The stamp is per rule, not per finding, so one remedy would land on a
token the vocabulary rejects _and_ on a file in the wrong folder. That is
[0124](./0124-correspondence-stamps-one-remedy-onto-opposite-branches.md)
verbatim, which records that nothing in eess triggers it yet because no shipped
preset sets a rule-level suggestion on a multi-branch rule. This fix would be the
first. **Per-finding granularity is therefore required, not preferred**, and that
is the argument the record must carry.

## The census, corrected

Four rule ids, **five** messages. The first version of this record said "three of
four" in prose while its own table said two, and the board row said two; all three
were wrong, and the denominator was wrong as well.

| rule id                          | remedy in the message?                     |
| -------------------------------- | ------------------------------------------ |
| `ledger/silent-open-box`         | yes — names all four disposition tokens    |
| `ledger/state-folder-mismatch` ① | yes — "move it back … or close it out"     |
| `ledger/state-folder-mismatch` ② | **no** — and it is false (see 0282)        |
| `ledger/deferred-none-lie`       | no — states the contradiction, not the fix |
| `ledger/unknown-state`           | no — names the wanted set, not the option  |

So three of five, and the missed one is the message an adopter actually reaches.

## The committed position this contradicts

`packages/md/tests/rules/ledger.test.ts:117-119` asserts the opposite, with a
comment:

```ts
expect(unknown[0]?.message).toMatch(/IMPLEMENTED/)
// It names what IS allowed, or the author cannot act on it.
expect(unknown[0]?.message).toMatch(/Done/)
```

That is a reasoned, committed claim that the wanted-set **is** the actionable
content. Both can hold — name the set _and_ the option — but this record has to
say so, or the fix reads as an unexplained reversal and the next author restores
the old behaviour. The test should keep its assertions and gain one.

## The corruption that must produce a violation

**Not "the message contains the word `states`", and not that assertion moved into
the `suggestion` field** — which is what the first version of this record
specified after warning against exactly that. A constant string satisfies both.

The honest form is behavioural, and this repo already writes it:
`scripts/nonvacuity/bad-emitter-remedies.mjs` asserts per cause that the finding
fires **by rule id** and that **every remedy its message names actually clears
it**, counting corrective and declaring remedies separately so "delete the check"
cannot be recorded as a working repair.

Applied here: given a corpus whose `State:` token is outside the vocabulary,
assert `ledger/unknown-state` fires by id, that it carries a `suggestion`, and
that **applying the option the suggestion names clears the finding**.
`packages/md/tests/rules/ledger.test.ts:121-131` already proves that passing
`states`/`terminalStates` clears it; nothing binds that fact to what the message
says. Binding them is the test.

One constraint on the wording: the preset **cannot** decide whether an unknown
token means closed. `findState` returns `state: undefined`, so nothing tells
`honestyAtClose` that `Promoted` is terminal. The suggestion must name both
options and say which applies when, or it is a constant naming both, which is the
weakest possible pass.

## Non-vacuity

`scripts/nonvacuity/bad-ledger.mjs:42-47` asserts the four ids fire and reads
nothing else. Emptying the suggestion leaves it green. The fixture must gain the
behavioural assertion in the same change, or the fix ships behind a probe that
cannot see it.

## Fix

1. Give the module-local helper a sixth optional `suggestion` parameter —
   per-finding, because `0124`'s trap rules out the rule-level stamp. Module-local,
   so no published type changes.
2. Supply one for `unknown-state`: name `states` and `terminalStates`, and say
   which applies when the token means closed.
3. Supply one for `deferred-none-lie`: say which side to change.
4. `state-folder-mismatch` branch ② belongs to
   [0282](./0282-the-kit-instructs-a-close-into-folders-the-gate-does-not-know.md),
   whose message is false and not merely silent. Named here so the two halves of
   one rule id are not repaired by halves.
5. Extend `scripts/nonvacuity/bad-ledger.mjs` to assert the remedy clears the
   finding.
6. Add the option-naming assertion to `packages/md/tests/rules/ledger.test.ts`
   beside the existing wanted-set ones, not instead of them.
7. Reconcile `CLAUDE.md:174-177` with itself: line 174 says "(often) a fix", lines
   175-177 say "**every** violation surfaces … a `Fix:` line". Prose drift, not the
   defect, and already recorded in `0113`'s severity note.

Out of scope: the four other fields the local helper drops (`ruleId`, `docs`,
`codeFrame`) and the fact that `HonestyAtCloseOptions` extends
`PresetReportOptions` rather than `PresetBaseOptions`, so this is the one md preset
with no per-rule `overrides`. Same helper, wider ask; if the fix converges on
`mdViolation` instead of a sixth parameter, they come back for free and this
record should say so at close.

## Verification ledger

- [x] Helper read; confirmed no `suggestion` parameter on it.
- [x] Confirmed the emitters render one when present (`packages/core/src/format.ts:54`).
- [x] **Falsified the first root cause** — a `honestyAtClose` finding carrying a
      suggestion reproduced against the published package.
- [x] Confirmed the kernel's rule-level stamp exists and would reach this finding.
- [x] Confirmed `headerRule` emits two rule ids from one chain, which is `0124`'s trap.
- [x] Census re-counted: four ids, five messages, three without a remedy.
- [x] Confirmed the committed test asserting the opposite.
- [ ] Red first: the finding fires by id, carries a suggestion, and the option it
      names clears it.
- [ ] The same for `deferred-none-lie`, or a recorded reason not to.
- [ ] `bad-ledger.mjs` extended past rule ids.
- [ ] `CLAUDE.md:174-177` reconciled — **has no box above; this is it.**

Deferred: none.

## Related

- [0124](./0124-correspondence-stamps-one-remedy-onto-opposite-branches.md) — why
  the cheap rule-level stamp is wrong here.
- [0113](./0113-correspondence-drops-rule-suggestion.md) — the same "no `Fix:` line
  can render" defect in `correspondence()`, Parked, and the record that already
  caught `CLAUDE.md`'s overpromise.
- [0151](./0151-honesty-at-close-options-undiscoverable-past-source.md) — fix item 2
  asks for this same mechanism in this same file. This record either supersedes that
  item or sits beside it; **that is for whoever builds it to declare.**
- [0282](./0282-the-kit-instructs-a-close-into-folders-the-gate-does-not-know.md) —
  where acting on this message actually lands the author.
