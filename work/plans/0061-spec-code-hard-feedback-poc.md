# 0061 — Spec↔code hard feedback: the EESS PoC

**Status:** IMPLEMENTED (Phases 0–4, 2026-07-06) — PoC PASSED; Phase 5 deferred
**Priority:** High
**Effort:** ~5 phases, 1–2 sessions (Phase 5 is the cuttable one; Phase 4 is not)

## Problem

The EESS thesis: coding agents (and humans) cannot hold a repo's web of specs,
diagrams, ADRs and code in their heads — so spec↔code drift must be caught by a
**deterministic, mechanical feedback loop**, the way `tsc` and a test suite
ground an agent. ts-archunit was the first proof that agents need mechanical
feedback (Tier 1, code-structure facts). This plan is the proof-of-concept for
the next step: **claims written in markdown specs get the same hard feedback.**

The regime this serves (see the manifesto's "The Amnesiac Reader"): every agent
session is stateless; the repo is its only memory; specs are agent _input_, so
a drifted spec is wrong instructions fed to the code generator, and the error
compounds across sessions. False memory is worse than no memory, because the
agent has no independent basis for doubt.

The PoC question is narrow and honest: is this _possible_ (deterministic, zero
false positives, in the agent's loop) and _useful_ (an agent can repair real
drift from the diagnostic alone)? Not: is it a product.

What already exists (survey verified 2026-07-06, **corrected by review** — build
on it, do not reinvent):

| Capability                     | Where                                                                                                                                                          | State         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Compiler-grade diagnostics     | `ArchViolation`: file/line/message/`because`/`suggestion`/`codeFrame`/`docs`                                                                                   | ✅ shipped    |
| Exit codes, watch, incremental | `eess-ts check` — `process.exitCode=1`, `--watch`, `--changed --base`                                                                                          | ✅ shipped    |
| Machine format                 | `--format json` (`format-json.ts`, stable shape)                                                                                                               | ✅ shipped    |
| Generic two-sided binding      | kernel `correspondence({left,right,keyBy,suggest})`, `Selection<T>`, `.beComplete({direction})`, `.preserveRelations()`                                        | ✅ shipped    |
| `.select()` terminal           | **kernel `RuleBuilder` base class** (`packages/core/src/rule-builder.ts:165`) — inherited by **every** dialect's builders, **including all three md builders** | ✅ shipped    |
| Structured md model            | `MdDocument`/`MdSection`/`MdTable`/`MdCodeBlock`; `haveSection`, `haveTable`, `haveTableRowsSatisfying`                                                        | ✅ shipped    |
| Schema precedent               | `adrEnforcement` preset (composes the table conditions)                                                                                                        | ✅ shipped    |
| Cross-dialect rule files       | CLI `runCheck` catches kernel `ArchRuleError` from any builder — dialect-agnostic in principle                                                                 | ⚠️ unverified |

**Review corrections to rev 1's survey** (recorded so the record stays honest):
rev 1 claimed "eess-md has no `.select()`" — false; it is inherited from the
kernel base class and works today (`docs(c).that().resideInFolder(...).select({...})`).
Rev 1 counted "five hand `.mjs` scripts" — there are four, and `check:diagram`
is already a CLI run (`eess-mermaid check mermaid.rules.ts`), not a script.

What is missing (correctly scoped after review):

1. **Rows as elements** — table rows are only reachable via the validation
   callback in `haveTableRowsSatisfying` (`packages/md/src/conditions/table-rows.ts`),
   never as first-class elements a `Selection` can carry. This is the one
   genuinely new API surface.
2. **Proof that md selections feed `correspondence()`** — the capability is
   inherited but untested and undocumented; no integration test exists.
3. **Spec↔code bindings in anger** — no correspondence anywhere binds a spec
   _claim_ (a table row) to a code artifact.
4. **Declaredness beyond ADRs** — coverage ("every X in code is claimed by
   some spec row") exists only as the un-named right-to-left half of
   `beComplete`.
5. **One diagnostic stream** — the gates are split across hand scripts and two
   CLIs; an amnesiac agent must rediscover five bespoke outputs per session
   instead of one command, one exit code, one JSON shape.

## Binding invariants (carried from 0060, extended)

- **No shortcuts.** No baselines, no severity-muting, no scoping-to-pass, no
  violation-hiding ignores. A-priori exclusions (declared before a check runs,
  with a written reason) are allowed. Inline sanctions only via
  `eess-exclude` with a reason.
- **Soundness over completeness.** A check that cannot run with zero false
  positives does not become a gate — it is declared at its honest tier
  instead. One false positive teaches agents to ignore the tool.
- **The consumer principle.** Only bind artifacts something actually reads
  (agent context, human decision, generator). A document nobody consumes is
  deleted, not gated — the historical failure of spec-sync (UML, MDA, CASE)
  was checking unconsumed artifacts. No half-verified rows: if a column of a
  gated table cannot be bound, bind it or delete the column — a green check on
  a partially-verified row lends false credibility to the unverified part.
- **Every phase lands as a gate on this repo** (customer zero) with a
  non-vacuity fixture. Usefulness is demonstrated, not asserted.

## Kill criteria (binding — predeclared falsification)

A PoC without falsification conditions is a hobby. Any of these, observed
during execution, is recorded in the as-built as a verdict-level failure — not
rationalized past:

1. **Ceremony detected.** Any spec table edited solely to satisfy the gate,
   with no consumer of the edited row → that artifact is unbound (or deleted);
   if the pattern repeats across artifacts, the PoC verdict is negative.
2. **Precision failure.** Any inline sanction on a spec gate. Not a "target of
   zero" — a tripwire. Each occurrence is a recorded precision failure.
3. **Feedback isn't hard.** Any gate failure that required human
   interpretation before an agent could act on it. The diagnostic must be
   sufficient by itself.

Conversely, the PoC **passes** only via the Phase 4 closed-loop experiment —
gates merely firing is mechanics, not proof.

---

## Phase 0 — Verify the "one compiler" assumption

The plan's cheapest and most load-bearing facts, verified not assumed:

- **One-shot cross-dialect:** `npx eess-ts check spec.rules.ts --format json`
  where the rules file default-exports md builders. (Mechanism confirmed by
  review: md's `.check()` is the inherited kernel terminal throwing kernel
  `ArchRuleError`, which `runCheck` catches — but run it anyway.)
- **`--watch` cross-dialect:** watch mode reloads with `fresh: true`
  (jiti `moduleCache: false`, `packages/ts/src/cli/load-rules.ts:22`), which
  can re-instantiate `@nielspeter/eess` inside the rule-file module graph — a
  second `ArchRuleError` class fails `instanceof` and would **crash the watch
  loop**. Probe this explicitly; one-shot success does not cover it.
- **Loader silent-drop fix:** `loadRuleFiles` keeps only `.check()`-able
  exports and **silently drops** everything else
  (`packages/ts/src/cli/load-rules.ts:47-51`) — a green-but-empty hazard
  forbidden by this plan's own invariants. Fix in this phase: a non-builder
  value in a rules file's default export array is a **loud error**, not a
  skip. (+ regression test.)

If cross-dialect fails, fix at the right layer (loader or kernel), not with a
wrapper script — that lesson is already paid for.

**Files changed:** `packages/ts/src/cli/load-rules.ts` (loud-error fix + test);
otherwise verification only, findings appended to this plan's as-built.

## Phase 1 — md selections: prove `.select()`, build `rows()`

**1a (rewritten by review). Prove and document inherited `.select()`.** No new
method — it already exists on every md builder via the kernel base class.
Deliverables: an integration test per md builder proving
`docs/links/pointers → .select() → correspondence()` end-to-end against a
two-sided fixture, and a documentation section in `packages/md/README.md`.
Writing a `.select()` implementation on md builders would duplicate an
inherited kernel method — explicitly out.

**1b. `rows()` entry point** — table rows as first-class elements:

```typescript
import { corpus, rows } from '@nielspeter/eess-md'

const c = corpus({ roots: ['README.md'] })

const packageRows = rows(c, {
  section: /^Packages$/,
  columns: { pkg: /^Package$/, status: /^Status$/ },
}).select({
  label: 'README package row',
  identify: (r) => ({ name: r.get('pkg'), file: r.doc.path, line: r.line }),
})
```

Design decisions (review-driven):

- **Real row positions, not arithmetic.** `buildDocument` currently discards
  the mdast per-row `position` it has in hand
  (`packages/md/src/model/document.ts:111-118`). Capture it: `MdTable` rows
  carry their own 1-based `line`. The `table.line + 2 + rowIndex` inference is
  out — for a tool whose contract is zero-false-positive file:line
  diagnostics, record positions, don't derive them.
- **One row type, not two.** `MdRow` becomes the model type
  (`packages/md/src/model/`); the existing public `TableRowContext` derives
  from or aliases it. The section+column matcher moves from `conditions/` to
  `packages/md/src/model/rows.ts` so both `conditions/` and `builders/` import downward
  (same layering direction as the earlier links/pointers model fix).
- **Multi-table policy: union.** `haveTableRowsSatisfying` silently validates
  only the first matching table (`candidates.find`). For `rows()`, every
  matching table contributes rows — silent first-match is unsound for a
  correspondence source. Documented.
- **Cell text is already flat.** `nodeText` flattens bold/links, preserving
  inline-code backticks (`packages/md/src/model/document.ts:66-77`) — so `get(role)` returns
  plain text (backticks included) and no `stripMd` helper is needed or
  shipped. Known limitation, documented: link **URLs** in cells are not
  recoverable from a row (Phase 2b compensates with a `links()` rule).
- **`fork()` safety.** `rows(c, opts)` carries constructor state beyond the
  corpus; `.should()` forks the builder (`rule-builder.ts:59-63`). Test that
  options survive the fork.

**Files changed:**

- `packages/md/src/model/document.ts` (capture per-row positions)
- `packages/md/src/model/rows.ts` (MdRow + shared table/section/column matcher)
- `packages/md/src/builders/rows.ts` (entry point + builder)
- `packages/md/src/conditions/table-rows.ts` (refactor onto shared model helper; `TableRowContext` converges on `MdRow`)
- `packages/md/src/index.ts` (exports)
- `packages/md/README.md`, `docs/markdown.md` (`.select()` + `rows()` docs)

**Tests:**

- rows: table matching by section+columns, union across multiple matching
  tables, `get(role)` mapping, **row line equals the actual file line**
  (fixtures with blank lines/preceding content), empty/no-match → empty
  selection, fork-safety, builder chain (`.that().satisfy()`).
- 1a integration: each md builder's selection consumed by kernel
  `correspondence()` two-sided.
- `haveTableRowsSatisfying` regression suite green after refactor.

## Phase 2 — first spec↔code bindings, gated (`check:spec`)

Dogfood two real correspondences in a new `spec.rules.ts` (its own
`corpus({ roots: ['README.md', 'CLAUDE.md'] })` — these files are outside
`check:corpus`'s roots today), run via the CLI, wired into `validate`:

**2a. README packages table ↔ actual workspace packages.** Right side is a
hand-built `Selection` from `packages/*/package.json` (`Selection<T>` is a
plain object; building one from `fs` in a rules file is legitimate lego use):

```typescript
correspondence({
  left: packageRows,
  right: workspacePackages, // {elements, label:'workspace package', identify: name + package.json path}
  keyBy: nameOf,
  suggest: {
    left: (info) => `remove the README row or restore the package '${info.name}'`,
    right: (info) => `add '${info.name}' to the README Packages table`,
  },
})
  .should()
  .beComplete({ direction: 'both' })
  .because('the README package table is a spec: it must not drift from the workspace')
  .rule({ id: 'spec/readme-packages-match-workspace' })
```

**Known live drift (product review finding — do not pre-fix):** the README
table lists 4 packages; the workspace has 6 (`eess-md`, `eess-crossvalidate`
missing), and the prose below it still calls Markdown a "future dialect". The
gate must land **red on its first run**, catch this for real, and the catch is
recorded in the as-built before the fix commit. This is the strongest
usefulness evidence available; quietly fixing the README first would destroy
it.

**No half-verified rows:** the table's Status column carries hand-maintained
versions ("0.12.x"). Decision: bind it — a row rule checks the cell against
the package's actual `package.json` version (prefix match). If that proves
noisy in practice, the column is **deleted from the README**, and the decision
recorded. A gated table with an ungated column is worse than an ungated table.

**2b. CLAUDE.md ADR index table ↔ `adr/*.md` files.** Both sides markdown —
md↔md correspondence with zero code-side machinery. Every ADR listed is a real
file; every ADR file is listed. Because cell link URLs are not recoverable
from rows (Phase 1b limitation), pair this with a `links(c)` resolve rule over
the same corpus so the `[001](./adr/001-…)` targets are verified too.

**Files changed:**

- `spec.rules.ts` (repo root)
- `package.json` (`check:spec` via `eess-ts check spec.rules.ts`, added to `validate`)
- `scripts/nonvacuity/` (fixtures probed **through the CLI gate**, not by
  importing presets: a README row for a nonexistent package must fail; an
  unlisted ADR file must fail)
- `README.md` (the drift fix — in a separate commit _after_ the red run is recorded)

## Phase 3 — declaredness and coverage

Generalize the Enforcement-table move: totality over claims.

**3a. Directionality as coverage.** Phase 2's `direction: 'both'` already IS
the coverage rule ("every workspace package is claimed by a spec row"). Name
and document the pattern in `packages/md/README.md` and `docs/crossvalidate.md`:
coverage = the right-to-left half of completeness.

**3b. Merged-selection coverage (pattern, not API).** "Every kernel class is
claimed by _some_ spec artifact": `Selection` is a plain object, so
`{ elements: [...a.elements, ...b.elements], label, identify }` needs no
kernel change. Document with the existing diagram gate as the worked example.

**3c (stretch, honesty-gated).** Field-level spec: the published
`ArchViolation` field table (`docs/violation-reporting.md`) ↔ the interface's
actual properties. This binds a table that _already exists and is consumed_
(it's the published API contract) — it passes the consumer principle. Requires
an eess-ts selection over interface properties — verify `types()` surface
supports it in-phase; if it needs new eess-ts API, 3c is dropped here and
recorded, not hacked in.

**Files changed:** docs as above; `spec.rules.ts` (3b/3c if landed);
non-vacuity fixture per new gate rule.

## Phase 4 — the verdict (uncuttable)

The PoC's entire point. Two parts:

**4a. The closed-loop experiment — the headline deliverable.** One full cycle
with no human touching a file:

1. An agent introduces real drift (e.g. renames a workspace package, or adds
   an ADR without an index row).
2. The gate fires. Its `--format json` output is handed to a **fresh agent
   session** with no other context beyond the repo.
3. The fresh agent repairs spec or code **from the diagnostic alone** — no
   human interpretation (kill criterion 3 if it can't).
4. The human ratifies the resulting spec diff in chat.

The transcript (diagnostic in, repair out) is recorded in the as-built. This
is the observation that distinguishes "gates fire" from "the loop closes."

**4b. Verdict inputs, recorded:**

- The Phase 2a first-run catch of the pre-existing README drift (live-drift
  evidence).
- Kill-criteria evaluation: each of the three, with the observations.
- Sanction count on spec gates (tripwire, expected 0).
- Wall-clock for `check:spec` (agent-loop viability; record, don't optimize).
- **an external repo expressibility assessment (paper, not code):** can the shipped
  eess-md surface express the external repo's hand-built `graph:check` (link integrity
  over an identical `work/` corpus)? If no — name the missing API. "Useful"
  must mean useful beyond the repo that built it; this is the cheapest honest
  proxy short of the actual migration (which is its own follow-up plan).

**Files changed:** this plan (as-built record), `CLAUDE.md` (short "For coding
agents" section: run the check, parse `--format json`, treat violations as
compiler errors).

## Phase 5 — one compiler loop (cuttable; do not let it eat Phase 4)

Consolidate the gates so an amnesiac agent rediscovers ONE command per
session, not five bespoke outputs:

- **Named architectural decision required first** (review finding): the
  crossvalidate/md presets are void-and-throwing (ADR-006: presets are
  functions), but the CLI loader accepts only `.check()`-able builders — the
  repo's own `check-crossval.mjs` documents this collision. Options to decide
  between: (a) presets gain builder-returning variants; (b) a kernel
  `asRule(fn)` adapter that wraps a void preset as a builder **honoring
  `CheckOptions`** (formatting lives in `executeCheck` — a naive
  `{check: () => preset()}` shim would break `--format json`/baseline/diff).
  This may warrant an ADR-006 amendment; if the decision needs its own plan,
  Phase 5 stops here and says so.
- Migrate `check:corpus` / `check:crossval` internals to rules files run by
  `eess-ts check`; `mermaid.rules.ts` (already a CLI rules file) moves under
  the same invocation. The `.mjs` scripts remain only where the CLI genuinely
  cannot express the check (record which, why).
- **Re-point the non-vacuity harness** (review finding): the corpus/crossval
  fixtures currently import presets directly — after migration they would
  prove a dead code path while the shipping gate goes unprobed. Every migrated
  gate is probed the way `gateArch` already does it: run the actual CLI
  against violating input.
- Populate `ArchViolation.suggestion` on correspondence violations (currently
  embedded in message text only — JSON consumers reading the field get
  nothing).

**Files changed:** `package.json` (scripts), `scripts/check-{corpus,crossval}.mjs`
(deleted or thinned), `corpus.rules.ts` / extended `spec.rules.ts`,
`scripts/check-nonvacuity.mjs` (re-pointing), kernel `correspondence.ts`
(suggestion field), possibly `adr/006-*` (amendment) — each with tests.

---

## Test inventory (aggregate)

| Area                         | Tests                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| Loader loud-error (Phase 0)  | non-builder export → error not silent skip                                                       |
| Cross-dialect CLI (Phase 0)  | e2e one-shot + **watch** with md rules; json shape                                               |
| `rows()` model + builder     | table/section/column matching, **union of matching tables**, real row lines, fork-safety, chain  |
| `.select()` integration (1a) | docs/links/pointers selections → kernel correspondence, two-sided fixtures                       |
| `table-rows.ts` refactor     | existing suite green (regression)                                                                |
| Gates                        | non-vacuity via CLI probe: readme-package drift, ADR-index drift, (3b/3c if landed)              |
| Phase 5 (if executed)        | migrated gates re-probed via CLI; suggestion field populated; preset adapter honors CheckOptions |

## Out of scope (explicitly — each is its own future decision)

- **external-repo migration** (replace `graph:check` with eess-md in the first
  external repo) — the natural follow-up plan and the true "useful outside
  customer zero" proof; Phase 4b's paper assessment is its feasibility gate.
- **MCP server / editor integration** — `--format json` + watch is the PoC
  agent surface.
- **Tier 2 (workflow/behavior dialect), Tier 4 (LLM validator)** — the
  probabilistic layer belongs to the portable extraction/QA agents.
- **Diff mode** (`validator(proposed) − validator(current)`).
- **"No claim without ratification"** (provenance gating: every spec claim
  traces to a decision record) — the post-PoC direction the manifesto now
  names; needs the PoC's primitives first.
- **A Java dialect** — tier is not mechanism; ArchUnit covers Java Tier 1.
- **Performance work** beyond recording the numbers.
- **Publishing/cutover** — unchanged, user-gated.

## Success definition

The PoC **passes** iff the Phase 4a closed loop completes: drift introduced →
gate catches it → a fresh agent repairs from the JSON diagnostic alone → human
ratifies in chat — with zero kill-criteria trips along the way. Gates landing
green (Phases 1–3) is necessary mechanics, not success. If a kill criterion
trips or the loop needs human interpretation, the as-built records a negative
or partial verdict and its cause — a legitimate PoC outcome; the point of
predeclaring the criteria is that the verdict is not the author's mood.

## Review record (rev 2)

Architect + product review, 2026-07-06. Material corrections adopted:
Phase 1a rewritten (`.select()` is inherited from the kernel base class —
rev 1 would have duplicated it); real mdast row positions instead of line
arithmetic; `MdRow`/`TableRowContext` converge; multi-table union policy;
loader silent-drop becomes a loud error; `--watch` dual-instantiation probe;
non-vacuity re-pointing requirement for Phase 5; preset-contract collision
named as a decision, not hand-waved; kill criteria added as a binding
section; closed-loop experiment promoted to the headline deliverable;
verdict (Phase 4) split from consolidation (Phase 5) so the cuttable work
cannot eat the uncuttable; known live README drift recorded as
first-catch evidence rather than pre-fixed; version column bound or deleted
(no half-verified rows); an external repo expressibility assessment added as a verdict
input.

## As-built record (2026-07-06) — VERDICT: the loop closes

Phases 0–4 executed on branch `eess-consolidation` (not merged/published).
Phase 5 deferred (see below). **PoC verdict: PASS.**

### Per-phase delivery

| Phase | Delivered                                                                                                     | Commit(s)           |
| ----- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| 0     | `loadRuleFiles` loud-errors on non-builder/mis-shaped exports (+4 inverted tests); cross-dialect CLI verified | `0e583bd`           |
| 1     | `rows()` entry point + `MdRow` (real mdast row lines); `.select()`→`correspondence()` proven; md suite 29→39  | `ee0671e`           |
| 2     | `check:spec` gate (`spec.rules.ts`): README↔workspace + CLAUDE.md ADR index↔`adr/`; CLI non-vacuity fixture   | `48045bc`,`19b4d20` |
| 3     | coverage = right-to-left completeness, documented; merged-selection pattern; 3c dropped (honesty gate)        | `34e1195`           |
| 4     | closed-loop experiment; `CLAUDE.md` "For coding agents"; this record                                          | (this commit)       |

### Phase 0 findings (the load-bearing verifications)

- **Cross-dialect one-shot works.** `eess-ts check spec.rules.ts` runs md
  builders, exits 1 on violations, renders correct `--format json`.
- **The `--watch` hazard does NOT materialize.** The review flagged that
  `fresh: true` jiti (`moduleCache: false`) might re-instantiate
  `@nielspeter/eess` and break `instanceof ArchRuleError`. Probed directly:
  `instanceof` stays true (jiti busts only its own rule-file cache, not node's
  `node_modules` registry). No watch-loop crash.
- **Loader silent-drop fixed** at the right layer (not a wrapper): a
  non-builder in a rule file's default export now throws, naming file + index.

### Phase 2 — the live-drift catch (headline usefulness evidence)

`check:spec` landed **red on its first run** (commit `48045bc`) and caught real,
pre-existing drift with a both-sided, actionable message:

```
spec/readme-packages-match-workspace (2):
  @nielspeter/eess-md            in workspace, missing from the README table
  @nielspeter/eess-crossvalidate in workspace, missing from the README table
```

The README also still called Markdown a "future dialect". Fixed in the next
commit (`19b4d20`) — the catch is in git history, not quietly pre-fixed. The
Status column is bound too (cell must contain the package's real major.minor),
so no half-verified row lends false credibility.

### Phase 4a — the closed-loop experiment (the actual proof)

One full cycle, no human touching a file:

1. **Drift introduced:** the `@nielspeter/eess-md` row deleted from the README.
2. **Gate fired:** `check:spec --format json` → 1 violation, naming the element
   (`@nielspeter/eess-md`), the source of truth (`packages/md/package.json`),
   and the fix (`add a row … to the README Packages table`).
3. **A fresh agent repaired from the diagnostic alone.** Given only the JSON and
   repo access (no plan, no design doc), it added the correct row and confirmed
   `check:spec` exit 0. Its honest report: the diagnostic gave _what_ and
   _where_; it derived the row's descriptive cells by reading the
   `packages/md/package.json` the diagnostic pointed at — **no human
   interpretation.**
4. Ratification is the human accepting the diff in chat (this record).

The diagnostic being sufficient for a cold agent to act — without asking a
human what it means — is exactly kill criterion 3 not tripping.

### Kill criteria — evaluated, none tripped

1. **Ceremony?** No. Every bound artifact is consumed: the README table is the
   install-decision surface on npm/GitHub; the CLAUDE.md ADR index is loaded
   into every agent session; the Status column reflects published versions. No
   row was edited only to satisfy the gate.
2. **Precision failure?** No. **Zero sanctions** on the spec gates
   (`grep eess-exclude spec.rules.ts` → 0). Zero false positives across
   the repo — the two catches were real drift; the status/ADR/link rules passed
   correctly. Full `npm run validate` green (exit 0) with `check:spec` wired in.
3. **Feedback not hard?** No. The fresh agent acted on the JSON alone.

### Verdict inputs

- **Live-drift catch:** yes — 2 real drifts on first run (above).
- **Sanctions on spec gates:** 0.
- **Wall-clock for `check:spec`:** **0.41s** — comfortably inside an agent's
  inner loop; no optimization needed.
- **an external repo expressibility (paper proxy for "useful beyond customer zero"):**
  the external repo's hand-built `graph:check` guards md↔md cross-links and md↔code
  pointers over an identical `work/` corpus. Its **core CI gate is directly
  expressible** with shipped eess-md — `links(c).that().areInternal().should().resolve()`
  - `pointers(c).that().areLive().should().resolve()`, with `frozen` folders for
    `completed/`/`delivered/` — which is exactly what `check:corpus` already runs
    here. Two `graph-render` report features (orphan docs, ID-collision) are
    expressible via `correspondence()`/`satisfy()` but not as one-line presets
    (need assembly). `graph:fix` (autofix) is a **non-goal** — eess validates, it
    does not rewrite. No blocking missing API for the primary link/pointer job;
    the external repo migration is a viable follow-up plan.

### Scope deviations

- **3c dropped (honesty gate honored):** binding the `ArchViolation` field table
  to the interface's properties needs a property-level eess-ts selection;
  `types()` selects whole type declarations only. Rather than reach into
  ts-morph from a rules file, it is dropped and recorded — its own future plan.
- **Phase 5 (consolidation) deferred, not executed.** It is the explicitly
  cuttable phase; the review's condition (a named ADR-006 decision on the
  void-preset/loader-contract collision before migrating the `.mjs` gates) is
  real design work that deserves its own plan, and Phase 4 (the verdict) is
  complete without it. The repo keeps its per-gate scripts; `check:spec` runs
  via the CLI directly. Deferred items: the preset→builder adapter honoring
  `CheckOptions`, migrating `check:corpus`/`check:crossval` onto the CLI,
  re-pointing their non-vacuity fixtures, and populating
  `ArchViolation.suggestion` on correspondence violations (today the fix is
  embedded in the message text, which is why the fresh agent still succeeded).

### Bottom line

Deterministic spec↔code drift detection is **possible** (zero false positives,
zero sanctions, 0.41s) and **useful** (caught real drift on first run; a cold
agent repaired it from the diagnostic alone). Within the all-agent regime the
manifesto describes, `check:spec` is a fourth feedback loop — `tsc` for the
markdown specs an amnesiac agent reads as its memory.
