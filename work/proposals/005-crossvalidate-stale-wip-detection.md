# Proposal 005 — crossvalidate: detect a stale `@wip` tag

**State:** Draft — two review rounds 2026-08-14 (round 1: architect · product
· enforcement, plus survey; round 2, scoped: architect · enforcement, on the
round-1 rewrite). **`Rewrite v2`** below is the operative section — it
replaces `Rewrite v1` after round 2 found v1's kernel-placement argument was
factually wrong and its non-vacuity plan modeled the fixture on the exact
tier bug 0127 had just fixed away from, hours earlier in the same session.
`Rewrite v1` is preserved in _Appendix B_; the original submission in
_Appendix A_. One question is explicitly still open (see `Rewrite v2 → Open
questions`); the rest — including, now, "kernel primitive or dialect-local?"
— are resolved with stated reasoning, not decided silently. Two review
rounds on one proposal is not a sign this needs a third; it is what
independent verification of a rewrite is supposed to look like when the
rewrite itself turns out to be wrong somewhere.
**Priority:** Medium — extends the reach of an already-shipped primitive
(`scenariosCovered`'s `include` option); does not close a correctness gap in
what eess currently _claims_ to check, since `scenariosCovered` never claimed
to detect this.
**Origin:** inbound — a consuming project, while wiring
`@nielspeter/eess-crossvalidate@0.2.0`'s `scenariosCovered({ include })` to
exempt not-yet-built scenarios via `@wip` tags, per that option's own JSDoc
example (`"handy for @wip scenarios"`).
**Affects:** `@nielspeter/eess-crossvalidate` (`gherkin-ts` subpath) —
`staleScenarioExemptions` — and `scripts/check-crossval.mjs` (this repo's own
dogfood wiring, not a package). No kernel change. See `Rewrite v2 → Scope`.

## Problem

`scenariosCovered`'s `include` option is documented as the way to exempt
not-yet-implemented scenarios from the coverage requirement, tagged `@wip` by
convention. That mechanism has no counterpart in the reverse direction:
nothing detects a scenario that is **still** tagged `@wip` after a real
citing test already exists for it. The exemption, once granted, never expires
on its own — a consumer has to remember to remove the tag by hand, and
nothing in the gate notices if they forget.

This is the same failure shape the eess family exists to catch elsewhere (a
citation nobody is checking) one level removed: instead of a citation
drifting from the code it cites, an _exemption_ drifts from the thing it was
exempting.

## Review — 2026-08-14

**Ruling: Rewrite needed**

The gap is real and all three reviewers
independently validated it, but the same two defects surfaced from all three
angles, one of which means the proposal's own evidence disproves its own
claim. Nothing here argues the capability shouldn't be built. The Evidence
and Acceptance Criteria sections need rework before this is plan-ready, and a
genuine three-way design disagreement (placement, and `isExempt` vs.
`include`) needs the library author's decision, not a synthesis picking a
side.

Everything below this section is the submission as received. It is preserved,
not endorsed — where the review falsified a claim, the claim is annotated
here rather than edited away, so the record shows what was argued and what
survived.

### What the review accepted

The origin is the strongest kind this board sees: a consumer followed eess's
own JSDoc example (`"handy for @wip scenarios"`) and found the recommendation
incomplete. The spike in _Evidence_ is real measurement, not argument —
reproduced against the published `0.2.0`, reverted after, the negative result
stated plainly ("completely unchanged"). The _Priority_ line's honesty —
"does not close a correctness gap in what eess currently claims to check" —
is exactly the tier-discipline this project asks of itself, applied to the
proposal's own severity, and a weaker proposal would have claimed High. And
the framing at _Problem_ — an exemption drifting from the thing it was
exempting — is genuinely good product thinking: it is what led one reviewer
to a kernel-level primitive (`beDisjoint()`, the unbuilt dual of
`beComplete()`) that neither of the other two independently found.

### Corrections to specific claims in the text below

- **The reviewer's own survey, supplied to all three reviewers, was wrong.**
  I told each reviewer "this repo has no Gherkin features of its own." False:
  `packages/crossvalidate/specs/scenario-binding.feature` exists, is tagged
  `@dogfood`, and is already gated by `scenariosCovered` in
  `scripts/check-crossval.mjs:95` — caught by the enforcement reviewer,
  verified independently before writing this. The "no in-repo dogfood
  consumer" framing doesn't hold; a plan for this would extend a fixture that
  already runs on real, in-repo content.
- **_Evidence_ §3's spike used `it.skip(...)` as proof a scenario is built —
  the mechanism disagrees.** `scenariosCovered`/`scenarioTestsResolve`
  deliberately count a skipped test's citation ("the gate binds a citation,
  it does not run the test, so a skipped test's citation is still checked,"
  `packages/crossvalidate/src/gherkin-ts.ts:70-73`). So the spike's own
  reproduction is the case the proposed rule would misfire on hardest: a
  staged placeholder test — the canonical legitimate reason a scenario stays
  `@wip` — reads as "already proven, remove the tag." All three reviewers
  found this independently. It also means the drafted violation message
  (_Proposed API_, below: _"already proven by test Y"_) claims Tier 2
  (behavior proven) from a Tier 1 mechanism (a citation exists) — the
  mechanism's own docstring says so twice (`gherkin-ts.ts:112-113`,
  `:203-204`: _"does NOT claim the test exercises the scenario's steps"_).
  Re-run the spike with a non-skipped test, or decide explicitly that
  `it.skip` citations count and reword the message to "cites," not "proves."
- **Acceptance Criteria's "file/line of the tag" contradicts Scope's "no
  `eess-gherkin` changes needed."** `GherkinScenario.tags` is
  `readonly string[]` with no position (`packages/gherkin/src/model.ts:26`);
  the loader discards the tag's line entirely (`packages/gherkin/src/load.ts:71-79`).
  One of the two sentences has to give — most likely Acceptance Criteria,
  relaxed to the scenario's own line (what the existing `sv()` helper already
  emits, `gherkin-ts.ts:165-173`), which keeps Scope true as written.
- **The Proposed API's `ExtractOptions` does not exist.** Verified
  repo-wide: the only occurrence of that name in the codebase is this
  document. The real type is declared inline, independently, twice —
  `ScenarioTestsResolveOptions` (`gherkin-ts.ts:13`) and
  `ScenariosCoveredOptions` (`gherkin-ts.ts:18`).
- **Acceptance Criteria's non-vacuity clause cites the advisory precedent,
  not the enforced one.** `scenarioTestStats`/`adrCitationStats` are printed
  by `scripts/check-crossval.mjs` but never asserted non-zero there — the
  discipline this repo actually enforces is a committed fixture in
  `scripts/check-nonvacuity.mjs` with its own denominator guard (the shape of
  `scripts/nonvacuity/bad-gherkin-ts.mjs`). Worth noting: `scenariosCovered`
  — the function this proposal extends — is already named in
  [bug 0112](../bugs/0112-three-crossval-presets-have-no-fixture.md) as one
  of three un-fixtured `check:crossval` presets. A plan should sequence with
  or after 0112, and rewrite this criterion around a committed fixture rather
  than a stats function a caller must remember to both call and eyeball.
- **Evidence §3 carries the reporting project's own vocabulary** (a
  filename, a Danish scenario title) that should be re-sourced to this
  repo's own corpus per the house rule on inbound proposals — the measured
  counts (19 scenarios, 3 files, `0.2.0`) are the part worth keeping; the
  shape reproduces identically against `specs/scenario-binding.feature`.

### Placement — a three-way disagreement, not resolved here

- **Product**: ship as a mode on `scenariosCovered`
  (`{ include, reportStaleExclusions: true }`), citing `honestyAtClose`'s
  one-preset-multiple-findings precedent (`packages/md/src/rules/ledger.ts:298`).
- **Architect**: ship as a new export, but argues the kernel-level answer is
  completing `correspondence()` with a `beDisjoint()` — the matched-pair dual
  of `beComplete()` (`packages/core/src/correspondence.ts:99`) — since
  `matchSelections` already computes the matched pairs and `completeness()`
  just discards them. Argues this generalizes (frozen-doc×live-pointer,
  `@deprecated`×call-site, planned×implemented class) and that `gherkin-ts.ts`
  is already the one crossvalidate module hand-rolling its own join instead
  of routing through `correspondence()` the way `md-ts.ts`/`mermaid-ts.ts`
  do — this would be the moment to fix that, not deepen it.
- **Enforcement**: no placement position, but flags that a blocking
  `ArchViolation` here is a severity _escalation_ over the kernel's own
  non-blocking `console.warn` for what may be the same underlying class
  (`packages/core/src/execute-rule.ts:66-73`) — a decision that needs
  stating, not defaulting into.

Reviewer's own read: the `beDisjoint()` argument is the most structurally
interesting and worth a spike before committing to a dialect-local shape, but
it is also the most expensive to build. Not decided here.

### Further disagreement — `include` vs. a separate `isExempt`

Open Question 2 (below) asked whether `isExempt` should just be the caller's
`include`, inverted. Product and architect both say yes — one predicate,
drift is structurally impossible. Enforcement says no — `include` narrows
_scope_ (which scenarios are gated at all), `isExempt` narrows _exemption_
(which gated scenarios are excused); a caller doing partial rollout with
`include` would, under inversion, get every out-of-scope scenario flagged as
if it were `@wip`. Not the same predicate wearing two names. Reserved for the
library author, per this skill's own guard against a review settling an open
question.

### Further findings, not blocking but real

- **No suppression mechanism exists for a `.feature` file today**
  (enforcement) — `packages/core/src/exclusion-comments.ts` supports `//` and
  `<!-- -->`, not Gherkin's `#`. A `@wip` tag kept for a reason other than
  "not built" (flaky, intentionally partial, tracked elsewhere) that happens
  to share a test title has no remedy but deleting the tag — destroying the
  signal to make the gate green. Needs a decided escape hatch (a second tag,
  a new comment form, or `.warn()`-only until one exists) before this ships
  as a blocking check.
- **Inherits `scenariosCovered`'s unique-title precondition** without
  stating it (enforcement) — `check-crossval.mjs` runs `haveUniqueTitles()`
  as a precondition gate for the sibling; a duplicate-titled `@wip` twin
  could put this check and `scenariosCovered` in disagreement with each
  other, no resolution available to the caller.
- **The docs-only alternative is rejected on a claim that doesn't hold**
  (product) — a 4-line inversion using already-public API (`report: 'return'`)
  can express this today without re-deriving citation extraction. The
  conclusion (ship it as a shared primitive anyway, so every consumer
  doesn't independently discover and maintain that inversion) can survive;
  the stated reason for rejecting docs-only should be replaced with the true
  one.
- Missing `PresetReportOptions` in the proposed signature (architect +
  enforcement) — every sibling export in the subpath threads it; as drafted
  this would ship the one preset a caller can't set `report: 'return'` on.
- No `ruleId` named — needed for a nonvacuity fixture to bind to.
- Name hardcodes `wip` while `isExempt` is fully generic (product +
  enforcement) — worth a name that describes the mechanism, not the default.

### Recommended next step

Not plan-ready. Before `/plan`: re-run the spike past the `it.skip` false
positive; resolve the Acceptance-Criteria/Scope contradiction one way;
rewrite the non-vacuity criterion around a committed fixture sequenced with
0112; and settle placement + the `include`/`isExempt` question (library
author's call, ideally after a short spike on `beDisjoint()` given how cheap
the evidence suggests it'd be).

## Review — 2026-08-14 (second pass, scoped to the Rewrite)

**Ruling: Rewrite needed**

Not plan-ready, second time. The Rewrite's placement argument was
factually wrong, and its non-vacuity plan silently regressed to the exact
fixture tier bug 0127 — closed hours earlier in this same session — fixed
away from. Requested and run at reduced scope (architect + enforcement
only; product's round-1 concerns were the most resolved by the spike
evidence). Everything from here through the end of the old _Rewrite_ section
is preserved as _Rewrite v1_ in _Appendix B_ below, not endorsed — this
record's own established convention, one layer deeper.

### What this pass accepted

The Evidence correction, the Acceptance-Criteria/Scope fix, the
`ScenarioExtract` consolidation, `PresetReportOptions`, and the `isExempt`
kept-separate-from-`include` call all survive independent re-verification —
both reviewers confirmed each against source, one adding a sharper argument
for `isExempt` than Rewrite v1 itself gave (the contract, not just
convention, forbids the inversion). The three-part document structure
(Review → Rewrite → Appendix) was judged to work as a reading experience.

### What this pass found wrong

- **The kernel-placement argument is false.** Rewrite v1 justified landing
  `beDisjoint()` in the kernel because "`gherkin-ts.ts` is the only
  crossvalidate module not routing through `correspondence()`." Verified,
  independently, by both reviewers and by me: `md-gherkin.ts` and
  `md-mermaid-er.ts` also hand-roll their own joins — three of six preset
  modules, not one. Re-verified directly: `grep -c correspondence
packages/crossvalidate/src/*.ts` returns 0 for `gherkin-ts.ts`,
  `md-gherkin.ts`, and `md-mermaid-er.ts` alike.
- **`beDisjoint()` over `matchSelections`'s `pairs` emits one violation per
  citing test, not per stale scenario — and the spike's own one-scenario,
  one-test setup could not have surfaced it.** `matchSelections`
  (`packages/core/src/matching.ts:82-86`) pushes a pair for every matching
  `(left, right)`; a `@wip` scenario cited by two tests — which is not
  hypothetical, the _original_ submission's own Evidence recorded "2 citing
  tests, still valid" for exactly this shape — yields two violations at the
  same `file:line`. Confirmed by re-reading `matchSelections` directly.
- **The direct implementation (inside `scenariosCovered`'s own module, no
  kernel change) is smaller than the kernel-routed one, not larger** — an
  architect sketch put it at ~12 lines, reusing `citedScenarioKeys()`
  verbatim, immune to the pair-duplication defect by construction. The
  "shared scan" benefit Rewrite v1 credited to the kernel route is real but
  was always available on the direct path too; only the join needed
  `correspondence()`, and the direct path doesn't need a join at all — a
  `Set.has()` check does the job `citedScenarioKeys()` already sets up.
- **The non-vacuity plan modeled the fixture on `bad-gherkin-ts.mjs` — the
  exact tier bug 0127 converted `corpus/links`/`corpus/pointers` away from,
  in the PR that closed hours before this review.** `bad-gherkin-ts.mjs` is
  named in [0127](../bugs/fixed/0127-nonvacuity-proves-a-condition-not-a-wired-rule.md)
  as a fixture that proves its own rebuilt condition fires, never that the
  production script (`scripts/check-crossval.mjs`) invokes it.
  `GATE_FOR['check:crossval']`'s coverage check
  (`scripts/check-nonvacuity.mjs`, `gateCoverage()`) verifies only that a
  named row exists — never that `check-crossval.mjs` actually calls the new
  export. Re-read `gateCoverage()` directly to confirm: it checks row names
  against `package.json`'s `check:*` scripts, nothing about what those
  scripts execute. As specified, this proposal could land a green fixture, a
  green coverage row, and zero production enforcement.
- **A real integration wrinkle, unpriced:** `check-crossval.mjs:95` calls
  `scenariosCovered(scenarioSpecProject, scenarioSpecs)` with **no**
  `include` — so this repo cannot host an uncited `@wip` scenario in its own
  dogfood corpus today without failing that gate. Wiring the new capability
  into the production gate means also changing that call's scope, which
  `Scope (updated)` never mentioned.
- **The Evidence spike's result doesn't discriminate the hypothesis from its
  negation.** `scenariosCovered` with `include` excluding `@wip` and without
  it both return 0 violations once the scenario is cited — coverage is
  satisfied either way. "0 violations" is consistent with "the exemption
  swallowed it" and equally consistent with "the exemption did nothing and
  coverage passed on its own." The claim is still true — provable by reading
  `citedScenarioKeys()`/`scenariosCovered` (`gherkin-ts.ts:176-226`), which
  only ever computes `include ∧ ¬covered`, never the intersection `exempt ∧
covered` — but that is an analytical proof, not what the spike measured.
  Same defect class 0127 itself names: "a reproduction constructed so it
  could not have failed."
- **An internal contradiction: the Proposed API's own prose reintroduced the
  tag-line claim the Acceptance Criteria section correctly removed**, 95
  lines apart in the same rewrite — "the exact
  `specs/scenario-binding.feature:25` where the tag lives" versus "the
  scenario's own `file`/`line` (not the tag's — the model has no per-tag
  position)". Both reviewers independently measured the same number and
  found `:25` is the **scenario keyword's** line, not the tag's — no per-tag
  position exists to report.
- **The severity resolution cites its own counter-evidence.** Defaulting to
  `'throw'` "the same choice the kernel's own `.excluding()` staleness makes
  unconditionally" is backwards — `.excluding()`'s stale-exclusion warning
  (`packages/core/src/execute-rule.ts:66-73`) is an _unconditional,
  non-blocking_ `console.warn`, the nearest in-family precedent for exactly
  this failure class, and its default is the opposite of the one being
  defended.
- **The remedy still doesn't cover the case the finding itself is about.**
  Both reviewers converged on the same fix, independently: `isExempt` is
  already caller-supplied, so a second tag (`@wip @tracked`) is a
  zero-new-code escape hatch — no `exclusion-comments.ts` change needed. This
  should be brought **in scope**, not deferred, which also dissolves the
  severity question above (the caller who wants a legitimate long-lived
  `@wip` writes `isExempt` to exclude it).
- Minor, both reviewers: routing through `correspondence()` would have
  inherited open [bug 0124](../bugs/0124-correspondence-stamps-one-remedy-onto-opposite-branches.md)
  (one `suggest` slot serving opposite-cause remedies) — moot once the
  kernel route is dropped, noted as a further reason the direct path is
  cleaner, not just smaller.

### Recommended next step

Rewrite v2 below. Not spiked a second time — the corrections are analytical
(read the source, don't guess) or structural (drop the kernel route, model
the fixture on 0127's _fixed_ shape, not its pre-fix one), not claims that
need new measurement.

## Rewrite v2 — 2026-08-14

Replaces _Rewrite v1_ (now _Appendix B_) in full. Two spikes from v1 are still
valid evidence (the corrected Evidence measurement; `beDisjoint()` existing
and typechecking) — only the _conclusions_ drawn from them changed. Two
design questions remain marked **resolved, confirm or override**.

### Evidence (measurement + the analytical proof it needed)

Reproduced against `packages/crossvalidate/specs/scenario-binding.feature` —
this repo's own real, in-repo, `@dogfood`-tagged Gherkin corpus, already gated
by `scenariosCovered` in `scripts/check-crossval.mjs:95`. Measured
2026-08-14, spike worktree, reverted after:

1. Baseline: `node scripts/check-crossval.mjs` — 3 scenarios, 3 citations, all
   covered, gate green.
2. Added a 4th scenario, tagged `@wip`, plus a **real, non-skipped, passing**
   test citing it (`expect(true).toBe(true)` — deliberately trivial, so the
   test's only claim is "a title matching this citation exists," nothing
   about behavior). Re-ran `scenariosCovered(proj, set, { include: (s) =>
!s.tags.includes('wip') })` directly. Result: **0 violations**.
3. `scenariosCovered(proj, set)` — the same call **without** `include` —
   also returns **0 violations** on the same corpus.

Step 3 is the correction this pass required: step 2 alone doesn't
discriminate "the exemption swallowed the stale tag" from "coverage was
satisfied on its own, exemption or not" — both readings predict 0. The
analytical proof closes that gap: `citedScenarioKeys()` and `scenariosCovered`
(`packages/crossvalidate/src/gherkin-ts.ts:176-226`) only ever compute
`include ∧ ¬covered` — the intersection `exempt ∧ covered` (a scenario that is
_both_ excluded from the requirement _and_ has a citation) is never formed by
any code path, and `sv()` can only ever emit "no test cites this scenario."
There is no state this mechanism can be in that reports a stale exemption; it
isn't that the check currently says nothing about it, it's that the question
isn't representable in its output at all. The spike measurement and the
source-reading proof agree, which is stronger than either alone.

The Tier finding survives unchanged: a passing, non-skipped test only proves
a title exists in the AST — the trivial body is deliberate. "Proven by test
Y" over-claims; "cited by test Y" is what happened.

### Proposed API (revised — direct implementation, no kernel change)

**Placement, corrected.** The `beDisjoint()` spike (`packages/core/src/correspondence.ts`,
~20 lines of real code, typechecked clean, didn't break the 16 existing
`correspondence()` tests) still exists as a validated fact, but the argument
for landing it was wrong on two counts, both caught on independent review and
reproducible from source:

- **"`gherkin-ts.ts` is the only crossvalidate module not routing through
  `correspondence()`" is false.** `md-gherkin.ts` and `md-mermaid-er.ts`
  don't either — `grep -c correspondence packages/crossvalidate/src/*.ts`
  returns 0 for all three. This fixes one of three hand-rolled joins, not
  "the" one, and the "moment to fix the pattern" framing doesn't hold.
- **The primitive itself has a real defect the one-scenario spike couldn't
  see.** `matchSelections` (`packages/core/src/matching.ts:82-86`) pushes one
  pair per matching `(left, right)` — a `@wip` scenario cited by two tests
  (not hypothetical: the original submission's own Evidence recorded exactly
  this, "2 citing tests, still valid") produces two violations at the same
  `file:line`. A correct `beDisjoint()` needs the `byLeft` grouping
  `relations()` already carries (`correspondence.ts:200-206`), making it a
  third copy of that idiom, not the ~20-line primitive claimed.

**The direct implementation is smaller, not larger, and immune to the
duplicate-violation defect by construction** — it needs no join at all,
because `citedScenarioKeys()` already computes the citation set as a
`Set<string>`:

```ts
export interface StaleScenarioExemptionsOptions extends PresetReportOptions {
  readonly isExempt?: (scenario: GherkinScenario) => boolean // default: s.tags.includes('wip')
  readonly extract?: ScenarioCitationExtract // shared type, see below — not `ExtractOptions`
}

const STALE_RULE = 'a stale exemption should be removed once a test proves the scenario'

export function staleScenarioExemptions(
  project: ArchProject,
  set: FeatureSet,
  options: StaleScenarioExemptionsOptions = {},
): ArchViolation[] {
  const extract = options.extract ?? defaultExtract
  const isExempt = options.isExempt ?? ((s) => s.tags.includes('wip'))
  const cited = citedScenarioKeys(project, set, extract) // already exported internally
  const violations = set
    .scenarios()
    .filter(isExempt)
    .filter((s) => cited.has(`${s.relPath} ${s.title}`))
    .map((s) => ({
      rule: STALE_RULE,
      ruleId: 'crossval/stale-scenario-exemption',
      element: `${s.relPath} › ${s.title}`,
      file: s.file,
      line: s.line,
      message: `scenario "${s.title}" is exempt but a test already cites it — the exemption is stale`,
      because: 'an exemption that has outlived its reason is a silent hole in the coverage gate',
    }))
  return finishPreset(violations, options)
}
```

Not spiked as a standalone snippet — it composes two functions
(`citedScenarioKeys`, `set.scenarios().filter`) that already have their own
passing tests, with one filter condition inverted, so its correctness is
inherited rather than newly claimed. What follows is design, not measurement.

- **`isExempt`, not an inverted `include` — still resolved against
  inversion**, on firmer ground than the first pass gave: `include` is
  documented as "the opt-in scope. Default: every scenario"
  (`gherkin-ts.ts:19-24`) — a caller using it to scope a partial rollout
  (e.g. `include: (s) => s.relPath.startsWith('features/checkout/')`) would,
  under inversion, have every scenario _outside_ checkout reported as a
  stale exemption. The contract forbids the merge, not just convention.
- **`ScenarioCitationExtract`, not `ScenarioExtract`.** `ExtractOptions`
  never existed — extracting a shared type is still right, but
  `ScenarioExtract` collides in spirit with `md-gherkin.ts`'s own
  `ExtractedCitation`/`ExtractedTestCitation` pair, which already ship from
  sibling subpaths of the same package. Renamed to say what it extracts
  (an `it()` title → a scenario citation), not just that it extracts
  something.
- **`PresetReportOptions` included** and **`rule`/`ruleId` both named** —
  every sibling export in the subpath sets a readable `rule` sentence
  (`RULE`, `COVER_RULE` at `gherkin-ts.ts:44`, `:163`); this one does too,
  so its output doesn't read `correspondence` (the kernel's generic string)
  where its siblings read a full sentence.
- **Severity: default `'throw'`, and the escape hatch is now the actual
  answer, not a hedge.** The `.excluding()` precedent cited in the first pass
  argued the wrong way — that mechanism warns _unconditionally_, which is the
  opposite of "default throw, ask for warn." The real resolution is simpler:
  see below.

### Escape hatch — in scope, zero new syntax

The first pass deferred this and reached for `report: 'warn'` as an interim
mitigation. Both reviewers found the actual answer sitting in the signature
already shipped: **`isExempt` is caller-supplied.** A caller who wants a
`@wip` tag to survive having a citing test — flaky, intentionally partial,
tracked elsewhere — writes:

```ts
isExempt: (s) => s.tags.includes('wip') && !s.tags.includes('tracked')
```

No `exclusion-comments.ts` change, no new Gherkin comment syntax, no
`.warn()`-by-default carve-out. This needs documenting at the export's JSDoc
(a worked example, the way `scenariosCovered`'s own JSDoc already recommends
`@wip` for `include`), not building. The genuinely-unbuilt `#`-comment form
in `exclusion-comments.ts` remains a separate, larger, not-needed-here idea
if this family ever wants per-violation Gherkin suppression for other
reasons.

### Non-vacuity (revised — driven by the production script, not the tier bug 0127 just retired)

The first pass modeled its fixture on `bad-gherkin-ts.mjs` — a rebuild-tier
fixture that proves its own condition fires over a hand-built corpus, never
that `scripts/check-crossval.mjs` invokes it. That is the exact tier
[bug 0127](../bugs/fixed/0127-nonvacuity-proves-a-condition-not-a-wired-rule.md)
converted `corpus/links`/`corpus/pointers` away from, in the PR that closed
hours before this pass — and `GATE_FOR`'s own coverage check
(`scripts/check-nonvacuity.mjs`, `gateCoverage()`) only verifies a gate row's
_name_ is claimed by some `check:*`, never that the production script calls
what the row claims. A fixture in the old shape would land green on both
counts while enforcing nothing.

Corrected:

- A committed fixture that plants a stale `@wip` scenario in a real corpus
  `scripts/check-crossval.mjs` actually scans, and runs `node
scripts/check-crossval.mjs` itself — not a private re-invocation of
  `staleScenarioExemptions`. `check-crossval.mjs` has no `--format json`
  (unlike `check-corpus.mjs`, which bug 0127's fix could lean on), so the
  fixture asserts on **exit code plus printed output** — the `gateNode`
  pattern already used for `crossval`/`crossval/gherkin-ts`/`crossval/md-ts`
  in `scripts/check-nonvacuity.mjs`, not the `--format json`
  `firedOn()` pattern 0127's fix used. `mustSay` should match the printed
  rule sentence (`STALE_RULE` above), and the harness header's hand-maintained
  gate→input→rule map needs a new row.
- **This requires wiring `staleScenarioExemptions` into `check-crossval.mjs`
  itself**, which is new: the gate currently calls `scenariosCovered` with no
  `include` (`:95`), so this repo cannot host an uncited `@wip` scenario
  today without failing that existing check. A plan needs to either add
  `include` to the existing call and add a new `gate(...)` block calling
  `staleScenarioExemptions`, or fold both into one block — a real, small
  design decision for the plan, not resolved here.
- **The "how many exempt scenarios were evaluated" criterion is restored**,
  not demoted to a caller convenience. The first pass's demotion was itself
  a regression: `staleScenarioExemptions`'s population (`isExempt`-matching
  scenarios) is empty in the steady state — most of the time nobody has
  written a `@wip` tag — so a disjointness-shaped check is structurally an
  "empty green" machine, exactly the shape this repo's own dogfood coverage
  work (0127's deferred `{ violations, examined }` seam, 0088 Phase 3/4)
  exists to name rather than silently accept. The fixture's own denominator
  guard (exit 2 on zero exempt scenarios, matching `bad-gherkin-ts.mjs:42-48`'s
  reasoning) covers the fixture; it does not cover the production gate. Both
  are needed: the fixture proves the mechanism can fail; a printed count in
  `check-crossval.mjs`'s own output (matching how it already prints
  `scenario↔test — N citations across M scenarios`) proves a real run wasn't
  silently scoped to nothing.
- Sequenced with or after [bug 0112](../bugs/0112-three-crossval-presets-have-no-fixture.md)
  — `scenariosCovered`, the function this extends, is itself one of three
  un-fixtured `check:crossval` presets; shipping a fourth un-fixtured sibling
  compounds a named, open gap rather than closing one.

### Acceptance criteria (revised)

- Break class: a scenario matching `isExempt` (default: tagged `@wip`) with a
  real, resolvable citing test produces one violation naming the scenario and
  **the scenario's own `file`/`line`** — not the tag's; the model has no
  per-tag position (`packages/gherkin/src/model.ts:26`, `load.ts:71-79`), and
  adding one would be a breaking `eess-gherkin` change this proposal doesn't
  need. Matches `sv()`'s existing attribution (`gherkin-ts.ts:165-173`). (The
  first pass's Proposed API prose named a specific line "where the tag
  lives," measured at the scenario's own line, not the tag's — corrected
  here; there is no tag-line claim anywhere in this revision.)
- Non-vacuity: a production-script-driven fixture per the section above
  **and** a printed denominator in `check-crossval.mjs`'s own output — not a
  stats function alone, and not the fixture's internal guard alone.
- Precondition: `haveUniqueTitles()` must hold over the scenario set, stated
  explicitly (the way `check-crossval.mjs:89-91` already runs it before
  `scenariosCovered`) — a duplicate-titled `@wip` twin would otherwise put
  this check and `scenariosCovered` in disagreement with no resolution
  available to the caller.

### Open questions — resolved, confirm or override

- ~~New export vs. a mode~~ — **resolved**: new export. The kernel-primitive
  route considered in the first pass is dropped (see _Proposed API_ above),
  not deferred — nothing about it needs revisiting unless a second dialect
  independently wants matched-pair reporting, at which point it can be
  proposed on its own merits with its own tests, unbundled from this
  capability.
- ~~`isExempt` vs. inverted `include`~~ — **resolved**: kept separate, now on
  a contract argument rather than a convention one. See _Proposed API_ above.
- ~~Escape hatch~~ — **resolved**: `isExempt` already provides it. See
  _Escape hatch_ above.
- **Still open, correctly**: should a `@wip` scenario be allowed to survive
  to its owning plan's close? Left open in the original submission and still
  is — a different trigger (a plan closing) on a different lifecycle (not a
  citation resolving), or its own proposal.

### Scope (revised — one package, plus a script)

- `packages/crossvalidate` (`gherkin-ts` subpath) — `staleScenarioExemptions`,
  the shared `ScenarioCitationExtract` type, and the nonvacuity fixture. No
  kernel change. No `eess-gherkin` model change.
- `scripts/check-crossval.mjs` — wires the new export in, and changes the
  existing `scenariosCovered` call's `include` scope (see _Non-vacuity_
  above). Not a package; no changeset, but real review surface for a plan.

One changeset: `@nielspeter/eess-crossvalidate`, minor (new export,
additive).

## Appendix B — Rewrite v1 (superseded 2026-08-14, second pass)

Preserved for history, not as current design — this is what _Rewrite v2_
above replaces. The "second pass, scoped to the Rewrite" _Review_ section
documents what was found wrong with it.

### Evidence (v1)

Reproduced against `packages/crossvalidate/specs/scenario-binding.feature` —
this repo's own real, in-repo, `@dogfood`-tagged Gherkin corpus, already gated
by `scenariosCovered` in `scripts/check-crossval.mjs:95` (the original
submission's claim that no in-repo consumer exists was wrong — caught in
_Review_ above). Measured 2026-08-14, spike worktree, reverted after:

1. Baseline: `node scripts/check-crossval.mjs` — 3 scenarios, 3 citations, all
   covered, gate green.
2. Added a 4th scenario, tagged `@wip`, plus a **real, non-skipped, passing**
   test citing it (`expect(true).toBe(true)` — deliberately trivial, so the
   test's only claim is "a title matching this citation exists," nothing
   about behavior). Re-ran `scenariosCovered(proj, set, { include: (s) =>
!s.tags.includes('wip') })` directly (`check-crossval.mjs`'s own gate call
   doesn't pass `include`, so a standalone script reproduced the original
   submission's exact call shape). Result: **0 violations** — the exemption
   swallows the now-cited scenario exactly as before, this time with evidence
   that survives scrutiny: not `it.skip`, a genuinely passing test, and still
   silent.
3. This also settles the Tier question _Review_ raised: even a passing,
   non-skipped test only proves a title exists in the AST — the trivial body
   is the point. "Proven by test Y" would still over-claim; "cited by test Y"
   is what happened.

### Proposed API (v1)

**Placement — kernel primitive under a dialect export, resolved.** Spiked
`beDisjoint()` — the matched-pair dual of `beComplete()` — in
`packages/core/src/correspondence.ts`: 34 lines including comments (~20 of
real code), typechecks clean, all 16 existing `correspondence()` tests still
pass unmodified. Built two `Selection`s from public APIs only (`features()`,
`calls()`/`project()` — no `gherkin-ts.ts` internals touched) and ran:

```ts
correspondence({
  left: exemptScenarios, // Selection<GherkinScenario>, filtered to isExempt
  right: citingTests, // Selection<citation>, built from calls()
  keyBy: { left: (s) => `${s.relPath} ${s.title}`, right: (c) => `${c.path} ${c.title}` },
})
  .should()
  .beDisjoint()
```

Result: **1 violation**, naming the exact scenario and the exact
`specs/scenario-binding.feature:25` where the tag lives, with a suggested fix
("remove the `@wip` tag from…"). Removing the citing test (negative case): 0
violations — a genuinely-unbuilt `@wip` scenario stays silent, correctly.

This resolves the three-way disagreement in _Review_ by dissolving it rather
than picking a side: **land `beDisjoint()` in the kernel** (architect's
structural argument — `gherkin-ts.ts` is the only crossvalidate module not
routing through `correspondence()`; this fixes that, and the primitive
generalizes to `md`/`ts`/`mermaid` for free, now spike-validated as cheap),
**and ship the capability itself as a new export** in `gherkin-ts`
(architect's ADR-006/`finishPreset`/`ruleId` argument still holds — a new
rule needs its own rationale and remedy, matching plan 0080's own precedent).
The new export builds its `Selection`s from data `gherkin-ts.ts` already
computes internally (`itTitles()`, `resolveFeature()`), which is where
product's "don't scan twice" concern actually gets satisfied — at the
call-site, not by refusing the kernel primitive.

```ts
export interface StaleScenarioExemptionsOptions extends PresetReportOptions {
  readonly isExempt?: (scenario: GherkinScenario) => boolean // default: s.tags.includes('wip')
  readonly extract?: ScenarioExtract // shared type, see below — not `ExtractOptions`
}

export function staleScenarioExemptions(
  project: ArchProject,
  set: FeatureSet,
  options?: StaleScenarioExemptionsOptions,
): ArchViolation[]
```

- **`isExempt`, not an inverted `include` — resolved against inversion.**
  Enforcement's counterexample stands: `include` narrows _scope_ (which
  scenarios this gate covers at all), `isExempt` narrows _exemption_ (which
  in-scope scenarios are excused); a caller using `include` for partial
  rollout would, under inversion, get every out-of-rollout scenario flagged
  as if newly-`@wip`. Kept separate, defaulting to `s.tags.includes('wip')`.
  The drift risk (two predicates a caller could let diverge) is accepted and
  named here rather than "solved" by an unsound merge.
- **`ExtractOptions` corrected.** It never existed. Fix folds in
  `M1` from _Review_: extract one shared, exported `ScenarioExtract` type
  from the two inline declarations already duplicated on
  `ScenarioTestsResolveOptions`/`ScenariosCoveredOptions`
  (`gherkin-ts.ts:13`, `:18`) — this proposal's own signature would have been
  a third copy otherwise.
- **`PresetReportOptions` included** — every sibling export in the subpath
  threads it; this one does too, so `report: 'return'`/`'warn'`/`format`
  all work the same way they do on `scenariosCovered`.
- **`ruleId: 'crossval/stale-scenario-exemption'`** — named, so a
  nonvacuity fixture has something to bind to (`M3` in _Review_).
- **Severity — resolved via the mechanism already shipped, not a new
  decision.** Enforcement's concern (a blocking violation with no Gherkin
  escape-hatch syntax is "a remedy that doesn't remediate") is real, but
  `PresetReportOptions.report` already lets _each caller_ choose `'warn'`
  over the `'throw'` default — the same choice the kernel's own
  `.excluding()` staleness makes unconditionally. Default stays `'throw'`
  for consistency with every sibling in the subpath; the proposal's own docs
  should say a caller without an escape hatch yet may want `report: 'warn'`
  until one exists (see below). No new severity mechanism needed.

### Escape hatch (v1) — named, not built here

No suppression syntax exists for a `.feature` file today —
`exclusion-comments.ts` supports `//` and `<!-- -->`, not Gherkin's `#`. A
`@wip` tag kept for a reason other than "not built" (flaky, intentionally
partial, tracked elsewhere) that happens to share a test title has no remedy
but deleting the tag. Out of scope for this proposal — named so it isn't lost:
a second tag (`@wip @tracked`) is the cheapest option, a `#`-comment form in
`exclusion-comments.ts` the most consistent one. Until either exists, the
`report: 'warn'` default note above is the interim mitigation.

### Non-vacuity (v1)

`scenarioTestStats`/`adrCitationStats` are the _advisory_ discipline
(printed by `check-crossval.mjs`, never asserted non-zero) — the _enforced_
discipline this repo actually runs is a committed violating fixture in
`scripts/check-nonvacuity.mjs`, the shape of `bad-gherkin-ts.mjs`. Acceptance
criterion, rewritten:

- A committed `scripts/nonvacuity/bad-gherkin-stale-wip.mjs`: a `@wip`-tagged
  scenario plus a real citing test, asserting `ruleId ===
'crossval/stale-scenario-exemption'` fires, exiting 2 (not 0) if zero
  features loaded or zero exempt scenarios evaluated — matching
  `bad-gherkin-ts.mjs:42-48`'s own reasoning for why an empty set proves
  nothing.
- Registered in `GATE_FOR['check:crossval']`
  (`scripts/check-nonvacuity.mjs`).
- Sequenced with or after [bug 0112](../bugs/0112-three-crossval-presets-have-no-fixture.md)
  — `scenariosCovered` itself, the function this extends, is one of three
  un-fixtured `check:crossval` presets; a plan should not ship a second
  un-fixtured sibling.
- `scenarioTestStats`-style counts stay as a caller-facing convenience, not
  the acceptance criterion.

### Acceptance criteria (v1)

- Break class: a scenario matching `isExempt` (default: tagged `@wip`) with a
  real, resolvable citing test must produce a violation naming the scenario
  and **the scenario's own `file`/`line`** (not the tag's — the model has no
  per-tag position, and adding one would be a breaking `eess-gherkin` change
  this proposal doesn't need; matches the existing `sv()` helper's
  attribution in `gherkin-ts.ts:165-173`).
- Non-vacuity: a committed fixture per the section above, not a stats
  function alone.
- Precondition: `haveUniqueTitles()` must hold over the scenario set, stated
  explicitly as a prerequisite (the way `check-crossval.mjs:89-91` already
  runs it before `scenariosCovered`) — a duplicate-titled `@wip` twin would
  otherwise put this check and `scenariosCovered` in disagreement with no
  resolution available to the caller.

### Open questions (v1)

- ~~New export vs. a mode~~ — **resolved**: new export, backed by a kernel
  `beDisjoint()` primitive. See _Proposed API_ above.
- ~~`isExempt` vs. inverted `include`~~ — **resolved**: kept separate. See
  _Proposed API_ above.
- **Still open, correctly**: should a `@wip` scenario be allowed to survive
  to its owning plan's close? Left open in the original submission and still
  is — a different trigger (a plan closing) on a different lifecycle (not a
  citation resolving), or its own proposal.

### Scope (v1)

Two packages, not one:

- `packages/core` — `beDisjoint()` on `CorrespondenceBuilder`, ~20 lines,
  spike-validated (see above). A kernel-level primitive every dialect can
  reach, not gherkin-specific.
- `packages/crossvalidate` (`gherkin-ts` subpath) — `staleScenarioExemptions`,
  the shared `ScenarioExtract` type, and the nonvacuity fixture.

No `eess-gherkin` model changes — the Acceptance Criteria rewrite keeps that
claim true. Both packages move: `@nielspeter/eess` gets a minor (new public
method, additive); `@nielspeter/eess-crossvalidate` gets a minor (new export,
additive). Two changesets when this becomes a plan.

## Appendix A — original submission (superseded 2026-08-14)

Preserved for history, not as current design. The _Review_ section above
documents what was found wrong; the _Rewrite_ section above is what replaces
it. Nothing below this line is current.

### Evidence (original)

Reproduced against the published `@nielspeter/eess-crossvalidate@0.2.0`
(measured 2026-08-14, consuming project):

1. Tagged 19 real Gherkin scenarios `@wip` across 3 `.feature` files (none of
   the corresponding features built yet).
2. `scenariosCovered(project, set, { include: (s) => !s.tags.includes('wip') })`
   correctly reported 0 violations — 1 required scenario, 19 excluded. The
   exemption itself works exactly as documented.
3. **Spike:** added one real test —
   `it.skip('f1-filtrering.feature › Sagsbehandler filtrerer på flere felter samtidig (AND-logik)', ...)`
   — citing one of the 19 `@wip` scenarios, without removing its tag.
   Re-ran the same `scenariosCovered` call. Result: still "1 required
   scenario (19 @wip, excluded)" — completely unchanged. The
   `ts→gherkin` direction (`scenarioTestsResolve`, doesn't look at tags)
   correctly picked up the new citation (`2 citing tests`, still valid). No
   check anywhere in the pipeline reported that the `@wip` tag was now stale.
   Reverted after measuring.

Survey performed before writing this: `grep -rn "stale\|wip" packages/gherkin/src
packages/crossvalidate/src` finds only the tag model itself and the two JSDoc
mentions recommending `@wip` for `include` — no detector. `grep` across this
repo's own `work/bugs/` and `work/proposals/` finds no prior filing.

### Proposed API (original)

A new export in the `gherkin-ts` subpath, e.g.:

```ts
staleWipScenarios(project: ArchProject, set: FeatureSet, options?: {
  isExempt?: (s: GherkinScenario) => boolean  // default: s.tags.includes('wip')
  extract?: ExtractOptions['extract']          // same contract as scenariosCovered
}): ArchViolation[]
```

For every scenario `isExempt` would currently exclude from `scenariosCovered`,
check whether a real citing test already resolves to it (same resolution
logic `scenarioTestsResolve`/`scenariosCovered` already use internally). If
one exists, emit a violation: "scenario X is tagged `@wip` but is already
proven by test Y — remove the tag."

Could alternatively ship as a mode on `scenariosCovered` itself
(`{ include, reportStale: true }`) rather than a separate export — noted as
an open question, not decided here.

### Alternatives considered (original)

- **Consumer hand-rolls it** (what a consuming project did _not_ yet do,
  having found the gap but not built a workaround): re-derive the citation
  extraction independently. Works, but is exactly the kind of logic this
  family ships as a shared primitive elsewhere so consumers don't reinvent
  it (e.g. `corpus-frozen.ts`'s own rationale in that consuming project:
  "two gates need the same list... rather than written twice").
- **Documentation only**: add a caveat to `scenariosCovered`'s JSDoc noting
  that a stale `@wip` tag is not detected. Cheapest fix, ships no new
  surface, but leaves the gap live for every consumer of the pattern.

### Acceptance criteria (original)

- Break class: a scenario matching `isExempt` (default: tagged `@wip`) that
  has a real, resolvable citing test must produce a violation naming the
  scenario and the file/line of the tag.
- Non-vacuity: the check must report how many exempt scenarios it evaluated,
  so a caller can distinguish "0 violations because none are stale" from "0
  violations because nothing was checked" — same discipline
  `scenarioTestStats`/`adrCitationStats` already established for their own
  presets.

### Open questions (original)

- New export vs. a mode on `scenariosCovered` — a decision reserved for the
  library author.
- Should `isExempt` default to the `@wip` tag specifically, or should the
  check simply take the same `include` callback the caller already passes to
  `scenariosCovered` and invert it, so the two can never drift from each
  other by construction (a caller only has to write the predicate once)?
- Should a `@wip` scenario be allowed to survive to the point its owning
  plan/feature closes as "done," or should that closure require every
  remaining `@wip` tag to carry an explicit disposition (matching this
  family's own `deferred→<home>` / `dropped-on-purpose` ledger-box
  discipline) rather than either persisting silently or being force-removed?
  A trigger tied to "citing test exists" (this proposal, as scoped) is
  unambiguous and mechanical; a trigger tied to "plan is done" is coarser and
  more judgment-laden, and risks the same perverse incentive a blanket
  no-open-boxes rule would — deleting the scenario, or closing the plan
  early, just to satisfy the gate. Left open rather than folded into this
  proposal's scope, since it's a different trigger on a different lifecycle
  (a plan's own close, not a citation resolving) and may belong as its own
  proposal if it turns out to be wanted.

### Scope (original)

`packages/crossvalidate` (`gherkin-ts` subpath) only. No changes needed to
`eess-gherkin`'s tag model — `GherkinScenario.tags` already exposes what this
would read.
