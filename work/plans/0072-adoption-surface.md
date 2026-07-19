# Plan 0072: Adoption surface — front door, agent-loop recipes, five-minute red gate

## Status

- **State:** Ready — floor frozen 2026-07-19: evidence base in-corpus
  (research doc, dated), all touched files and mechanisms verified to exist,
  recipe contents and guidance text internalised by value, no open questions.
  Reviewed via PR #8.
- **Priority:** P1 — the market-signals research concluded the scarce resource
  is adoption attention, not capability; the window where "we already built
  this, with proofs" differentiates is open but closing.
- **Effort:** Phase 1 ≈ 0.5 session · Phase 2 ≈ 0.5 session · Phase 3 ≈ 1
  session · Phase 4 ≈ 0.5 session · Phase 5 ≈ 0.25 session.
- **Created:** 2026-07-19

## Problem

eess is capability-rich and adoption-poor: six packages on npm with provenance,
a dogfooded gate chain, agent-grounding features (`agentGuardrails`,
`explain --format agent`, `eess-ts init`) — and effectively zero external
users. The front door doesn't sell what the market is asking for.

Evidence, distilled in
[the external-signals research doc](../research-external-signals-2026-07.md):

1. **The buyer's pain is agent slop, not spec management.** Every channel in
   the 186-summary sweep converged on "AI agents ship confident drift that
   green checks don't catch." Nobody searches for a "specification system";
   they search for guardrails, oracles, drift gates.
2. **The README leads with the platform, not the wedge.** The family (kernel +
   five dialects) is the moat, but platforms don't get adopted — wedges do.
   The 60-second path (`npx eess-ts init` → guardrails enforcing →
   `explain --format agent` into the agent's prompt) exists and is buried.
3. **The acronym works against the pitch.** "Executable Enforceable
   Specification System" reads as spec-driven path-dictation — the framing top
   practitioners now reject ("the map is not the territory"). eess actually
   verifies **constraints on the finished work**; the front door should say so.
   (A full rename was evaluated 2026-07-19 and declined — `eess` stays as a
   plain name; the expansion is demoted to heritage.)
4. **The strongest external critique — rule staleness — has no stated answer.**
   Multiple practitioners argue rules must be retired as models improve. eess
   accumulates enforcement monotonically and says nothing about it. A stance
   costs a paragraph; the mechanism is future work (0073).
5. **The consumption point is inside the agent loop.** CI-fail→agent-fix is now
   a native pattern in the major harnesses, and eess's `--format json` +
   `because`/`Fix:` output was built for exactly that — but no recipe shows
   the plumbing.

One theme: **make eess findable, and adoptable in five minutes.** Docs and
positioning only — no engine changes.

## Implementation phases

### Phase 1 — README inversion (the front door)

Restructure the root `README.md` to lead with the wedge:

- New opening: what it is in buyer vocabulary — _architecture guardrails for AI
  coding agents; deterministic gates that ground the agent loop; drift fails
  the build_ — then the 60-second path as the first code block:
  `npx eess-ts init` → `npx eess-ts check` → `eess-ts explain arch.rules.ts
--format agent` pasted into the agent's instructions.
- The family/dialect story moves down, reframed as "and it grows into…" (the
  moat, chapter three — not the headline).
- "eess validates eess" (the dogfood + non-vacuity section) stays prominent —
  it is the credibility asset — but gains one sentence naming the reward-hacking
  context (green checks are gameable; ours provably fail on bad input).
- **Constraint:** `check:spec` binds the Packages table and structure to the
  workspace — the inversion must keep every bound element intact (reorder and
  reframe, don't drop). `check:corpus` gates all links.

**Files:** `README.md`. **Validation:** `check:spec` + `check:corpus` green;
the wedge path appears before any mention of dialects.

### Phase 2 — Manifesto: heritage, positioning, staleness stance

- **Acronym → heritage.** The expansion becomes a one-line origin note in
  `docs/manifesto.md` ("the name comes from…"); nothing else leads with it.
- **"Constraints, not a map" section.** State the position explicitly: eess
  does not dictate the agent's path; it verifies invariants on the finished
  work. This pre-empts the legitimate anti-spec-framework critique.
- **Staleness stance paragraph.** Acknowledge the critique (rules can outlive
  their usefulness as models improve); state the design answer: enforcement
  rows already carry status vocabulary; a `review-by` discipline and
  telemetry-driven retirement (violation-history analysis) are planned as 0073.
  Honest, one paragraph, no mechanism promised beyond what's real.

**Files:** `docs/manifesto.md`, `README.md` (tagline echo). **Validation:**
`check:corpus` green (the manifesto is a live corpus document).

### Phase 3 — Agent-loop integration recipes

A new `docs/agent-integration.md` (linked from README + the eess-ts README)
with three copy-paste recipes:

1. **GitHub Action** — run the gate chain on PRs, `--format github` for inline
   annotations; note the `npm rebuild` bin-linking step CI needs (learned in
   this repo's own pipeline).
2. **Claude Code hook** — a settings snippet running `check:fast` (or
   `eess-ts check --changed`) as a Stop/PostToolUse hook so violations reach
   the agent in-loop with `because`/`Fix:`, not post-hoc in CI.
3. **AGENTS.md sentinel workflow** — `eess-ts explain arch.rules.ts --format
agent` emits a sentinel-wrapped imperative block; the recipe shows the
   idempotent-update loop (regenerate on rule change, replace between
   sentinels) so the agent's standing instructions never drift from the actual
   rules — eess eating its own drift-prevention dogfood at the prompt layer.

Each recipe is verified by actually running it once against this repo (or a
scratch repo) before it's documented — no untested snippets.

**Files:** `docs/agent-integration.md` (new), links from both READMEs.
**Validation:** `check:corpus` green; each snippet executed once.

### Phase 4 — Quickstart around time-to-first-red-gate

The adoption metric: **a newcomer hits a genuine, correct violation within
five minutes of `init`.** A green-only quickstart proves nothing (a vacuous
onboarding, by our own standards).

- Rework the quickstart (eess-ts README + `docs/what-is-eess.md` intro path)
  so the demonstrated loop includes a real red: run `init` on a project with
  source, see the floor preset catch something (or, on a clean codebase, the
  documented 30-second "introduce a violation, watch it fail, revert" probe —
  the same move `check:nonvacuity` makes, offered to the user as proof the
  gate is real).
- Time the path end-to-end once, honestly; adjust until it fits five minutes.

**Files:** `packages/ts/README.md`, `docs/what-is-eess.md`. **Validation:**
`check:corpus` green; the timed walkthrough documented in the plan's ledger at
close.

### Phase 5 — Skill-guidance touch-ups (research candidates #8 + #9)

Two paragraph-sized additions from the research doc that are too small to be
plans and would otherwise rot unhomed:

- **`skills/eess-adr-author`** gains the ADR authoring heuristic (write an ADR
  only when the decision is hard to reverse, surprising without context, or a
  real trade-off — Pocock's criteria).
- **`skills/eess-adr-validate`** gains the judge-sycophancy checklist: ask
  neutral, adversarial, binary questions; never show the judge the desired
  conclusion; know the drift triggers (expert citation, emotional stakes, long
  context) — Anthropic safeguards.

**Files:** `skills/eess-adr-author/SKILL.md`, `skills/eess-adr-validate/SKILL.md`.
**Validation:** `check:corpus` green. Effort ≈ 0.25 session.

## Out of scope

- **Violation telemetry / staleness engine** — plan 0073 (number reserved on
  the board as an idea row; research-doc candidates #1+#2); this plan ships
  only the stated _stance_.
- **Renaming** — evaluated and declined 2026-07-19; `eess` stays.
- **New dialects, new rules, engine changes** — nothing in `packages/*/src`
  changes in this plan.
- **`eess-ts init` behavior changes** — the scaffolder is used as-is; if the
  quickstart exposes gaps, they become their own items.
- **Paid marketing / site build-out** — docs in this repo only.

## Success definition

- The README's first screen contains the wedge (init → check → explain
  `--format agent`) and the buyer-vocabulary pitch; no acronym expansion above
  the fold anywhere.
- The manifesto carries the heritage note, the "constraints, not a map"
  position, and the staleness stance.
- Three integration recipes exist, each executed once before documented.
- The quickstart demonstrably reaches a red gate; the five-minute claim was
  timed, not asserted.
- `npm run validate` green end-to-end (`check:spec`'s README bindings intact).

## Progress ledger

- [x] Phase 1 — README inversion — done 2026-07-19; wedge (init → check →
      explain --format agent) is the first section, family reframed as the moat,
      Packages table + all bound elements preserved byte-identical.
- [x] Phase 2 — manifesto — done 2026-07-19; H1 → "The eess manifesto" with the
      acronym as an origin note; "Constraints, not a map" after the Core Thesis;
      "Rules age — enforcement is not monotone" after the status section
      (retirement = `deprecated` status transition, Tier-5 human act; mechanism
      → plan 0073).
- [x] Phase 3 — agent-loop recipes — done 2026-07-19; `docs/agent-integration.md`
      with CI action, Claude Code hook, AGENTS.md sentinel script. All three
      executed first against the **published** npm package in a scratch project:
      the sentinel loop proven idempotent (2 runs, 1 sentinel pair, guard added
      after the first execution wiped on empty output), `--format github`
      annotations verified, the monorepo-vs-consumer `npm rebuild` nuance
      corrected (consumers don't need it; only source workspaces do).
- [x] Phase 4 — quickstart — done 2026-07-19; both entry docs now demonstrate a
      genuine red + the introduce-violation-revert probe. **Timed:** npm init →
      red gate in 2s on a warm npm cache (cold adds only npm download time) —
      the ≤5-min claim holds with wide margin. Verified the scaffolded rules are
      all blocking (exit 1), so the demonstrated red is a true red.
- [x] Phase 5 — skill touch-ups — done 2026-07-19; Step 0 (ADR-worthiness
      heuristic) in eess-adr-author; "Guard your own judgment" anti-sycophancy
      subsection in eess-adr-validate.
- [ ] Board row updated to Done · validate green

**Finding (out-of-scope defect, to file as /bug):** executing the wedge against
a fresh `npm init -y` project exposed that `eess-ts init` scaffolds an
ESM-syntax `eess-ts.config.ts` without ensuring `"type": "module"` — the setup
crashes on first `check` in a CJS-default project (works in this repo only
because the root is already ESM). Recipes/quickstart document the
`npm pkg set type=module` prerequisite as the interim answer; the real fix
(init sets or verifies it, or fails loudly) is init behavior — out of scope
here per this plan, owed to a bug item.
