# Plan 0096: Dogfood the missing crossvalidate bindings on the repo's own artifacts

## Status

- **State:** Ready — frozen 2026-08-14. Created 2026-08-12; reworked 2026-08-12
  after a six-persona review found the first pass manufactured proof that could
  not go green (a repo-root citation that wouldn't resolve, a two-line citation
  that never checked the scenario, and an md↔mermaid gate over fictional/flowchart
  fences that failed on first run). The rework plants a resolvable scenario-title
  citation and a real embedded class diagram. **Corrected again 2026-08-12** —
  verification of the review's own bug filings found that both reworked phases
  still rested on non-vacuity guards that cannot do the job: Phase 1's
  `scenarios > 0` counts the feature set's size, not anything scanned
  ([bug 0098](../bugs/0098-scenario-stats-report-set-size-as-scan-count.md)), and
  Phase 2's fence count does not distinguish a classDiagram from a flowchart. Both
  now use the repo's real non-vacuity mechanism — a sabotage fixture — with the
  stats line demoted to a summary. The eess project dogfoods only **3 of the 7**
  `@nielspeter/eess-crossvalidate` bindings in its own gate
  (`scripts/check-crossval.mjs` mounts `mermaid-ts`, `md-ts`, `gherkin-ts`). The
  other four — `md-gherkin`, `md-mermaid`, `md-mermaid-er`, `files` — are never
  exercised on the repo's own corpus. This plan closes the dogfood gap. It is
  deliberately **not** 0091 (the adopter-facing examples) and **not** 0089/0101
  (per-dialect sufficiency + gate _honesty_); it is the project dogfooding more of
  crossvalidate's _surface_ on its own artifacts.
- **Freeze check (2026-08-14).** Re-verified every load-bearing assumption
  against current code, since `check-crossval.mjs`, `md-gherkin.ts`, and
  `check-nonvacuity.mjs` all changed materially after this plan was drafted
  (proposal 005 / plan 0145, merged 2026-08-14). Nothing dangled:
  `docs/crossvalidate.md:79` still carries the unfixed repo-root, no-title form
  Phase 1 targets; `docs/architecture.md` still does not exist (Phase 2's plant
  is still needed); `scenarioCitationsResolve`/`scenarioCitationStats`
  (`md-gherkin.ts`) and `embeddedDiagramsMatchCode` (`md-mermaid.ts`) are
  unchanged; bugs 0097/0098 are still Draft, so `scenarioCitationStats` still has
  no `titled` field and the Phase 1 floor's stated limit still holds exactly as
  written. Phase 3's fixture tier (`gateNode`, matching `bad-gherkin-ts.mjs`) is
  still the live convention for this class of gate — plan 0145 elevated only
  `scenarioExemptionsCurrent`/`scenariosCovered` to the stronger
  `EESS_CROSSVAL_GHERKIN_ROOT` e2e tier, and left the sibling
  `crossval/gherkin-ts` and `crossval/md-ts` rows on the same weaker tier this
  plan's Phase 3 uses — so Phase 3 is not adopting a tier the repo has since
  moved past. `npm run check:corpus` is clean with the plan's own links as
  written. No open questions, no refinement story to harvest.
- **Priority:** High — a dogfood gap, same class as 0091. Not a blocker; nothing
  gates on it.
- **Effort:** Small — two bindings to mount, each needing one planted artifact
  pair and a gate block. `md↔mermaid-er` is parked (no erDiagram in the repo).
- **Created:** 2026-08-12

## Problem

The eess project ships a package whose job is "bind two dialects' artifacts and
fail when they drift," then dogfoods only half of it on itself. `check:crossval.mjs`
mounts three bridges over the repo's own artifacts:

- `mermaid↔ts` — `docs/architecture.mmd` ↔ `packages/core`
- `md↔ts` — `/adr` enforcement tables ↔ test AST
- `gherkin↔ts` — `scenario-binding.feature` ↔ its spec test

It never mounts `md↔gherkin`, `md↔mermaid`, or `md↔mermaid-er`. So the repo that
_teaches_ the family to bind two dialects only binds three of its own pairs. The
missing three aren't trivially mountable — each needs an artifact pair the repo
doesn't currently exercise, and a first pass at this plan got the pairs wrong:

- **`md↔gherkin`** (`scenarioCitationsResolve`) — needs a markdown doc that cites
  a real `.feature` **scenario** (path + title on one line). `docs/crossvalidate.md`
  already carries a _file-level_ citation to `scenario-binding.feature` (line 79),
  but it uses a repo-root path that won't resolve against the features `cwd`, and
  it cites no scenario title — so the scenario-resolution path is never exercised.
- **`md↔mermaid`** (`embeddedDiagramsMatchCode`) — needs a markdown doc with an
  embedded `mermaid` **classDiagram** that matches real code. The repo's two
  embedded fences are both unusable: `docs/eess-walkthrough-calculator.md:132` is
  a classDiagram of seven **fictional** classes (only two exist in code, as test
  fixtures), and `docs/manifesto.md:229` is a `graph TD` flowchart the class-diagram
  parser can't read. There is **no** embedded classDiagram in the corpus that
  matches real code — one must be planted.
- **`md↔mermaid-er`** — needs an embedded erDiagram. The repo has none; parked.

## Approach

Mount the two feasible missing bindings in `check:crossval.mjs`, each over the
repo's own artifacts, with the same non-vacuity discipline the existing three
gates carry (a gate that scanned nothing must not read as green). This is the
_dogfood_ lane; 0091 is the _example_ lane. Both are needed — the examples prove
the bindings work, the gate makes the repo's own corpus exercise them.

## Phased implementation

### Phase 1 — mount `md↔gherkin` on the repo's own corpus

`docs/crossvalidate.md` is the natural citing doc — it already describes the
binding and already carries a file-level citation (line 79). The work is to make
that citation a real **scenario-title** citation in the frozen convention, with
the path in the form the resolver actually matches.

**Two conventions the resolver enforces (verified against `md-gherkin.ts`):**

- `resolveFeature` matches the cited path against each feature's `relPath`,
  which is **relative to the features `cwd`**. With `cwd: 'packages/crossvalidate/specs'`,
  the feature's relPath is `scenario-binding.feature` — so the citation must be
  the bare `` `scenario-binding.feature` ``, **not** the repo-root
  `packages/crossvalidate/specs/scenario-binding.feature` (which resolves to
  nothing and fails the gate).
- `defaultExtract` reads the quoted title only from the **same line** after the
  backticked path. A path on one line and a title on the next is file-level only —
  the scenario title is never checked.

So fix line 79 to a single-line scenario-title citation:

```markdown
**Honest scope:** it proves a test _cites_ a scenario, not that the test _exercises_
its behaviour — that last step is Tier 2, still open. eess dogfoods this pairing on
itself: `scenario-binding.feature` · 'A cited scenario resolves to a real scenario'
is a use case, proven by a test whose `it()` titles cite its scenarios, gated live
in `check:crossval`.
```

Then mount the gate in `check:crossval.mjs`:

```js
import {
  scenarioCitationsResolve,
  scenarioCitationStats,
} from '@nielspeter/eess-crossvalidate/md-gherkin'

const citingDocs = () => corpus({ roots: ['docs/crossvalidate.md'] })
const featureSet = () => features({ cwd: 'packages/crossvalidate/specs', roots: ['**/*.feature'] })

gate('md↔gherkin (story citations resolve in the corpus)', () => {
  const violations = scenarioCitationsResolve(citingDocs(), featureSet())
  if (violations.length > 0) throw new Error(violations.map((v) => v.message).join('\n'))
  const s = scenarioCitationStats(citingDocs(), featureSet())
  if (s.citations === 0) throw new Error('md↔gherkin scanned zero citations — green-but-empty')
  console.error(`  md↔gherkin — ${s.citations} citations across ${s.scenarios} scenarios`)
})
```

**`violations.length > 0` is load-bearing** — the identity check.
`scenarioCitationsResolve` returns `ArchViolation[]` (via `finishPreset`, which
also throws by default). Discarding the return would let a citation that resolves
to a _missing scenario title_ pass green — the vacuous-pass failure this plan
exists to prevent. The planted title
`'A cited scenario resolves to a real scenario'` is verified to exist in
`scenario-binding.feature`.

**The stats line is a summary, not a guard.** An earlier draft of this phase
guarded on `s.scenarios === 0`, claiming `scenarios` counts scenarios referenced
by title-bearing citations. It does not: `md-gherkin.ts:162` returns
`set.scenarios().length` — the feature set's own inventory, computed without
consulting the corpus at all. That guard is satisfied by the `.feature` files
loading, whether or not a single document cites them, and would have shipped
exactly the green-but-empty gate this plan exists to prevent
([bug 0098](../bugs/0098-scenario-stats-report-set-size-as-scan-count.md)).

`s.citations === 0` is the honest floor available today: `citations` _is_ a
corpus-side scan count. It is a weak floor — `docs/crossvalidate.md` already
carries a file-level citation, so it does not prove the _title_-resolution path
ran. No exported field can prove that yet; bug 0098 adds `titled` for exactly
this, and when it lands the floor tightens to `s.titled === 0`. Adding it here
is out of scope (this plan ships no new public surface), so the proof that the
gate can go red comes from the sabotage fixture in **Phase 3** — which is the
repo's actual non-vacuity mechanism regardless.

**Integration note:** the citation is a
backticked `.feature` path in a gated doc; `check:corpus` is green with the
identical path today (line 79), so the planted form resolves — no exemption needed,
but confirm the doc's other links stay green.

### Phase 2 — mount `md↔mermaid` on a real embedded classDiagram

`embeddedDiagramsMatchCode` validates every `mermaid` **classDiagram** fence in
the corpus against code. The audit found the repo has **no** embedded classDiagram
that matches real code: the walkthrough's is fictional (seven classes, five don't
exist in code), and the manifesto's is a `graph TD`flowchart the class-diagram
parser can't read. So Phase 2 must **plant a real one** — and the honest source is`docs/architecture.mmd`, which the existing `mermaid↔ts`gate already proves
matches`packages/core`. Embed that same diagram in a doc that documents the
kernel architecture, and the gate validates the embedded form against the same
code the standalone form already matches.

Add a `docs/architecture.md` that embeds the kernel class diagram as a `mermaid`
fence (mirroring `docs/architecture.mmd`), then mount the gate over **that doc
only** — not `docs/\*\*`, which would sweep in the fictional walkthrough and the
flowchart:

```js
import { embeddedDiagramsMatchCode } from '@nielspeter/eess-crossvalidate/md-mermaid'

gate('md↔mermaid (embedded diagrams match code)', () => {
  const violations = embeddedDiagramsMatchCode(
    corpus({ roots: ['docs/architecture.md'] }),
    project('packages/core/tsconfig.build.json'),
    { scope: '**/packages/core/src/**' },
  )
  if (violations.length > 0) throw new Error(violations.map((v) => v.message).join('\n'))
  const fences = corpus({ roots: ['docs/architecture.md'] })
    .documents()
    .flatMap((d) => d.codeBlocks)
    .filter((b) => b.lang === 'mermaid')
  if (fences.length === 0)
    throw new Error('md↔mermaid scanned zero mermaid fences — green-but-empty')
})
```

`embeddedDiagramsMatchCode` returns `ArchViolation[]` (not void), so the gate
asserts the array is empty **and** that it scanned at least one embedded fence.
If the embedded kernel diagram drifts from `packages/core`, the gate fails with a
violation pointing at the markdown file and fence line.

**What the fence count does and does not prove.** An earlier draft called this a
count of "class-bearing `mermaid` fences … so a flowchart fence can't fake a
scan." It isn't: the filter is `lang === 'mermaid'`, exactly the test
`md-mermaid.ts:51`applies before handing the fence to the class-diagram parser.
A`graph TD`flowchart satisfies it. The gate is sound today only because Phase 2
scopes it to`docs/architecture.md`, a doc this plan plants containing exactly
one classDiagram — but the guard would go on reading green if that doc later lost
its classDiagram and kept a flowchart. Treat the count as "the corpus root wasn't
empty or misglobbed", which is what it actually checks, and get the real proof
from the sabotage fixture in **Phase 3**.

### Phase 3 — prove both new gates can go red

A stats threshold detects an _empty_ scan. It cannot prove the gate _fails on
drift_ — for that this repo has one mechanism, and both new gates must use it:
a committed sabotage fixture under `scripts/nonvacuity/`, run by
`scripts/check-nonvacuity.mjs`, which requires the gate to exit 1 and to name
the rule that fired. `scripts/nonvacuity/bad-gherkin-ts.mjs` is the template —
same package, same try/catch-and-exit-1 contract.

Two fixtures, mirroring the two failure modes that matter:

- **`scripts/nonvacuity/bad-md-gherkin.mjs`** + `bad-md-gherkin/cites-missing-scenario.md` —
  a doc citing `` `scenario-binding.feature` `` with a scenario title that does
  not exist in it. Run against the real feature set, `scenarioCitationsResolve`
  must fire `crossval/scenario-citations-resolve`. This is the check that
  Phase 1's `citations` floor cannot make: it proves the **title**-resolution
  path is live, not merely that citations were counted.
- **`scripts/nonvacuity/bad-md-mermaid.mjs`** + `bad-md-mermaid/drifted-diagram.md` —
  a doc whose embedded `mermaid` classDiagram declares a class absent from
  `packages/core`. `embeddedDiagramsMatchCode` must fire `crossval/embedded-diagram`.
  (Directly analogous to the existing `ghost-diagram.mmd` fixture, which does this
  for the standalone `.mmd` form.)

Both register in `check-nonvacuity.mjs`'s `gates` array and in its header
docblock's gate → violating-input → rule map, which is the file's own inventory
of what is proven.

## Files Changed

- `scripts/check-crossval.mjs` — two new `gate(...)` blocks (md↔gherkin, md↔mermaid)
  - their imports. **Not** the header comment: lines 6–8 are
    [bug 0097](../bugs/0097-crossval-presets-bypass-caller-owns-reporting.md)'s
    lane, and that bug changes two preset signatures, so it owns what the comment
    must end up saying. Whichever lands second inherits a correct comment.
- `docs/crossvalidate.md` — fix line 79's citation to the cwd-relative
  `scenario-binding.feature` path + a scenario title on the same line.
- `docs/architecture.md` — new: embeds the kernel class diagram (mirroring
  `docs/architecture.mmd`) as a `mermaid` fence.
- `scripts/nonvacuity/bad-md-gherkin.mjs` · `bad-md-gherkin/cites-missing-scenario.md` — new (Phase 3).
- `scripts/nonvacuity/bad-md-mermaid.mjs` · `bad-md-mermaid/drifted-diagram.md` — new (Phase 3).
- `scripts/check-nonvacuity.mjs` — two rows in the `gates` array + two lines in
  the header docblock's gate → input → rule map.
- `work/plans/ROADMAP.md` — board row.

## Test inventory / non-vacuity

Two tiers, and the plan is only closable with both. The first catches an _empty_
scan; only the second proves the gate _fails on drift_.

**Tier 1 — the gate's own floor (detects green-but-empty).**

- **md↔gherkin** — `s.citations === 0` throws. `citations` is a corpus-side scan
  count, so a misglobbed root or a doc that cites nothing fails rather than
  passes. It does **not** prove the title-resolution path ran; no exported field
  can until [bug 0098](../bugs/0098-scenario-stats-report-set-size-as-scan-count.md)
  adds `titled`, at which point this tightens to `s.titled === 0`. Stating the
  floor's limit is the point — the earlier `scenarios > 0` form claimed a
  strength it did not have.
- **md↔mermaid** — a non-zero count of `mermaid` fences in
  `docs/architecture.md`. Same class of floor: it proves the root resolved, not
  that a classDiagram was parsed.

**Tier 2 — sabotage fixtures (prove the gate goes red).** Phase 3, run by
`check:nonvacuity`:

- `bad-md-gherkin.mjs` — a citation to a scenario title absent from
  `scenario-binding.feature` must fire `crossval/scenario-citations-resolve`.
  **This is the load-bearing proof for md↔gherkin**, since Tier 1 cannot reach
  the title path.
- `bad-md-mermaid.mjs` — an embedded classDiagram declaring a class absent from
  `packages/core` must fire `crossval/embedded-diagram`.

**Reviewer's checks** (both must behave as stated before this plan closes):
delete the scenario title from `docs/crossvalidate.md:79` → the `bad-md-gherkin`
fixture still exits 1, and the main gate stays green (correctly: a file-level
citation is legal) — which is precisely why Tier 2 exists. Delete the embedded
fence from `docs/architecture.md` → the md↔mermaid gate fails on its floor.

Both gates run in `npm run validate` via `check:crossval`; `check:nonvacuity`
gains two rows and stays green.

## Out of Scope

- **`md↔mermaid-er`** — needs an embedded erDiagram in the corpus and the repo has
  none, so mounting it would be a green-but-empty gate, the exact failure this
  plan exists to avoid. It was drafted as a "parked" Phase 4 and removed
  2026-08-12: a phase that cannot be built is not a phase, and one that waits on a
  condition nobody has scheduled would hold this plan open forever. It is recorded
  here as a known gap with its trigger — the day a doc in this repo gains an
  erDiagram, that is when it becomes work, and it gets a plan number then. Until
  then eess dogfoods **5 of 7** bindings and says so.
- **The `files` entry point** — a selection factory, not a dialect-pair binding;
  not a dogfood target.
- **The adopter-facing examples** — that is plan 0091.
- **Per-dialect sufficiency** — plan 0089. **Sibling gates going fail-closed** —
  plan 0101. This plan mounts bindings; neither of those changes what a gate
  mounts.
- **Extending the crossvalidate package itself** — this plan only _consumes_ its
  existing bindings on the repo's own artifacts; no new public surface.

## Success / close

The plan closes when `check:crossval.mjs` mounts **five** of the seven bindings on
the repo's own artifacts — the existing three plus `md↔gherkin` and `md↔mermaid` —
each carrying **both** a green-but-empty floor and a sabotage fixture that proves
it goes red, and `npm run validate` is green. Concretely:
`docs/crossvalidate.md` carries a resolvable scenario-title citation,
`docs/architecture.md` embeds a class diagram that matches `packages/core`, and
`check:nonvacuity` gains two rows that fail if either gate is neutered. The
project that ships "bind two dialects and fail on drift" then dogfoods
the family on itself, not just half of it. `md↔mermaid-er` stays honestly parked
until the repo has an erDiagram.
