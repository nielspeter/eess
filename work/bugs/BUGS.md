# Bugs — defect records

A **bug** is a concrete defect in the code or its specs — root cause + fix. It is
not a plan: a plan is work we chose to do, a bug is something that is already
wrong. A bug stands on its own; it needn't come from anywhere (`/bug`).

- **Origin.** Every bug here is self-found — from a persona review, a gate, a
  spike, or a verification pass. eess is private and pre-adopter, so there is no
  support funnel yet; when there is, `/case` records what was reported and the
  bug it spawns internalises the reproduction.
- **Fixed** bugs move to `fixed/` in the same PR as the fix (`/close`).
- **Rejected** bugs move to `rejected/` — and are **never deleted**. A record
  whose premise did not hold is kept with the reasoning that killed it, so the
  same question is not re-litigated from scratch six weeks later. (No
  `rejected/` directory exists yet; the first rejection creates it.)

### When is a bug fixed?

**When the fix is verified locally and merged.** The PR is the moment the bug is
fixed — the fix, its red-test-turned-green, and the record's move to `fixed/` all
land in that one merge. We do **not** hold a record open afterwards pending a
release, a deploy, or a production verification. If the fix later turns out to be
broken in use, that is a **new** bug with its own number, not this one reopening.

The same rule governs plans: a plan closes with its PR, never half-built. If a
work item cannot close in one PR, the item is wrong and gets **split** into ones
that can.

**Why it is stated out loud:** the alternative sounds more rigorous and is
strictly worse. A record held open for a post-merge verification is a record
nobody closes — the verification is never performed, so the item sits in limbo
indefinitely, not because anyone decided to keep it open but because no one
remembers it. Closing at merge puts every record in a terminal state on a known
day, and turns a later regression into a separately-prioritised new record
instead of an old one quietly reopening.

**So there is no waiting rung.** Nothing sits between `Ready` and `Fixed` — no
"deployed?", no "verified in prod", no "fixed but not closed". If something
genuinely must be observed after merge, that observation is its own record.

**State** — the same vocabulary as plans, so a row means what the record header
says:

| State      | Meaning                                                                           |
| ---------- | --------------------------------------------------------------------------------- |
| `Draft`    | filed; the claim is confirmed against the source; no red test written yet         |
| `Ready`    | the reproduction is mechanized — a red test exists and fails for the right reason |
| `Fixed`    | fix merged, record in `fixed/`                                                    |
| `Rejected` | premise didn't hold, or the behaviour is intended; record in `rejected/`          |
| `Parked`   | real, deliberately not acted on; carries the reason and what would reopen it      |

**Severity** — scaled to what this product claims, not to generic impact. eess's
whole promise is that a green gate means something, so the cardinal sin is a
check that passes while the drift it exists to catch is present:

| Severity   | Meaning                                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **High**   | **false green** — a gate, rule, or documented snippet passes over drift it should catch; or the build / an adopter's first run is broken |
| **Medium** | **false red**, a missing capability, or an honesty gap between a stated claim and its actual mechanism                                   |
| **Low**    | comment or documentation drift with no runtime effect                                                                                    |

## Bug template

```markdown
# Bug NNNN: <title>

## Status

- **State:** Draft | Ready | Fixed | Rejected | Parked — <what has been established>
- **Severity:** High | Medium | Low
- **Origin:** self-found · <which review / gate / spike>
- **Reported:** YYYY-MM-DD · **Fixed:** YYYY-MM-DD (PR #NN)

## Symptom

## Reproduction

## Root cause

## Why it matters <!-- only when the cost isn't obvious from the symptom -->

## Fix

## Verification

- [ ] Red test written first: <the test, and why it is red today>
- [ ] `npm run validate` green.

Deferred: none | <each deferral re-homed to a named owner>
```

> **Why `Severity` and `Origin` are on the board:** neither field exists in the
> records filed before 2026-08-12 — the template adds them going forward, and the
> table carries them for the older ones. Severity is a judgement made at the
> 2026-08-12 board rewrite, not something the records assert about themselves.

## Board — every bug, whatever its state

**Updated:** 2026-08-12 · **Open:** 11 · **Fixed:** 2 · **Rejected:** 0

> The counts are **counted** in `work/bugs/` and `fixed/`, not projected forward.
>
> **Nothing enforces this table.** `work/bugs/**` sits outside `check:corpus`'s
> roots (`scripts/check-corpus.mjs:22-24`), blocked on
> [0086](./0086-links-to-directories-do-not-resolve.md) and the `fixed/`
> frozen-folder omission it names. So no gate verifies that a row points at a
> real file, that every file has a row, or that these three numbers are right —
> the one corpus in this repo that isn't dogfooded. Fixing 0086 unblocks it.

| ID                                                              | Title                                                                                                                                   | Severity | State               | Origin                                                                 | PR        |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------- | ---------------------------------------------------------------------- | --------- |
| [0074](./fixed/0074-init-esm-type-module.md)                    | `eess-ts check` crashes on its own scaffolded config in CJS projects                                                                    | High     | ✅ Fixed → `fixed/` | self-found · plan 0072's recipes run against the published npm package | #11       |
| [0083](./fixed/0083-langium-node26-invalid-url.md)              | `langium generate` (mermaid build) throws `Invalid URL` on Node ≥26                                                                     | High     | ✅ Fixed → `fixed/` | self-found · the build, on Node 26                                     | #29 · #30 |
| [0084](./0084-preserve-relations-right-to-left.md)              | `preserveRelations` checks nothing right→left; `both` is half a gate                                                                    | High     | 🔴 Draft            | self-found · architect review of proposal 001                          | —         |
| [0085](./0085-table-row-violations-report-table-line.md)        | table-row violations report the table's line and a row ordinal, not the row                                                             | Medium   | 🔴 Draft            | self-found · review of proposal 001                                    | —         |
| [0086](./0086-links-to-directories-do-not-resolve.md)           | a link to a directory that exists is reported broken — the blocker for gating `work/bugs/`                                              | Medium   | 🔴 Draft            | self-found · extending `check:corpus` to `work/bugs/**`                | —         |
| [0087](./0087-frontmatter-parsed-as-setext-heading.md)          | YAML frontmatter parses as a setext heading — every such document reports a phantom section                                             | Medium   | 🔴 Draft            | self-found · checking proposal 001's frontmatter support               | —         |
| [0092](./0092-integrity-gate-misses-three-packages.md)          | `check:integrity`'s local-linking guard checks 3 of 6 packages — a registry copy of `eess-crossvalidate`/`-md`/`-gherkin` sails through | High     | 🔴 Draft            | self-found · devops review of plan 0091                                | —         |
| [0093](./0093-stale-no-workspace-protocol-comment.md)           | `check:integrity` claims npm has no `workspace:` protocol — it does (npm 9+); the false comment blessed a bare-pin drift                | Low      | 🔴 Draft            | self-found · plan 0091 review                                          | —         |
| [0094](./0094-md-ts-readme-snippet-noops-without-dir.md)        | the md↔ts README snippet passes no `dir`, so it silently checks nothing for the common `adr/` layout                                    | High     | 🔴 Draft            | self-found · customer review of plan 0091                              | —         |
| [0095](./0095-examples-readme-unanchored-run-filename.md)       | `examples/README.md`'s run step names `arch.test.ts` — a file that exists neither here nor in the adopter's project                     | Low      | 🔴 Draft            | self-found · product review of plan 0091                               | —         |
| [0097](./0097-crossval-presets-bypass-caller-owns-reporting.md) | two crossvalidate presets return `void` — no `report`/`format` control, and ADR-008's `gated` row can't see the gap                     | Medium   | 🔴 Draft            | self-found · devops review of plan 0096                                | —         |
| [0098](./0098-scenario-stats-report-set-size-as-scan-count.md)  | the scenario stats APIs report the feature set's size as `scenarios` — a non-vacuity guard built on it is vacuous                       | Medium   | 🔴 Draft            | self-found · verifying the plan-0096 review's filings                  | —         |
| [0099](./0099-nul-bytes-make-md-gherkin-unsearchable.md)        | two raw NUL bytes make `md-gherkin.ts` binary — invisible to `grep`/`rg`, unreviewable in `git diff`                                    | Medium   | 🔴 Draft            | self-found · verifying the plan-0096 review's filings                  | —         |
