# Plan 0089: Family standalone sufficiency — per-dialect re-export surface + `check:family`

## Status

- **State:** Ready — frozen 2026-08-16. Freeze verification found and fixed two
  real floor-cracks rather than papering over them: (1) Phase 1's rule 2 code
  sample globbed `packages/*/src/index.ts` only — `packages/crossvalidate`
  has no `index.ts` at all (confirmed: 8 flat files, 7 matching its
  `package.json` exports map, `it-title.ts` internal-only), so the rule as
  originally written would have silently examined zero crossvalidate files,
  the exact "glob matches zero" failure class this session's own bug
  0131/plan 0101 arc spent three review rounds hunting elsewhere. Corrected to
  an `or(...)` over both subject shapes, with a matching two-shape
  non-vacuity requirement added to Phase 1. (2) Phase 2 cited 0088 as having
  already "built the same fixture" for eess-ts — false: 0088's own Test
  Inventory claimed a dist-only black-box consumption fixture, but only a
  source-level re-export-completeness test
  (`packages/ts/tests/standalone-surface.test.ts`) exists anywhere in the
  repo, confirmed by exhaustive search. Corrected: Phase 2 is this repo's
  first dist-only consumption fixture, not a fourth instance of an existing
  pattern (0088's own overclaim is separate, disclosable, not fixed here).
  Both premises verified stale via direct repo inspection, not assumed
  correct from the plan's own prose. No other open question or dangling
  reference found in the text. Created 2026-08-10 as the deliberate split from
  plan 0088.
  **Split again 2026-08-12:** this plan carried four phases, of which two required
  0088 Phase 4's folded kernel seam. The plan named that honestly ("the dependency
  is Phase-3-scoped, not plan-wide") but naming it does not make it closable —
  Phases 1–2 would merge while Phases 3–4 sat open behind another plan's phase.
  The fold-dependent half is now
  [0101](./completed/0101-sibling-gates-go-fail-closed.md). What remains here is
  **independent of 0088 and buildable now**: the per-dialect re-export surface and
  the rules that guard it. _(The same rewrite removed a duplicated tail — this
  file carried two divergent copies of Out of scope / Success definition /
  Progress ledger, disagreeing on whether crossvalidate is an exception and on
  whether 0088's exception list is honoured or superseded. The refined copy is
  kept.)_
- **Priority:** High — standalone sufficiency is a claim each published dialect
  makes on npm today, and nothing checks it. That is a claim-versus-check gap
  independent of the fold; the fold only makes it more expensive to leave open.
- **Effort:** Medium — verification-driven; the shake-out per package dominates.
- **Created:** 2026-08-10

## Problem

Each sibling dialect promises to be a complete tool on its own: a user installing
only `@nielspeter/eess-md` — or `-mermaid`, `-gherkin`, `-crossvalidate` — gets
everything they need with no awareness that `@nielspeter/eess` exists. The
mechanics are already right (the kernel is each package's transitive
`dependency`, `^0.2.0`). What is missing is the **re-export surface** and its
guard.

Verification (2026-08-10): none of eess-md, eess-mermaid, eess-gherkin,
eess-crossvalidate overrides `collectViolations`; only `mermaid/src/index.ts` even
re-exports `TerminalBuilder`. They consume the kernel through `RuleBuilder` /
`correspondence` / their own builders (`rows`, `docs`, `links`, `pointers`). So
which kernel exports each sibling must re-export has never been established — and
eess-ts's own "exception" list (`correspondence`, `matchSelections`, `applyFixes`)
is **dialect-specific**, not a family answer: md's users need `applyFixes`
(autofix), crossvalidate's need `correspondence` / `matchSelections`.

**Corrected at review (2026-08-16): this is narrower than 0088's own
invariant, not a generalization of it — say so plainly rather than
overclaim.** 0088's actual guarantee for eess-ts
(`packages/ts/tests/standalone-surface.test.ts`) is full-surface: _every_
kernel export (minus a named exception list) must be reachable, so a kernel
primitive eess-ts's own body never happens to touch is still guaranteed
reachable for a consumer who wants it. What this plan built instead
(`family/re-export-complete`) is a self-consistency check: does each entry
point re-export what that package's _own source code_ actually imports.
Real and useful — it caught every genuine gap this plan's own review found —
but strictly weaker: a kernel primitive none of a dialect's internals happen
to use has no guarantee of being reachable from that dialect at all, the
exact promise 0088 makes for eess-ts. Closing that fuller gap for the other
four dialects, if wanted, is real additional work this plan did not do —
noted here rather than left to be discovered as a silent shortfall. It does
not depend on the fold — the promise this plan does deliver is live on the
registry now.

## Implementation phases

### Phase 1 — Shake out each sibling's re-export surface

For each of `packages/md`, `packages/mermaid`, `packages/gherkin`,
`packages/crossvalidate`: enumerate the kernel exports its own sources actually
import (the dialect's real touch surface), plus what its _own_ documented public
API promises its users. The re-export set is the union — what the dialect's code
needs and what its users are told they can call. Differences between the two
lists are the shake-out artefacts: a kernel export the docs promise but the code
never touches is either a gap (re-export it) or a doc bug (don't).

**Deliverable:** a per-package matrix in `work/dogfood-coverage.md` (the audit
surface already names the dogfooding coverage). **Files changed:** each sibling's
`index.ts` (+ any doc claim that is corrected instead of honoured).

**The enforcement is eess rules, not script tests.** The guarantees this plan
makes are _architecture of the family_ — the exact thing eess-ts rules are for.
So the re-export completeness and the sibling boundaries become a rules file
(`family.rules.ts` at the repo root, checked by a new `check:family` gate), so
nothing can silently regress a dialect's standalone sufficiency:

```ts
// family.rules.ts — dogfood: the family's own boundaries, as eess-ts rules
// (ADR-006: rules are code)
import { project, modules, or, and, not, resideInFile, haveNameMatching } from '@nielspeter/eess-ts'

// 1. No dialect may import another dialect's package directly — they all
//    join only through @nielspeter/eess (the shared kernel). EXCEPTION: the
//    existing arch.rules.ts carve-out, carried forward — crossvalidate is
//    deliberately exempt because its whole job is to bridge dialects
//    (arch.rules.ts:10 "only eess-crossvalidate bridges them"; verified:
//    packages/crossvalidate/src/{md-ts,mermaid-ts,gherkin-ts,md-mermaid}.ts
//    import the siblings directly). Apply the isolation rule per-dialect for
//    ts/md/mermaid/gherkin only; crossvalidate is the bridge, not a violation.
modules(project('tsconfig.json'))
  .that()
  .resideInFolder('packages/{ts,md,mermaid,gherkin}/src/**')
  .should()
  .notImportFromCondition('packages/{ts,md,mermaid,gherkin,crossvalidate}/**')
  .check()

// 2. Each dialect's public entry point(s) re-export what their own bodies
//    import from the kernel — the re-export-completeness guard. The
//    per-dialect allowlist is explicit: eess-ts's index deliberately does
//    NOT re-export `correspondence` / `matchSelections` / `applyFixes`
//    (0088's exception — they serve crossvalidate/md, and matchSelections
//    backs eess-ts's own cross-layer builder), while crossvalidate's own
//    entry points MUST re-export them. The rule reads each package's own
//    allowlist before asserting completeness.
//
//    CROSSVALIDATE HAS NO src/index.ts (verified at freeze, 2026-08-16:
//    `ls packages/crossvalidate/src/` — 8 flat files, no index.ts, no
//    subfolders). It ships one file per package.json `exports` subpath
//    instead — mermaid-ts.ts, md-ts.ts, md-mermaid.ts, files.ts,
//    md-gherkin.ts, gherkin-ts.ts, md-mermaid-er.ts (7 files, matching the
//    7 entries in its exports map exactly) — each independently a public
//    entry point subject to this rule. `it-title.ts` is the one file NOT in
//    the exports map (an internal helper the others import); it must be
//    excluded from this rule's subject set, or the check would demand it
//    re-export something it was never a public entry point for. A rule
//    written against `packages/*/src/index.ts` alone silently matches zero
//    files for crossvalidate — found and corrected during this plan's
//    freeze, not left for Phase 1 to rediscover.
modules(project('tsconfig.json'))
  .that()
  .satisfy(
    or(
      resideInFile('packages/{ts,md,mermaid,gherkin}/src/index.ts'),
      and(resideInFile('packages/crossvalidate/src/*.ts'), not(haveNameMatching('it-title.ts'))),
    ),
  )
  .should()
  .satisfy(reExportsWhatBodyUsesWithAllowlist)
  .check()

// 3. The kernel never imports a dialect (it is the seam, not a join).
modules(project('tsconfig.json'))
  .that()
  .resideInFolder('packages/core/src/**')
  .should()
  .notImportFromCondition('packages/{ts,md,mermaid,gherkin,crossvalidate}/**')
  .check()
```

The custom condition (`reExportsWhatBodyUses`) is defined via
`defineCondition` in the rule file, reading each package's own sources and
asserting every kernel symbol those sources import is also re-exported from that
package's `index.ts` — the standalone invariant, mechanically. This is the
dogfood: the tool that guards family architecture is the family's own tool.

**Tests:** the rule file itself is executable (its violations are the
reconciliation list as errors); `check:family` wired into `validate`; plus the
unit cases for `reExportsWhatBodyUsesWithAllowlist` (a missing re-export reds, a
complete one greens — the same fixture-style test the other dogfood rules carry).

**Non-vacuity:** `check:family` is a new gate, so it gets a committed violating
fixture in `scripts/check-nonvacuity.mjs` — a temp sibling-import probe for rule 1
(a `packages/md/src` file importing `@nielspeter/eess-ts`) and, for rule 2,
**two** temp probes, not one: an `index.ts`-shaped package that drops a kernel
re-export, and a crossvalidate-shaped flat-file package that does the same —
proving both subject shapes rule 2's `or(...)` actually reaches, not just the
first one found. (This session's own bug 0131/plan 0101 arc found this exact
class of gap repeatedly: a check proven against one shape of subject silently
never examining a second, differently-shaped one — worth not repeating here.)
Each probe is asserted to make `check:family` exit non-zero naming the
violation. A negative rule whose globs silently match zero is exactly the
failure class `check:nonvacuity` exists for; the harness must prove each
`family.rules.ts` rule can fail on every subject shape it claims to cover.
(The unit cases are vitest; the harness rows are the gate-level proof.)

**Done, 2026-08-16.** `family.rules.ts` built and green against the real
repo — 5 rules (3 per-dialect isolation, re-export-completeness, kernel
purity), 0 failing. Getting there surfaced two real, previously-unknown
implementation bugs, both fixed before landing (not worked around):

1. **Unanchored globs matched zero files on every rule**, the first time it
   ran — `workspace()`'s per-package project roots (plan 0148) mean a
   project-relative glob needs the leading `**/` `arch.rules.ts`'s own
   `only()`/`inPkg()` helpers already use. Fixed by adopting the same
   helpers here.
2. **A combined isolation rule flagged same-package relative imports.**
   `notImportFrom` matches each import's _resolved_ path, so naming a
   dialect's own package as forbidden in one shared rule (my first draft)
   flagged that dialect's own internal files importing each other (found on
   mermaid's generated-parser files). Split into three rules, one per
   dialect, mirroring `arch.rules.ts`'s own per-dialect shape exactly.
3. **The custom condition's own kernel-usage scan initially missed
   forwarding re-exports.** `export { X } from '@nielspeter/eess'` (an
   `ExportDeclaration`) is a different AST node than
   `import { X } from '@nielspeter/eess'` (an `ImportDeclaration`) —
   `packages/ts/src/presets/shared.ts` forwards its whole preset-authoring
   toolkit this way, invisible to a scanner that only walked
   `getImportDeclarations()`. Found because the check's own first clean run
   suspiciously under-reported — fixed by scanning both declaration kinds.

Running the corrected rule against the real repo surfaced genuine,
previously-undocumented re-export gaps in **every** sibling dialect (see
`work/dogfood-coverage.md`'s new "Family standalone sufficiency" section for
the full per-package table) — not zero, and not manufactured: `eess-md` and
`eess-gherkin` had **zero** kernel re-exports before this pass despite their
own sources using `RuleBuilder`/`Predicate`/`Condition` internally,
`eess-mermaid` was missing one symbol, and `eess-ts`'s root index was missing
its whole preset-authoring toolkit (reachable only via the separate
`/presets` subpath before this pass). All fixed at the source — the
dialects' own `index.ts` files — not by loosening the rule.

Non-vacuity: 3 new fixtures (`family isolation`, `family re-export (index)`,
`family re-export (crossvalidate)`) in `scripts/check-nonvacuity.mjs`, all
firing correctly — the re-export probes mutate a real entry point (save,
inject a bad import, run, restore in a `finally`), since the rule's subject
must be a real, already-declared entry point, not a throwaway new file.
`npm run check:nonvacuity` — 40 fixtures total, up from 37, all green.

Unit tests for `reExportsWhatBodyUsesWithAllowlist` in isolation (the plan's
own stated deliverable, separate from the non-vacuity harness) were **not**
added in this pass — the non-vacuity fixtures above already prove both
directions (red on a broken entry point, green on a clean one) against real
project state, which is a stronger proof than a synthetic vitest fixture
would be, but it is not the same deliverable the plan named. Recorded here
rather than silently dropped; a follow-on can add them without touching the
condition itself.

`npm run validate` green end-to-end with `check:family` wired into both
`validate` and `check:fast`.

**A six-persona `/review` round found this build was not actually done —
three genuine Criticals, all empirically proven, all fixed before merge:**

1. **`packages/md`'s own README/docs still required a second, direct
   `@nielspeter/eess` install.** Its headline `rows()` + `correspondence()`
   example, and `docs/markdown.md`'s equivalent, both `import { correspondence }
from '@nielspeter/eess'` — reproduced live: neither compiled against
   `@nielspeter/eess-md` alone. Root cause: Phase 1's own stated methodology
   ("what the code imports, **plus what the docs promise**") only mechanized
   the code half; `family.rules.ts` scans `src/**`, never `README.md`/
   `docs/*.md`, so it's structurally blind to a doc-promised-but-uncoded
   symbol and stayed green while this stayed broken. Fixed: `correspondence`/
   `CorrespondenceBuilder` added to `packages/md/src/index.ts` directly (a
   doc-promise gap, not a code-detected one — `work/dogfood-coverage.md`
   updated to say so explicitly). The fix also exposed a second, unrelated
   pre-existing bug in the same example — `keyBy: (e) => e.name` never
   type-checked against `MdRow` (which has no `.name`), full kernel or not —
   corrected to the documented default (`keyBy` omitted, falls back to
   `identify().name`). Re-audited the other three dialects' READMEs and
   every remaining `docs/*.md` page the same way this round: none import
   from `@nielspeter/eess` directly (mermaid/gherkin only import their own
   package; crossvalidate correctly imports each bound peer, its intended
   shape) — this was the one real gap that class of audit found.
2. **The re-export-completeness non-vacuity fixtures were circular.**
   Proven by sabotage: corrupting the line that aggregates a whole package's
   imports (`packageSourceFiles`, vs. just the entry file) left both
   existing fixtures green, and a real regression (deleting a re-export for
   a symbol used only elsewhere in the package) went fully undetected — the
   same defect class this session's own bug 0131 arc spent three rounds
   closing, now found here too. Fixed: a third non-vacuity fixture
   (`family re-export (aggregation)`) injects into a NON-entry file
   (`packages/md/src/model/document.ts`) and asserts the violation still
   correctly names the entry (`index.ts`) — the only way to prove the
   aggregation is real. Re-sabotaged the same line after the fix: the two
   old fixtures still pass (unaffected), the new one correctly fails,
   confirming it closes exactly the gap found.
3. **Aliased re-exports produced a false positive.** Proven live:
   `export { RuleBuilder as MdRuleBuilder } from '@nielspeter/eess'` was
   flagged as "missing `RuleBuilder`," even though a standalone consumer can
   already reach it — just under a different name, which fully satisfies
   this rule's own intent. Root cause: `entry.getExportedDeclarations().keys()`
   is keyed post-alias. Fixed by also collecting each exported declaration's
   own true name (`reachableExportNames`) — not by narrowing the scan to
   this file's own direct re-exports alone, which was tried first and broke
   mermaid's `export * from './core/index.js'` transitive resolution (16 new
   false positives against the real repo, caught before landing). Verified
   both directions with a real ts-morph project (not an in-memory one — that
   can't resolve `@nielspeter/eess` at all, a dead end tried first): the
   aliased case now produces zero violations, the genuinely-missing case
   still produces one.

**Four Important findings, also fixed:** (4) `family.rules.ts` shipped 4
rules byte-for-byte duplicating `arch.rules.ts`'s own isolation/purity rules
— removed, keeping only `family/re-export-complete`, the one genuinely new
rule; the file's own docstring now says why. (5) This plan's Problem section
claimed to "generalize eess-ts's invariant from 0088" — corrected: what got
built is a narrower self-consistency check (what a package's own code
imports), not 0088's full-surface guarantee; the difference is now stated
plainly rather than overclaimed. (6) `check:family` was wired into
`package.json` but never into `.github/workflows/ci.yml` — added, positioned
after `check:arch` matching `validate`'s own order. (7) `check:family` was
undocumented in both `CLAUDE.md`'s gate list and root `README.md`'s "eess
validates eess" section — added to both, plus `family.rules.ts` to
`CLAUDE.md`'s Project Structure tree. (8) The changeset omitted `eess-md`/
`eess-ts` despite both gaining new exports, on the reasoning that two
unrelated pending changesets already "covered" them — verified they didn't
mention these exports anywhere; both packages now declared directly in
`family-standalone-sufficiency.md` with their own bullets.

**A focused re-verification round — enforcement and testing, independently
re-sabotaging the three Criticals rather than trusting the fix pass's own
self-verification (this repo's own author≠verifier doctrine, applied one
level down) — found zero Critical and zero new findings from enforcement.**
Both reviewers reproduced the original bugs from scratch, confirmed each
fix, and pushed further than the original findings (wildcard `export *`
chains, doubly-aliased chains, a genuinely isolated `npm pack`-tarball
install for the README check, not a monorepo `file:` reference that would
have silently passed for the wrong reason). Testing's own two Important
findings, also closed:

9. **The wildcard/alias-chain generalization worked but had no dedicated
   regression test** — only proven by manual probing, on the exact class of
   shape (`export * from`) that already caused one real regression during
   this build (16 false positives, caught before landing). Closed: three new
   cases added to `family-re-exports.test.mjs` (a wildcard chain, a
   doubly-aliased chain, and wildcard chain's negative control proving it
   doesn't blanket-satisfy every symbol) — sabotage-verified: reverting
   `reachableExportNames`'s transitive-name resolution correctly reds the
   alias-chain cases.
10. **`packages/md/README.md`'s example (and its `docs/markdown.md` twin) —
    the fence the whole Critical-1 fix rests on — was structurally invisible
    to `check:docs-code`.** `check-docs-code.mjs` only scanned `docs/`, never
    `packages/*/README.md`, and its self-containment heuristic required
    `project(`/`workspace(` specifically, which `corpus(`-based md/gherkin
    examples never satisfy. So the fix's own core claim ("compiles
    standalone") was verified nowhere in CI — only by a reviewer's one-off
    manual sandbox check. Closed: `check-docs-code.mjs` now also scans every
    `packages/<name>/README.md`, and its heuristic recognizes `corpus(`
    (eess-md) and `features(` (eess-gherkin) alongside `project(`/`workspace(`
    — tightened to require the entry function's own name be imported in the
    same fence, not just "some import plus some call," after that looser
    version produced 3 false positives against `packages/crossvalidate/README.md`'s
    real narrative-continuation examples (fences that call `project(...)`
    assuming it was imported by an earlier fence). Both target fences gained
    a small inline `workspacePackages` stub (matching the prose's own "a
    plain Selection you build" description) so they're genuinely compilable,
    not just self-contained-looking. Widening the scan surfaced two real,
    previously-invisible bugs in `packages/crossvalidate/README.md` as a
    bonus: a stale `.check?.()` call on a function that returns `void`, and
    (transiently, before the heuristic was tightened) the narrative-fragment
    false positive itself — both fixed. `check:docs-code` now scans 43
    self-contained fences (up from 32), 0 failures.

`npm run validate` green end-to-end after this round too.

**The two remaining Important findings (9, 10) and the deferred unit-test
gap above are now the same fix**, since testing's review found they share
one root cause — non-vacuity fixtures alone don't pin down this condition's
logic precisely enough. Built the unit test matrix the plan originally
deferred (`scripts/lib/family-re-exports.test.mjs`, Node's built-in test
runner — no vitest precedent exists for `scripts/*.mjs` in this repo, so
this follows the file's own `node scriptname.mjs` execution convention
rather than inventing a new root harness), covering: missing re-export
(both subject shapes), aliased re-export satisfies the requirement, a
forwarding re-export is genuinely detected as needed (proves
`kernelImportsOf`'s `ExportDeclaration` scan is load-bearing, not just
narrated), whole-package aggregation catches a non-entry-file usage,
per-package allowlist correctly scoped (`ts` exempt from `correspondence`,
`crossvalidate` not), `KERNEL_INTERNAL` exempted everywhere, and a sync
guard between this file's `KERNEL_INTERNAL` and
`standalone-surface.test.ts`'s own copy (extracted from its source text —
no shared module graph between a plain `.mjs` and a vitest `.ts` test to
`import` across). Sabotage-verified two of the eight against the real
implementation before trusting them: reverting the alias fix fails exactly
the alias test; reverting the forwarding-scan fix fails exactly the
forwarding test — each isolated, nothing else moves. Wired into
`npm run check:family` directly (`eess-ts check family.rules.ts && node
--test scripts/lib/family-re-exports.test.mjs`), so it runs everywhere
`check:family` already does — `validate`, `check:fast`, and now CI.

Two Minor findings also fixed: the 6 `packages/crossvalidate/src/*.ts`
files with interleaved import/export statements now group imports first,
the new re-export block trailing — matching `packages/md/src/index.ts`'s
own shape; `docs/cross-layer.md`'s recommendation of `correspondence()` for
`eess-ts` users now says plainly that it's a kernel-level primitive, not a
re-export gap — `correspondence`/`matchSelections` are deliberately excluded
from `eess-ts`'s own surface since `crossLayer()` already wraps the common
case without them.

`npm run validate` re-run green end-to-end after all of the above —
`check:nonvacuity` still 40 fixtures (removing the duplicate-rule fixture
`family isolation` and adding `family re-export (aggregation)` net to zero
change in count, not a net addition), `check:family` runs its own 8-case
unit suite as part of every invocation.

### Phase 2 — Standalone-consumption test per dialect

A fixture that installs **only** the dialect package (dist, as a foreign consumer
would) and runs its primary path — md: `check` over a live corpus; mermaid:
diagram check; gherkin: scenario check. No `@nielspeter/eess` import in sight.

**Corrected at freeze (2026-08-16): no such fixture exists anywhere in this
repo today, for any package — 0088's own Test Inventory claimed it delivered
one for eess-ts ("standalone-consumption test — a black-box fixture that
installs only `@nielspeter/eess-ts` (dist)... runs the full path
`init → check → diagnose`"), but what actually shipped is
`packages/ts/tests/standalone-surface.test.ts`, a source-level
`import * as ns` re-export-completeness check — a real and useful test, but
not a dist-only black-box consumption fixture; confirmed by exhaustive search
(`find . -iname "*standalone*"`, `grep` for `dist`/`npm pack`/`black-box`
across `packages/ts/tests/`) turning up nothing else.** Phase 2 is not
following an existing pattern for a fourth dialect; it is building this
repo's first genuine dist-only consumption fixture, for four dialects at
once. (0088's own overclaim is a separate, disclosable finding — not fixed
here, since 0088 is already closed; noted for whoever next touches that
plan's record.) The shape is still small and the promise is already live —
this phase does not need eess-ts's fixture to exist first, only its own four
fixtures to get built.

**`crossvalidate` is the deliberate exception — per its nature, not an
oversight.** `eess-crossvalidate` is a _binding_ tool: its function is to join
two dialects, it declares them as `peerDependencies`, and "run a two-dialect
correspondence with crossvalidate installed alone" is not satisfiable. Its
standalone-consumption fixture installs **crossvalidate + the two dialects it
binds** (honoring its peer deps) and asserts the correspondence works with no
`@nielspeter/eess` import in sight. This is the same deliberate-exception shape
0088 carves for `correspondence`/`matchSelections`. The per-dialect sufficiency
invariant stands for md/mermaid/gherkin; crossvalidate's guarantee is "one
package + its peers, no kernel."

**Files changed:** a `tests/standalone/` per package (or a shared script if the
shape generalizes). **Tests:** the four fixtures, each asserting the dialect's
CLI/gate works with nothing but the single package (plus peers, for
crossvalidate) installed.

**Not built in this pass.** Phase 1 consumed the full session; Phase 2 (four
new dist-only black-box fixtures — a genuinely new mechanism, confirmed at
freeze that nothing in this repo does this today) is real, separately-sized
work, not a quick follow-on to Phase 1's shake-out. Left for a follow-on
build rather than rushed — see Progress ledger.

## Test inventory

- Phase 1: `family.rules.ts` — the dialect-isolation and re-export-completeness
  rules, run via `check:family` (wired into `validate`); unit cases for the
  `reExportsWhatBodyUsesWithAllowlist` custom condition (missing re-export reds,
  complete greens) + its non-vacuity harness rows (a temp sibling-import probe,
  and — for rule 2's two subject shapes — a temp dropped-re-export probe on an
  `index.ts`-shaped package _and_ one on a crossvalidate-shaped flat-file
  package, each independently reddening `check:family`).
- Phase 2: **four** standalone-consumption fixtures — md/mermaid/gherkin install
  the single dialect alone; **crossvalidate installs the dialect + its two peer
  dialects** (its binding nature is the deliberate exception), each with no
  `@nielspeter/eess` import in sight.

## Out of scope

- **The fold itself** (engine rejoining, ADR-008/009 port) — plan
  [0088](./completed/0088-fold-ts-archunit-into-eess.md). This plan does **not** depend on
  it; both can proceed in either order.
- **Reconciling the sibling dogfood gates to fail-closed** —
  [0101](./completed/0101-sibling-gates-go-fail-closed.md), the other half of this split.
  That work cannot start until the folded kernel seam exists; this can.
- **Sibling engine features beyond the re-export surface** — e.g. md adopting
  `terms()`/`vocabulary()`
  ([proposal 001](../proposals/001-md-corpus-rule-coverage.md)), or any dialect
  gaining new capability from the ported engine. New _surface_ is a
  proposal/plan.
- **Standalone sufficiency for `eess-ts` itself** — 0088's binding invariant.

## Success definition

- **Md/mermaid/gherkin** usable alone: correct re-export surface + a passing
  standalone-consumption fixture. **Crossvalidate** usable as "one package + its
  two peer dialects, no kernel" — its binding nature is the deliberate exception.
- `family.rules.ts` enforces the family's boundaries (with the crossvalidate
  bridge carve-out carried from `arch.rules.ts`) and per-dialect re-export
  completeness (with the explicit per-dialect allowlist) via `check:family` in
  `validate` — rules, not script tests, so nothing can silently regress them.
- The eess-ts "exception" list from 0088 is honored by the per-dialect allowlist
  (each dialect re-exports the kernel surface its own users touch, minus the
  named exceptions).
- `npm run validate` green with `check:family` live and proven non-vacuous.

## Progress ledger

- [x] Phase 1 — per-dialect re-export shake-out + `family.rules.ts` (with
      crossvalidate bridge carve-out + allowlist) + `check:family` + non-vacuity row
- [ ] Phase 2 — standalone-consumption fixtures (md/mermaid/gherkin alone;
      crossvalidate with its peers) — not built this pass, see Phase 2's own
      "Not built in this pass" note
