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
  crossvalidate's _surface_ on its own artifacts. Two of its touched files —
  `docs/crossvalidate.md` and the new `docs/architecture.md` — are themselves
  pages in the published VitePress guide, so a real reader's experience of the
  guide moves too, even though the plan's target is dogfood coverage, not
  adopter-facing examples.
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
- **Post-freeze review (2026-08-14).** A six-persona review of the frozen plan
  found two critical gaps in the code snippets below — a shared-ruleId hazard
  that would let Phase 3's own named template prove the wrong thing, and an
  emptied-diagram fence that was silently green under the unstated
  `left-to-right` default — plus several important corrections: missing
  `completeness: 'both'`, a missing `GATE_FOR` entry that would have failed
  `check:nonvacuity`'s own coverage gate, missing `...opts` threading, a
  factually-wrong rationale for a dead-code check, `docs/architecture.md`
  landing as an unlinked page in the published guide, and `md↔mermaid-er`'s
  parking language overselling an unscheduled trigger as an open one.
- **Re-review (2026-08-14).** A second six-persona pass, specifically checking
  whether the first round's fixes actually held up rather than trusting the
  fix commit's own message, found the fixes had introduced two new defects,
  both since corrected: Phase 1's "keep the full path in adjoining prose" fix
  re-backticked a `.feature`-suffixed span, which `FEATURE_PATH_RE` extracts as
  a second citation regardless of context — reintroducing the exact
  unresolvable-citation failure Phase 1 exists to remove (the path is now
  plain, unbackticked prose). And Phase 3's emptied-diagram regex,
  `/has no matching class/`, does not match the real `rightUnmatched` message
  (`"... has no matching diagram class ..."`) — corrected to
  `/has no matching diagram class/`, verified against the actual label
  composition in `correspondence.ts`/`md-mermaid.ts`, not just the message
  shape. Both were caught because the re-review ran the real regex/preset
  against the plan's own proposed text rather than reading it for plausibility
  — the same discipline this plan asks Phase 3 to apply to its own fixtures.
  All fixed inline below; this plan stays **Ready**.
- **Build (2026-08-14).** Both phases implemented and verified empirically —
  `check-crossval.mjs` mounts both gates, `docs/architecture.md` embeds the
  kernel diagram, both Phase 3 sabotage fixtures fire on message (not just
  ruleId), `check:nonvacuity` gains the two rows (`gates` + `GATE_FOR`), and
  all three of this plan's own "Reviewer's checks" were run by hand and
  behaved exactly as stated. Running the full `check:nonvacuity` harness (not
  just the two new fixtures in isolation) surfaced one real defect the three
  prior review rounds never caught, because none of them ran it: reusing
  `scenarioSpecs` for the `md↔gherkin` gate, as Phase 1 originally specified,
  broke plan 0145's `bad-crossval-gherkin-e2e.mjs` fixture by silently
  widening what `EESS_CROSSVAL_GHERKIN_ROOT` affects. Fixed inline in Phase 1
  (a gate-local `FeatureSet` unaffected by the override) and reverified —
  `npm run validate` is green, 33 nonvacuity fixtures fire (was 31). Stopped
  before merge per `/plan-build`'s guard; hand to `/close` after merge.
- **Priority:** High — a dogfood gap, same class as 0091. Not a blocker; nothing
  gates on it.
- **Effort:** Small — two bindings to mount, each needing one planted artifact
  pair and a gate block. `md↔mermaid-er` is out of scope indefinitely (no
  erDiagram in the repo's own corpus).
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
- **`md↔mermaid-er`** — needs an embedded erDiagram. The repo has none in its
  own corpus; out of scope (see below).

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

So fix line 79 to a single-line scenario-title citation, keeping the full path
in adjoining prose so the fix doesn't cost a reader the file's real location —
but **not backticked**. `FEATURE_PATH_RE` (``/`([^`\n]+\.feature)`/g``) matches
_every_ backtick-delimited `.feature`-suffixed span on a line, independently,
with no concept of "this one is the real citation, that one is prose" — a
second backticked copy of the full repo-root path is itself extracted as a
second citation and fails to resolve exactly the way the un-fixed original
does (`resolveFeature` only matches an exact `relPath` or a `/`-bounded
_suffix_ of a longer one; the repo-root form is longer than the real
`relPath`, so neither branch matches). An earlier version of this fix
backticked the full path in the parenthetical and reintroduced that exact
failure — caught by re-review, running the real preset against the proposed
text. The full path must appear as plain prose, unbackticked:

```markdown
**Honest scope:** it proves a test _cites_ a scenario, not that the test _exercises_
its behaviour — that last step is Tier 2, still open. eess dogfoods this pairing on
itself (at packages/crossvalidate/specs/scenario-binding.feature):
`scenario-binding.feature` · 'A cited scenario resolves to a real scenario'
is a use case, proven by a test whose `it()` titles cite its scenarios, gated live
in `check:crossval`.
```

Then mount the gate in `check:crossval.mjs`, **after** `scenarioSpecs` is
defined. **Corrected during build (2026-08-14):** the plan as originally
written said to reuse `scenarioSpecs` rather than re-hardcode a second,
independent `FeatureSet`, reasoning that a second copy would silently diverge
from the file's own `EESS_CROSSVAL_GHERKIN_ROOT` override convention. Running
the real `bad-crossval-gherkin-e2e.mjs` fixture against the built gate proved
that reasoning backwards: `scenarioSpecs` **follows**
`EESS_CROSSVAL_GHERKIN_ROOT`, the override that exists so a fixture can point
the gherkin-ts trio at a throwaway corpus — reusing it here silently widened
that override's scope, so the e2e fixture's real-`check-crossval.mjs`
sub-invocations started failing on an unrelated `md↔gherkin` violation
(`docs/crossvalidate.md` citing the real `scenario-binding.feature`, absent
from the throwaway corpus) instead of the scenario each was built to test. The
built gate computes its own `FeatureSet` from the literal default path,
joining `diagram↔code` and `ADR↔test` as unaffected by the override — exactly
the invariant the file's own comment already documented ("Only these three
gates read it"):

```js
import {
  scenarioCitationsResolve,
  scenarioCitationStats,
} from '@nielspeter/eess-crossvalidate/md-gherkin'

const mdGherkinSpecs = features({ cwd: 'packages/crossvalidate/specs', roots: ['**/*.feature'] })
const citingDocs = () => corpus({ roots: ['docs/crossvalidate.md'] })

gate('md↔gherkin (story citations resolve in the corpus)', () => {
  // scenarioCitationsResolve's default `report: 'throw'` (finishPreset) already
  // reports and throws *inside* the preset when violations exist — same idiom
  // as the existing ADR↔test gate above, which never inspects a return value
  // either. No manual `violations.length` check: on the violating path there is
  // no return to discard, so a leftover check here would be dead code.
  scenarioCitationsResolve(citingDocs(), mdGherkinSpecs, opts)
  const s = scenarioCitationStats(citingDocs(), mdGherkinSpecs)
  if (s.citations === 0) throw new Error('md↔gherkin scanned zero citations — green-but-empty')
  console.error(`  md↔gherkin — ${s.citations} citations across ${s.scenarios} scenarios`)
})
```

**The gate relies on the preset's own default throw, not a manual check.**
`scenarioCitationsResolve` calls `finishPreset` with no `report` option, so a
violation is reported and thrown before the call can return —
`gate()`'s own `try/catch` is what fails the build. A citation resolving to a
_missing scenario title_ takes exactly this path. The planted title
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

**Integration note:** the citation is a backticked `.feature` path, but it is
not itself a link or `path:line` pointer — `check:corpus`'s link/pointer rules
don't parse this citation shape at all, so that gate being green today is
neither evidence for nor against the new form. Confirm separately that the
doc's real links and pointers stay green after the edit.

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
only** — not `docs/**`, which would sweep in the fictional walkthrough and the
flowchart. Link the new page from `docs/dogfooding.md`'s gate table — its
natural home, alongside the standalone `.mmd` gate — with one sentence naming
it as the `md↔mermaid` dogfood plant, not an adopter template, so it's a real,
findable page in the published guide rather than an unlinked orphan (VitePress's
local search indexes it either way). Note at the top of the new file that it is
a hand-maintained mirror of `docs/architecture.mmd` with no automated sync
between the two — a human editing one must remember the other:

```js
import { embeddedDiagramsMatchCode } from '@nielspeter/eess-crossvalidate/md-mermaid'

gate('md↔mermaid (embedded diagrams match code)', () => {
  // completeness: 'both' matches the standalone mermaid↔ts gate above on the
  // same source diagram — left-to-right alone only catches the embed naming a
  // class code lacks; 'both' also catches code gaining a class the
  // hand-maintained embed was never updated with, and closes an emptied-fence
  // hole left-to-right leaves open (an empty diagram vacuously satisfies
  // leftUnmatched; 'both' makes every real kernel class fail as
  // rightUnmatched instead — verified against correspondence.ts).
  embeddedDiagramsMatchCode(
    corpus({ roots: ['docs/architecture.md'] }),
    project('packages/core/tsconfig.build.json'),
    { scope: '**/packages/core/src/**', completeness: 'both', ...opts },
  )
  const fences = corpus({ roots: ['docs/architecture.md'] })
    .documents()
    .flatMap((d) => d.codeBlocks)
    .filter((b) => b.lang === 'mermaid')
  if (fences.length === 0)
    throw new Error('md↔mermaid scanned zero mermaid fences — green-but-empty')
})
```

`embeddedDiagramsMatchCode` calls `finishPreset` with the default
`report: 'throw'`, so — like Phase 1's gate — it throws inside itself on any
violation; `gate()`'s own `try/catch` is what fails the build. If the embedded
kernel diagram drifts from `packages/core` **in either direction**, the gate
fails with a violation pointing at the markdown file and fence line.

**What the fence count does and does not prove.** An earlier draft called this a
count of "class-bearing `mermaid` fences … so a flowchart fence can't fake a
scan." It isn't: the filter is `lang === 'mermaid'`, exactly the test
`md-mermaid.ts:51` applies before handing the fence to the class-diagram parser.
A `graph TD` flowchart satisfies it, and so would a syntactically valid but
content-free `classDiagram` fence (zero classes) — the fence-count floor can't
tell either apart from a real diagram. The gate is sound today only because
Phase 2 scopes it to `docs/architecture.md`, a doc this plan plants containing
exactly one classDiagram — but the guard would go on reading green if that doc
later lost its classDiagram and kept a flowchart. `completeness: 'both'` (above)
closes the emptied-content case at the level that actually matters: an empty
diagram against a non-empty `packages/core` fails on `rightUnmatched` regardless
of what the fence-count floor sees. Treat the fence count as "the corpus root
wasn't empty or misglobbed," which is what it actually checks, and get the real
proof — including the emptied-fence case — from the sabotage fixtures in
**Phase 3**.

### Phase 3 — prove both new gates can go red

A stats/fence-count threshold detects an _empty_ scan. It cannot prove the gate
_fails on drift_ — for that this repo has one mechanism, and both new gates must
use it: a committed sabotage fixture under `scripts/nonvacuity/`, run by
`scripts/check-nonvacuity.mjs`, which requires the gate to exit 1 and to name
the rule that fired.

**Tier choice, stated honestly.** Both fixtures use `gateNode` + a rebuilt-rule
project (the `bad-gherkin-ts.mjs`/`bad-crossval.mjs` tier), not the stronger
production-script-driven e2e tier plan 0145 just built for the gherkin-ts trio
(`EESS_CROSSVAL_GHERKIN_ROOT`, running the real `check-crossval.mjs` twice
against a throwaway corpus). That tier isn't available to these two gates
today: there is no `EESS_CROSSVAL_*_ROOT`-style override for the `docs/`-corpus
roots `scenarioCitationsResolve`/`embeddedDiagramsMatchCode` read — only the
gherkin `FeatureSet` root has one. Building that override is a real follow-on,
out of scope here, not a reason to block this plan: `crossval/gherkin-ts` and
`crossval/md-ts` remain on this same weaker tier today, so Phase 3 isn't
regressing anything the repo has already raised the bar on.

**Shared-ruleId hazard — both presets need message-level assertion, not a bare
ruleId check.** `scenarioCitationsResolve` emits the identical
`crossval/scenario-citations-resolve` for all three of its failure modes
(missing feature file, ambiguous suffix, missing scenario title — one shared `v()`
helper in `md-gherkin.ts`). `embeddedDiagramsMatchCode` similarly emits one
`crossval/embedded-diagram` for both `leftUnmatched` (diagram names a class code
lacks) and `rightUnmatched` (code has a class the diagram lacks — now live via
Phase 2's `completeness: 'both'`). `bad-gherkin-ts.mjs` — the file an earlier
draft of this phase named as its template — proves this is a real trap: it
deliberately seeds all three gherkin failure modes in one fixture project and
asserts only `ruleId`, so it proves "some scenario-citation violation fired,"
never which one. Copying that pattern here would let `bad-md-gherkin.mjs` "pass"
even if its planted citation broke for the wrong reason while still printing the
right ruleId. The correct precedent is already in the repo: `bad-crossval.mjs`
filters on **ruleId and a message regex** because its own preset has the
identical shared-ruleId shape. Both fixtures below follow `bad-crossval.mjs`,
not `bad-gherkin-ts.mjs`.

Two fixtures, each proving a specific failure mode by message (not just
ruleId), plus a clean-direction negative control per fixture — the same
sanity-check pattern `bad-md-ts.mjs` uses, so neither fixture can be a resolver
that's simply stuck always-red:

- **`scripts/nonvacuity/bad-md-gherkin.mjs`** + `bad-md-gherkin/cites-missing-scenario.md` —
  a doc citing `` `scenario-binding.feature` `` (the real feature file, so only
  one thing is wrong) with a scenario title that does not exist in it. Run
  against the real feature set, `scenarioCitationsResolve` must fire
  `crossval/scenario-citations-resolve` **matching `/no such scenario in that feature file/`**
  — the title-specific submode, not either of the other two. This is the check
  that Phase 1's `citations` floor cannot make: it proves the **title**-resolution
  path is live, not merely that citations were counted. A second, clean-direction
  case in the same fixture — the real feature file and an existing scenario
  title — must resolve with zero violations.
- **`scripts/nonvacuity/bad-md-mermaid.mjs`** + three planted docs, all three
  cases required to pass before the fixture prints its sentinel (the
  `bad-md-ts.mjs` clean+dangling contract, extended to three cases rather than
  two — a single `gates`-array row, `crossval/md-mermaid`, covering all of
  them, since they exercise one preset's two submodes plus its negative
  control):
  - `bad-md-mermaid/drifted-diagram.md` — an embedded `mermaid` classDiagram
    declaring a class absent from `packages/core`. Must fire
    `crossval/embedded-diagram` **matching `/has no matching TS class/`**
    (directly analogous to the existing `ghost-diagram.mmd` fixture, which
    proves the same submode for the standalone `.mmd` form). This is the
    `leftUnmatched` message — `` `${right.label} "${name}" has no matching
${left.label}` `` with `right.label = 'TS class'` — verified against
    `correspondence.ts`'s message template and `md-mermaid.ts`'s label
    assignment, not just the shape.
  - `bad-md-mermaid/emptied-diagram.md` — a syntactically valid but
    content-free `classDiagram` fence (zero classes). Under Phase 2's
    `completeness: 'both'`, every real kernel class in `packages/core` becomes
    unmatched on the code side — must fire `crossval/embedded-diagram`
    **matching `/has no matching diagram class/`** (the `rightUnmatched`
    message: `left.label` is `` `diagram class (in ${doc.relPath})` ``, not
    bare `'diagram'` or `'class'` — a plain `/has no matching class/` does
    **not** match the real string, "diagram" sits between "matching" and
    "class"; confirmed by constructing the label and message directly and
    testing the regex against it). Proves the emptied-fence hole (a
    `left-to-right`-only gate passes this vacuously) is actually closed.
  - A clean-direction case — the real, undrifted `docs/architecture.mmd`
    content embedded verbatim — must resolve with zero violations. This is a
    **third** hand-maintained copy of the kernel diagram (alongside the
    standalone `.mmd` and Phase 2's embed) — same no-automated-sync caveat as
    Phase 2's note applies here too.

Both register in `check-nonvacuity.mjs`'s `gates` array as
`crossval/md-gherkin` and `crossval/md-mermaid` — **and those two names must
also be added to `GATE_FOR['check:crossval']`**, or the harness's own
`gateCoverage()` check ("gate is in the list but no check:\* claims it") fails —
plus two lines in the header docblock's gate → violating-input → rule map,
which is the file's own inventory of what is proven.

## Files Changed

- `scripts/check-crossval.mjs` — two new `gate(...)` blocks (md↔gherkin,
  md↔mermaid), each threading `...opts` like their five siblings; Phase 1's
  gate reuses the file's existing `scenarioSpecs` rather than a second
  hardcoded `FeatureSet`. Their imports.
  - **Not** the header comment: lines 6–8 are
    [bug 0097](../bugs/0097-crossval-presets-bypass-caller-owns-reporting.md)'s
    lane, and that bug changes two preset signatures, so it owns what the comment
    must end up saying. Whichever lands second inherits a correct comment.
- `docs/crossvalidate.md` — fix line 79's citation to the cwd-relative
  `scenario-binding.feature` path + a scenario title on the same line, keeping
  the full `packages/crossvalidate/specs/scenario-binding.feature` path in
  adjoining prose, **unbackticked** (see Phase 1) so the fix doesn't cost a
  reader the file's real location without reintroducing a second, unresolvable
  citation.
- `docs/architecture.md` — new: embeds the kernel class diagram (mirroring
  `docs/architecture.mmd`) as a `mermaid` fence, with a one-line note that it's
  a hand-maintained mirror with no automated sync to the `.mmd` original.
- `docs/dogfooding.md` — link the new page into its gate table, naming it as
  the `md↔mermaid` dogfood plant rather than an adopter template, so it's
  findable rather than an orphan in the published guide.
- `scripts/nonvacuity/bad-md-gherkin.mjs` · `bad-md-gherkin/cites-missing-scenario.md` — new (Phase 3).
- `scripts/nonvacuity/bad-md-mermaid.mjs` · `bad-md-mermaid/drifted-diagram.md` ·
  `bad-md-mermaid/emptied-diagram.md` — new (Phase 3).
- `scripts/check-nonvacuity.mjs` — two rows in the `gates` array
  (`crossval/md-gherkin`, `crossval/md-mermaid`), **the same two names added to
  `GATE_FOR['check:crossval']`** (or `gateCoverage()` fails), and two lines in
  the header docblock's gate → input → rule map.
- `work/plans/ROADMAP.md` — board row.
- No `packages/*` source is touched and no new `@nielspeter/eess-crossvalidate`
  export is added, so `check:release` needs no changeset for this plan.

## Test inventory / non-vacuity

Two tiers, and the plan is only closable with both. The first catches an _empty_
scan; only the second proves the gate _fails on drift_. Neither is proving the
underlying resolution/parsing logic works in isolation —
`packages/crossvalidate/tests/md-gherkin.test.ts` already does that at the unit
level (a title-resolution case and a missing-file case, each asserted by
message). What's actually new and provable only here is that the **production
wiring** — this repo's own `docs/crossvalidate.md`/`docs/architecture.md` +
`check:crossval.mjs` — really invokes that logic, not that the logic itself is
correct.

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
  that a classDiagram was parsed, and not that the parsed diagram has any
  classes in it (an emptied fence still counts) — that gap is closed at the
  gate level by Phase 2's `completeness: 'both'`, not by this floor.

**Tier 2 — sabotage fixtures (prove the gate goes red).** Phase 3, run by
`check:nonvacuity`. Each assertion matches **ruleId and message** — both
presets share one ruleId across multiple failure modes, so ruleId alone can't
tell them apart (Phase 3, "shared-ruleId hazard").

- `bad-md-gherkin.mjs` — a citation to a scenario title absent from
  `scenario-binding.feature` must fire `crossval/scenario-citations-resolve`
  matching the title-missing message, plus a clean-direction case that must
  fire nothing. **This is the load-bearing proof for md↔gherkin**, since Tier 1
  cannot reach the title path.
- `bad-md-mermaid.mjs` — an embedded classDiagram declaring a class absent from
  `packages/core` must fire `crossval/embedded-diagram` matching the
  ghost-class message; a second, emptied-fence case must also fire (proving the
  `completeness: 'both'` fix actually closes that hole); a clean-direction case
  must fire nothing.

**Reviewer's checks** (all must behave as stated before this plan closes):
delete the scenario title from `docs/crossvalidate.md:79` → the `bad-md-gherkin`
fixture still exits 1, and the main gate stays green (correctly: a file-level
citation is legal) — which is precisely why Tier 2 exists. Delete the embedded
fence from `docs/architecture.md` → the md↔mermaid gate fails on its floor.
Empty the fence's content instead of deleting it → the md↔mermaid gate still
fails, this time via `completeness: 'both'`'s code-side check, not the floor.

Both gates run in `npm run validate` via `check:crossval`; `check:nonvacuity`
gains two rows and stays green.

## Out of Scope

- **`md↔mermaid-er`** — needs an embedded erDiagram in the corpus and the repo
  has none today (verified: no `erDiagram` fence anywhere under `docs/` or
  `adr/`; the only `erDiagram` content in the repo is
  `packages/crossvalidate/tests/fixtures/table-er/**`, test fixtures, not
  dogfood corpus). Mounting it now would be a green-but-empty gate, the exact
  failure this plan exists to avoid. It was drafted as a "parked" Phase 4 and
  removed 2026-08-12: a phase that cannot be built is not a phase, and one that
  waits on a condition nobody has scheduled would hold this plan open forever —
  exactly what an open-ended "the day this repo gains an erDiagram" trigger
  would do left abstract. A real candidate exists and is worth naming rather
  than gesturing at: the `work/` lane's own entity relationships (Proposal
  1--0..1 Plan via `Implements`, the Bug/Plan/Proposal state machines) are
  genuinely relational and could legitimately be documented as an erDiagram for
  real documentation value, not manufactured solely to satisfy this gate.
  Nobody has scheduled that work today, so this stays honestly **out of scope
  indefinitely** rather than "parked pending a trigger" — if `work/`'s own data
  model is ever diagrammed for real, mounting `md↔mermaid-er` against it
  becomes a numbered plan then. Until then eess dogfoods **5 of 7** bindings
  and says so.
- **`scenarioCitationsResolve`'s and `embeddedDiagramsMatchCode`'s violation
  actionability** — unlike `gherkin-ts.ts`, neither preset's violations carry a
  `suggestion`/`docs` field (`embeddedDiagramsMatchCode` never supplies
  `correspondence()`'s `suggest` option; confirmed by build-time review — the
  first draft of this section named only `scenarioCitationsResolve`, which
  understated the gap this plan actually introduces). This plan makes both
  load-bearing in CI for the first time without closing it: a title-drift or
  ghost-class violation sends an author only a raw diff-shaped message, no
  `Fix:` line. Worth a follow-up bug rather than blocking this plan, since
  fixing it is a `packages/crossvalidate/src` change and this plan ships no new
  public surface — alongside bugs 0097/0098, already linked above, against the
  same package.
- **The `files` entry point** — a selection factory, not a dialect-pair binding;
  not a dogfood target.
- **The adopter-facing examples** — that is plan 0091.
- **Per-dialect sufficiency** — plan 0089. **Sibling gates going fail-closed** —
  plan 0101. This plan mounts bindings; neither of those changes what a gate
  mounts.
- **Extending the crossvalidate package itself** — this plan only _consumes_ its
  existing bindings on the repo's own artifacts; no new public surface.
- **A production-script e2e non-vacuity tier for these two gates** — no
  `EESS_CROSSVAL_*_ROOT`-style override exists for the `docs/`-corpus roots
  these two gates read (Phase 3, "tier choice"); building one is a real
  follow-on, not this plan's job.

## Success / close

The plan closes when `check:crossval.mjs` mounts **five** of the seven bindings on
the repo's own artifacts — the existing three plus `md↔gherkin` and `md↔mermaid` —
each carrying **both** a green-but-empty floor and a sabotage fixture (message-matched,
not just ruleId-matched) that proves it goes red, and `npm run validate` is
green. Concretely: `docs/crossvalidate.md` carries a resolvable scenario-title
citation with its real path preserved in prose, `docs/architecture.md` embeds a
class diagram that matches `packages/core` in **both** directions and is linked
from `docs/dogfooding.md` rather than orphaned, and `check:nonvacuity` gains two
rows (registered in both `gates` and `GATE_FOR`) that fail if either gate is
neutered — including if either citation or diagram is emptied rather than
deleted. The project that ships "bind two dialects and fail on drift" then
dogfoods the family on itself, not just half of it. `md↔mermaid-er` stays out of
scope indefinitely — a real candidate exists (`work/`'s own entity
relationships) but nobody has scheduled it, and manufacturing one just to
satisfy this gate would repeat the exact failure this plan was reworked twice
to avoid.
