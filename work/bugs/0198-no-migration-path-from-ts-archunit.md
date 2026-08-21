# Bug 0198: nothing tells a ts-archunit user how to switch to eess-ts

## Status

- **State:** Draft — release-blocking for the replacement story.
- **Deferred:** none
- **Found:** 2026-08-21, while assessing readiness to retire the fork.

## Symptom

[Plan 0100](../plans/0100-publish-the-fold-retire-ts-archunit.md) will
`npm deprecate @nielspeter/ts-archunit`. A deprecation notice sends every
existing user looking for a migration path. **There is none.**

Measured across `docs/`, `README.md` and every package README, `ts-archunit` is
mentioned exactly three times, and none is instructions:

| where                        | what it says                                                        |
| ---------------------------- | ------------------------------------------------------------------- |
| `docs/getting-started.md:15` | "evolved from ts-archunit's engine. Install `@nielspeter/eess-ts`." |
| `packages/ts/README.md:12`   | "Formerly published as `@nielspeter/ts-archunit`."                  |
| `docs/index.md:7`            | credits ArchUnit and ts-morph — unrelated                           |

`grep -rn 'migrat'` across `docs/` and `README.md` returns nothing tying the two
packages together. There is no page, no section, no snippet.

## Why this blocks the release rather than following it

The API surface is **not** the gap — that is already closed. Measured against the
published `@nielspeter/ts-archunit@0.61.0` `.d.ts`: 253 exports, of which **251
are present in eess-ts under the same name**, and eess-ts exports 311 in total.
The only two absent are `correspondence` / `CorrespondenceBuilder`, deliberately
renamed to `crossProject` / `CrossProjectBuilder`.

So a migration is genuinely small — which is exactly why leaving it undocumented
is the wrong trade. The work is a page, not an engine.

**The unanswered questions a switching user hits immediately**, none of which the
corpus answers today:

1. **The rename.** `correspondence()` → `crossProject()`. This is the one symbol
   that moved, and per [bug 0195](./0195-crossproject-ships-with-no-documentation.md)
   it is also the one with no documentation page — so the single thing a migrator
   must change is the single thing they cannot read about.
2. **Baselines — MEASURED 2026-08-21, and the answer is good.** See below.
3. **The CLI binary name**, the config filename, and the scaffolded `package.json`
   scripts — do they change, and does `init` overwrite or collide with an existing
   ts-archunit setup?
4. **Presets.** Do preset names and their `overrides` keys carry over unchanged?

## Measured: baseline compatibility (2026-08-21)

**Result: an existing ts-archunit baseline transfers unchanged. 5 of 5 hashes
identical, 0 orphaned, 0 new.** This closes the question that had the worst
failure mode.

Method — a real project, not a reasoning exercise: a fixture with violations
across three rule kinds, `@nielspeter/ts-archunit@0.61.0` installed from npm,
`arch.rules.ts` scaffolded by its own `init --preset recommended` (so the rules
are valid for that version by construction), baseline generated with
`ts-archunit baseline`. Then `@nielspeter/eess-ts@0.3.0` packed from this repo
and installed alongside, with **only the import specifier changed**.

| check                                                          | result                                               |
| -------------------------------------------------------------- | ---------------------------------------------------- |
| `ts-archunit check --baseline` (control)                       | exit 0, all 5 suppressed                             |
| `eess-ts check --baseline <ts-archunit's file>`                | **exit 0, all 5 suppressed**                         |
| `eess-ts check` with no baseline (vacuity control)             | exit 1, **the same 5** violations, same rule strings |
| eess-ts's own generated baseline, hash-diffed vs ts-archunit's | **5/5 identical**, 0 only-in-A, 0 only-in-B          |

Both use `hashVersion: 5` and the same filename, `arch-baseline.json`. The
`hashViolation` implementations are byte-identical between the two packages —
but that was not taken as the answer, because identical hash _code_ proves
nothing if the inputs (rule descriptions, messages) drifted in the fold. The
two independent derivations above are what settle it: a suppression run **and**
a direct hash diff, plus a control proving the green is suppression rather than
vacuity (ADR-010).

**Caveat, stated because it bounds the claim:** this covers the rules the
`recommended` and `agentGuardrails` presets construct — 3 rule kinds, 5
violations. It does not sweep all 251 shared exports. The mechanism is
shared and version-stamped, so the result should generalise; "should" is not
"measured".

## The measurement found a worse break than the one it was looking for

**A migrating user's rules file does not work, and the reason is not the hashes.**

ts-archunit's `recommended()` returns builders directly — it has no `deliver()`
and never throws. eess-ts's routes through `deliver()`, whose default is
`report: 'throw'` (ADR-008). So the identical file, specifier swapped, throws at
module-evaluation time — **before** the CLI's baseline filtering runs.

Measured on the fixture above, with the full matching baseline present:

```
npx eess-ts check arch.migrated.rules.ts --baseline arch-baseline.json
→ exit 1
  src/services/order-service.ts:4 — OrderService.place    ← accepted in the baseline
  src/services/report-service.ts:6 — ReportService.todo   ← accepted in the baseline
```

So the migrator's first run reds with violations they had already accepted, the
output never mentions the baseline, and the rules declared after the throwing
preset never evaluate at all. Adding `report: 'builders'` to the preset calls
makes the same project exit 0 with all 5 suppressed.

That is filed as [bug 0199](./fixed/0199-a-bare-preset-call-throws-before-baseline-filtering.md)
— it is a defect in its own right, not only a migration artefact, since anyone
hand-writing `recommended(p)` from `packages/ts/README.md:175` hits it. The
migration page must carry the one-line remedy regardless of how 0199 is fixed.

Also found: [bug 0200](./0200-a-failing-rule-file-reports-one-of-zero-rules.md) —
the summary line on that path reads `1 of 0 rules failing`.

## Blocked on bug 0195, and that was not recorded

Question 1 is the `correspondence` → `crossProject` rename, and this record already
says it is _"the single thing a migrator must change is the single thing they
cannot read about"_. That page is
[bug 0195](./0195-crossproject-ships-with-no-documentation.md) — filed **Medium**,
whose own fix ordering is "settle 3, then 2, then 1", and whose finding 3 is the
undecided question of whether `crossProject` replaces `crossLayer` at all (it does
not, for the `haveConsistentExports` path).

So this **High** release blocker cannot close until a **Medium** with an open
design question closes. Neither `BUGS.md` nor the list below said so. It is stated
here now rather than left for whoever picks this up to discover.

## Fix

Not decided. At minimum a `docs/migrating-from-ts-archunit.md`, reachable from
the sidebar and from `packages/ts/README.md`, that answers 1–4 **from
measurement** rather than assertion — the surface diff above is reproducible and
belongs in it.

Question 2 is the one to settle first, because it is the only one whose wrong
answer is silent.

## Verification

- [ ] `dropped-on-purpose` — "the export-surface diff is reproduced by a script,
      not hand-typed". That is a tooling deliverable, not migration documentation,
      and holding a release blocker open for it would block the release on
      something unrelated to migrating. The hand-derived risk is real (plan 0193's
      standing problem), so the page must state the date and the command that
      produced the number instead of presenting it as timeless.
- [x] Baseline compatibility is **measured**: a real ts-archunit baseline is run
      against eess-ts and the result recorded, including which entries orphan.
      **Done 2026-08-21 — 5/5 hashes identical, 0 orphaned.** See above.
- [ ] The migration page carries the `report: 'builders'` remedy for
      [bug 0199](./fixed/0199-a-bare-preset-call-throws-before-baseline-filtering.md),
      whose absence reds a migrator's first run against an accepted baseline.
- [ ] A ts-archunit project switches by following the page alone, with the gates
      green at the end.
- [ ] `docs/.vitepress` sidebar reaches the page.
