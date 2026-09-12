# Bug 0283: `ledger/unknown-state` names the vocabulary it wanted and never the option that would admit yours

## Status

- **State:** Draft — measured by reading the constructor; no red test yet.
- **Severity:** Low — the finding is correct and the build fails for a real
  reason. What is wrong is where the message sends the reader.
- **Origin:** self-found · while verifying an adopter's report for
  [bug 0282](./0282-the-kit-teaches-a-state-vocabulary-its-own-gate-rejects.md)
- **Reported:** 2026-09-12

## Symptom

An adopter whose lane legitimately uses a token outside the default vocabulary
sees, at `packages/md/src/rules/ledger.ts:244-251`:

```
State: Promoted is not a state this corpus declares — expected one of
Draft, Ready, Open, Done, Won't-do. An unreadable state cannot be checked
against its folder, so it is reported rather than skipped.
```

Every word is true and the reader is still sent to the wrong file. "is not a
state this corpus declares" reads as a fact about the record; the remedy is
`states: [...]` in the call, and the message never says so. The first move an
author makes is to edit `Promoted` into `Done` — which silently reclassifies the
record rather than configuring the gate.

This is the misdirection class [bug 0223](./fixed/0223-type-module-rule-files-cannot-import-a-sibling.md)
was filed for, in a different preset: a confident message whose stated cause
points away from the actual one.

## Root cause

`honestyAtClose` builds every finding through a five-parameter helper —
`rule`, `doc`, `line`, `message`, `because` (`packages/md/src/rules/ledger.ts:210-223`).
There is **no `suggestion` parameter**, so it is structurally impossible for any
`honestyAtClose` finding to carry a `Fix:` line, whether or not one would help.

The emitters render one from `suggestion` when it is present
(`packages/core/src/format.ts:54`), and suppress it when it would merely repeat
the message. So the mechanism exists at every layer below this helper, and the
helper is the one place that cannot reach it.

Three of the four ledger messages carry their remedy inline and lose nothing —
`silent-open-box` lists the four disposition tokens, `state-folder-mismatch` says
"move it back to the active lane or close it out". The gap is specific:

| rule id                        | remedy in the message?                     |
| ------------------------------ | ------------------------------------------ |
| `ledger/silent-open-box`       | yes — names all four tokens                |
| `ledger/state-folder-mismatch` | yes — names both moves                     |
| `ledger/deferred-none-lie`     | no — states the contradiction, not the fix |
| `ledger/unknown-state`         | no — names the wanted set, not the option  |

So this is not "add `suggestion` everywhere". It is two messages that stop one
sentence short, and a helper that cannot supply that sentence.

## A hedge that is already in the docs

`CLAUDE.md:174` says a gate prints "a file, a line, a message, and (often) a fix",
then three lines later says "**every** violation surfaces its rationale
(`.because`), a `Fix:` line (the rule's `suggestion`)". The two sentences
disagree, and the second is the one an agent reading the file will act on. Worth
correcting in the same change, but it is prose drift, not the defect.

## The corruption that must produce a violation

The honest red test is not "the message contains the word `states`" — that pins a
string and goes green on any rewrite. What must fail is: **a `ledger/unknown-state`
finding that does not name a caller-supplied remedy.** Concretely, given a corpus
whose `State:` token is outside the vocabulary, assert the emitted violation
carries a `suggestion`, and that the suggestion names the option (`states`, or
`terminalStates` when the token means closed) rather than the expected set.

`ledger/deferred-none-lie` gets the same treatment or an explicit note saying why
not — a fix that quietly repairs one of two identical gaps is how the second one
stops being visible.

## Fix

1. Give the helper a sixth optional `suggestion` parameter. It is local to
   `ledger.ts`, so no published type changes.
2. Supply one for `unknown-state`: name `states`/`terminalStates`, and say which
   applies when the token means closed.
3. Supply one for `deferred-none-lie`: say which side to change.
4. Reconcile `CLAUDE.md:174-177` with itself.

Out of scope: `adrEnforcement` reaches emission through the builder chain, where
`suggestion` is already plumbed (`packages/md/src/builders/vocabulary.ts:150`) and
simply unused by its conditions. Same symptom, different path, not this record.

## Verification ledger

- [x] Helper read; confirmed no `suggestion` parameter exists on it.
- [x] Confirmed the emitters do render one when present, so the gap is the helper's.
- [x] All four ledger messages read; the two that stop short are identified rather
      than assumed.
- [x] Confirmed `adrEnforcement` takes a different path, so the claim is scoped to
      `honestyAtClose` and not to `eess-md`.
- [ ] Red first: assert the `unknown-state` violation carries a suggestion naming
      the option.
- [ ] The same for `deferred-none-lie`, or a recorded reason not to.

Deferred: none.
