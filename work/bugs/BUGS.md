# Bugs — defect records

A **bug** is a concrete defect in the code or its specs — root cause + fix. It is
not a plan: a plan is work we chose to do, a bug is something that is already
wrong. A bug stands on its own; it needn't come from anywhere (`/bug`).

- **Origin.** Most bugs here are **self-found** — from a persona review, a gate,
  a spike, or a verification pass. Since 2026-08-12 some are **inbound**: filed
  by an agent in a consuming project against a published package. eess is
  private and has no support funnel, so an inbound record arrives as prose, not
  a case number.
- **Adopting an inbound bug.** It becomes ours only after we **verify every
  load-bearing claim against our own source or the registry** — an inbound
  report is evidence, not a finding. On intake it is renumbered into this
  sequence, its `Origin` records that it came from outside, and any material
  identifying the reporting project (its language, domain vocabulary, file
  names) is **re-sourced to our own corpus** — the reproduction has to stand on
  evidence a reader here can check. Where verification changes the record — a
  wrong premise, or a fix that cannot close in one PR — the change is stated in
  the record rather than made silently. A report we cannot verify is not filed
  as a bug.
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

**Updated:** 2026-08-13 · **Open:** 34 (33 Draft · 1 Parked) · **Fixed:** 15 · **Rejected:** 0

> The counts are **counted** in `work/bugs/` and `fixed/`, not projected forward.
>
> **Partially enforced now.** `work/bugs/**` joined `check:corpus`'s roots when
> [0086](./fixed/0086-links-to-directories-do-not-resolve.md) fixed
> directory-link resolution — every row's link above must now point at a real
> file, or `check:corpus` fails. What's still unenforced: nothing verifies
> **every file has a row** (the reverse direction — a filed bug with no board
> entry), and nothing verifies the **Open/Fixed/Rejected counts** above are
> right — both are still hand-counted, the same way every other board in
> `work/` is.

| ID                                                                        | Title                                                                                                                                                               | Severity | State               | Origin                                                                       | PR        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------- | ---------------------------------------------------------------------------- | --------- |
| [0074](./fixed/0074-init-esm-type-module.md)                              | `eess-ts check` crashes on its own scaffolded config in CJS projects                                                                                                | High     | ✅ Fixed → `fixed/` | self-found · plan 0072's recipes run against the published npm package       | #11       |
| [0083](./fixed/0083-langium-node26-invalid-url.md)                        | `langium generate` (mermaid build) throws `Invalid URL` on Node ≥26                                                                                                 | High     | ✅ Fixed → `fixed/` | self-found · the build, on Node 26                                           | #29 · #30 |
| [0084](./0084-preserve-relations-right-to-left.md)                        | `preserveRelations` checks nothing right→left; `both` is half a gate                                                                                                | High     | 🔴 Draft            | self-found · architect review of proposal 001                                | —         |
| [0085](./0085-table-row-violations-report-table-line.md)                  | table-row violations report the table's line and a row ordinal, not the row                                                                                         | Medium   | 🔴 Draft            | self-found · review of proposal 001                                          | —         |
| [0086](./fixed/0086-links-to-directories-do-not-resolve.md)               | a link to a directory that exists is reported broken — the blocker for gating `work/bugs/`                                                                          | Medium   | ✅ Fixed → `fixed/` | self-found · extending `check:corpus` to `work/bugs/**`                      | #54       |
| [0087](./0087-frontmatter-parsed-as-setext-heading.md)                    | YAML frontmatter parses as a setext heading — every such document reports a phantom section                                                                         | Medium   | 🔴 Draft            | self-found · checking proposal 001's frontmatter support                     | —         |
| [0092](./0092-integrity-gate-misses-three-packages.md)                    | `check:integrity`'s local-linking guard checks 3 of 6 packages — a registry copy of `eess-crossvalidate`/`-md`/`-gherkin` sails through                             | High     | 🔴 Draft            | self-found · devops review of plan 0091                                      | —         |
| [0093](./0093-stale-no-workspace-protocol-comment.md)                     | `check:integrity` claims npm has no `workspace:` protocol — it does (npm 9+); the false comment blessed a bare-pin drift                                            | Low      | 🔴 Draft            | self-found · plan 0091 review                                                | —         |
| [0094](./0094-md-ts-readme-snippet-noops-without-dir.md)                  | the md↔ts README snippet passes no `dir`, so it silently checks nothing for the common `adr/` layout                                                                | High     | 🔴 Draft            | self-found · customer review of plan 0091                                    | —         |
| [0095](./0095-examples-readme-unanchored-run-filename.md)                 | `examples/README.md`'s run step names `arch.test.ts` — a file that exists neither here nor in the adopter's project                                                 | Low      | 🔴 Draft            | self-found · product review of plan 0091                                     | —         |
| [0097](./0097-crossval-presets-bypass-caller-owns-reporting.md)           | two crossvalidate presets return `void` — no `report`/`format` control, and ADR-008's `gated` row can't see the gap                                                 | Medium   | 🔴 Draft            | self-found · devops review of plan 0096                                      | —         |
| [0098](./0098-scenario-stats-report-set-size-as-scan-count.md)            | the scenario stats APIs report the feature set's size as `scenarios` — a non-vacuity guard built on it is vacuous                                                   | Medium   | 🔴 Draft            | self-found · verifying the plan-0096 review's filings                        | —         |
| [0099](./0099-nul-bytes-make-md-gherkin-unsearchable.md)                  | two raw NUL bytes make `md-gherkin.ts` binary — invisible to `grep`/`rg`, unreviewable in `git diff`                                                                | Medium   | 🔴 Draft            | self-found · verifying the plan-0096 review's filings                        | —         |
| [0103](./0103-adr-009-cited-but-does-not-exist.md)                        | two shipped scripts cite `ADR-009` as settled doctrine; `adr/` stops at 008 — plan 0088 Phase 2 is what creates it                                                  | Low      | 🔴 Draft            | self-found · review of inbound proposal 002                                  | —         |
| [0104](./fixed/0104-it-title-capture-stops-at-any-quote.md)               | `it('…')` title capture stops at any quote, not the opening one — a backticked title truncates and resolves against the wrong test                                  | High     | ✅ Fixed → `fixed/` | inbound · adopter integration, verified 2026-08-12                           | #42       |
| [0105](./fixed/0105-md-ts-drops-modifier-forms.md)                        | `md-ts` drops every `it.skip`/`it.only` definition — its own regex permits modifiers, the guard one line above does not                                             | Medium   | ✅ Fixed → `fixed/` | inbound · adopter integration, verified 2026-08-12                           | #43       |
| [0106](./fixed/0106-no-gate-requires-a-changeset.md)                      | nothing required a changeset, so a feature could merge green and unreleasable — `check:release` now gates it (`gherkin-ts` ships with plan 0100's release)          | High     | ✅ Fixed → `fixed/` | inbound · adopter integration, verified 2026-08-12                           | #46       |
| [0107](./fixed/0107-number-allocation-scans-one-lane.md)                  | `/bug` and `/plan` allocate from their own lane, but the number sequence is shared — two collisions in one session                                                  | Medium   | ✅ Fixed → `fixed/` | self-found · two number collisions on 2026-08-12                             | #39       |
| [0108](./0108-work-readme-lanes-table-lists-one-lane.md)                  | `work/README.md`'s Lanes table lists one lane and calls the rest cargo-cult; four exist — the one-screen map is the least-gated doc                                 | Low      | 🔴 Draft            | self-found · reviewing inbound proposal 002                                  | —         |
| [0109](./fixed/0109-nonvacuity-fixtures-read-a-crash-as-a-pass.md)        | the non-vacuity harness read a crashed fixture as a detected violation — the meta-gate had the defect it exists to catch                                            | High     | ✅ Fixed → `fixed/` | self-found · auditing the fixtures after 0107's red test caught it in itself | #40       |
| [0110](./fixed/0110-nonvacuity-gates-do-not-assert-which-rule-fired.md)   | five non-vacuity gates prove a fixture ran but not which rule fired — `ruleNote` is printed, never asserted                                                         | Medium   | ✅ Fixed → `fixed/` | self-found · four-persona review of 0109's fix                               | #41       |
| [0111](./0111-md-adr-citations-resolve-by-prefix.md)                      | `eess-md` resolves a cited `it()` title by **prefix** — `it('r')` matches any test starting with `r`; 0104's defect, stronger                                       | High     | 🔴 Draft            | self-found · architect + enforcement review of 0104's fix                    | —         |
| [0112](./0112-three-crossval-presets-have-no-fixture.md)                  | three of `check:crossval`'s five presets have no non-vacuity fixture — emptying any of them leaves the gate green                                                   | Medium   | 🔴 Draft            | self-found · enforcement review of 0104's fix                                | —         |
| [0113](./0113-correspondence-drops-rule-suggestion.md)                    | the ambiguous correspondence branch names no colliding element and offers no remedy (headline half fixed by 0122)                                                   | Medium   | 🅿️ Parked           | self-found · enforcement review of 0104's fix                                | —         |
| [0114](./0114-string-literal-lexis-lives-outside-the-engine.md)           | `ArchCall` has no accessor for a literal argument, so the bridge re-lexes TypeScript strings — ADR-007 Rule 2                                                       | Medium   | 🔴 Draft            | self-found · architect review of 0104's fix                                  | —         |
| [0115](./0115-two-test-definition-readers.md)                             | `md-ts` and `gherkin-ts` carry the same four-step test-definition reader — the shape that produced both 0104 and 0105                                               | Low      | 🔴 Draft            | self-found · architect review of 0105's fix                                  | —         |
| [0116](./0116-gated-row-resolves-against-a-skipped-test.md)               | an enforcement row marked `gated` resolves against `it.skip(…)` — a clause claiming CI blocks it, proven by a test that never runs                                  | Medium   | 🔴 Draft            | self-found · architect review of 0105's fix                                  | —         |
| [0117](./0117-conditional-modifier-tests-are-invisible.md)                | `it.skipIf(cond)('…')` / `it.runIf` are invisible to `adrCitationsResolve` — 0105's symptom, one shape narrower                                                     | Medium   | 🔴 Draft            | self-found · testing review of 0105's fix                                    | —         |
| [0118](./fixed/0118-ledger-gate-skips-the-bug-lane.md)                    | `check:ledger` reads `work/plans/**` only — a bug can claim `Fixed` with open boxes, and 8 of 9 deferrals go through that lane                                      | Medium   | ✅ Fixed → `fixed/` | self-found · asked where deferrals go, during the 0105 review round          | #45       |
| [0119](./fixed/0119-placement-check-never-ran.md)                         | the state↔folder placement check never examined a real document — it looked for `State:` one heading above where all 55 records write it                            | High     | ✅ Fixed → `fixed/` | self-found · fixing 0118, when the drift it predicted did not appear         | #45       |
| [0120](./0120-no-state-and-cannot-find-it-are-the-same-answer.md)         | "no state" and "could not find its state" are the same answer — the region heuristic can go blind again one heading over                                            | Medium   | 🔴 Draft            | self-found · enforcement + testing reviews of 0119's fix                     | —         |
| [0121](./fixed/0121-ledger-reads-two-of-four-lanes.md)                    | `check:ledger` reads two of four `work/` lanes — proposals carry `State:` and nothing opens them                                                                    | Low      | ✅ Fixed → `fixed/` | self-found · enforcement review of 0119's fix                                | #53       |
| [0122](./fixed/0122-violations-path-drops-because.md)                     | the `.violations()` path drops `.because`, so every caller-owns-reporting gate ships violations with no rationale                                                   | Medium   | ✅ Fixed → `fixed/` | self-found · architect + testing reviews of 0106's fix                       | #47       |
| [0123](./0123-crossvalidate-readme-documents-four-of-seven-subpaths.md)   | `eess-crossvalidate` publishes seven subpaths and documents four — `./files` ships undiscoverable                                                                   | Medium   | 🔴 Draft            | self-found · customer review of 0106's fix                                   | —         |
| [0124](./0124-correspondence-stamps-one-remedy-onto-opposite-branches.md) | a rule-level `suggestion` is stamped onto all three correspondence branches — one remedy shown for opposite causes                                                  | Medium   | 🔴 Draft            | self-found · enforcement review of 0122's fix                                | —         |
| [0125](./0125-condition-context-metadata-is-now-redundant.md)             | five builders thread rule metadata that `applyFilters` now stamps anyway — dead weight that can only drift                                                          | Low      | 🔴 Draft            | self-found · architect review of 0122's fix                                  | —         |
| [0126](./0126-validate-cannot-say-it-stopped-short.md)                    | a truncated `validate` run looks like a green one — the chain reports the steps it ran and nothing about the ones it did not                                        | Medium   | 🔴 Draft            | self-found · hid the test suite for a full session                           | —         |
| [0127](./0127-nonvacuity-proves-a-condition-not-a-wired-rule.md)          | no `gateNode` fixture proves the production gate still invokes its rule — two rebuild it, five exercise the preset; 36 of 45 dogfood rules have none                | High     | 🔴 Draft            | self-found · instrumented both kernel seams while scoping 0088               | —         |
| [0128](./0128-enforcement-status-is-the-cell-nothing-derives.md)          | `Status` is the only Enforcement cell nothing validates — 20 rows claim `gated`, 3 checked at case granularity, 17 only at file existence                           | Medium   | 🔴 Draft            | self-found · same measurement as 0127                                        | —         |
| [0129](./fixed/0129-four-validate-gates-run-in-no-workflow.md)            | four gates in `validate` ran in no workflow — a ledger violation, a duplicate number or a preset violation merged green                                             | High     | ✅ Fixed → `fixed/` | self-found · devops review of 0127 + 0128                                    | #49       |
| [0130](./0130-cli-summary-counts-the-invocation.md)                       | the shipped `eess-ts check` summary counts the command line, not the work — under a comment claiming it proves non-vacuity                                          | Medium   | 🔴 Draft            | self-found · customer review of 0127 + 0128                                  | —         |
| [0131](./0131-honesty-at-close-bypasses-the-builder-dsl.md)               | `honestyAtClose` builds no rule — a shipped preset hand-iterating the corpus, which 0088's fail-closed floor can never reach                                        | Medium   | 🔴 Draft            | self-found · architect review of 0127 + 0128                                 | —         |
| [0132](./0132-the-chain-and-the-workflow-need-a-derivation.md)            | nothing binds the `validate` chain to the workflow that runs it — the derivation 0129 twice failed to build, with what review established about how                 | Medium   | 🔴 Draft            | self-found · re-homed from 0129 after two failed attempts                    | —         |
| [0133](./0133-nothing-requires-a-check-to-join-the-chain.md)              | a `check:*` need never join the `validate` chain — three authored lists of the same gates, two joins asserted                                                       | Medium   | 🔴 Draft            | self-found · architect + product review of 0129's fix                        | —         |
| [0134](./0134-explain-empty-green-wipes-the-agents-block.md)              | `explain --format agent` renders "no rules" as a valid sentinel block and exits 0 — the documented `-s` guard cannot see it, and the AGENTS.md block is overwritten | Medium   | 🔴 Draft            | self-found · enforcement review of proposal 004                              | —         |
| [0135](./0135-graphql-resolver-binding-is-a-text-grep.md)                 | `haveMatchingResolver` greps concatenated file text — a shipped Tier-1 claim whose red is unreachable for a field named `id`, on a surface no gate runs             | Medium   | 🔴 Draft            | self-found · enforcement review of proposal 003                              | —         |
| [0136](./0136-link-fragments-are-never-checked.md)                        | `linkResolves` discards the fragment — a dead anchor is green, and the autofix transplants anchors onto other files without validating them                         | Medium   | 🔴 Draft            | self-found · probed the gate while adding an anchor to proposal 001          | —         |
| [0137](./fixed/0137-directory-link-violation-does-not-say-why.md)         | a broken directory link and a typo'd file link report the identical message — no hint that `docs/` and `work/**` deliberately resolve directories differently       | Low      | ✅ Fixed → `fixed/` | self-found · enforcement review of 0086's fix                                | #55       |
| [0138](./0138-pointer-resolve-proves-existence-not-truth.md)              | `corpus/pointers-resolve` proves a `path:line` citation exists, never that the line says what the prose claims — demonstrated 4 times in one review round on 0127   | Medium   | 🔴 Draft            | self-found · enforcement + testing review of 0127's citation refresh         | —         |
