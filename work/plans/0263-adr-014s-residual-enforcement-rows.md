# Plan 0263: ADR-014's residual enforcement rows

## Status

- **State:** Ready — **Phase 1 shipped 2026-09-07 on its second attempt**; the
  first was opened as PR #116, reviewed by five lenses, and **closed unmerged**
  because the measurements said the design was wrong rather than incomplete (see
  Phase 1's record). Phases 2-5 remain. Frozen 2026-09-06. **The freeze found two things, one a
  false premise this plan inherited from ADR-014's own table and repeated
  without measuring** — written the day before, by me, which is the mistake this
  ADR is about, made about the ADR:
  1. **Phase 4's premise was wrong.** `cardinality.ts` is not the sole `WeakSet`
     registry home; `owns-empty-discovery.ts` is a second, and says so in its own
     comment. The rule as written would have reddened on legitimate kernel code
     on first run. Corrected here and in the ADR row.
  2. **Phase 2 is bigger than "write a fixture".** `checkAll` aggregates with
     `flatMap` and delivers through `writeReport`, so it never reaches the
     evidence gate — the receipt's `examined` is discarded at that seam. The
     phase now names the wiring and the two contracts that constrain it.

  Verified and holding: `throwIfViolations` still exported from both roots; all
  five `pending` rows name this plan; `emitter/one-dead-check` exists while
  `check:ledger` and `check:release` have no counterpart; `check-release.mjs`'s
  `noDiff` branch is real. Originally: the named home for what
  [plan 0235](./completed/0235-the-emitter-takes-a-receipt.md) built the contract
  for and did not gate. Created at 0235's close so the deferral has somewhere to
  go: five `pending` rows in a binding ADR that named a plan about to become a
  completed one is the orphan shape `/close` exists to refuse.

- **Priority:** Medium — every clause here is already **true of the code**; what
  is missing is the mechanism that would notice if it stopped being true. That is
  a weaker emergency than a false green, and a real one:
  [ADR-009](../../adr/009-agent-first-failure-surfaces.md) rule 1's whole thesis
  is that an unenforced clause decays to prose, and this ADR's own §2 refuses a
  registry precisely so the guarantee lives in mechanisms rather than lists.
- **Effort:** Low-to-medium — five rows, four of them one fixture or one rule
  each. The `throwIfViolations` row is the only one that moves a public surface,
  and it is a breaking change in two packages.
- **Created:** 2026-09-06
- **Inherits:** the five rows
  [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)'s
  Enforcement table still marks `pending` at 0235's close. No `**Implements:**`
  line — this builds no proposal; it finishes an ADR's table.

## Problem

Plan 0235 shipped ADR-014's contract and moved nine of the table's sixteen rows
to `gated`. Six stayed `pending`; one of those (`a terminal's verdict flows
through unchanged`) was measured and gated at 0235's close, leaving **five**.

The five are not oversights in the contract — the contract holds. They are
clauses whose _mechanism_ was scoped out, each for a stated reason, and the
honest consequence is that nothing would notice their regression:

| Row                                                                        | What is true today                                                                                                             | What would not be noticed                                                                                            |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `throwIfViolations` is not exported                                        | It **is** still exported from `packages/core/src/index.ts` and `packages/ts/src/index.ts` — the clause is simply not satisfied | n/a; this one is undone work, not unwatched work                                                                     |
| A rule file exporting an evidence-free builder reds the CLI and `checkAll` | It does — `checkAll` routes through the kernel merge and the CLI through the emitter                                           | a future refactor that hands the CLI a bare array again, which is exactly the shape 0206 had                         |
| The finding names its cause, and the remedy remediates                     | Each of the four causes has its own id and message                                                                             | a message edited into uselessness, or a remedy that does not clear the finding it is printed beside (ADR-009 rule 2) |
| No new kernel registry is added                                            | **TWO** `WeakSet` registries exist, not one — see Phase 4's freeze correction                                                  | a second registry added under `packages/core/src`, which is the device ADR-014 §2 chose the required field over      |
| Every hand-assembled check in this repo supplies evidence                  | `check:corpus` proves it end to end (`emitter/one-dead-check`)                                                                 | the same dead-check fail-open in `check:ledger` or `check:release`, neither of which has a break-the-loop fixture    |

The middle three share a shape worth naming: **the clause is enforced by a
mechanism that exists for another reason** (the type system, the suite), which is
why they were not urgent, and **not by anything that fails on their specific
regression**, which is why they are not `gated`. Calling that `gated` would be
the over-claim ADR-014's own table is supposed to make impossible.

## Phase 1 — evidence in the two gates, then the two fixtures (`check:nonvacuity`)

> **Corrected twice. The first correction was to the phase; the second was to the
> fix.** Recorded in full because this plan's subject is mechanisms that stop
> being true without anyone noticing, and both mistakes are that.
>
> **First: the phase's premise was wrong**, the same way the freeze had already
> found Phase 2's to be wrong, one phase over, by the same author. This phase said
> "plant the corruption, assert the finding fires", which assumes
> `check-ledger.mjs` and `check-release.mjs` reach the evidence gate the way
> `check-corpus.mjs` does. They do not: measured, `check-corpus.mjs` carried 17
> `collectResult`/`mergeCollectResults` references and the other two carried
> **zero**. Both hand-printed on the default path — the path ADR-014's row
> explicitly names — so there was no finding for a fixture to key on. Driven both
> ways before anything was written: zeroing the ledger's finished-not-closed
> denominator left `findings ✓ every done-item reconciled` at exit 0, and
> discarding the release gate's entire `violations` array left
> `✓ release readiness … 0 findings` at exit 0.
>
> **Second: the first fix was wrong, and five reviews measured it.** It shipped as
> PR #116, which was **closed unmerged**. Its receipts were built by the SHELL:
> `ledgerStats(...).scanned` stamped onto `honestyAtClose`'s findings, a disk
> count onto `findUncoveredLanes`'s, `LANES.length` onto `findLaneDoneVacuity`'s,
> and per-rule denominators reconstructed in `check-release.mjs` from the same
> arrays the declarations tested. The consequences, all measured by reviewers and
> reproduced here:
>
> | measurement                                                                                      | result                                                                     |
> | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
> | of the 9 checks the two receipts covered, how many red when their own check dies                 | **1**                                                                      |
> | severing `honestyAtClose`, the preset `check:ledger` exists to run, over 216 records             | **exit 0**, `✓ every done-item reconciled`, receipt attesting 216 examined |
> | two live sabotages of `releaseViolations`                                                        | **exit 0** green, both                                                     |
> | `emitter/release-dead-check` on the 107 of 200 recent commits with no breaking changeset pending | **reds `check:nonvacuity`**, blaming the mechanism for a moved corpus      |
> | reverting either `--format json` branch                                                          | both fixtures stayed **green**                                             |
>
> `scripts/release-gate.mjs` already stated the rule that broke, in this repo's
> own words: _a denominator sourced from anywhere but the rule attests a check
> that may not have run, which is worse than no denominator at all._ The first
> attempt reproduced that one gate over, inside the change built to prevent it.
>
> **The rework, and what it is measured to catch.** Every member is now the
> receipt its own check returned. `honestyAtClose` already returned one and the
> shell was overwriting it; `findUncoveredLanes` and `findLaneDoneVacuity` now
> return theirs (each counting what it actually weighed, not what was on disk or
> declared); `releaseViolations` merges its rules' own receipts instead of
> flattening them, counts the three hand-built rules inside their own loops, and
> uses `notRun` for a waived rule rather than reporting a healthy denominator for
> a rule that was switched off. Declarations come from the INPUT and counts from
> the RULE, so the two can disagree — which is the entire guard.
>
> | mutation                                             | before | after   |
> | ---------------------------------------------------- | ------ | ------- |
> | sever `honestyAtClose`                               | green  | **red** |
> | uncovered-lane loop reaches its assertion zero times | green  | **red** |
> | lane-done-vacuity weighs zero lanes                  | green  | **red** |
> | finished-not-closed examines nothing                 | red    | **red** |
> | `brokenOnPatch` stops evaluating                     | green  | **red** |
> | `break-names-dependents` stops evaluating            | green  | **red** |
> | changed-package correspondence stops examining       | green  | **red** |
>
> **The ceiling, stated because an unstated one reads as coverage.** These
> receipts guard the RULES, not the inputs. If the shell's own parsing goes wrong
> — the breaking-marker detector stops pushing to `breakingFiles`, say — the
> population and the declaration move together and the member declares
> legitimately. That failure belongs to the parser's own fixtures
> (`bad-release.mjs`, `bad-release-e2e.mjs`), not to this seam.

1. **`check-ledger.mjs` supplies evidence** — the per-lane members are
   `honestyAtClose`'s own receipts, and the two lane checks return theirs.
2. **`check-release.mjs` supplies evidence** — `releaseViolations` returns one
   merged receipt built from its rules' own evidence.
3. **`check-corpus.mjs`** — its summary counted emitter findings out of the
   total, so it printed `0 violation(s)` beside a red exit. The first attempt
   fixed that line in the two copies it created and left the original: plan
   0188's headline hazard, inside the change that made the third copy.

Then the fixtures. Both plant the corruption in the **production** script, drive
**both** exits, and assert the finding by id via `firedOn`:

Both are break-the-loop fixtures in `scripts/check-nonvacuity.mjs`, the same
shape as the `emitter/one-dead-check` fixture 0235 shipped: plant the corruption
in the **production** script, assert the finding fires by id, and assert the
other checks still examined.

1. **`emitter/ledger-dead-check`** — plant a `continue` at the top of one of
   `scripts/check-ledger.mjs`'s per-check loops.
2. **`emitter/release-dead-check`** — the same in `scripts/check-release.mjs`,
   which has the extra wrinkle that its `noDiff` branch legitimately declares
   empty, so the fixture must plant its corruption on a path that is **not**
   `noDiff` or it proves nothing.

That second wrinkle is the whole reason this is a phase rather than a copy-paste:
a fixture that fires on the declared-empty path would be a fixture asserting the
declaration works, filed under a row about dead checks.

## Phase 2 — the rule-file fixture and `checkAll`

**Measured at the freeze: `checkAll` is not merely unfixtured, it is outside the
contract.** `packages/ts/src/core/check-all.ts` aggregates with
`dedupeConfigFindings(rules.flatMap((rule) => rule.violations()))` and delivers
through `writeReport`, never `finishPreset` or `reportViolations`. A `flatMap`
over receipts produces a bare array — every `examined` on the floor — so the
evidence gate is never reached, and a rule file exporting an evidence-free
builder passes through `checkAll` silently today. That is why the row is
`pending` rather than `warn`, and it makes this phase a wiring job, not only a
fixture:

> **Corrected at build, 2026-09-07: the phase named one door and the row names
> two.** ADR-014's clause is _"reds the CLI **and** `checkAll`"_, and this phase
> described only `checkAll`'s `flatMap`, with item 2 assuming `eess-ts check`
> already reddened so a fixture could simply assert it. Measured before anything
> was written — the probe rule file `export default [{ violations: () => [] }]`:
>
> | door                                 | before                                       |
> | ------------------------------------ | -------------------------------------------- |
> | `checkAll([bare])`                   | returned silently                            |
> | `eess-ts check <file> --format json` | `"total": 0`, `"examined": null`, **exit 0** |
>
> `runCheck` has the same hole for the same reason: it builds its report by
> pushing `attributeToRuleFile(builder.violations(), file)` into a plain array,
> which keeps the violations and drops the receipt. So this phase wired both.
> This is the third premise in this plan to be wrong the same way, and it is now
> [bug 0267](../bugs/0267-the-freeze-checks-links-not-premises.md)'s subject
> rather than another rueful sentence.

1. Route `checkAll`'s aggregation through `mergeCollectResults` so the receipt
   survives, and its delivery through the gate — **and `runCheck`'s, for the
   same reason**. The severity split at the bottom (`ridesTheThrow`) and bug
   0203's suppression contract must both survive the change — they are why this
   was not done inside 0235.
2. A non-vacuity fixture whose rule file exports a builder whose `violations()`
   returns a bare `[]`, asserted to red `eess-ts check` by rule id.
3. A test that `checkAll` over the same throws — the regression guard for bug
   0206's shape at a different door.

## Phase 3 — the remedy-remediates fixtures

Four fixtures, one per cause (`no-receipt`, `sourceEmpty`, zero-examined,
expired declaration). Each asserts twice: the finding fires on the corrupt
input, **and** applying the remedy the message names clears it. That second
assertion is ADR-009 rule 2's behavioural corollary and is the half nobody
writes — a message can name a remedy that does not work, and only this shape
catches it.

## Phase 4 — the no-third-registry rule

**Corrected at the freeze, 2026-09-06, and this is the phase's whole lesson.**
This plan said "no module under `packages/core/src` other than `cardinality.ts`
constructs a `WeakSet`", inherited verbatim from ADR-014's row, which said
`cardinality.ts` was "the sole home". Measured, it is not:

| file                                        | registry                | audience                             |
| ------------------------------------------- | ----------------------- | ------------------------------------ |
| `packages/core/src/cardinality.ts`          | `CARDINALITY_ASSERTERS` | conditions that assert cardinality   |
| `packages/core/src/owns-empty-discovery.ts` | `OWNERS`                | conditions reporting their own empty |

`owns-empty-discovery.ts`'s own comment says it outright — _"the two markers
share it"_ — so the fact was documented in the code the whole time and wrong in
the ADR. **The rule as originally written would have reddened on legitimate
existing kernel code on its first run**, and the author would have weakened it or
exempted it: a mechanism that fires on the thing it protects teaches people to
switch it off (ADR-009 rule 1).

So: one rule in `arch.internal.rules.ts` asserting that no module under
`packages/core/src` **other than those two** constructs a `WeakSet`. ADR-010 §2's
clause is "nothing may add a fourth"; this rule is what makes it enforceable
rather than prose.

**Scoped to `WeakSet` deliberately.** `packages/core/src/selection-memo.ts`
constructs two `WeakMap`s, and they are a memo cache, not a suppression registry.
The rule must not catch them, and this sentence exists so nobody later "fixes"
the rule to include `WeakMap` and reds the cache.

Tier 1, and it must declare a non-zero denominator or the row is not `gated` —
0235's own success criterion.

## Phase 5 — `throwIfViolations` leaves the public surface

The only breaking change here. It is exported from two packages' roots; ADR-014
says it should not be. Removing it needs a changeset marking the break and naming
every dependent package (bug 0185's rule), and `check:surface` will want the root
export census re-derived.

Sequenced last deliberately: it is the only row whose fix an adopter can feel,
and the other four are pure gain.

## Files changed

- `scripts/check-ledger.mjs`, `scripts/check-release.mjs`, `scripts/release-gate.mjs`,
  `scripts/lib/lane-coverage.mjs`, `scripts/check-corpus.mjs` — the evidence
  seam (Phase 1, after its correction: the phase turned out to need the
  mechanism before the fixture)
- `scripts/check-nonvacuity.mjs` — four new fixtures (Phases 1 and 3)
- `packages/ts/tests/` — the `checkAll` bare-builder test (Phase 2)
- `arch.internal.rules.ts` — the registry rule (Phase 4)
- `packages/core/src/index.ts`, `packages/ts/src/index.ts` — the removal (Phase 5)
- `adr/014-the-emitter-refuses-a-verdict-without-evidence.md` — five rows to `gated`
- `.changeset/` — the Phase 5 break

## Out of scope

- **ADR-014's two stated residuals** — an adopter who sums by hand, and one who
  never calls an emitter. Those are
  [plan 0237](./completed/0237-eess-runtime-use-only-in-rule-files.md)'s, and the ADR marks
  them `n/a` rather than `pending` for the reason it states: only a human reading
  the loop can judge a wrong `examined`.
- **[Bug 0262](../bugs/0262-an-adr-cannot-cite-a-kernel-test.md)** — the reason
  ADR-014's kernel rows cite file paths rather than `it('…')` titles. It is a
  gate-scope defect, not a row, and upgrading the citations is listed in its own
  verification ledger.

## Success

- Five rows move from `pending` to `gated`, and each one's mechanism has been
  **run red** before it is called gated.
- No row is marked `gated` whose mechanism examines nothing — the criterion 0235
  set for itself and the reason this plan exists as a separate item rather than a
  footnote in a closed one.

## Progress

- [x] Phase 1 — evidence in `check-ledger` and `check-release`, then the two
      dead-check fixtures. Shipped on the second attempt; the first is PR #116,
      closed unmerged after five reviews, and its measurements are in the record
      above. 85 fixtures fire.
- [x] Phase 2 — every verdict door wired, the fixture and the tests. `checkAll`
      merges its builders' receipts through `mergeCollectResults` and consults
      the gate; the three CLI doors (`check`, `check --fix`, `baseline`) consult
      it **per builder**, where the rule file is still in hand;
      `check:nonvacuity` gained `emitter/bare-builder-reds-the-cli` (a probe rule
      file driving the real binary, asserted by id); `check-all.test.ts` gained
      **five** tests — a bare array loaded through `loadRuleFiles` throws, a
      member that ran and examined nothing reds, the cause is named rather than
      thrown for some other reason, one dead member among healthy ones reds, and
      a CONTROL that a declared-empty member stays green.
      Sabotage-checked: reverting the wiring reds exactly the assertions and
      leaves the control green; renaming the cited test reds `check:crossval`.
      Ships `@nielspeter/eess-ts` minor, break-marked: a hand-rolled builder that
      used to pass now fails, which is the point.

      **Reworked after review, and the corrections are the phase's real record.**
      Five lenses measured the first cut. The gate now runs **per builder**
      rather than over a run-wide merge — an architect's proposal, adopted
      because it is strictly stronger and because one move fixed four defects at
      once: the finding named no rule file, an `emitter/*` id arriving from
      inside a member was reported twice, the summary printed `2 of 1 rule
      failing`, and the guard keyed on an object identity that attribution had
      already destroyed. `eess-ts baseline` is gated too — it was minting a
      persisted verdict from a builder that certified nothing. The probe moved
      under `scripts/nonvacuity/`, which `check:integrity` sweeps; at the repo
      root it was invisible to both `git status` and that sweep, which is bug
      0231's shape. The ADR row cites an `it()` title the resolver binds
      (measured: renaming it reds `check:crossval`).

      **And the ceiling this phase asserted was false.** The test file argued the
      bare-array case could not be tested without an `as` that ADR-005 forbids.
      Two reviewers each wrote it independently — one through `loadRuleFiles`,
      one with `@ts-expect-error` — and both typecheck and pass. The test is
      written now, by the route production takes. That was the fourth premise in
      this plan asserted rather than driven, inside the phase that filed
      [bug 0267](../bugs/0267-the-freeze-checks-links-not-premises.md) about
      exactly that habit.

      **A third pass, because two of the review's own repairs were also
      asserted.** The row excused `check --fix` as "returns before any verdict";
      it does not — `runFix` calls `violations()` on every builder, so the door
      was open and is now gated and driven by the fixture in both directions. It
      excused `doctor` as a diagnostic that "already reports rules unable to
      enforce anything"; measured against the built binary, `doctor` over a bare
      builder prints `No rules that cannot enforce anything.` and exits 0, which
      is now [bug 0268](../bugs/0268-doctor-gives-a-clean-bill-to-a-builder-that-enforces-nothing.md).
      `doctor` stays outside the clause because it returns no verdict, which is
      the honest reason rather than the one given.

      **The rework's own repair was measured too, and the first cut was
      wrong.** An ops review measured three hand-rolled builders in one rule
      file reported as ONE finding whose note said they were "one edit" — the
      per-builder gate names every file, and the reporting layer merged them
      back. The first fix refused a dedupe key whenever a finding's `element`
      repeated its identity, which is too broad: `the-floor.test.ts`'s "CONTROL:
      genuinely identical findings still collapse" reds on it, because a real
      rule with a real narrowing and no glob to name has the same shape and two
      instances of it genuinely are one edit. The guard is keyed on the four
      emitter ids instead, and the kernel unit test now carries that control
      locally so nobody widens it back.

      **An existing negative control caught a mistake in a different lane.**
      Adding the ADR row broke `crossval/scenario-exemption-stale` and
      `crossval/scenarios-covered-e2e` — not because either gate changed, but
      because their negative-control scenario requires the whole of
      `check-crossval.mjs` to exit 0, and the new row cited a KERNEL test, which
      the ADR resolver cannot see ([bug 0262](../bugs/0262-an-adr-cannot-cite-a-kernel-test.md)).
      Two fixtures in an unrelated dialect reddened on a bad citation in an ADR.
      The clause is now pinned by a `packages/ts` test at the door it is about,
      which the resolver binds — measured by renaming it and watching
      `check:crossval` go red.

      **The falsifier was measured one gate at a time, not argued.** Deleting
      the `check`, `--fix` or `baseline` gate individually reds the fixture;
      deleting `checkAll`'s does not, and reds two suite tests instead — so the
      fixture's blind spot is named in the ADR row rather than left implied. A
      first attempt at this matrix ran in a `git worktree` whose `node_modules`
      symlink resolved `.bin/eess-ts` back to the main checkout's `dist`, so the
      sabotage never executed and the fixture "passed" against unmutated code.
      The matrix was rerun in the real tree with every source file restored by
      hash afterwards. An isolation habit that silently isolates the wrong thing
      is the same fail-open shape this plan is about.

- [ ] Phase 3 — the four remedy-remediates fixtures
- [ ] Phase 4 — the no-second-registry rule
- [ ] Phase 5 — `throwIfViolations` removed, changeset naming the break
- [ ] `/close`

Deferred: none
