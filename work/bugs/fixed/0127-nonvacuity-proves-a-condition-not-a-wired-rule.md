# Bug 0127: two non-vacuity fixtures rebuild the rule they guard and five exercise the shipped preset, so neither proves the production gate still invokes it — 36 of 45 dogfood rules have no fixture of any kind

## Status

- **State:** Fixed — `corpus/links` converted from a rebuilt-rule fixture to
  two production-script-driven gates, one per bug 0086's routing region;
  `corpus/pointers` converted the same way. A six-persona branch review found
  the first version still passed only `check-corpus.mjs --format json`, never
  the no-flags terminal invocation `check:corpus` actually runs in CI — three
  reviewers independently reproduced a live false green from it (deleting
  `check-corpus.mjs`'s terminal `process.exit(1)` alone left all three new
  rows green while a real broken link passed the build). Each gate now asserts
  **both** exit codes. Verified against a seven-mutation sabotage matrix
  (whole-array neutering, each spread deleted independently, pointer
  collection neutered, the terminal exit statement deleted, the rule id
  renamed) — every mutation reddens exactly the row(s) it should and nothing
  else, `scripts/check-corpus.mjs` confirmed reverted byte-identical after
  each. `check:nonvacuity`'s summary corrected to "fixtures fired," not "gates
  proven," and tightened once more after review to "no fixture is silently
  green" (the original wording still read as a claim about the whole gate,
  which is not what's measured). Moved to `fixed/` in this same PR (#57), so
  the merge and the close are one atomic act.
- **Severity:** High — on the reproduction, not on the ratio. `check:arch` passes
  green over six rules that assert nothing, which is `BUGS.md`'s High row (a gate
  passes over drift it should catch). Note what is _not_ claimed: only one of the
  45 rules examines zero units today, and that one is a legitimate empty (see
  Symptom). [0112](../0112-three-crossval-presets-have-no-fixture.md) is a strict
  subset of this record's population at Medium; if that severity is right, the
  boundary is that 0112 counts absent fixtures and this counts fixtures that
  cannot see the production gate.
- **Origin:** self-found · instrumented both kernel seams while scoping the
  ts-archunit doctrine port ([0088](../../plans/0088-fold-ts-archunit-into-eess.md),
  and [0103](../0103-adr-009-cited-but-does-not-exist.md), which cites the doctrine)
- **Reported:** 2026-08-12 · **Fixed:** 2026-08-14 (PR #57)

### Correction, 2026-08-12 — what the six-persona review found wrong in this record

Kept because a record about uncounted coverage that hides its own miscount is
worth nothing.

| first draft claimed                             | measured                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| 38 rules across six gates                       | **44** across eight — `check:baseline` (4) and `check:release` (2) were dropped |
| 3 covered by a fixture                          | **9**                                                                           |
| "All 25 rules in `check:arch`" uncovered        | two are covered                                                                 |
| the harness "cannot cover production rules"     | three gates do exactly that                                                     |
| the reproduction empties 25 rules               | **6**                                                                           |
| the summary line is "byte-identical"            | identical but for elapsed time                                                  |
| fix 3 (drive the production rule file) is novel | already shipped for three gates                                                 |

The cause of the miscount is this record's own subject: coverage was enumerated
from one syntactic form (`gateNode(script, mustSay)` rows) and reported as
complete, so the three gates that assert via `firedOn(...)` were invisible. Two
reviewers found it independently; a third disproved the reproduction's
interpretation by experiment.

### Correction, 2026-08-13 — citations and counts refreshed, unrelated PRs moved them

This record was accurate when filed and is a different kind of correction than
the block above: not a flawed measurement, just drift — several unrelated things
landed since 2026-08-12 (bugs 0086, 0121, 0137, and the v0.2.3 release) and
happened to touch files or consume state this record cites. Re-verified live
before anyone picks this up; the defect itself is unchanged.

**A second pass, 2026-08-13, by an independent enforcement reviewer, found this
first refresh pass itself had drifted in three places** — the exact failure mode
this bug is about, one level up: a passing `check:corpus` (which verifies a
`path:line` citation _resolves_) says nothing about whether the citing prose is
still true. Folded in below and at point of use rather than a second correction
table: the `release/changed-package-needs-changeset` example's "5 declarations"
(Symptom — stale by 2026-08-13, the v0.2.3 release consumed them), the
`ledger.ts:297→320` "why" cell (this table, above — wrongly attributed to
`findUncoveredLanes`, which lives in `scripts/lib/lane-coverage.mjs`, not
`ledger.ts`), and the "8/44 → 9/45 inline rules" claim (Fix section — not
reproducible by any stated counting rule; softened to what a direct `grep` can
actually show).

**A third pass, same day, by an independent testing reviewer, found the second
pass's own fix to the `ledger.ts` cell was itself wrong** — the relocated line
(`:320`) resolves to a real line, but the wrong one: it lands on `finishPreset`
itself, not the `for (const doc of corpus.documents())` loop the citing prose
actually means by "iterates directly". Correct target is `:309`. Three revisions
to get one citation right, each wrong version passing `check:corpus` cleanly the
whole time — because that gate proves a `path:line` _resolves_, never that the
line says what the prose claims. This record's own thesis, demonstrated three
times over inside the record describing it, is the strongest evidence in this
correction section that the thesis is correct.

| citation / figure                       | as filed (2026-08-12)                                                                                                                                                                                                                                                                    | now (2026-08-13)                                                                                            | why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/check-corpus.mjs:54`           | `const broken = linkRule.violations()`                                                                                                                                                                                                                                                   | line 115; `broken` now unions two rule instances (`linkRule`/`repoLinkRule` — site vs. repo-native routing) | bug 0086 (PR #54) rewrote directory-link resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `check:corpus` row (Symptom table)      | 5 rules, 1 covered                                                                                                                                                                                                                                                                       | **6** rules, 1 covered                                                                                      | the link check is now two `RuleBuilder` constructs sharing one id, not one                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| rule totals                             | 44 total, 35 uncovered                                                                                                                                                                                                                                                                   | **45** total, **36** uncovered                                                                              | follows from the corpus row above; `9` covered is unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| gate count (`check:nonvacuity` summary) | 20 gates                                                                                                                                                                                                                                                                                 | **22** gates                                                                                                | bug 0086 added `corpus/link-routing`; bug 0121 added `corpus/ledger/uncovered-lane` — reprinted live via `npm run check:nonvacuity`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `packages/md/src/rules/ledger.ts:297`   | `for (const doc of corpus.documents())` — the direct-iteration loop the citing prose means by "iterates directly" (mislabelled "`finishPreset` call" in this correction's first two revisions — `finishPreset` was at `:308`, a different line, evidencing the weaker half of the claim) | same loop, now **line 309**                                                                                 | PR #45 (bugs 0118/0119) is what _produced_ line 297 in the first place (182 insertions/32 deletions, landed 2026-08-12 19:02, hours before this record was filed) — it is not a shift applied to a pre-existing 297. The 297→309 shift is one clean insertion: PR #53's `stateMatcher([])` guard (bug 0121), +12 lines, nothing else. `:320` is where `finishPreset` itself lands, which resolves fine but evidences the wrong clause. Four revisions to get this one cell right, caught by three independent review passes in succession — the record's own thesis, reproduced inside the record describing it |

Re-verified live, 2026-08-13: emptying the (relocated) `broken` array in
`check-corpus.mjs` still leaves `check:corpus` green (measured 2026-08-13, before
this commit added bug 0138 to the corpus: `✓ corpus integrity — 599 checks across
96 documents, 0 violations`) while `bad-links.mjs` run directly still exits 1 on
its own rebuilt rule — the exact defect this bug describes, reproduced against
the current shape, then reverted (`git checkout --
scripts/check-corpus.mjs`, confirmed byte-identical). The Fix section's plan
(convert `bad-links.mjs`/`bad-pointers.mjs` to the `gateArch` pattern) is
unaffected — neither fixture has changed since filing.

## Symptom

Instrumenting the two examining seams the dogfood gates use — `RuleBuilder`'s
post-predicate set and `CorrespondenceBuilder`'s sides — across the eight
rule-running gates in the `validate` chain:

| gate             | rules  | covered by a fixture |
| ---------------- | ------ | -------------------- |
| `check:arch`     | 25     | 2                    |
| `check:spec`     | 4      | 0                    |
| `check:diagram`  | 1      | 1                    |
| `check:corpus`   | 6      | 1                    |
| `check:ledger`   | 0      | —                    |
| `check:crossval` | 3      | 2                    |
| `check:baseline` | 4      | 1                    |
| `check:release`  | 2      | 2                    |
| **total**        | **45** | **9**                |

(`check:corpus` was 5/44 total at filing; bug 0086 split the link check into
two `RuleBuilder` instances since — see the 2026-08-13 correction above.)

**36 rules have no fixture of any kind.** Every rule in `check:spec` — the gate
binding the README and the ADR index — is among them.

**At least one rule examines zero units, and it is legitimate** — pinned to
2026-08-12 (filing day) rather than restated live, since it depends on
`.changeset/` contents that shift with every release: `release/changed-package-needs-changeset`
saw 5 changeset declarations against 0 changed packages on a clean tree, which is
the rule being satisfied, not failing. Recorded because it is the concrete case a
fail-closed floor must not red — see Fix. (Caveat on the metric: a correspondence's
"examined" was taken as `min(left, right)`, a judgement, not a derivation.)

\_Measured 2026-08-13, after v0.2.2 and v0.2.3 both shipped and consumed every
pending declaration: `.changeset/` now holds 0. That makes it **two** rules
examining zero elements on a clean tree, not one —
`release/changeset-names-real-package` takes the same declaration set as its left
side (`declarationSelection`, `scripts/release-gate.mjs:154-158`, consumed at
`:192-193`), so it drops from `min(5, 6)` to `min(0, 6)`. Both are the rule being
satisfied. This doesn't weaken the point the Fix section makes — a naive
fail-closed floor now has two legitimate zero-examination cases to tolerate
instead of one, which is a stronger reason to get the declared-empty grammar
right, not a weaker one.

_Correction, 2026-08-13, same review round: the first version of this paragraph
cited `:159-190` — a range that contains neither `declarationSelection` nor
`namesRealPackage`, only the sibling rule (`changedSelection`,
`workspaceSelection`, `needsChangeset`). It resolved, so `check:corpus` stayed
green over it — a fifth instance of exactly what [0138](../0138-pointer-resolve-proves-existence-not-truth.md)
files, caught independently by five of six reviewers (architect, product,
devops, testing, enforcement) auditing this same commit. The underlying claim
was already correct; only the pointer was wrong._

The three fixtures that do reach a production rule are the strongest in the
harness and were missed by the first draft. `gateArch`
(`scripts/check-nonvacuity.mjs:168`) plants a probe file in real source and runs
**`eess-ts check arch.rules.ts`** — the production rule file — asserting one
violation carrying both the production rule id and the probe. `gateInternalArch`
and `gateBaseline` do the same for `arch.internal.rules.ts` and the shipped
`recommended` preset.

The rest fall into two weaker tiers:

- **Rebuild the rule** — `bad-links.mjs`, `bad-pointers.mjs`. They construct
  their own rule with their own id (`nonvacuity/broken-links`), so they prove a
  **condition** fires over a broken corpus and nothing more.
- **Exercise the shipped preset over a fixture corpus** — `bad-adr.mjs`,
  `bad-ledger.mjs`, `bad-crossval.mjs`, `bad-md-ts.mjs`, `bad-gherkin-ts.mjs`.
  Stronger: the published code really fires. Still silent on whether the
  production gate script invokes it.

**Taxonomy note, added 2026-08-13.** The two gates that joined since filing don't
sort cleanly into either tier above. `bad-corpus-link-routing.mjs` asserts the
actual functions `scripts/check-corpus.mjs` imports from
`scripts/lib/corpus-link-routing.mjs` — not a rebuilt copy. `bad-lane-coverage.mjs`
imports `findUncoveredLanes` from `scripts/lib/lane-coverage.mjs`, the identical
module `scripts/check-ledger.mjs:20` imports — so it drives the real production
function directly, stronger evidence than "exercise the shipped preset" and closer
to the `gateArch` tier, without going through the production gate _script_ itself.
Neither is folded into the Symptom table above (both test plain functions outside
any `RuleBuilder`, the table's unit of measurement) — noted here as a live
counter-example to "only three fixtures reach a production rule," so a future
editor doesn't read the table as the complete taxonomy.

## Reproduction

Two rots, and the contrast between them is the finding.

**A — an uncovered rule.** `arch.rules.ts:24` defines `only()`, used by 6 of that
file's 7 rules:

```bash
# anchored on text, not a line number, and self-verifying.
# -F (fixed string) is load-bearing: the BRE form of this pattern silently
# fails to match and reports a false ANCHOR MOVED — measured while writing this.
grep -qF 'packages/${pkg}/src/**' arch.rules.ts || echo "ANCHOR MOVED — repro invalid"
perl -pi -e 's{packages/\$\{pkg\}/src/\*\*}{packages/\$\{pkg\}/NO_SUCH/**}' arch.rules.ts
git diff --quiet arch.rules.ts && echo "PATCH DID NOT APPLY — do not trust the result"

npm run check:arch        # exit 0 — "✓ eess-ts — 25 rules across 2 files · 0 failing"
npm run check:nonvacuity  # exit 0 — "22 gates each failed on their violating input"

git checkout -- arch.rules.ts
```

Six rules now assert nothing. `check:arch` is green and its summary is identical
but for elapsed time — the denominator counts rule objects and rule files, never
examined elements.

**B — a covered rule.** Rot `eess/adr002-no-raw-typescript`'s own selector
(`arch.rules.ts:42`) instead:

```
npm run check:arch        # exit 0 — same green, same summary
npm run check:nonvacuity  # exit 1
  nonvacuity: arch (root rules) — FAILED (did not fail on violating input)
```

**The harness is partial, not blind.** A rot that lands on a covered rule is
caught within one edit; A stays green only because the rules it empties are among
the 36. The first draft ran A, read the green as blindness, and built its prose on
that — a reproduction constructed so it could not have failed.

_(The first draft used `sed -i ''`, which is BSD-only. Under GNU sed the `''` is
consumed as the script, the file is unchanged, and the reader gets the claimed
green **for the wrong reason** — the failure this repo exists to catch, inside its
own reproduction. Hence the anchored, self-verifying form above.)_

## Root cause

Scoped to where it is true. The `gateNode` fixtures — both tiers — build their own
invocation, so nothing binds them to the production gate script. Measured, by an
enforcement reviewer: neutering the production link rule (then at
`scripts/check-corpus.mjs:54`; bug 0086 restructured this into two rule instances
— `broken` now lives at line 115, see the 2026-08-13 correction above) left
the `corpus/links` row stayed OK while `bad-links.mjs` still exited 1 on its own
rebuilt copy. Re-verified live 2026-08-13 against the current shape, before this
commit added bug 0138 to the corpus: emptying `broken` still greens `check:corpus`
(`✓ corpus integrity — 599 checks across 96 documents, 0 violations`) while
`bad-links.mjs` is untouched. Stronger than stated: the denominator itself doesn't
move under the sabotage either — `linksChecked` (`scripts/check-corpus.mjs:114`)
comes from `linkRule.select()`, independent of `.violations()`, so the number the
summary line prints is insensitive to the very rule being neutered. Fixture
and subject are written from the same understanding
and agree even when the understanding is wrong — the shape
[0110](./0110-nonvacuity-gates-do-not-assert-which-rule-fired.md) closed one
layer down, when it made a fixture name the rule that fired. The rule it names is
still the fixture's own.

Underneath, the kernel fails open by construction at
`packages/core/src/rule-builder.ts:330` — an empty selection and a clean corpus
return the same value. `RuleBuilder` at least _knows_ `filtered.length` and could
report it; the `TerminalBuilder` seam at
`packages/core/src/terminal-builder.ts:159` returns `ArchViolation[]` with nowhere
to put evidence at all.

**The symptom ships.** `packages/ts/src/cli/commands/check.ts:65-66` computes the
summary from `builders.length` and `args.ruleFiles.length` — the invocation, never
work done — under a comment reading _"Report the denominator so a fast green is
provably non-vacuous, not silence."_ This is not a property of this repo's harness; every
adopter gets it, and `eess-ts init` scaffolds rule files against a guessed layout,
so an adopter whose sources sit outside the scaffolded glob gets a confident green
on their first run.

**Residual risk, found 2026-08-14 by an enforcement reviewer of the fix.** Before
this fix, `check:nonvacuity`'s probes lived only under `packages/core/src` — a
concurrency hazard the harness's own header comment already names, but a narrow
one. Converting `corpus/links`/`corpus/pointers` moved two more probes into
`docs/` and `work/bugs/` — real, git-tracked `check:corpus` roots also read by
`check:fast` (this repo's own recommended on-save loop), `check:ledger`, and
`check:numbers`. `withProbe` still writes-then-deletes within one call and a
hard kill still can't leave a committed leftover (`**/__nonvacuity_probe*` is
now `.gitignore`d), but a `check:fast` run racing the write-to-delete window can
observe a transient probe mid-flight and report a spurious violation against a
file that's already gone by the time anyone looks. Not eliminated, only
narrowed — the probe surface now overlaps four gates it never touched before,
not zero.

## Why it matters

ts-archunit's ADR-008: _"A check that cannot fail is worth less than no check,
because it is counted as coverage."_ `check:nonvacuity` prints `22 gates each
failed on their violating input — none is silently green` (measured 2026-08-13;
two gates joined since filing — see the correction above), which reads as the
gates being proven. It proves 22 fixtures and 9 rules.

## Fix

**Scoped to what closes in one PR.** The first draft's fix ladder was a programme,
and its lead item could not go red on its own reproduction (below).

1. **Convert `bad-links.mjs` and `bad-pointers.mjs` to the `gateArch` pattern** —
   plant the broken link/pointer in the real corpus, run the **production**
   `scripts/check-corpus.mjs`, assert one violation carrying the production rule
   id and the planted file. This is generalising a working in-repo pattern, not
   new machinery, and it is falsifiable by the sabotage above: with it in place,
   neutering `check-corpus.mjs`'s `broken` array (line 115) must red the gate.

   **Refinement, found 2026-08-13 by a testing reviewer of this refresh.** Since
   bug 0086, `broken` is not one collection but two independently-filtered spreads
   routed by region — `scripts/lib/corpus-link-routing.mjs`'s
   `REPO_NATIVE_ROOTS = ['work/', 'adr/']` vs. everything else:

   ```js
   const broken = [
     ...linkRule.violations().filter((v) => !isRepoNativeLink(relTo(v.file))), // docs/, the site profile
     ...repoLinkRule.violations().filter((v) => isRepoNativeLink(relTo(v.file))), // work/, adr/
   ]
   ```

   A single planted probe exercises only one branch — deleting the _other_ spread
   line (a smaller, more realistic sabotage than emptying the whole array) would
   leave that gate green with only one probe in place. The conversion needs **two**
   probes, one per routing region, as two rows in the gate list — the same
   treatment `corpus/ledger/*` already gets at `scripts/check-nonvacuity.mjs:356-362`
   for its three sub-rules. Verification checkbox 1 below is scoped to the
   single-probe case only; it should be split in two when this fix is built.
   The conversion is easier than it was at filing, not harder: `check-corpus.mjs:141`
   now supports `--format json`, so asserting `firedOn(v, 'corpus/broken-links')`
   against the production script's own output is a direct fit for either probe.

   **Second refinement, found 2026-08-14 by three reviewers independently
   (architect, enforcement, testing) auditing the fix this Fix item describes.**
   `--format json` returns through its own early exit
   (`scripts/check-corpus.mjs:141-145`); the no-flags terminal invocation
   `"check:corpus": "node scripts/check-corpus.mjs"` actually runs computes
   failure separately and exits at a different line entirely. A gate built only
   against `--format json` — as the first version of this fix was — proves the
   violation-collection logic and the JSON branch's own exit, never the
   statement that makes the real CI invocation a gate. Measured: deleting that
   terminal `process.exit(1)` alone left all three converted rows green while
   `npm run check:corpus` printed a real violation and exited 0. Same shape as
   bug 0106's `release/gate-fails-the-build` (the pure core vs. the impure
   shell) — the repo had already named this failure class and the first
   version of this fix rediscovered it rather than avoiding it. The built fix
   runs `check-corpus.mjs` **both** ways per probe: `--format json` for
   `firedOn`'s rule+file identity, the no-flags form for the exit code CI
   actually depends on — replacing the old purely-informational `clean`
   direction, which three reviewers separately flagged as decorative anyway.

2. **Correct `check:nonvacuity`'s summary sentence** to state what it measured —
   fixtures that fired, not gates proven — so the harness stops over-claiming
   while the coverage gap is open.

Both land together; (1) without (2) leaves the misleading sentence, and (2)
without (1) is a docs change.

**Explicitly not in this record**, with reasons:

- **A rule-level coverage denominator.** The first draft closed on this. It
  cannot: a count of which rules a fixture _names_ does not move when a rule
  examines nothing, so it stays green on both reproductions above — this record's
  own reviewer question answered "pass". It also cannot be derived today — rule
  construction inside `.mjs` scripts is inline and exported nowhere for reuse
  (`grep -n '\.rule(' scripts/*.mjs` finds 5 today, across `check-corpus.mjs` and
  `release-gate.mjs`; how many of the remaining rules count as "inline" depends on
  where you draw that line, and the record's original 8/44 estimate at filing was
  already not independently reproducible by any stated rule) — so the total would
  arrive hand-typed. If it is built, it must be a **set** measured
  against a dated committed baseline, not a scalar that a rule leaving and another
  joining leaves unmoved. → [0088](../../plans/0088-fold-ts-archunit-into-eess.md)
  Phase 4a, which already specifies a shrink-only list with an expiry.
- **Evidence at the seam** (`{ violations, examined }`). The only fix that reddens
  reproduction A. Three costs the first draft understated: there are **eight**
  `collectViolations` implementations across the family, not one root, so
  ts-archunit's "~8 lines" is its cost and not ours; retyping the kernel's abstract
  member is a break across all six packages; and it needs a declared-empty grammar
  **first**, or `release/changed-package-needs-changeset` reds on every PR that
  touches no package, and stage 2 of `docs/eess-walkthrough-calculator.md:120` —
  which teaches writing rules before the code exists — goes red for every new
  adopter. → 0088 Phase 3/4.

**A measured constraint on the seam fix, which should not be rediscovered later:**
it reaches 45 of the family's checks and **not** `check:ledger`'s. `honestyAtClose`
constructs no builder — it imports `finishPreset` and iterates directly
(`packages/md/src/rules/ledger.ts:309`, the `for (const doc of corpus.documents())`
loop — at `:297` when PR #45 (bugs 0118/0119) produced it, hours before this
record was filed; PR #53's bug 0121 `stateMatcher([])` guard then inserted 12
lines above it, `:297`→`:309`; see the 2026-08-13 correction above, fourth
revision) — so it emitted zero evidence records. A floor is necessary and not
sufficient.

**Method scope, stated so it is not read as more than it is:** two of the family's
eight seams were instrumented, chosen because the dogfood gates use only those. The
six unmeasured seams (slice, cross-layer, tsconfig, smell, and the two graphql
builders) are outside this measurement, and the next dialect that ships a builder
is outside it by construction.

## Verification

- [x] Red test written first, then re-run against a wider matrix after review
      found the first version incomplete. Seven mutations to
      `scripts/check-corpus.mjs`, each applied alone and reverted (confirmed
      byte-identical) before the next: (S1) empty the whole `broken` array —
      both link rows red, `corpus/pointers` unaffected; (S2) delete only the
      site spread — `corpus/links/site` red alone; (S3) delete only the
      repo-native spread — `corpus/links/repo-native` red alone (S2/S3 prove
      the two-probe split discriminates by region, not just "a broken link
      exists somewhere"); (S4) empty the pointer-violation collection —
      `corpus/pointers` red alone; (S5) delete the terminal `process.exit(1)`
      (the mutation review found the first version of this fix missed
      entirely) — all three rows now correctly red; (S6) rename the
      `corpus/broken-links` rule id on one of the two rule constructions —
      only the matching row reds, proving rule-identity is asserted per row,
      not just liveness. Every mutation was green on `main` before this fix
      and is red on this branch after it.
- [x] The converted fixtures assert the production rule id **and** the planted
      file in one violation, per `firedOn`'s existing contract —
      `firedOn(json, 'corpus/broken-links', 'docs/__nonvacuity_probe_site__.md')`,
      `firedOn(json, 'corpus/broken-links', 'work/bugs/__nonvacuity_probe_repo__.md')`,
      `firedOn(json, 'corpus/pointers-resolve', 'docs/__nonvacuity_probe_pointer__.md')`
      — region-specific basenames, changed from a shared one after four
      reviewers independently flagged that an identical fragment let either
      row's assertion pass on either probe's violation (sound only because
      the two probes were never co-present, not because the assertion pinned
      it).
- [ ] deferred→this record's own Root cause section (the residual-risk
      paragraph added above) —
      the probe-surface checkbox as filed asked about **concurrency**, not
      just adjacency to `packages/*/src`, and review found the real answer is
      worse than the first version of this close claimed: the new probes sit
      in `docs/` and `work/bugs/`, roots also read by `check:fast` (the
      recommended on-save loop), `check:ledger`, and `check:numbers` — a
      collision surface that did not exist before this fix, not one this fix
      merely failed to shrink. Mitigated, not eliminated: `**/__nonvacuity_probe*`
      is now `.gitignore`d (closes the "a hard-killed run commits a leftover"
      half) and every probe writes then deletes within one `withProbe` call
      (milliseconds of exposure), but a `check:fast` racing that window can
      still observe a transient probe and report a spurious violation against
      a file gone by the time anyone looks. Moving the probe surface out of
      every tracked corpus root entirely is the real fix and is out of scope
      for a two-fixture conversion — this checkbox stays open, pointing at
      this paragraph as its home, rather than closing on a narrower answer
      than it asked.
- [x] `check:nonvacuity`'s summary states fixtures fired, not gates proven —
      prints "N fixtures each fired on their violating input — no fixture is
      silently green" (tightened once more after review: "none is silently
      green" without "fixture" still read as a claim about the whole gate).
      The header doc comment's opening claim, its per-gate `corpus/links`/
      `corpus/pointers` bullets, and its closing line were corrected the same
      way, and — after review found the correction itself over-claimed in the
      opposite direction (naming only the three new rows as
      production-script-driven when `gateArch`/`gateInternalArch`/`gateBaseline`
      already were) — reworded again to name all five honestly rather than
      implying the new rows are the only exception.
- [x] `npm run validate` green — 146 test files, 1934 tests, 0 failures; all 23
      nonvacuity fixtures OK; `check:corpus` and `check:ledger` both clean.

Deferred, each re-homed:

- **The coverage denominator** → [0088](../../plans/0088-fold-ts-archunit-into-eess.md)
  Phase 4a. Its four-verdict classification (`fail-open` · `config-finding` ·
  `other-throw` · `no-checks`) is a correction to that phase's stated three, and
  the `no-checks` cell is the preset-constructs-nothing hole 4a claims to expose.
- **Evidence at the seam, and the declared-empty grammar it requires** → 0088
  Phase 3/4.
- **The shipped CLI summary** → [0130](../0130-cli-summary-counts-the-invocation.md)
  — filed since this record was first drafted; it's the adopter-facing half of
  this defect, exactly as anticipated here.
