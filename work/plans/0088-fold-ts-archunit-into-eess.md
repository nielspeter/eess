# Plan 0088: Fold ts-archunit 0.59 into eess — port ADR-008 + ADR-009

## Status

- **State:** Draft — direction ruled by the author (2026-08-10: retire
  ts-archunit, fold its current engine in, port the two doctrine ADRs).
  **Split 2026-08-12:** the original Phase 7 (retire ts-archunit — a registry act
  and another repository's setting) and Phase 8's publish step could not land in
  this plan's PR, so this plan could not close. Both moved to
  [0100](./0100-publish-the-fold-retire-ts-archunit.md); what remains of the
  release work is Phase 7, which authors it as merged changesets. 0088 now closes
  at merge. The
  engine-drift measurement is cited (`ts-archunit` ADR-010: **10,342 diff-lines
  behind across the 118 shared files, plus 37 modules it never received**). Phase
  ordering below is provisional; the per-file delta class (Phase 1) may reorder
  phases.
- **Priority:** High — the flagship dialect has drifted ~34 releases and ~10k lines
  behind its own ancestor, and the two engines are _the same files_ with a doctrine
  eess lacks entirely. This is the drift the project exists to prevent, committed
  against its own flagship.
- **Effort:** Large — engine rejoining + doctrine port + dogfood reconciliation.
  Phased: each phase leaves `validate` green.
- **Created:** 2026-08-10

## Problem

`eess-ts` forked `ts-archunit`'s engine and then split the dialect-independent
core into `@nielspeter/eess` (this was plan 0051's consolidation — correct as a
_direction_). But the fork then **froze at ~0.17 semantics while `ts-archunit`
surged to 0.59** — ~34 releases, a plan corpus through 0102, 3320 tests, and two
binding ADRs eess does not bear.

The kernel and ts-archunit's `src/core/` share **21 files by name** (`ansi`,
`code-frame`, `combinators`, `condition`, `define`, `exclusion-comments`,
`format-*`, `predicate`, `rule-builder`, `rule-metadata`, `silent-exclusion`,
`terminal-builder`, `violation`, …). They are the **same ancestral files**, and the
fork has drifted — measured at **10,342 diff-lines across 118 shared files, plus
37 modules never received** (`ts-archunit` ADR-010, context §trigger).

Two consequences are load-bearing:

1. **The doctrine is missing.** The fork predates the single most valuable thing
   the ancestor has become: the **fail-closed** discipline.
   - `ts-archunit` **ADR-008 (Agent-First Failure Surfaces):** _"A check that
     cannot fail is worth less than no check."_ An agent reads failures, not
     warnings; an empty-green is a lie; remedies must be stated and **verified
     to remediate**; review rule 5 (the reviewer question — _"what would this
     test do if what it guards were broken?"_) and its corollaries.
   - `ts-archunit` **ADR-009 (A Pass Is Constructed From Evidence):** evidence
     counted at the examining seam, `{ violations, examined }`; **empty is a
     declaration, never a default**; a pass that examined zero units is
     **unrepresentable**; the vacuity matrix over the published exports map.
     eess's doctrine today is ADR-008 ("caller owns reporting" — a _different_
     ADR-008) plus the manifesto's Tier/Status honesty. The fail-closed seam that
     makes a green _mean something_ is absent. The user's directive is explicit:
     **"the ts-archunit adr 08+09 is very important to port to eess."**

2. **The institutional record is stale and unjoined.** ts-archunit's ADR-010
   names its twin — _"eess ADR-009 (Adopt ts-archunit as the Engine; Retire the
   Fork)"_ — which **does not exist** (eess has ADR-001..008). Its ratification
   is deliberately two-sided and the eess half was never written. Meanwhile
   plan 0081 (2026-07-23) claimed eess is "ahead of" ts-archunit — a claim that
   was _true against the 0.17.0 parity snapshot it was written for_, and became
   stale because eess-ts froze while ts-archunit surged. (The eess ROADMAP
   §State-of-play is dated 2026-07-24 and carries no such claim; the attribution
   in an early draft of this plan was wrong and is corrected here.) This plan is
   the missing twin: it creates eess ADR-009 + ADR-010 (the ported doctrine) and
   retires the fork.

## Is this the right shape? — the direction ruling

Two-fold choices were on the table; the author ruled on **both**:

- **Retire `ts-archunit`, fold its engine in** (ruled) — _not_ keep two packages.
  ts-archunit's own ADR-010 alternative 1 rejected _its_ fork for the same reason
  this rejects the reverse. Two engines shipping the same core under two names,
  one ~10k lines behind, is the drift eess sells against.
- **Port ADR-008 + ADR-009 as eess ADRs** (ruled) — the current eess ADR-008 is
  "caller owns reporting"; the _ported_ ones land as **eess ADR-009
  (Agent-First Failure Surfaces)** and **eess ADR-010 (A Pass Is Constructed From
  Evidence)**, with renumbering free (008 is already taken).

**Not ported verbatim as ts-archunit ADR-010's full text.** ts-archunit's
ADR-010 ("The Extension Surface Is a Contract") describes the karma of folding:
once eess's dialects extend the kernel as ts-archunit's `graphql/` does, that
surface becomes a contract. That _consequence_ is adopted (Phase 6), but as an
eess statement, not a wholesale copy of ts-archunit's doc whose context (a second
repo) will not survive the fold. **Naming, to prevent a collision:** eess
**ADR-010 = "A Pass Is Constructed From Evidence"** (the port of ts-archunit
ADR-009, Phase 3). The extension-surface consequence is _not_ a numbered eess ADR
unless review asks for one (then it is **eess ADR-011**) — it is Phase 6's
fixture.

## Implementation phases

### Phase 1 — The delta: classify every shared + missing module

Before any copy, produce the artifact the whole fold rests on: a per-file
classification of ts-archunit's `src/` vs `@nielspeter/eess` kernel + `eess-ts`,
three buckets:

- **kernel-bound** — dialect-independent honestly-gate machinery: the exclusion /
  comment / `silent` / `unsuppressable` / orphan-detection system, `examined`
  counts, `{ violations, examined }` return, the `CollectResult` shape,
  `zeroSubjectsAdvice` / `narrowingHint` / `examinedUnitNoun`, cache/memoization,
  baseline + diff, formatters. → `packages/core/`.
- **eess-ts-bound** — TS-specific: predicates, conditions, body-analysis,
  builders, smells, graphql, presets, tsconfig, CLI. → `packages/ts/`.
- **already-in-eess / superseded-by-ADR-008** — the reporting surface ts-archunit
  pre-dates and eess re-expressed (e.g. `checkAll` → `finishPreset`); note as
  _no-op_.

**Deliverable:** `work/dogfood-coverage.md` appendix or a plan-adjacent matrix
(`work/spikes/0002-fold-delta.md`). The earlier `spikes/0001-eess-over-ts-archunit`
is an empty stub (only `node_modules`); Phase 1 replaces it with a real read.

**The three merge hazards the classification must track** (from the 2026-08-10
engine map of ts-archunit v0.59):

1. **The gate and `diagnose()` are an ordered pair, not two functions.** The
   honest-gate precedence (`collectWithAssertionGuard` —
   ts-archunit's `src/core/terminal-builder.ts`, lines ~339–424) and the
   in-process `diagnose()` (ts-archunit's `src/core/diagnose.ts`, lines ~194–380)
   **mirror each other**, sharing `isFaultPosition`, `loadedNothing`,
   `emptyProjectAdvice`, `assertionAdvice()`, `zeroSubjectsAdvice()` — every one
   of those seams exists because the two were _measured diverging_. Porting one
   without the other reintroduces documented bugs. They land together. _(Line
   cites are the source engine's, recorded as provenance in prose — eess's
   `packages/core/src/terminal-builder.ts` today is 161 lines; the fold brings the
   longer body over in Phase 4.)_
2. **Three unforgeable capability registries guard the opt-outs.** `cardinality.ts`
   (`CARDINALITY_ASSERTERS = new WeakSet<object>()`, set only via
   `marksAssertsCardinality` — the `unique symbol` version was the forgeable one,
   stolen in two lines through `Object.getOwnPropertySymbols`, and replaced
   precisely because of it), `owns-empty-discovery.ts` (non-exported module
   `WeakSet` — a `unique symbol` variant was broken the same way),
   `silent-exclusion.ts` (`unique symbol`). These are security-relevant, not
   stylistic: a forged registry membership is a suppressed empty-green. **Port
   each registry verbatim, including the WeakSet-vs-symbol choice** — the choice
   _is_ the threat model.
3. **Name collisions are systemic.** `notExist`, `haveNameMatching`,
   `resideInFile`, `havePropertyNamed`, `acceptParameterOfType`,
   `notImportFrom`, `haveAttribute*` each exist 2–4× across families,
   disambiguated only by re-export aliasing in `src/index.ts`. The barrel merge
   must replicate that aliasing table verbatim — or the surface silently changes
   meaning. (eess-ts's own prefixed aliases, e.g. `classHaveMethodNamed`, are a
   _second_ layer this must compose with, not replace.)

**Files changed:** none (analysis). **Tests:** the matrix is itself the
non-vacuity check (it must assert the counts match ADR-010's 10,342 / 37, else
the measurement has since moved).

### Phase 2 — Port ADR-008 (Agent-First Failure Surfaces) to eess ADR-009

Write `adr/009-agent-first-failure-surfaces.md`, the eess statement of
ts-archunit ADR-008: the agent-reads-failures-not-warnings premise, empty-green as
a lie, remedies verified to remediate, review rule 5 + corollaries. **Become** the
missing twin: its TL;DR is _this plan_ (retire the fork), and it cites
`0088-fold-ts-archunit-into-eess.md`.

Enforcement table rows (one per enforceable clause — **Status uses the fixed
vocabulary only**: `gated` / `warn` / `pending` / `manual` / `n/a` / `deprecated`;
`pending` = decided, mechanism known, owner-phase named, not yet green. Each
row's mechanism must exist before the row flips to `gated`):

| Clause                                                                         | Tier                                                                     | Mechanism (built by)                                                                                                                   | Status                                        |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Every published check-constructor is provably non-vacuous (the vacuity matrix) | 2 (behavioral — the harness _executes_ constructors, not a static claim) | vacuity matrix over `package.json` exports → dist → namespace-object exports, built in Phase 4a; `check:nonvacuity` row per gate       | `pending` (flips `gated` when Phase 4a lands) |
| Remedies are stated and verified to remediate                                  | 2                                                                        | a committed violating fixture per remedy (apply the fix, assert the finding clears) — not a `--removed` CLI flag, which does not exist | `pending` (Phase 5)                           |
| Review rule 5 (independence) in place                                          | 5                                                                        | reviewer question, review-enforced                                                                                                     | `manual`                                      |
| Retire the fork (this plan)                                                    | 5                                                                        | `ts-archunit` npm deprecated → `@nielspeter/eess-ts`, mechanically asserted                                                            | `pending` (flips `gated` on close)            |

**Tests:** `adrEnforcement` gate (Phase 2 renders it well-formed); `check:corpus`
citations resolve.

**Annex — the enforcement methodology.** ADR-008's review rule 5 lives only if
the sabotage-matrix discipline is adopted with it (from the 0088 corpus-wisdom
map). Port alongside: enumerate revert rows **from the diff**, not memory; split
bundled rows; assert a **green baseline** + each patch applies non-trivially,
and **hold the tree exclusively** (isolated worktree); read the verdict from the
exit code, and prove the exit code means something; every guard carries its own
vacuity control; a count of 1 is never sufficient where a config finding can
appear. These are the habits that make "what would this check do if its guard
were broken?" answerable — without them the ADR is prose.

### Phase 3 — Port ADR-009 (Pass Is Constructed From Evidence) to eess ADR-010

Write `adr/010-a-pass-is-constructed-from-evidence.md`: evidence counted at the
examining seam, `{ violations, examined }`, empty-is-declaration-never-default,
zero-units pass unrepresentable, vacuity matrix over the `package.json` exports
map.

**Tests:** same — `adrEnforcement` + `check:corpus` green; the two new ADRs index
in the README ADR table (`check:spec`).

### Phase 4 — Fold the engine: copy the delta into kernel + eess-ts

The mechanical half. For each Phase-1 bucket:

- **kernel (`packages/core/`):** adopt the honest-gate machinery **as a unit** —
  the gate (`collectWithAssertionGuard`) _with_ `diagnose()` and the three
  unforgeable registries, `CollectResult`/`examined`, exclusion/orphan detection,
  cache, `zeroSubjectsAdvice` — re-exported through `core/index.ts`. Reconcile
  against existing kernel: where a file already exists (the 21 shared names), it
  is the _newer_ ts-archunit file + any eess-specific adaptation (ADR-008
  reporting, `ArchFix`, `apply-fixes`). The gate/diagnose pair and the registries
  are **atomic** — never ported half-way (Phase 1 merge hazard 1 & 2).
  **Two kernel-identity constraints gate this bullet** (2026-08-10 review, verified):
  the kernel today is **zero-runtime-dependency and ts-morph-free**
  (`packages/core/package.json` has no `dependencies`; `packages/core/src/index.ts:5`
  states the identity; `arch.rules.ts` gates `eess/kernel-no-engine-deps` and
  `eess/kernel-no-dialects`). ts-archunit's core is entangled — 13–23 files import
  ts-morph, including `violation.ts` (runtime `Node` guards) and `project.ts`
  (wraps a ts-morph `Project`), and the gate's transitive closure runs through
  them. **Phase 1 must classify which "kernel-bound" files actually import
  ts-morph, and Phase 4 must re-express them behind an engine-neutral seam** —
  a structural `ArchProject`/loaded-project type in the kernel (e.g.
  `getSourceFiles(): readonly { getFilePath(): string }[]`), with the ts-morph-
  backed project living in `packages/ts` (the ADR-007 Rule 1 shape). Porting the
  ts-morph-importing files verbatim into `packages/core` is **not** acceptable —
  it breaks the kernel's identity and trips the purity gates.
- **kernel — `RuleBuilder<T, P>` signature is preserved, not replaced.** eess's
  kernel base is `RuleBuilder<T, P = unknown>` (constructor takes `P`, does _not_
  extend `TerminalBuilder`); ts-archunit's is `RuleBuilder<T> extends
TerminalBuilder` with `ArchProject`. Every eess-ts builder (`<T, ArchProject>`)
  and every sibling builder (md passes `Corpus`, mermaid its own) depends on the
  two-param form (verified: 6 ts builders, 6 md builders, mermaid). **Phase 4
  must reconcile the honest-gate mechanics (which ts-archunit lives on the
  `TerminalBuilder`/`CollectResult` seam) with eess's two-param generic** — keep
  `<T, P>`, add `TerminalBuilder` inheritance as a second base or composition —
  rather than swapping the base and breaking every builder at compile time. This
  is a named first-order Phase-4 requirement (the "newer file wins" rule is
  explicitly amended: the _signature_ does not follow the newer file).
- **`collectViolations`' retype is a public-API break and is named as such.**
  `collectViolations` is exported from `packages/core/src/index.ts:77` (via
  `baseline-generator.js`) and re-exported by eess-ts at `packages/ts/src/index.ts:263`
  today. Changing its return to `CollectResult` is a breaking change for any
  consumer calling it, and it lands in the breaking-changelog + migration line
  (Phase 7) — it is not "kernel-internal" to the siblings.
- **eess-ts (`packages/ts/`):** adopt the 37 missing modules + the newer body of
  every predicate/condition/builder/smell/graphql/preset. Keep eess-ts-specific
  aliases (`classHaveMethodNamed` etc.) and the ADR-005 no-`any`/no-`as` floor.
  The `index.ts` barrel must reproduce ts-archunit's alias disambiguation table
  (Phase 1 merge hazard 3) composed with eess-ts's own prefixed exports.
- **Standalone completeness (the sufficiency invariant, enforced in this
  phase):** every kernel export a standalone user needs is re-exported from
  eess-ts's own `index.ts` — the honest-gate trio (`diagnose`,
  `orphanExclusions`, `zeroSubjectsAdvice`), the preset/reporting trio
  (`reportViolations`, `finishPreset`, `dispatchRule`), and the rest of the
  surface. A guard test enumerates eess-ts's re-exports against the kernel's
  index and fails on a gap (mirroring ts-archunit's own "published surface is
  complete" checks). The dialect-family-only exports (`correspondence`,
  `matchSelections`, `applyFixes`) are the _one_ deliberate exception — they
  serve `crossvalidate`/`md`, not a standalone ts user.
- **Migration rule:** engine files come in _as-is where sensible_; only the seams
  ADR-008/009 name are re-expressed through the existing eess kernel API. This is
  not a wholesale rename — it is catching the fork up. Carried with the code: the
  honest-gate **docstrings** (`owns-empty-discovery.ts`, `unsuppressable.ts` are
  mostly measured-failure prose) — that prose is the design's only spec and
  survives the fold with it.

### Phase 4a — Build the vacuity matrix (the honest-gate's own non-vacuity proof)

The enforcement table's row 1 ("every published check-constructor is non-vacuous")
is the doctrine's central claim, and it needs a **mechanical derivation** — the
2026-08-10 review's C1. A hand-maintained constructor list is exactly the
empty-green the ADR exists to prevent. The derivation, three steps (adopted from
ts-archunit's plan 0095, which already solved this):

1. **Enumerate from the `package.json` exports map, importing from `dist`.** The
   exports map is the one list a published surface cannot avoid joining. Each
   subpath (`./rules/*`, `./presets`, `./graphql`, `.`) is loaded, its namespace
   exports recursed, and every export that is a check-constructor (has
   `.check()`/`.warn()`/`TerminalBuilder` shape) collected. Type-only exports ride
   the static/runtime pairing. **A new subpath or export that lands in
   `package.json` but never in the classification fails** — the matrix is
   enumerated from the exports map, not from a memory list.
2. **Probe each constructor bare, on `.check()` AND `.warn()`** over a zero-file
   project. Record a three-way verdict: `fail-open` (passes green), `other-throw`
   (throws for a different reason), `config-finding` (the honest-gate fires).
   Three control fakes, not two — a probe that classifies every throw as
   `other-throw` satisfies two controls and misreports every real cell.
3. **A `KNOWN_FAIL_OPEN` ratchet that may only shrink and expires at a target
   version.** Any constructor landing in `fail-open` is either fixed or listed
   with a date. The ratchet is the honest record: a known-vacuous published
   constructor is a declared, tracked debt — never a silent green.

This is where the "preset that constructs nothing" hole (ts-archunit plan 0100,
parked in Out of scope) **becomes visible and countable**: the matrix probes the
_minimal type-correct call_ per preset, which is exactly the call that exposes
`agentGuardrails({ src })` / `dataLayerIsolation({ repositories })` constructing
zero rules. The matrix therefore names the 0100 hole as a `KNOWN_FAIL_OPEN` row
with its expiry — the doctrine ships honest, not silent, even before 0100 lands.

**Files changed:** `scripts/vacuity-matrix.mjs` (new), a `vacuity/` fixture dir
with the zero-file project + controls. **Tests:** the matrix is itself the
non-vacuity check — every gate it covers must prove `fail-open` impossible on a
fresh build; the `KNOWN_FAIL_OPEN` ratchet shrinks monotonically. Wired into
`check:nonvacuity` as its own row (the honest-gate itself gets a violating
fixture: a committed rule file whose selector matches nothing must exit non-zero
_naming the empty selection_).

### The family boundary — re-homed to plans 0089 + 0101, not 0088

The fold's kernel change has family-wide _consequences_ (verified 2026-08-10):
the four sibling dialects (md, mermaid, gherkin, crossvalidate) consume the
kernel through `RuleBuilder` / `correspondence` / their own builders and do
**not** subclass the seam — so ADR-009's retype is kernel-internal for them and
they inherit the honest-gate for free. Two consequences follow, and **both are
owned by 0089** (standalone sufficiency) and **0101** (sibling gates go fail-closed), not this plan:

- **Per-dialect standalone sufficiency.** The invariant holds per package
  (`@nielspeter/eess-md` alone, `-mermaid` alone, …), each re-exporting the
  kernel surface its own users touch, each with its own re-export-completeness
  guard.
- **Sibling dogfood gates go honest — but only when 0101 opts them in.** The
  kernel seam makes fail-closed _available_ to every dialect; it does **not**
  activate it for the sibling gates inside 0088. 0088 ships the seam so that
  `check:corpus`/`check:ledger` (md), `check:diagram` (mermaid),
  `check:crossval` (crossvalidate) **continue to pass as they did** — the honest
  gate surfaces silently-empty selections in _their_ rules only when 0101's
  Phase 3 flips the sibling gates to fail-closed and reconciles each (declare
  `.expectEmpty()` or fix the rule — a judgment call per gate). **This staging is
  the 0088/0089 close-ordering fix** (2026-08-10 review C4/doD deadlock): without
  it, the fold's own "siblings inherit fail-closed" and "0088's DoD is `validate`
  green" cannot both hold.

**0088's only obligation to the siblings is preservation:** they must keep
compiling against the kernel and their existing suites must stay green
(a regression guard, not new capability). The eess kernel has **no**
`correspondence().allowEmpty` today (verified — that conversion was
ts-archunit-internal pre-fork), so the fold introduces a _new_
`expectEmpty`/`expectNonEmpty` capability the siblings may adopt later, not a
conversion they are forced through.

### Phase 5 — Reconcile the eess-ts dogfood gates

Point the honest-gate machinery at _this repo_ for the ts gates that this fold
touches: `check:arch` / `check:spec` run via the folded engine. The vacuity /
examined machinery will surface exclusions eess currently keeps silent in the ts
rule files — that is the engine being more honest, not a migration bug. Budget a
pass to clear them (or declare them in-scope-with-reason). `check:nonvacuity`
must stay green (prove the gates still fail on a committed violating fixture).
The sibling gates (`check:corpus`/`diagram`/`crossval`/`ledger`) are 0101's
surface; 0088 only requires they still _run_ and pass as they did.

**Definition of done:** `npm run validate` green end-to-end **with the folded
engine and the staged honest-gate** — sibling gates pass unchanged (0101 opts
them into fail-closed later), eess-ts gates re-proven non-vacuous. This is _the_
acceptance test of the fold.

### Phase 6 — The extension surface as a contract (eess ADR-010 consequence)

Once the fold lands, eess's other dialects (md, mermaid, gherkin, crossvalidate)
extend the kernel the way ts-archunit's `graphql/` does. Adopt ts-archunit
ADR-010's _consequence_ (the surface is a consumed contract) as an eess
statement — a contract fixture that plays the stranger against the published
`.d.ts`, so a renamed protected member or drifted semantics breaks _our own_
suite. This is where ADR-010's "twin" becomes real.

### Phase 7 — Version the break: author the release, do not publish it

The fold is a breaking engine swap, and this phase is where that is named (the
2026-08-10 review's single biggest release gap). It is **not** optional polish.

**Everything here is a file, and files merge.** The changesets, the
breaking-changelog entries, the migration story, and the compat test all land in
this plan's PR. The _acts_ that cannot land in a PR — running the publish,
deprecating `@nielspeter/ts-archunit`, archiving its repository — are
[plan 0100](./0100-publish-the-fold-retire-ts-archunit.md), split out so 0088 can
close at merge instead of waiting on a registry.

- **Which packages move, and to what versions.** `@nielspeter/eess` 0.2 → 0.3+
  (the `{ violations, examined }` retype + new honest-gate exports are a contract
  break at 0.x) and `@nielspeter/eess-ts` 0.2 → 0.59-equivalent (major). The four
  sibling dialects get **at least** a `minor` (their re-export additions +
  re-emission against the new kernel declarations) and their `@nielspeter/eess`
  dependency ranges are bumped in **lockstep** — `^0.2.0`/`^0.2.1` means
  `>=0.2.0 <0.3.0`, so a 0.3 kernel breaks every sibling range on the registry if
  they are not bumped together. The changesets are written here to make 0088 +
  0089 + 0101 publishable as **one coordinated release** (no published window where a
  consumer gets `eess-ts@0.3` + `eess-md@0.2` = two kernel copies — which would
  also split the unforgeable registries between two `WeakSet` instances).
  Executing that release is [0100](./0100-publish-the-fold-retire-ts-archunit.md);
  this phase's obligation is that the changesets it merges make the release
  _correct when run_, so 0088 never waits on any sibling plan's merge.
- **Breaking-changelog + migration line.** Each package's CHANGELOG carries a
  `breaking`-flagged entry with a migration line: `collectViolations` retype,
  `{ violations, examined }` everywhere, `allowEmpty`→`expectEmpty` if adopted.
- **The adopter migration story** (per ts-archunit ADR-008 rule 1's diagnostic-first
  corollary): existing rules' predicate names and semantics, `// eess-ts:disable`
  comment syntax, `arch-baseline.json` format, and `ruleId`/`because`/`Fix:`/`Docs:`
  texts all get an explicit _"unchanged"_ statement or a named breaking delta. A
  compat test keeps the existing eess-ts rule fixtures running **unchanged** on the
  folded engine, and the upgrade path tells an adopter to run `eess-ts diagnose`
  first to find rules that were green-but-empty.

**Tests:** breaking-changelog entries per package exist and name the migration;
the existing eess-ts rule fixtures pass **unchanged** on the folded engine (a
compat test, not an adapted one); sibling ranges bump in lockstep in one changeset.

## Test inventory

- Phase 1: delta matrix asserts ADR-010's counts (non-vacuous measurement);
  per-file ts-morph-import classification feeding the kernel-seam decision.
- Phase 2/3: `adrEnforcement` × 2 new ADRs; `check:corpus`; `check:spec` (ADR
  index).
- Phase 4: the adopted ts-archunit suite (3320) + existing eess-ts suite, both
  green; `check:docs-code` (doc fences); **standalone-consumption test** — a
  black-box fixture that installs only `@nielspeter/eess-ts` (dist, as a foreign
  consumer would) and runs the full path `init → check → diagnose` with no
  `@nielspeter/eess` import in sight, plus the re-export-completeness guard
  (every kernel export eess-ts claims is present). Sibling suites (md / mermaid /
  gherkin / crossvalidate) keep passing against the new kernel —
  preservation, nothing more. **Kernel-identity checks:** `packages/core` remains
  ts-morph-free and zero-runtime-dependency (`eess/kernel-no-engine-deps`,
  `eess/kernel-no-dialects` green); `RuleBuilder<T, P>` two-param generic held.
- Phase 4a: vacuity matrix — exports-map enumeration, bare `.check()`+`.warn()`
  probes, three control fakes, `KNOWN_FAIL_OPEN` ratchet; wired into
  `check:nonvacuity` as its own row.
- Phase 5: `npm run validate` green end-to-end on the eess-ts gates with the
  staged honest-gate;
  `check:nonvacuity` green. Sibling-gate reconciliation is 0101's surface.
- Phase 6: contract fixture green against published `.d.ts`.
- Phase 7: breaking-changelog entries per package name the migration; existing
  eess-ts rule fixtures pass **unchanged** on the folded engine (a compat test,
  not an adapted one); sibling ranges bump in lockstep in one coordinated
  changeset. The retirement assertion is
  [0100](./0100-publish-the-fold-retire-ts-archunit.md)'s — it cannot go green
  until the deprecation exists, so authoring it here would leave `validate` red.

## Out of scope

- **Rewriting ADR-010 verbatim as an eess ADR.** Its _consequence_ (contract
  surface) is adopted in Phase 6; its context (a second repo to govern) dies with
  the fold.
- **Back-porting eess's newer work into ts-archunit.** The fold is one-way.
- **`checkAll` / `asSeverity`** — ts-archunit's lazy-builder reporting; eess's
  `finishPreset` (ADR-008) supersedes (already recorded in 0081).
- **New engine features beyond the delta** — eess's own plans (0076 autofix,
  0081 checkAll) proceed after the fold, composed with the ported doctrine.
- **Untangling eess-ts's renamed aliases into ts-archunit names** — the aliases
  are adopted eess-ts surface; not a churn goal.
- **The "preset that constructs nothing" gap** (ts-archunit plan 0100, still
  open upstream) — two published presets (`agentGuardrails({ src })`,
  `dataLayerIsolation({ repositories })`) can construct zero rules at a minimal
  type-correct call and pass green. It is ADR-009's own unresolved edge; the fold
  **inherits** it (adopting the presets adopts the hole), so it is recorded here
  as a consequence of adoption and parked as its own plan, not fixed inside 0088
  — otherwise the fold's blast radius grows past the delta.
- **Warn-expiry / count-ceiling** (ts-archunit plan 0090, open upstream) — a
  deliberate deferral of the same kind: the idea to port, not the API to copy.
- **Publishing, deprecating, and archiving — plan 0100, not this plan.** The
  coordinated six-package release, `npm deprecate @nielspeter/ts-archunit`, the
  repo archival, and the retirement test that makes "retired" mechanically true
  are all acts that complete outside a merge. Split out so this plan closes when
  its code lands. The corpus migration (ts-archunit's plans/bugs/ADRs/docs) is
  [0090](./0090-adopt-ts-archunit-work-corpus.md); the archived repo stays its
  provenance source, so nothing is severed.
- **Family-wide fold consequences — plan 0089, not this plan.** Per-dialect
  standalone sufficiency (md / mermaid / gherkin / crossvalidate each re-export
  the kernel surface their own users touch, each with a re-export-completeness
  guard), and reconciling the sibling dogfood gates (`check:corpus` /
  `check:diagram` / `check:crossval` / `check:ledger`) once they inherit
  fail-closed from the folded kernel seam. 0088's sibling obligation is
  **preservation only**: they must keep compiling and their existing suites keep
  passing against the new kernel. All substantive sibling work is 0089's (the
  re-export surface) and 0101's (the gates going fail-closed).

## Success definition

- **Standalone sufficiency for eess-ts (binding invariant):** `@nielspeter/eess-ts`
  alone is a complete tool, exactly as `@nielspeter/ts-archunit` was — a user who
  installs only it runs the whole engine: builders, honest gate, `diagnose`,
  `orphanExclusions`, presets, baseline/diff, formatters, and the `eess-ts` CLI,
  with no second install and no awareness that `@nielspeter/eess` exists. The
  kernel stays a normal transitive `dependency` and is **fully re-exported
  through eess-ts's own index**. _(Per-dialect sufficiency for the siblings is
  plan 0089's scope — as a consequence of the same fold, deliberately split so
  each is closable.)_
- `@nielspeter/eess-ts` ships ts-archunit-0.59-equivalent engine semantics;
  `@nielspeter/eess` kernel carries the honest-gate seam **without losing its
  ts-morph-free, zero-runtime-dependency identity** (the engine-neutral
  `ArchProject` seam, ADR-007 Rule 1) and **without breaking the `RuleBuilder<T,
P>` generic** every builder in the family depends on.
- eess ADR-009 + ADR-010 accepted (the ported doctrine), indexed, enforced — and
  the missing twin ADR referenced by ts-archunit's ADR-010 is now real.
- `npm run validate` green end-to-end on the folded engine with the **staged**
  honest-gate (sibling gates pass unchanged; 0101 opts them in), nonvacuity
  intact.
- The vacuity matrix is built (Phase 4a) and proves every published check-constructor
  non-vacuous, with a `KNOWN_FAIL_OPEN` ratchet.
- The release is **authored** and breaking-changelogged (Phase 7): packages named,
  sibling kernel ranges bumped in lockstep in merged changesets, existing eess-ts
  rule fixtures pass **unchanged** on the folded engine. Running that release, and
  retiring `@nielspeter/ts-archunit`, is
  [0100](./0100-publish-the-fold-retire-ts-archunit.md) — this plan closes at
  merge, not at publish.
- The stale record (plan 0081's "ahead-of" claim, stale against its 0.17 snapshot)
  corrected.

## Progress ledger

- [ ] Phase 1 — delta classification matrix + ts-morph-import audit
- [ ] Phase 2 — port ADR-008 → eess ADR-009
- [ ] Phase 3 — port ADR-009 → eess ADR-010
- [ ] Phase 4 — fold the engine (kernel seam + `RuleBuilder<T,P>` + eess-ts)
- [ ] Phase 4a — build the vacuity matrix (exports-map enumeration + ratchet)
- [ ] Phase 5 — reconcile eess-ts dogfood gates (staged honest-gate, `validate` green)
- [ ] Phase 6 — extension-surface contract fixture
- [ ] Phase 7 — version the break: changesets + breaking changelogs + migration
      story + compat test, all authored and merged (the publish itself is
      [0100](./0100-publish-the-fold-retire-ts-archunit.md))
