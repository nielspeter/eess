# Bug 0118: an unreadable `State:` token silently disables the placement check — and `check:ledger` never opens the bug lane at all

## Status

- **State:** Fixed — `check:ledger` scans both lanes with the vocabulary each
  one uses, and an unreadable `State:` token is reported rather than skipped.
  Fixing it uncovered [0119](./0119-placement-check-never-ran.md), without which
  this fix would have been inert: the token was never read in the first place.
- **Severity:** Medium — an honesty gap between a stated claim and its mechanism.
  A bug record can claim `Fixed` while carrying open verification boxes, or defer
  to nowhere, and nothing reports it.
- **Origin:** self-found · asked directly during the 0105 review round — "if you
  defer things, where do they go then?" — which is a question the repo should be
  able to answer mechanically and cannot
- **Reported:** 2026-08-12 · **Fixed:** 2026-08-12 (PR #45)

## Symptom

`scripts/check-ledger.mjs:20`:

```js
const ROOTS = ['work/plans/**']
```

So `npm run check:ledger` — which reports `honesty at close — N done-items across
M plans` — never opens `work/bugs/**`. Two things follow:

1. A record in `work/bugs/fixed/` may carry unticked `- [ ]` verification boxes
   while its header says `Fixed`. Nothing reports it.
2. A `Deferred:` line may name no owner — "later", "a follow-up", or nothing —
   where the template requires `Deferred: none | <each deferral re-homed to a
named owner>`.

This is not hypothetical about volume: of the nine deferrals disposed on
2026-08-12, **eight** were re-homed through the bug lane and one through the plan
lane. The gate covers the lane the traffic is not in.

## Root cause

Three causes. The first is why this is not a one-line fix; the third is why it is not only about the bug lane.

**1. The roots, and a narrowed default.** `check-ledger.mjs:21` also overrides
the preset's done-folders:

```js
const DONE_FOLDERS = ['/completed/', '/wont-do/', '/archived/']
```

The preset's own default (`packages/md/src/rules/ledger.ts:42`) is
`['/completed/', '/fixed/', '/wont-do/', '/delivered/', '/archived/']` — it
**already knows about `/fixed/`**. The script drops it, consistent with only
scanning plans, so restoring it is part of the same change.

**2. The state vocabulary is plan-shaped.** `packages/md/src/rules/ledger.ts:47-50`:

```ts
const STATE_TOKEN_LINE_RE = /…\s*(Draft|Ready|Open|Done|Won't-do)\b/i
const TERMINAL_STATES = new Set(['Done', "Won't-do"])
```

Bugs use `Draft | Ready | Fixed | Rejected | Parked` ([BUGS.md](../BUGS.md)).
`Fixed` and `Rejected` are not in either set, so with roots widened the gate
would be **half-blind rather than wrong**.

**Measured, not reasoned.** `honestyAtClose` run over a scratch corpus holding
one record per case, with `doneFolders: ['/completed/', '/fixed/']` — i.e. the
configuration this bug proposes:

```
scanned: 3 | violations: 2
  ledger/silent-open-box       · bugs/fixed/0001-closed-with-open-box.md:9
      unchecked box with no disposition
  ledger/state-folder-mismatch · plans/0003-orphaned-plan.md:3
      State: Done but not in a done-folder — the move-to-done was never made
```

| record                                          | reported?                         |
| ----------------------------------------------- | --------------------------------- |
| `bugs/fixed/…`, `State: Fixed`, open `- [ ]`    | ✅ `ledger/silent-open-box`       |
| `bugs/…`, `State: Fixed`, never moved           | ❌ **silent**                     |
| `plans/…`, `State: Done`, never moved (control) | ✅ `ledger/state-folder-mismatch` |

Rows 2 and 3 are the same failure in two lanes, and only the plan lane reports
it. That is the orphaned close — a record marked terminal that was never moved —
and it is exactly what the placement half exists to catch. Row 1 works because
the done-folder test never consults the state vocabulary; the placement half
does, and that is the whole difference.

Also worth noting from the same run: `honestyAtClose` over the **real**
`work/bugs/**` today reports `30 documents scanned, 0 violations`. The lane is
clean — so widening the roots costs nothing to land, and the vocabulary work is
what buys the second row.

**3. And the blind spot is already live in the lane that _is_ gated.** An
unrecognised state token does not fail — it makes `stateLine` stay `0`, so
`placementViolation` returns `null` and the state↔folder check is **silently
skipped**. Counting the plan lane's actual tokens:

| token         | count | in the preset's enum? |
| ------------- | ----- | --------------------- |
| `Draft`       | 12    | yes                   |
| `Done`        | 9     | yes                   |
| `Ready`       | 1     | yes                   |
| `IMPLEMENTED` | 3     | **no**                |
| `BUILDABLE`   | 1     | **no**                |

Four plans — `0051`, `0058`, `0059`, `0060` — carry tokens the gate cannot read,
and for those four the placement half has been off the whole time. No corruption
is masked today (all four are genuinely complete and sit in `completed/`), but
the gate cannot say so, and it never announced that it wasn't looking.

That changes what this bug is. The headline is the missing lane; the mechanism is
broader: **the state vocabulary is a closed set, and anything outside it turns off
half the check without a word.** Whether the bug lane is scanned is a
configuration question. Whether an unparseable state is silence or a violation is
a correctness question, and it is live right now.

BUGS.md line 52 also claims the bug states are "the same vocabulary as plans",
which is not true — plans close on `Done`/`Won't-do`, bugs on `Fixed`/`Rejected`.
Fixing the sentence is not the fix, but the sentence is why nobody noticed.

## Why it matters

`check:ledger`'s summary line reads `honesty at close — 16 done-items across 29
plans, 0 findings`. That is true and complete for what it scans, and a reader
takes it as "the corpus is honest at close". The corpus is two lanes.

It also makes this repo's dogfooding claim narrower than it reads: the kit under
`kit/` ships `honestyAtClose` as the portable working-method gate, and an adopter
running it over a bug-shaped lane inherits the same half-blindness with no notice.

## Fix

1. **Preset — an unrecognised state must not be silence.** This is the ordering
   decision, and it comes first because it is the live defect. A `State:` line
   whose token is outside the configured set should produce a violation
   (`ledger/unknown-state`), not disable the placement check. Land that and the
   four plans above light up immediately, which is the point.

   Then accept the vocabulary as options rather than hard-coding one lane's enum:
   `terminalStates?: readonly string[]` and the neutral-enum equivalent,
   defaulting to today's values so nothing moves for plans. `minor` on
   `@nielspeter/eess-md`.

   Sequence matters: parameterising first and reporting second would let the four
   plans be quietly absorbed by a widened enum, which is the opposite of the fix.
   Report first, decide `IMPLEMENTED`/`BUILDABLE` deliberately (they read as
   `Done`, so most likely they are corrected in the plans rather than admitted to
   the enum), then parameterise for the bug lane.

2. **Script** — add `work/bugs/**` to `ROOTS`, restore `/fixed/` to
   `DONE_FOLDERS`, pass the bug vocabulary, and report the two lanes separately so
   the denominator stays readable (`N done-items across M plans + K bugs`).
3. **Board** — `work/bugs/BUGS.md` and `work/plans/ROADMAP.md` are already
   excluded as `boardFiles`; confirm `BUGS.md` is in that set once the lane is
   scanned, or its template's example `- [ ]` boxes will report.

Deliberately **not** in scope: gating `work/bugs/**` in `check:corpus` (links and
`path:line` pointers). That is [0086](./0086-links-to-directories-do-not-resolve.md)'s
blocker and needs the directory-link fix; this needs none of it. Filing them
apart so the cheaper half is not held hostage to the harder one.

## Verification

- [x] Red test written first: a document whose `State:` token is outside the
      configured set is reported (`ledger/unknown-state`) rather than silently
      exempted. Four plans and two bugs went red on the first run and were
      corrected — see [0119](./0119-placement-check-never-ran.md) for the table.
- [x] A bug record in `fixed/` with an unticked `- [ ]` is reported.
- [x] A record with `State: Fixed` left in `work/bugs/` is reported as an
      orphaned close, and a `Draft` parked in `fixed/` reports the other
      direction — both measured against the **real** corpus, not fixtures.
- [x] `BUGS.md`'s own template boxes do not report (it is a `boardFiles` entry
      in the bug lane's config).
- [x] A non-vacuity fixture: `scripts/nonvacuity/bad-ledger.mjs` asserts
      `ledger/silent-open-box`, guards its denominator, and proves the clean
      direction. `check:ledger`'s `no-gate-yet` waiver is retired — the harness
      now runs 14 gates, 9 `check:*` scripts gated, 5 waived.
- [x] `npm run validate` green.

**One box from the original list was withdrawn, not ticked.** It read _"the plan
lane's findings and denominator are unchanged — this widens coverage, it must not
move existing results."_ That premise was wrong, and 0119 is why: the plan lane
had no findings to preserve because the check had never run there either. The
plan lane gained four findings, all real, all corrected here. Preserving its
results would have meant preserving the silence.

**Not disposed here, and named rather than left implicit** — review found more
than this record's fix covers:

- **Three plans carry `**Status:** IMPLEMENTED`** (`0061`, `0062`, `0066`) — the
  same drift corrected in four siblings, invisible because the key is spelled
  `Status:`. This record's own table counted them as "no `State:` line" without
  noticing. They are why `withReadableState` reads 26 of 29 rather than 29 of 29,
  which is now visible on every run. **→ a follow-up.**
- **`work/proposals/**`is a third lane** with`State:` records that no lane
  opens. This record's title says "reads plans only"; the fix reads two of four.
  **→ a follow-up.**
- **The region rule re-arms the same trap one heading over** — a document whose
  first section is not `## Status` is silent again, with 0119's exact signature.
  Splitting "no state line" from "could not find one" is the structural answer.
  **→ a follow-up.**

Deferred: none of the above is left unnamed; each needs its own record before
this lane can claim the class is closed.
