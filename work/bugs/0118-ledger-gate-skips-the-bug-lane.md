# Bug 0118: the honesty-at-close gate reads plans only — the bug lane, where the deferrals actually go, is ungated

## Status

- **State:** Draft — the gap is confirmed against the script and the preset, and
  the preset's state vocabulary was read rather than assumed. No red test yet.
- **Severity:** Medium — an honesty gap between a stated claim and its mechanism.
  A bug record can claim `Fixed` while carrying open verification boxes, or defer
  to nowhere, and nothing reports it.
- **Origin:** self-found · asked directly during the 0105 review round — "if you
  defer things, where do they go then?" — which is a question the repo should be
  able to answer mechanically and cannot
- **Reported:** 2026-08-12

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

Two separate causes, and the second is why this is not a one-line fix.

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

Bugs use `Draft | Ready | Fixed | Rejected | Parked` ([BUGS.md](./BUGS.md)).
`Fixed` and `Rejected` are not in either set, so with roots widened the gate
would be **half-blind rather than wrong**:

| record                              | open `- [ ]` caught? | placement caught? |
| ----------------------------------- | -------------------- | ----------------- |
| `work/bugs/fixed/NNNN.md`, `Fixed`  | ✅ (done-folder)     | ❌ state unparsed |
| `work/bugs/NNNN.md`, `State: Fixed` | ❌                   | ❌                |
| `work/bugs/NNNN.md`, `State: Draft` | n/a                  | ✅                |

Row 2 is the orphaned close — a record marked `Fixed` that was never moved. It is
exactly the failure the placement half exists to catch, and it is the one the
vocabulary cannot see.

## Why it matters

`check:ledger`'s summary line reads `honesty at close — 16 done-items across 29
plans, 0 findings`. That is true and complete for what it scans, and a reader
takes it as "the corpus is honest at close". The corpus is two lanes.

It also makes this repo's dogfooding claim narrower than it reads: the kit under
`kit/` ships `honestyAtClose` as the portable working-method gate, and an adopter
running it over a bug-shaped lane inherits the same half-blindness with no notice.

## Fix

1. **Preset** — accept the vocabulary as options rather than hard-coding one
   lane's enum: `terminalStates?: readonly string[]` and the neutral-enum
   equivalent, defaulting to today's values so nothing moves for plans. `minor` on
   `@nielspeter/eess-md`.
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

- [ ] Red test written first: a bug record in `fixed/` with an unticked `- [ ]`
      is reported. Passes today.
- [ ] A record with `State: Fixed` left in `work/bugs/` is reported as an
      orphaned close. Passes today, and fails for the right reason only after the
      vocabulary is configurable.
- [ ] The plan lane's findings and denominator are unchanged — this widens
      coverage, it must not move existing results.
- [ ] `BUGS.md`'s own template boxes do not report.
- [ ] A non-vacuity fixture: a bug-shaped corpus with a silent open box makes the
      gate exit 1, asserting `ledger/…` as the rule id (`check:ledger` is
      currently waived in `scripts/check-nonvacuity.mjs` as `no-gate-yet`, so this
      also retires one waiver).
- [ ] `npm run validate` green.

Deferred: none.
