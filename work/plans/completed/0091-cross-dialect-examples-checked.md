# Plan 0091: The family, checked — dogfood eess-crossvalidate as executing examples

## Status

- **State:** Done — built and merged 2026-08-14. Frozen 2026-08-12 after a
  six-persona review and a targeted re-review of the non-vacuity section;
  re-verified 2026-08-14 after plan 0096 landed (a floor drift check found
  `md-ts`'s stats export had already shipped independently and two
  `check-crossval.mjs` line citations had shifted — both corrected in place, no
  re-review needed since neither changed scope or approach). Born from a dogfood
  irony: the monorepo's own crossvalidate consumption was audited and found
  wanting on every side. The package exists to bind dialects together; this repo
  describes that but never demonstrates it. No prerequisite plan; it stood on its
  own. Deferred: none — the two follow-ups the plan itself names (the five legacy
  `examples/*.test.ts` staying typecheck-only; the `md-mermaid-er`/`files`
  bindings having no example) are named in Out of Scope below, not new open items
  this plan owes a home.
- **Priority:** Medium — a dogfood gap, in the same class as 0089 (family
  reconciliation of the `crossval` gate). Not a blocker; nothing else gates on it.
- **Effort:** Small — roughly a box of small fixtures, four example test files, and
  a fold config. The execution wiring (Phase 3) and the honest non-vacuity
  mechanisms (Phase 2) are the load-bearing parts — a review surfaced that the
  draft's first non-vacuity inventory assumed APIs that don't exist; that is fixed
  here. (A 2026-08-14 freeze-time drift check found the `md-ts` stats export the
  draft assumed still needed had, in fact, already shipped independently by then —
  Effort trimmed from Small–Medium to Small accordingly; see Phase 2.)
- **Created:** 2026-08-12
- **Build (2026-08-14):** All three phases landed as designed, with one real
  deviation from the plan text: Phase 3's literal script,
  `vitest run --dir examples`, does not pick up `examples/vitest.config.ts` —
  Vitest resolves config from `--root`, not `--dir` — so it silently ran all nine
  `examples/*.test.ts` files unfiltered instead of the intended four. Fixed by
  using `--root examples` instead, verified by running both ways: `--dir`
  produced 5 failed / 5 passed (the five legacy examples failing exactly as
  Phase 3 predicts, proving the fold is load-bearing), `--root` produces the
  intended 4 passed / 0 failed. `check:examples` now runs
  `tsc --noEmit -p examples/tsconfig.json && vitest run --root examples`.
  `mermaid-ts`'s diagram→code fixture uses a fifth `.mmd` (`ghost.mmd`: the
  `complete.mmd` classes plus one, `GhostClass`, with no code counterpart) rather
  than a second use of `drift.mmd` — `drift.mmd` already proves the code→diagram
  direction alone, since `diagramMatchesCode`'s own default `completeness` is
  already `'both'` (confirmed reading `packages/crossvalidate/src/mermaid-ts.ts`).

## Problem

`@nielspeter/eess-crossvalidate` ships **seven** pair-bindings
(`mermaid-ts` · `md-ts` · `md-gherkin` · `gherkin-ts` · `md-mermaid` ·
`md-mermaid-er` · `files`); its README documents four as the adoption surface —
Mermaid↔TS, Markdown↔TS, Markdown↔Gherkin, Gherkin↔TS. Each section carries the
central promise: _drift in either artifact fails the build with an actionable
message._

This monorepo shows three absences, all on the same theme — **nothing proves the
promise**:

1. **`examples/` has zero crossvalidate.** The folder is single-dialect eess-ts
   only (`archunit-inspired`, `clean-architecture`, `custom-rules`, `rest-api`,
   `type-safety`). Grep across it for `crossvalidate`: no hits. The README's four
   snippets have no living counterpart in-repo.
2. **`check:crossval` mounts 5 of the 7 bridges** — `mermaid-ts`, `md-ts`,
   `gherkin-ts`, and (as of plan 0096) `md↔gherkin` and `md↔mermaid`. It never runs
   `md↔mermaid-er` (out of scope indefinitely — no `erDiagram` in this corpus).
   Corrected by a 2026-08-14 freeze-time drift check: this item originally read
   "mounts 3 of the 7 bridges... never runs `md↔gherkin`, `md↔mermaid`"; plan 0096
   closed that gap on the gate side in the interim. It doesn't change this plan's
   scope — the gate and the adopter-facing `examples/` below are deliberately
   separate (see Out of Scope) — but the motivating claim needed correcting.
3. **No `package.json` declares the dependency.** The root consumes it purely by
   npm-workspaces hoisting (a `file:` symlink from the workspace). From a fresh
   `npm ci`, `check:crossval` runs on hope, not a declared edge.

And a fourth, the one that makes "checked examples" mean something:

4. **`examples/` is typecheck-only.** `check:examples` is `tsc -p examples/tsconfig.json`
   and nothing more; `npm run test` is `--workspaces --if-present`, so root and
   `examples/` are excluded. The five `.test.ts` files are named as tests but
   never **executed**. They are green-but-unrun — the exact "silent no-op" this
   repo's non-vacuity discipline exists to forbid.

So an adopting team reads a README full of exact, runnable snippets and a promise
of a failing build, and the only code that lives here demonstrates none of it —
nor does any of it run.

## Approach

- **Placement: `examples/`** — adopter-facing, per the ask. It complements
  `scripts/check-crossval.mjs` rather than duplicating it: the script is the
  _dogfood gate_ (binds the repo's own live artifacts, exits non-zero); the
  examples are the _checked demo_ (self-contained fixtures showing green **and**
  red **and** non-vacuity). Both are needed.
- **The new examples must execute — the five legacy ones explicitly don't.**
  A `.test.ts` that only `tsc`s proves nothing — the assertions never run. The
  plan wires vitest over the four new `cross-dialect.*.test.ts` files and folds
  execution into `validate` (via `check:examples`). But the audit showed the five
  existing eess-ts examples fail _deterministically_ under vitest (each resolves
  `project('tsconfig.json')` against a repo root with no `tsconfig.json`), so the
  fold is **pinned to `cross-dialect.*.test.ts`** and the five are explicitly
  deferred to a follow-up rather than made to run here. Executing them is a
  five-file port with its own fixtures and effort; bolting it on would rewrite
  this plan's scope.
- **No new ADR.** The design decisions here are placement and execution, not
  architecture. Two existing ADRs already govern how examples must be written:
  **ADR-007** (isolate the AST engine behind the public API — no ts-morph in the
  examples) and **ADR-008** (caller owns reporting — the examples assert via the
  thrown `ArchRuleError`, never by reaching into reporters). The plan links these
  rather than burying a decision in prose.

## Phased implementation

### Phase 1 — declare the dependencies (the phantom, killed)

Add root devDependencies for **all six** internal packages the examples import —
not just crossvalidate. The examples also import `@nielspeter/eess-md`,
`@nielspeter/eess-gherkin`, `@nielspeter/eess-ts`, `@nielspeter/eess-mermaid`,
and `@nielspeter/eess` (for `ArchRuleError`); today every one of them resolves
by npm-workspaces hoisting alone. Declaring only crossvalidate would be this
plan's own "declared edge, not hope" standard applied to one import of six.

Each is scoped with the **`workspace:*` protocol** — not a bare version — so it
always links the local copy and can never silently resolve a published registry
version:

```json
"devDependencies": {
  "@nielspeter/eess": "workspace:*",
  "@nielspeter/eess-ts": "workspace:*",
  "@nielspeter/eess-md": "workspace:*",
  "@nielspeter/eess-mermaid": "workspace:*",
  "@nielspeter/eess-gherkin": "workspace:*",
  "@nielspeter/eess-crossvalidate": "workspace:*"
}
```

The `workspace:*` range is the load-bearing choice, and a bare `"0.1.2"` is not
acceptable: the six packages are independently versioned by changesets, while the
root is `private` and outside `workspaces: ["packages/*"]`, so `version-packages`
never rewrites root deps. A fixed pin would go stale at the next bump with no
release-path mechanism to fix it — exactly the lagging-range drift the repo's own
integrity gate exists to forbid. `workspace:*` sidesteps that entirely.

Phase 1 also closes the guard gap the audit found. `scripts/check-workspace-integrity.mjs`
`WORKSPACE_PKGS` lists only `@nielspeter/eess`, `-ts`, `-mermaid`; `eess-crossvalidate`
(and `-md`, `-gherkin`) have **no local-linking check**, so a registry-installed
copy would sail through `check:integrity`. Add the missing packages to
`WORKSPACE_PKGS`, and correct the stale "npm has no `workspace:` protocol" comment
(lines 15–17) — npm is 11.x and supports it — so it stops blessing the very
bare-pin drift it exists to forbid.

### Phase 2 — the four checked examples + fixtures

One example per README binding, each carrying **green + red + non-vacuity**.
Each example's shape mirrors the package's own test
(`packages/crossvalidate/tests/*.test.ts`) and its fixture gardens — that is the
proven house form, brought into the adopter-facing folder.

**`examples/cross-dialect.md-gherkin.test.ts`** — the fully-absent bind, shown in
full because it sets the pattern:

```ts
import { it, expect } from 'vitest'
import { corpus } from '@nielspeter/eess-md'
import { features } from '@nielspeter/eess-gherkin'
import {
  scenarioCitationsResolve,
  scenarioCitationStats,
} from '@nielspeter/eess-crossvalidate/md-gherkin'
import { ArchRuleError } from '@nielspeter/eess'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/gherkin')
const c = (roots: string[]) => corpus({ roots, cwd: root })
const set = () => features({ cwd: root, roots: ['features/**'] })
const violations = (fn: () => void) => {
  try {
    fn()
  } catch (e) {
    if (e instanceof ArchRuleError) return e.violations
    throw e
  }
  return []
}

it('green — cited scenario resolves', () =>
  expect(() => scenarioCitationsResolve(c(['docs/good.md']), set())).not.toThrow())

it('non-vacuous — the green doc really cites a scenario', () =>
  expect(scenarioCitationStats(c(['docs/good.md']), set()).citations).toBeGreaterThan(0))

it('red — a cited scenario that does not exist fails the build', () => {
  const v = violations(() => scenarioCitationsResolve(c(['docs/bad-missing.md']), set()))
  expect(v).toHaveLength(1)
  expect(v[0]?.message).toMatch(/no such scenario/)
})
```

Fixtures under `examples/fixtures/gherkin/` mirror
`packages/crossvalidate/tests/fixtures/gherkin-citations/`: a `features/` set
(a `job-management.feature` with a `View job schedules` scenario), a `docs/good.md`
carrying the frozen citation convention on one line
(`` `job-management.feature` · 'View job schedules' ``), and a `docs/bad-missing.md`
citing a scenario that isn't there. The red case is what makes "the build fails
with an actionable message" demonstrable rather than asserted.

The other three follow the same three-part shape with their own API + fixture
needs, each mirroring its package test:

- **`examples/cross-dialect.md-ts.test.ts`** — `adrCitationsResolve(corpus, project, { dir })`.
  Fixture: an ADR-style `.md` with an Enforcement table citing an
  `it('…')` title; a bad twin citing a title that doesn't exist in the test AST.
  Mirrors `packages/crossvalidate/tests/md-ts.test.ts`. The `project()` tsconfig must include the test
  file (the ADR-gate lesson, `scripts/check-crossval.mjs:74-76` — corrected from
  `:54–62` by a 2026-08-14 drift check; plan 0096 grew this file and the original
  citation had shifted onto an unrelated line). `adrCitationsResolve` ends in
  `.beComplete({ direction: 'left-to-right' })`, so a fixture whose citation row
  was deleted is _green-on-empty_, not red, unless the example also asserts a
  count. **`adrCitationStats` already exists** on `packages/crossvalidate/src/md-ts.ts`
  for exactly that (added by bug 0104, the same day this plan was frozen — not new
  work here; an earlier draft claimed it as new public surface this plan adds,
  which the same drift check found stale and corrected). The example imports it
  and asserts its count, same shape as `md-gherkin`'s `scenarioCitationStats` and
  `gherkin-ts`'s `scenarioTestStats`.
- **`examples/cross-dialect.gherkin-ts.test.ts`** — `scenarioTestsResolve(project, features)`
  - `scenarioTestStats`. Green over a `.feature` + an `it('feature › scenario')`;
    red on a dangling path / ambiguous suffix / missing scenario. Mirrors
    `packages/crossvalidate/tests/gherkin-ts.test.ts`.
- **`examples/cross-dialect.mermaid-ts.test.ts`** — `diagramMatchesCode(diagram, project,
{ scope, completeness })`, asserting an `ArchRuleError` on a divergent `.mmd`.
  Mirrors `packages/crossvalidate/tests/mermaid-ts.test.ts`. **Two red directions are required**, not one:
  `drift.mmd` (a code class the diagram lacks) guards code→diagram only, and a
  single-direction `left-to-right` implementation would pass both that and green.
  A second fixture — a diagram class with **no** code counterpart — guards the
  diagram→code direction, so the example proves both sides mount. Note this goes
  **beyond** the package test, which guards only code→diagram: its third case
  (`packages/crossvalidate/tests/mermaid-ts.test.ts:32-38`) literally proves a `left-to-right`
  implementation passes `drift.mmd` — the exact vacuity. The example adds the
  diagram→code red the package test lacks. The `scope` glob must be pinned to the
  fixture's own `src` so the `drift.mmd` red actually mounts — if `scope` matched
  nothing on the TS side, that red would silently go green.

All example files use **only the public APIs** (ADR-007): imports from
`@nielspeter/eess-crossvalidate/*`, `@nielspeter/eess-md`, `@nielspeter/eess-gherkin`,
`@nielspeter/eess-ts`, `@nielspeter/eess` — never ts-morph, never internals. Every
`project()`/`corpus()`/fixture path is **absolute via `import.meta.url`** (the
pattern above, from the package tests) — never cwd-relative, which the audit showed
breaking at runtime.

**No published-surface consequence.** `adrCitationStats` on
`packages/crossvalidate/src/md-ts.ts` already exists (bug 0104, shipped the same
day this plan was frozen) — this plan does not add it, only consumes it. Everything
this plan actually touches (root devDeps, `examples/`, `check:examples`,
`WORKSPACE_PKGS`) is monorepo-internal and ships nothing, so this plan carries
**no changeset**. (A prior draft claimed a `minor` changeset on
`@nielspeter/eess-crossvalidate` for this export; a 2026-08-14 freeze-time drift
check found the export had already shipped independently and corrected the claim.)
The plan's public surface is verifiably untouched, full stop.

**Fixture-duplication budget.** Several `examples/fixtures/*` are deliberate twins
of `packages/crossvalidate/tests/fixtures/*` (a second `job-management.feature`, a
second `calc/`). Some duplication is inherent to adopter-facing examples, but it is
the repo's #1 failure mode (two copies drift apart across wording changes). Keep
each example to the three assertions and the **smallest planted drift**; name which
fixtures are twins in a one-line comment so a future editor doesn't "fix" one side.
`calc.ts` and gherkin fixture `.ts` files sit outside `examples/tsconfig.json`'s
`include: ["*.test.ts"]` by design — they are read as text by ts-morph and
intentionally untypechecked-and-unexecuted; say so at the fixture.

### Phase 3 — execute the new examples (and be honest the five legacy stay typecheck-only)

The examples are meaningless until run — but the audit corrected two assumptions
about _how_. `vitest run --dir examples` from the repo root would pull in **all**
`examples/*.test.ts`, and the five legacy files fail **deterministically**, not
"if one drifts": each calls `project('tsconfig.json')` at module load, which
resolves against cwd (the repo root, which has **no** `tsconfig.json` — confirmed)
and throws on every run. That is a five-file port job, not a named expectation of
drift, and it is not what this plan is scoped to. So the fold is pinned.

`check:examples` gains an `examples/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    include: ['cross-dialect.*.test.ts'], // the checked family, and nothing else
  },
})
```

The narrow `include` does two things at once: it excludes the five legacy examples
(kept as typecheck-only — their current, documented behavior), **and** it keeps any
`*.test.ts` fixture under `examples/fixtures/` (e.g. an md↔ts citation-AST, which
vitest's default glob would otherwise sweep in as a spurious fifth test) from being
executed. Use `.cases.ts` for citation-AST fixtures anyway, matching `scripts/check-crossval.mjs:68`.

Then:

```json
"check:examples": "tsc --noEmit -p examples/tsconfig.json && vitest run --dir examples"
```

`validate` already runs `check:examples`, so the fold needs no new `validate` entry
(and note: `check:examples` now does two jobs — typecheck _and_ execute; say so in
the script comment so the next reader isn't misled).

The five legacy examples are not silently dropped from the plan's concern — they
are **explicitly deferred**, named in Out of Scope, to a follow-up that ports them
to real fixture projects (the crossvalidate package's own `fixtures/calc` is the
template). Executing them responsibly is a five-file job with its own fixtures and
effort; bolting it onto this plan would balloon "Small–Medium" into a rewrite.

## Files Changed

- `package.json` — root devDependencies for **all six** internal packages, each
  `workspace:*`; `check:examples` folded to typecheck + vitest.
- `examples/vitest.config.ts` — new: `include: ['cross-dialect.*.test.ts']`.
- `scripts/check-workspace-integrity.mjs` — add `eess-crossvalidate`/`-md`/`-gherkin`
  to `WORKSPACE_PKGS`; correct the stale "no `workspace:` protocol" comment.
- `examples/README.md` — correct now-false "templates, not runnable tests, only
  type-checked in CI" claims; add a row per cross-dialect example naming the
  good/bad fixture pair and a one-line "intentionally broken" note on red fixtures.
- `examples/tsconfig.json` — confirm `include` covers the new `*.test.ts`.
- `examples/cross-dialect.md-gherkin.test.ts` · `examples/cross-dialect.md-ts.test.ts` ·
  `examples/cross-dialect.gherkin-ts.test.ts` · `examples/cross-dialect.mermaid-ts.test.ts`.
- `examples/fixtures/gherkin/{features,jobs/docs}` — `.feature` + good/bad citation docs.
- `examples/fixtures/calc/` — `calc.ts`, tsconfig, `complete.mmd`, `drift.mmd` (two-direction).
- `examples/fixtures/adr/`, `examples/fixtures/gherkin-ts/` — md↔ts and gherkin↔ts fixtures.
- `work/plans/ROADMAP.md` — board row (live section).

The five existing `examples/*.test.ts` are **not** in Files Changed — they are
deferred, not rewritten here (see Out of Scope).

## Test inventory / non-vacuity

Every example carries a non-vacuity assertion its green case would otherwise be
able to fake, and — post-review — each assertion is backed by a function that
actually exists and actually fails on empty:

- **md↔gherkin** — `scenarioCitationStats(...).citations > 0` (exists in `packages/crossvalidate/src/md-gherkin.ts`).
- **gherkin↔ts** — `scenarioTestStats(...).citations > 0` (exists in `packages/crossvalidate/src/gherkin-ts.ts`).
- **md↔ts** — `adrCitationStats(...)`, **already exported** by
  `packages/crossvalidate/src/md-ts.ts` (bug 0104 — not new work here; a prior
  draft claimed this as new public surface the plan adds, corrected by a
  2026-08-14 freeze-time drift check once the export was found to already exist).
  Among the three citation-count bindings (md↔gherkin, gherkin↔ts, md↔ts), md-ts
  is otherwise the odd one out — a left-to-right `beComplete` that stays green on
  an empty selection — so without asserting this count, the md↔ts green case would
  be _unimplementable as a non-vacuity assertion_; the example simply consumes the
  existing export to close that gap.
- **mermaid↔ts** — two red directions (`drift.mmd` code→diagram, a diagram-only
  class for diagram→code), so a broken single-direction implementation cannot pass
  both green and red. No count API exists or is needed; the two reds are the proof.

Each red case asserts the throw **and** a message regex — proof drift fails, not
just that the happy path returns. The post-review form of the checklist: for
md↔gherkin and gherkin↔ts, deleting the fixture citation fails the green because
the stats drop to zero; for md↔ts it fails because the new `adrCitationStats`
reads zero; for mermaid↔ts it fails because both directions unmount. A reviewer
re-checking the plan must be able to point at the exact assertion per binding —
which this inventory now lets them.

**Honesty about novelty.** Two of the four red-cases duplicate behavior already
proven in committed fixtures (`scripts/nonvacuity/bad-crossval.mjs` for mermaid↔ts,
`scripts/nonvacuity/bad-gherkin-ts.mjs` for gherkin↔ts). The genuinely new red evidence this plan
adds is md↔gherkin (mounted nowhere until now) and md↔ts _citation-resolution_.
The close criterion counts this as **documentation-by-execution** — the value is
that the repo itself runs the promise — not as four fresh proofs of four
previously-open gaps. That framing is stated so the plan isn't overclaimed at close.

## Out of Scope

- **The three undocumented entry points** (`md-mermaid`, `md-mermaid-er`,
  `files`) — not in the README's adoption surface; a fifth/sixth/seventh example
  would be new public surface this plan doesn't need. Parked as a follow-up. The
  README's covering 4 of 7 exports is the undercovering artifact, noted so the
  thread isn't lost; the plan starts (small) at the demonstrated side.
- **Extending `check:crossval`** to mount the three missing bridges on real
  repo artifacts — a separate reconciliation (parent 0089) about the _gate_, not
  the examples. This plan makes the _demonstrated_ family complete; the gate's
  is a distinct item.
- **Executing the five existing eess-ts examples** — **explicitly deferred, not
  forgotten.** They call `project('tsconfig.json')` against a repo root with no
  `tsconfig.json` and fail _deterministically_ under vitest; making them run is a
  five-file port to real fixture projects (the package's own `fixtures/calc` is
  the template) with its own effort. That is a separate, follow-on item. This plan
  pins the fold to `cross-dialect.*.test.ts` so they stay typecheck-only (their
  current, documented behavior) rather than silently failing.
- **Doc-fence typechecking or doc CI** — plan 0082 already owns that lane.

## Success / close

The plan closes when all four README bindings have an **executing** example in
`examples/` — each green + red + non-vacuous, with the md↔ts non-vacuity backed
by the existing `adrCitationStats` and mermaid↔ts by two directions — and all six
internal packages the examples import are declared root devDependencies via
`workspace:*`, with `WORKSPACE_PKGS` extended so `check:integrity` covers them.
`npm run validate` runs the examples. The folder that once demonstrated nothing now
proves the family, in the one place an adopter goes to look. The irony that
started this — "we aren't even dogfooding our own binder" — is gone because the
binder is now both declared (all of it, not one import) and demonstrated (all four
documented bindings, provably).
