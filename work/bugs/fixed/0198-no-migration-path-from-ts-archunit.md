# Bug 0198: nothing tells a ts-archunit user how to switch to eess-ts

## Status

- **State:** Fixed — `docs/migrating-from-ts-archunit.md` ships, reachable from the
  sidebar beside Getting Started, from `getting-started.md` and from the package
  README. All four unanswered questions are answered by measurement.
- **Deferred:** none
- **Found:** 2026-08-21, while assessing readiness to retire the fork.

## Symptom

[Plan 0100](../../plans/0100-publish-the-fold-retire-ts-archunit.md) will
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
published `@nielspeter/ts-archunit@0.61.0`: **the only two exports absent from
eess-ts are `correspondence` / `CorrespondenceBuilder`**, deliberately renamed to
`crossProject` / `CrossProjectBuilder`. Everything else is present under the same
name, and eess-ts exports a superset.

**The counts are deliberately not quoted here, because the first version's were
wrong.** It said "253 exports, of which 251 are present, eess-ts exporting 311" —
derived by regex over `index.d.ts`. A reviewer re-derived them with the TypeScript
checker (`getExportsOfModule`) and got **317 / 396 / 315 shared** — the same
qualitative answer, numbers off by roughly 25%. The regex could not see re-exported
and type-only surface. That is the sixth hand-derived population figure this corpus
has had to withdraw, and the reason the migration page must carry the command that
produced any number it quotes, dated, rather than the number alone.

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
5. **Inline exclusion comments — the widest surface, and the first version of this
   record never asked.** The token changed: `// ts-archunit-exclude <id>: <why>` →
   `// eess-exclude <id>: <why>`. Measured by the adopter review on one identical
   source file: ts-archunit reports 4 violations and "1 finding suppressed by
   inline comments"; eess-ts reports **5**, with **no mention** of the comment on
   the line above. The exemption evaporates silently. It fails loud rather than
   green, so it is not a fake pass — but it is a wrong attribution, and the blast
   radius is every file in the repo rather than one rules file. eess-ts already has
   the machinery to notice these comments; it should recognise the legacy token and
   say so.

## Measured: baseline compatibility (2026-08-21)

**Result: an existing ts-archunit baseline transfers unchanged. 5 of 5 hashes
identical, 0 orphaned, 0 new.** This closes the question that had the worst
failure mode.

Method — a real project, not a reasoning exercise: a fixture with violations
across three rule kinds, `@nielspeter/ts-archunit@0.61.0` installed from npm,
`arch.rules.ts` scaffolded by its own `init --preset recommended` (so the rules
are valid for that version by construction), baseline generated with
`ts-archunit baseline`. Then `@nielspeter/eess-ts@0.3.0` packed from this repo
and installed alongside. The rules file changed in exactly one place per row below —
the import specifier always, and `report: 'builders'` where the row says so.

| check                                                          | rules file                 | result                                               |
| -------------------------------------------------------------- | -------------------------- | ---------------------------------------------------- |
| `ts-archunit check --baseline` (control)                       | as scaffolded              | exit 0, all 5 suppressed                             |
| `eess-ts check --baseline <ts-archunit's file>`                | **+ `report: 'builders'`** | **exit 0, all 5 suppressed**                         |
| `eess-ts check` with no baseline (vacuity control)             | + `report: 'builders'`     | exit 1, **the same 5** violations, same rule strings |
| eess-ts's own generated baseline, hash-diffed vs ts-archunit's | + `report: 'builders'`     | **5/5 identical**, 0 only-in-A, 0 only-in-B          |
| `eess-ts check --baseline`                                     | **specifier swap ONLY**    | exit 1 — two accepted violations reported (bug 0199) |

**The `report: 'builders'` column is load-bearing, and the first version of this
table omitted it** while the prose above said "only the import specifier changed".
Those cannot both describe one file: a reader reproducing the method as written
gets the LAST row, not the second. The hash-compatibility conclusion is unaffected
— the fourth row is an independent derivation — but the method had to be stated
correctly, since this record seeds a page other people will follow.

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

That is filed as [bug 0199](./0199-a-bare-preset-call-throws-before-baseline-filtering.md)
— it is a defect in its own right, not only a migration artefact, since anyone
hand-writing `recommended(p)` from `packages/ts/README.md:175` hits it. The
migration page must carry the one-line remedy regardless of how 0199 is fixed.

Also found: [bug 0200](../0200-a-failing-rule-file-reports-one-of-zero-rules.md) —
the summary line on that path reads `1 of 0 rules failing`.

## Was blocked on bug 0195 — UNBLOCKED 2026-08-22

Question 1 is the `correspondence` → `crossProject` rename, and this record said it
is _"the single thing a migrator must change is the single thing they cannot read
about"_. That page was
[bug 0195](./0195-crossproject-ships-with-no-documentation.md), now **fixed**:
`docs/cross-project.md` ships with a migration table.

**Its open design question is settled, and this record's summary of it was wrong.**
The text here said `crossProject` "does not" replace `crossLayer` "for the
`haveConsistentExports` path". Measured: it does — a key function may return an
**array**, so one file expands into one key per exported symbol and the pairing
folds into the key's prefix.

**But the opposite over-claim then replaced it and is also corrected.** 0195's fix
first asserted `crossProject` replaces _every_ `crossLayer` use with attribution as
the only loss. Review measured three exceptions, and the migration page now states
them: a `.mapping(fn)` that is not key equality has no key encoding at all;
`satisfyPairCondition` builds its own violation (including `measured`/`metricUnit`
for the baseline ratchet) and has no equivalent; and a 3+ layer chain becomes N−1
rules.

**What this means for the migration guide:** `crossLayer` is superseded for most
rules and retained for the rest, and the page must say which — it does. Baselines
also do not survive the rename (identity is `rule::element::message` and all three
change), which is a second answer to this record's question 2.

## Fix

`docs/migrating-from-ts-archunit.md`, reachable from three entry points, answering
all four questions from measurement.

**The page leads with question 1, not question 2.** The record said question 2
(baselines) should be settled first "because it is the only one whose wrong answer
is silent". Measuring changed that: baselines transfer unchanged, and the silent
one turned out to be the **preset default**. On a clean codebase
`export default [...recommended(p)]` spreads an empty violations array, so the file
exports `[]` and every rule disappears — which is why that is §1 and carries the
table of both outcomes.

**Question 5 — exclusion comments — was added on review and is the widest surface**,
because those comments live across the whole codebase rather than in a rules file.
The page gives the `grep` for finding them.

**What was measured for questions 3 and 4**, which were still open when this record
was last edited:

|                                | ts-archunit `0.61.0`         | eess-ts                          |
| ------------------------------ | ---------------------------- | -------------------------------- |
| bin                            | `ts-archunit`                | `eess-ts`                        |
| config                         | `ts-archunit.config.{ts,js}` | `eess-ts.config.{ts,js}`         |
| baseline file                  | `arch-baseline.json`         | `arch-baseline.json` — unchanged |
| preset names                   | 5                            | same 5, none absent              |
| `recommended` `overrides` keys | 4                            | same 4, none added or removed    |

## Verification

- [x] `docs/migrating-from-ts-archunit.md` ships and is reachable from the sidebar
      (beside Getting Started), `docs/getting-started.md`, and
      `packages/ts/README.md` — three doors, since a migrator does not know the page
      exists.
- [x] Every claim on the page is measured, not asserted. Questions 3 and 4 were
      still open and are answered in the table above; questions 1, 2 and 5 carry the
      measurements already in this record.
- [x] The page states the ONE thing that is silent — the preset default on a clean
      codebase — as §1, with both outcomes tabulated, rather than burying it.
- [x] `dropped-on-purpose` — "the export-surface diff is reproduced by a script".
      The page quotes no export counts at all, so there is no number to go stale:
      it states the qualitative fact (`correspondence` / `CorrespondenceBuilder` are
      the only two exports that moved), which is what a migrator needs and what the
      earlier hand-derived counts got wrong twice.
- [x] `npm run validate` exits 0.
- [x] `deferred→`[plan 0100](../../plans/0100-publish-the-fold-retire-ts-archunit.md)
      — **`npm deprecate @nielspeter/ts-archunit` must not run before `eess-ts`
      publishes.** Unchanged and still owed by
      [plan 0100](../../plans/0100-publish-the-fold-retire-ts-archunit.md): npm `latest`
      is `eess-ts@0.2.1` while this repo is well past it, and deprecating first sends
      switchers to a `latest` that predates every fix this page assumes. This box is
      **the plan's, not this record's** — noted here because this page is what the
      deprecation notice will point at.

**The deprecation must not name the docs site.** Measured on review:
`https://nielspeter.github.io/eess/` is **404** with `has_pages: false` and no Pages
workflow, while `https://nielspeter.github.io/ts-archunit/` is **200** — the old
project's docs work and the new project's do not
([bug 0180](../0180-the-documentation-site-the-shipped-readmes-link-to-is-404.md)).
The changeset and the package README carry the GitHub blob URL instead, because a
changelog entry and an npm deprecation notice are both permanent.

Deferred: the deprecation ordering constraint, to
[plan 0100](../../plans/0100-publish-the-fold-retire-ts-archunit.md).
