# Plan 0145: crossvalidate — detect a stale `@wip` exemption

## Status

- **State:** Ready — created 2026-08-14 as a Draft following proposal 005's
  acceptance (`Ship as-is`, third review round — architect · product ·
  enforcement, all three full). Frozen the same day: the one open item (the
  `scenariosCovered` fixture's name/placement) is resolved above — folded
  into `bad-crossval-gherkin-e2e.mjs` as a third scenario, not a separate
  file. No refinement to harvest. No live-source cords: every citation
  (`Rewrite v3`, `bad-release-e2e.mjs`, bugs 0112/0127/0141/0144, plan 0079)
  is this repo's own version-controlled corpus, already `check:corpus`-clean.
- **Implements:** proposal 005
- **Priority:** Medium — extends the reach of an already-shipped primitive
  (`scenariosCovered`'s `include` option); does not close a correctness gap
  in what eess currently _claims_ to check, since `scenariosCovered` never
  claimed to detect a stale exemption.
- **Effort:** Small-Medium — one package (`@nielspeter/eess-crossvalidate`,
  `gherkin-ts` subpath), no kernel change, no `eess-gherkin` model change.
  The design is fully settled in the proposal's `Rewrite v3` — this plan is
  build-and-wire, not further design.
- **Created:** 2026-08-14

## Problem

`scenariosCovered`'s `include` option is documented as the way to exempt
not-yet-implemented Gherkin scenarios from the coverage requirement, tagged
`@wip` by convention. That mechanism has no counterpart in the reverse
direction: nothing detects a scenario that is **still** tagged `@wip` after
a real citing test already exists for it. The exemption, once granted, never
expires on its own.

Full problem statement, evidence, and the accepted design are in
[proposal 005](../proposals/005-crossvalidate-stale-wip-detection.md)'s
`## Rewrite v3 — 2026-08-14` section (the operative one — `## Review —
2026-08-14 (third pass...)` immediately above it carries the `Ship as-is`
Ruling and a synthesis of what three rounds of review settled). This plan
does not re-derive the design; it builds exactly what `Rewrite v3` specifies,
phased for review and to keep the PR closable.

## Approach

Three phases, one PR — each depends on the last, and none is independently
shippable (a non-vacuity fixture with nothing to test, or dogfood wiring
with no gate to wire, is not a partial win).

### Phase 1 — Core export

In `packages/crossvalidate/src/gherkin-ts.ts` (same file — `citedScenarioKeys`
is module-private, so this was always the only place it could live):

- Export `TestCitationSite` (currently module-private).
- Add `citedScenarioSites(project, set, extract): Map<string, TestCitationSite>`,
  exported. `citedScenarioKeys` becomes a one-line wrapper
  (`new Set(citedScenarioSites(...).keys())`) so `scenarioTestsResolve`/
  `scenariosCovered` are behaviorally unchanged.
- Add and export `TestCitationExtractor` (the type alias replacing the two
  duplicated inline signatures at `ScenarioTestsResolveOptions.extract` and
  `ScenariosCoveredOptions.extract`).
- Add `scenarioExemptionsCurrent(project, set, options)` — `isExempt`
  required, no default (proposal's `Decided`). Exact signature and violation
  shape are in `Rewrite v3 → Proposed API`; implement verbatim, not
  reinvented.

**Definition of done:** `packages/crossvalidate/tests/gherkin-ts.test.ts`
covers `citedScenarioSites` (site map correctness, including the multi-
citation case `matchSelections` would have mishandled had the kernel route
been kept) and `scenarioExemptionsCurrent` (fires on exempt+cited, silent on
exempt+uncited, silent on non-exempt, the `.skip`-citation decision from
`Rewrite v3 → Acceptance criteria`). `tsc --noEmit` clean.

### Phase 2 — Non-vacuity, strong tier

Per `Rewrite v3 → Non-vacuity` exactly:

- Add `--format json` to `scripts/check-crossval.mjs` (all five `gate(...)`
  calls thread `{ format }` through `finishPreset`/`reportViolations`).
- Add the `EESS_CROSSVAL_GHERKIN_ROOT` override (default
  `packages/crossvalidate/specs`) scoping only the three gherkin-ts gates.
- Wire in `scenarioExemptionsCurrent` as a new `gate(...)` call.
- Add `include: (s) => !s.tags.includes('wip')` to the existing
  `scenariosCovered` call, and correct its printed denominator to the
  **filtered** count.
- New fixture `scripts/nonvacuity/bad-crossval-gherkin-e2e.mjs`
  (`bad-release-e2e.mjs`-shaped): one shared throwaway-directory-per-scenario
  helper (mirroring `bad-release-e2e.mjs`'s own `scenario()` helper and its
  `E2E` array of cases), driving three scenarios in one file rather than
  three separate fixtures duplicating the same scaffolding:
  1. exempt + cited → fires `crossval/scenario-exemption-stale`;
  2. exempt + uncited → silent (the negative control);
  3. non-exempt + uncited → fires `crossval/scenarios-covered` — this third
     scenario is what closes one of
     [bug 0112](../bugs/0112-three-crossval-presets-have-no-fixture.md)'s
     three named rows, folded into this same fixture rather than a separate
     file, since it needs the identical throwaway-corpus machinery the other
     two already build.
     Each scenario asserts via `--format json`'s `firedOn`, plus a bare-
     terminal exit-code run (bug 0127's two-run discipline).
- `scripts/check-nonvacuity.mjs`: new `PROBE_*` sweep entries if any
  ephemeral probes are needed beyond the throwaway-directory shell already
  used by `bad-release-e2e.mjs`; new `GATES` rows; `GATE_FOR['check:crossval']`
  gains the new row names; the harness header docblock's gate→input→rule
  table gains a row (per this round's own finding that the table already
  silently omitted plan 0142's five rows — fix this omission too while
  editing the same table, since it is the same honesty gap, found again).

**Definition of done:** `npm run check:nonvacuity` proves every new rule id
fires on its violating input, verified by mutation before considering this
phase done (this session's own established discipline — reviewer confidence
is not evidence, re-derive it).

### Phase 3 — Dogfood wiring and documentation

- Commit one new scenario to
  `packages/crossvalidate/specs/scenario-binding.feature`, tagged `@wip`,
  staying inside the feature's own real scope (a scenario↔test binding
  capability, not an unrelated example) rather than a generic placeholder:
  "a cited scenario's steps are proven to run, not just cited" — the exact
  Tier-2 gap `scenarioTestsResolve`/`scenariosCovered`'s own docstrings
  already name as open ([plan 0079](../plans/0079-tier-2-3-mechanization.md),
  "a mechanism; none exists"). Genuinely unbuilt, not a scenario this change
  itself will make stale.
- `packages/crossvalidate/README.md`: document `scenariosCovered` (currently
  undocumented — the discoverability gap proposal 005's own Origin fell
  into) alongside `scenarioExemptionsCurrent`.
- One changeset: `@nielspeter/eess-crossvalidate`, minor.

**Definition of done:** `npm run check:corpus` shows `1 accepted` and
`✓ every accepted proposal has a plan, every Ruling/Implements parses` —
the proposal→plan linkage gate ([bug 0141](../bugs/0141-no-check-binds-accepted-proposals-to-plans.md)/[plan
0142](../plans/0142-bind-proposals-to-plans.md)) proven against a real
accepted proposal and a real implementing plan for the first time since it
was built. `npm run check:crossval` shows the new gate green in steady
state (the committed `@wip` scenario present and uncited, satisfying
`scenariosCovered`'s narrowed `include` and not yet tripping
`scenarioExemptionsCurrent`).

## Test inventory

- Phase 1: unit tests in `packages/crossvalidate/tests/gherkin-ts.test.ts` —
  `citedScenarioSites` map correctness; `scenarioExemptionsCurrent` fire/
  silent/`.skip` cases; `TestCitationExtractor` default behavior unchanged
  from `defaultExtract`.
- Phase 2: `bad-crossval-gherkin-e2e.mjs`'s three scenarios prove all three
  directions against the real `check-crossval.mjs`, mutation-verified before
  Phase 2 is considered done — delete the new `gate(...)` call, confirm the
  row reddens; revert `include`, confirm the third scenario's row reddens.
- Phase 3: `npm run check:corpus` and `npm run check:crossval` both green,
  the former showing a real `1 accepted` for the first time.

## Files changed

- `packages/crossvalidate/src/gherkin-ts.ts` — new exports, per Phase 1.
- `packages/crossvalidate/tests/gherkin-ts.test.ts` — new unit coverage.
- `packages/crossvalidate/README.md` — `scenariosCovered` +
  `scenarioExemptionsCurrent` documented.
- `packages/crossvalidate/specs/scenario-binding.feature` — one new `@wip`
  scenario.
- `scripts/check-crossval.mjs` — `--format json`, env override, new gate
  call, `include` + corrected denominator on the existing one.
- `scripts/nonvacuity/bad-crossval-gherkin-e2e.mjs` (new), plus one more
  fixture for `scenariosCovered` (closing one row of bug 0112).
- `scripts/check-nonvacuity.mjs` — new rows, `GATE_FOR` entries, header
  docblock update.
- `.changeset/` — one new changeset, minor, `@nielspeter/eess-crossvalidate`.

## Out of scope

- **Whether a `@wip` scenario should survive to its owning plan's close** —
  proposal 005's own explicitly-deferred open question. A different trigger
  on a different lifecycle; its own proposal if anyone wants it built.
- **The other two rows of bug 0112** (`diagramMatchesCode` code→diagram
  direction, `haveUniqueTitles()`) — this plan closes the one row
  (`scenariosCovered`) its own `include` edit makes load-bearing; the other
  two stay with bug 0112.
- **The kernel-routed `beDisjoint()` design** — considered and rejected
  across two prior review rounds (real pair-duplication defect, not a
  20-line primitive as first claimed). Not revisited here; if a second
  dialect independently wants matched-pair reporting, that is its own
  proposal.

## Success definition

- `scenarioExemptionsCurrent` ships, tested, and is the first real dogfood
  consumer of a strong-tier (`bad-release-e2e.mjs`-shaped) non-vacuity
  fixture outside the release gate itself.
- `check:corpus`'s proposal→plan linkage gate goes green against a real
  accepted proposal and a real declaring plan — proposal 005 no longer
  contributes to a permanently-`0-accepted` denominator.
- `scenariosCovered` gains its own fixture, closing one of bug 0112's three
  named rows.
- `npm run validate` green end-to-end.

## Progress ledger

- [x] Phase 1 — core export, unit-tested (18 tests in `gherkin-ts.test.ts`,
      77/77 crossvalidate suite green, `tsc --noEmit` clean)
- [x] Phase 2 — non-vacuity, strong tier, mutation-verified (31 fixtures
      total, both new rows confirmed to catch their target mutation; also
      fixed the harness header's pre-existing omission of plan 0142's rows,
      found again while editing the same table)
- [x] Phase 3 — dogfood wiring, docs, changeset; `check:corpus` shows a real
      accepted+implemented pair (`1 accepted`, ✓), `check:crossval` shows a
      real, non-zero, honestly-uncited `1 exempt scenario(s) evaluated`
