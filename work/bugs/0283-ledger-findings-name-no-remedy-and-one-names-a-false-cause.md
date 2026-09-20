# Bug 0283: no ledger finding names its remedy, and one of them names a cause that is false

## Status

- **State:** Draft — root cause corrected twice, both corrections recorded in
  place; no red test yet.
- **Severity:** Medium — three of the five messages that predate PR #144 leave the author with no remedy,
  and one of those three asserts something untrue about the repository. Acting on
  the first of them can reach
  [0284](./0284-a-declared-vocabulary-disjoint-from-its-terminal-set-turns-the-gate-off.md),
  which is the High one.
- **Origin:** self-found · while verifying an external report; widened on review
  to cover every `ledger/*` message, since they are one file, one class, one
  fixture and one test file
- **Reported:** 2026-09-12
- **Note, 2026-09-19:** PR #144 added two findings that do name their remedy —
  see [The census](#the-census). This record is about the five before them, and
  its line numbers are restated for that PR's `ledger.ts`.

## Symptom

### 1. `ledger/unknown-state` names the vocabulary it wanted, never the option

From `packages/md/src/rules/ledger.ts:249-256`:

```
State: Promoted is not a state this corpus declares — expected one of
Draft, Ready, Open, Done, Won't-do. An unreadable state cannot be checked
against its folder, so it is reported rather than skipped.
  Why: a state nobody can read is a check that silently stops running
```

Every word is true and the reader is still sent to the wrong file. "is not a state
this corpus declares" reads as a fact about the record. The remedy is `states` in
the call, and neither the message nor the rationale says so.

### 2. `ledger/state-folder-mismatch`, second branch, asserts a move that was made

From `packages/md/src/rules/ledger.ts:270-276`, on a file that **is** in a folder,
just not one the caller declared:

```
State: Done but not in a done-folder — the move-to-done was never made (orphaned close).
work/proposals/promoted/0001-p.md:5
  Why: a done item left in an active lane is an orphaned post-merge move
```

The move was made. `work/proposals/promoted/` is not an active lane. **Both fields
are false**, and the finding names no remedy at all — unlike the rule id's first
branch (`:265`), which names both moves.

This one is reached by acting on the first. An author told their token is not
declared edits it to one that is, and lands here.

### 3. `ledger/deferred-none-lie` states the contradiction, not the fix

`:314-320` reports that a `Deferred: none` summary contradicts a disposed box. It
does not say which side to change.

## Root cause — corrected twice

**First version.** Said the local five-parameter helper at
`packages/md/src/rules/ledger.ts:215-228` is why no finding carries a `Fix:` line.
Wrong as a _reason_: the helper is not the only constructor.

**Second version.** "Corrected" that to say a `honestyAtClose` finding _can_ carry
a `Fix:` line, citing the kernel's zero-examined finding. **That correction was
itself false, and it broke a true conclusion.** `configFinding`
(`packages/core/src/vacuity-findings.ts:39-53`) sets `suggestion: message` —
byte-identical, deliberately, its JSDoc saying "`suggestion` is the message — its
own remedy, never the author's (bug 0021)". Every emitter then suppresses the line
via `remedyRepeatsMessage` (`packages/core/src/violation.ts:188-190`) at
`packages/core/src/format.ts:54`. Measured: `suggestion === message` is `true`, and
the rendered output contains no `Fix:`.

Worse, the first version **carried the sentence that proves this** — "the emitters
render one from `suggestion` when it is present, and suppress it when it would
merely repeat the message" — and the second version deleted it to make room for a
claim it refutes. The verification box certifying the correction measured
`suggestion !== undefined` while the claim above it was about a rendered line. A
receipt answering a different proposition than its claim is the exact defect class
this record is about, committed twice inside it.

**What holds.** None of the five `ledger/*` findings before PR #144 renders a `Fix:`
line, for **two independent reasons**:

1. All five construction sites (`:249`, `:261`, `:270`, `:314`, `:459`) go through
   the local helper, which has no `suggestion` parameter.
2. The one `honestyAtClose` finding that does carry a `suggestion` is a kernel
   configuration finding whose suggestion equals its message, which every emitter
   suppresses by design.

**And the helper is not the blocker.** The kernel already stamps a rule-level
suggestion onto any violation lacking one
(`packages/core/src/execute-rule.ts:127-128`). A `.rule({ suggestion })` would
reach `ledger/unknown-state` today.

**The reason that cheap fix is wrong is the finding.** `headerRule` is one chain
whose single condition emits two rule ids from opposite branches — `:250` and
`:262`/`:271`. The stamp is per rule, so one remedy would land on a rejected token
_and_ on a misplaced file. That is
[0124](./0124-correspondence-stamps-one-remedy-onto-opposite-branches.md), which
records that nothing in eess triggers it yet because no shipped preset sets a
rule-level suggestion on a multi-branch rule. This fix would be the first, so
**per-finding granularity is required, not preferred**.

## Three ways to reach per-finding, not one

The second version asserted the local helper is "the sole exception in the
dialect". **False.** `packages/md/src/builders/vocabulary.ts:133-150` is a second
hand-built violation, and unlike the ledger helper it threads `ctx.suggestion`,
`ctx.because`, `ctx.docs` and `ctx.ruleId` off the condition context.

So there are three options, not the one the record previously named:

| option                                              | cost                                               |
| --------------------------------------------------- | -------------------------------------------------- |
| sixth optional parameter on the local helper        | smallest; keeps a second adapter in the dialect    |
| read the remedy off `ConditionContext`              | the shape `vocabulary.ts:147` already demonstrates |
| converge on `mdViolation` (`model/violation.ts:13`) | also returns `ruleId`, `docs`, `codeFrame`         |

The third is the only one that closes the adjacent gap: ledger findings carry no
`ruleId` either, so a consumer filtering them keys on `rule`, which holds an id for
a ledger finding and an English sentence for a configuration finding.

## The census

Four rule ids, **five** messages. Three of the five carry no remedy.

| rule id                          | remedy in the message?                          |
| -------------------------------- | ----------------------------------------------- |
| `ledger/silent-open-box`         | yes — names all four disposition tokens         |
| `ledger/state-folder-mismatch` ① | yes — "move it back … or close it out"          |
| `ledger/state-folder-mismatch` ② | **no**, and its message and `because` are false |
| `ledger/deferred-none-lie`       | no                                              |
| `ledger/unknown-state`           | no                                              |

An earlier version of this record said "three of four" in prose beside a table
saying two, with a board row saying two. All three were wrong and so was the
denominator.

**Since PR #144 (2026-09-19): six rule ids, seven messages.** The two new
findings, `ledger/unterminated-fence` and `ledger/state-in-code`, are built
outside the helper (`:377`, `:408`) and carry a `suggestion` of their own,
which the kernel's formats render as a `Fix:` line. The five above still carry
none. This repo's own gate never shows either line: `scripts/check-ledger.mjs:270-273`
prints only the first line of each message — the same gap, one layer out.

## The committed position this contradicts

`packages/md/tests/rules/ledger.test.ts:117-119` asserts the opposite, with a
comment: the message must name what IS allowed "or the author cannot act on it".
That is a reasoned, committed claim. Both can hold — name the set _and_ the
option — but this record must say so, or the fix reads as an unexplained reversal.
Keep those assertions and add one.

## The corruption that must produce a violation

**Not** "the message contains the word `states`", and **not** that assertion moved
into the `suggestion` field — which is what an earlier version specified after
warning against exactly that. A constant string satisfies both.

The shape is `scripts/nonvacuity/bad-emitter-remedies.mjs`: assert per cause that
the finding fires **by rule id**, and that **every remedy its message names clears
it**. Two halves of that fixture are load-bearing here and an earlier version took
only the first:

- **The remedy must be `corrective`, not `declaring`.** Measured: on a closed
  record with an undisposed box, applying `states` alone clears every finding —
  because admitting the token as non-terminal removes the document from the
  done-item population. Zero findings on a corrupt record. A remedy that clears a
  finding by deleting its subject is the `checkAll([])` failure this fixture exists
  to prevent. The assertion must be that after applying the remedy the document
  **stays examined** and a control finding still reds. That fail-open is
  [0284](./0284-a-declared-vocabulary-disjoint-from-its-terminal-set-turns-the-gate-off.md).
- **A declaring remedy must expire.** Named for the same reason.

**One constraint on the wording.** Passing `states` + `terminalStates` does not
clear `ledger/unknown-state` cleanly — it yields symptom 2. The committed test at
`:121-131` appears to show otherwise only because it also passes `closeInPlace:
true`, a third option this record previously elided. So the suggestion has to cover
the folder axis too, or the assertion has to be "the named remedy removes **this
rule id**, and what it leaves behind is itself remediable" — stated as such, since
the weaker form records a cascade as a passing test.

And the preset **cannot** decide whether an unknown token is terminal: `findState`
returns `state: undefined`. The suggestion must name both options and say which
applies when, or it is a constant naming both.

## Non-vacuity

`scripts/nonvacuity/bad-ledger.mjs:42-47` asserts the four ids fire and reads
nothing else, so emptying a suggestion leaves it green. Extending the fixture is
**not sufficient on its own**: `scripts/check-nonvacuity.mjs` gates on a `mustSay`
token in stderr, and the existing rows are satisfied by the id list the fixture
already prints. A new registry row with a token only the behavioural assertion can
print is required.

## Fix

1. Choose among the three routes above; per-finding either way, because of 0124.
2. Supply a remedy for `unknown-state` naming `states`/`terminalStates`, and the
   folder axis per the constraint above.
3. Repair branch ② — it must stop asserting a move that was not made, in **both**
   `message` and `because`, and must name `doneFolders`.
4. Supply one for `deferred-none-lie`.
5. Extend `bad-ledger.mjs` **and** add a `check-nonvacuity.mjs` registry row.
6. Add the option-naming assertion to `ledger.test.ts` beside the existing ones.
7. Reconcile `CLAUDE.md:174-177` with itself — line 174 says "(often) a fix", lines
   175-177 say "**every** violation surfaces … a `Fix:` line". Prose drift, already
   noted in 0113's severity line.

## Verification ledger

- [x] All five construction sites and four rule ids counted in source.
- [x] **Falsified this record's own second root cause** — measured
      `suggestion === message` on the configuration finding and confirmed the
      rendered output carries no `Fix:` line. The first version's conclusion was
      right.
- [x] Confirmed the kernel's rule-level stamp exists and would reach the finding.
- [x] Confirmed `headerRule` emits two rule ids from one chain — 0124's trap.
- [x] Confirmed `vocabulary.ts:133-150` is a second hand-built violation that does
      thread the context, falsifying "sole exception".
- [x] Confirmed branch ②'s message and `because` are both false on a file in a
      declared folder.
- [x] Measured that `states` alone clears every finding on a corrupt record.
- [x] Confirmed the committed test passes three options, not two.
- [ ] Red first: each finding fires by id, carries a remedy, and the remedy is
      corrective — the document stays examined and a control still reds.
- [ ] The `check-nonvacuity.mjs` registry row.
- [ ] `CLAUDE.md:174-177` reconciled — no box above covers it; this is it.

Deferred: none.

## Related

- [0284](./0284-a-declared-vocabulary-disjoint-from-its-terminal-set-turns-the-gate-off.md)
  — where acting on symptom 1's advice can land: a silent green.
- [0124](./0124-correspondence-stamps-one-remedy-onto-opposite-branches.md) — why
  the cheap rule-level stamp is wrong here.
- [0113](./0113-correspondence-drops-rule-suggestion.md) — the same "no `Fix:` line
  renders" defect in `correspondence()`, Parked, and where `CLAUDE.md`'s overpromise
  was first recorded.
- [0151](./0151-honesty-at-close-options-undiscoverable-past-source.md) — fix item 2
  asks for this mechanism in this file; whoever builds this declares whether it
  supersedes that item.
- [0251](./0251-the-corpus-map-teaches-a-close-vocabulary-the-gate-rejects.md) — the
  kit half, a different artifact and a different fix.
