# Plan 0068: Working-Method Kit

## Status

- **State:** Done — the full portable kit shipped under `kit/` (7 skills · seed
  templates · cold-start board stub · `AGENTS` nudge · zero-dep bootstrap) on top of
  Phase 3's gate; `working-method.md` is current; and eess now **dogfoods** the
  ledger gate on its own corpus (`check:ledger` in `validate`).
- **Priority:** P2 — packaged a proven internal practice for reuse
- **Effort:** delivered across two branches — the thin spine, then the full kit + dogfood
- **Created:** 2026-07-09
- **Refined:** 2026-07-09 — Phase 3 updated from the consumer PoC
  (its PR #68): the
  clause↔mechanism split (mdast vs. zero-dep emulation), the three named findings,
  and the gate/absence asymmetry. The validation half feeding the authoring half.

### Progress ledger — this plan closing honestly on itself

The plan's own **honesty at close** applied to the plan: every phase disposed, and
its "first real dogfood" (per Phase 3) made literal — eess now runs `check:ledger`
on this very corpus, and this plan is the first item closed by the convention.

- [x] **Phase 1 — method current + kit seeds.** `working-method.md` brought current
      (tier model + harness pairing · three-layer + promote-a-clause · nudge-not-instruct
      · corpus-is-the-template); seed plan/bug templates, the cold-start board stub, and
      the `AGENTS` nudge shipped under `kit/`.
- [x] **Phase 2 — workflow skills.** All 7 shipped to `kit/skills/` — `/plan`,
      `/plan-ready`, `/plan-build`, `/bug`, `/close`, `/refine`, `/case` —
      de-projected from the consumer PoC into the language-neutral kit.
- [x] **Phase 3 — the one gate.** The `eess-md` `honestyAtClose` preset + `taskItems`
      primitive; cut over in the consumer PoC (PR #68), and now wired into eess's own `validate`
      as `check:ledger`.
- [x] **Phase 4 — bootstrap.** `kit/bootstrap.mjs` — zero-dep, dry-run-by-default,
      idempotent; installs skills + corpus skeleton + method doc + nudge. Smoke-tested.
- [x] **eess self-adoption (dogfood).** `check:ledger` wired into `validate`; the
      plans corpus migrated to the terminal-`State:` + `completed/` convention; this
      plan is the first item closed by it.

Deferred: none. The portable kit (Phases 1–4) and eess's own dogfood are complete.

## Problem

eess packages the **mechanical** half of harness engineering — the tier model,
`eess-ts`, and `eess-md`'s `check:corpus` (see [eess as a
harness](../../../docs/eess-as-a-harness.md)). But the _other_ half — **how a
human + AI team actually works**: triage, plan/bug/refinement lanes, the honest
close-out, the corpus-as-memory — has lived only as tacit habit, re-typed into
prompts every session. It is now written down as [the working
method](../../../docs/working-method.md), and it is genuinely proven: it has
produced hundreds of completed plans across more than one project. Two costs
remain:

- **Repetition.** The human re-narrates the same mechanics every time ("next
  number, put it on the board, review it, close it honestly, move it") — the
  method's own most-cited friction.
- **Portability.** Introducing the method to a new project today means
  hand-copying tribal knowledge; there is no kit to drop in.

This plan packages the method into a **portable, agent-usable kit** so the
guidelines half of the harness is as reusable as the mechanical half. It also
brings [`working-method.md`](../../../docs/working-method.md) _current_ — that draft
predates the tier-pairing, the three-layer (docs / skills / gates) model,
nudge-not-instruct, and the corpus-is-the-template insight. The two costs retire
in **different phases** — Phase 1 buys _portability_ (a new project can adopt);
Phase 2 buys back the _repetition_ (the skills carry the mechanics, so the human
gives a one-line intent). The MVP alone does not remove the repetition; the plan
says so plainly rather than implying it.

Related: plan [0067](../0067-harness-informed-roadmap.md) _informs_ this (the
harness thesis and quick wins) but isn't a blocker; the one hard dependency is
`eess-md` (plan [0058](./0058-markdown-dialect-eess-md.md)), which Phase 3's gate
builds on. The "Workflow dialect" idea sits at ROADMAP row 9 (a _mechanical_
workflow validator — deliberately **not** this plan; see Out of scope).

## Design principles (from the method itself — this plan obeys them)

This kit is built the way the method says to build things, and it is the first
dogfood of the method-as-product:

- **Light and discoverable; nudge, not instruct.** A skill is a paragraph, not a
  manual — the model already knows how to write a plan. Aim the nudge at the few
  things models actually forget (above all: _state the deferrals out loud_), not
  at the whole procedure.
- **Structure the memory and the handoffs, never the thinking.** Skills encode
  the stable _mechanics_; the judgment stays free.
- **Three firm things only** (honesty at close; point-don't-duplicate; keep
  cross-references alive). Everything else is a deviate-when-it-serves default.
- **Determinism only at the mechanical floor; honesty about the rest.** Promote a
  clause to a gate only when it's a mechanically-knowable fact; keep the
  unenforced surface queryable.
- **The corpus is the template.** Seed a template _only_ for a cold-start project;
  it becomes vestigial the moment real examples exist.

## Implementation phases

### Phase 1 — Make the method current + seed templates (the MVP — buys portability)

Bring [`working-method.md`](../../../docs/working-method.md) up to where the thinking
actually landed, in the same light voice (additions are nudges, not a spec): the
tier model and its harness pairing; the **three-layer system** (method docs /
agent-callable skills / mechanical gates) and the _promote-a-clause_ path;
nudge-not-instruct; corpus-is-the-template; and the **draft→ready freeze** (point
live authority, record settled decisions by value) with its **draft/ready state
distinction**. That list is an _enumerated checklist_, so "the doc is current" is a
mechanically checkable claim, not a vibe. (The last item — the freeze, the
draft/ready distinction, and the sharpened firm principle #2 — already landed in the
doc during this plan's own refinement; the tier / three-layer / nudge / template
items remain.) Then write **seed templates** — a minimal plan template and bug
template — for the _cold-start_ case only (a fresh project with no examples to
deduce a shape from), each marked plainly _"delete once real examples exist."_
Seed a one-line **board/lane stub** beside them so an authored item has somewhere
to land — item templates alone don't tell a cold project where the board lives.
**Fix the ledger convention once, here** — the exact close-out format (disposition
tokens + an optional `deferred:` summary) _and a standardized `State:` done-token_ (a
required leading `Done` / `Won't-do`) that Phase 3's `check:ledger` keys on — so
template and gate can't diverge, and the gate's "done" selector has something
deterministic to match (eess closes by free-form status today, so this is a real
dependency). Add a **thin nudge in the project's agent-entry doc**
(`AGENTS.md`, `CLAUDE.md`, whatever the project uses) pointing at the method and
noting the skills exist.

**Effort ≈ 0.5 day. Acceptance:** the doc-current checklist is satisfied
(mechanical); and — _manual, validation-owed_ — a fresh agent given only the doc
plus a seed template authors a well-shaped plan that lands on the seeded board.

### Phase 2 — Workflow skills (the toil-killer — this is the phase that retires the repetition)

Agent-callable skills, each a **thin nudge** (a paragraph, not an SOP) that
operationalizes the repetitive mechanics and guards the failure modes models
actually have — reading the _shape_ from the corpus and the _why_ from the method
doc, never re-describing either. They are **lane-grouped where a lane has a
multi-stage lifecycle** — the plan lane prefixes under `/plan-*` so tab-completing it
reveals the whole sequence — while single-action lanes keep a bare, self-describing
root (`/bug`, `/refine`, `/case`). The convention is **bare root = author (the common
case), suffixes = later lifecycle stages.** The one genuinely cross-lane action,
**closing**, is a _single universal `/close`_ acting on whatever item is in context —
the ledger ritual is identical across lanes, so one name (rather than `/plan-close` +
`/bug-close`) keeps it from duplicating one behaviour under many. They map to the plan
lifecycle (_refinement → `/plan` → draft → `/plan-ready` → ready → `/plan-build` →
`/close` → done_), each callable by the agent, not only the human, and deliberately
**split** — draft→ready and ready→impl are distinct committed acts, so the freeze
gets its own skill rather than hiding as a step of authoring:

**Core**

- **`/plan`** — _when:_ something's agreed to be a plan (new work or a refactor).
  _Runs:_ confirm it's really a plan → next free number (checked against the board)
  → house shape from the corpus → write + link any prerequisite ADRs → on the board
  → optionally fan out review subagents → **stop at `State: Draft`.** _Guards:_
  number collisions, un-placed board entries, decisions buried instead of ADR'd, and
  barrelling into implementation.
- **`/plan-ready`** — _when:_ you commit to build a draft. _Runs:_ the **freeze** —
  harvest the ripe refinement, **internalise every load-bearing artifact** (export
  the design frame into the corpus, distil decisions into plan/ADR), downgrade
  live-source links to dated provenance, resolve or re-home every open `[ ]`, set
  `State: Ready`, and **refuse the flip while the floor still dangles** — a
  skill-prompted checklist walk (dangling links, un-internalised artifacts, open
  `[ ]`), _not a gate_ (Phase 3 explains why the freeze stays judgment). _Guards:_
  the most-forgotten discipline — marking "ready" while the floor still dangles.
- **`/plan-build`** — _when:_ "go build NNNN," interactively or handed off
  autonomously (a worktree). _Runs:_ **refuse unless `State: Ready`** (a draft is not
  a work order) → load the plan's declared context and the real code first →
  implement → keep status live → stop before merge with _the diff is reviewed._
  _Guards:_ the autonomous failure modes — starting from a drifted/uncommitted plan,
  ignoring existing patterns, going silent, self-merging.
- **`/bug`** — _when:_ a concrete defect, standing alone. _Runs:_ confirm it's a bug
  → number + bug shape → **red test first** → fix → green → hand to `/close`.
  _Guards:_ fixing before reproducing.
- **`/close`** — _when:_ the work is merged-and-green (move-to-done authored _in_ the
  PR); acts on whatever item is in context (plan or bug — only the done-folder
  differs, the ritual doesn't). _Runs:_ walk the ledger → mark each part done /
  done-otherwise / deferred-with-a-home / dropped-on-purpose → **say the deferral
  count out loud** → re-home every deferral → move the file to the lane's done-folder
  in the same PR → update the board → run **`check:ledger`**. _Guards:_ silent
  deferral and the orphaned post-merge move. _(Gate: `check:ledger`.)_

**Optional (only where the lane exists)**

- **`/refine`** — the volatile pre-plan lane: append with a **dated pointer** to the
  live source (never a mirror), track open `[ ]`, mark a topic **ripe**, then suggest
  `/plan`. Deliberately **ungated** — it's working memory; `/plan` + `/plan-ready` is
  where it hardens.
- **`/case`** — support: log a customer case with **raw evidence by pointer**, keep
  the _case_ distinct from the _defect_, spawn a `/bug` that **internalises** the
  repro. Case points; bug freezes.

**Cross-cutting.** Each skill **points at the corpus for shape** rather than
embedding it — "points, doesn't embed" is an inspectable review criterion, because a
skill that re-describes a plan's shape has bloated into the manual the thesis
rejects. At cold-start the shape source is Phase 1's seed template; it hands off to
the corpus once real items exist, which is why the template is safe to delete only
_then_. Two are **load-bearing** — `/plan-ready` (the freeze checklist) and `/close`
(paired with the one gate, `check:ledger`) — guarding the two firm-principle failure
modes (a dangling floor at start, a silent deferral at close); the rest just kill
repetition.
**The thinking gets no skill** — no `/design`, no `/decide`; triage is a beat inside
`/plan` and `/bug` until a busy intake funnel earns its own.

**Effort ≈ 1.5 sessions. Acceptance (manual / validation-owed):** one recorded run
each of the happy path (`/plan → /plan-ready → /plan-build → /close`) and the
short path (`/bug → /close`) completes from a one-line intent, reading shape from
the corpus rather than re-describing it; `check:ledger` fires at close (proven for
real in Phase 3), and `/plan-ready` runs the freeze as a checklist, not a gate.

### Phase 3 — Harness pairing (promote the one gate; be honest about the rest)

Apply eess's own move to the method: name, per clause, whether it's _documented /
skilled / gated_. Most stay Tier-4 judgment (docs + skills). Two are already gated —
_point-don't-duplicate_ and _keep cross-references alive_ are `eess-md`'s
`check:corpus`. Exactly **one** more clause has a mechanically-knowable slice worth a
gate: **honesty at close**.

**`check:ledger` (the one new gate).** Be honest about _which_ slice is knowable:
whether a `deferred:` declaration is **truthful** is Tier-4 judgment (the reviewer
checking the ledger against the diff). The knowable fact is only the **silent** case
— the method's own "silence is not 'nothing deferred.'" So this is a
**ledger-reconciliation** check, tagged _form-gated / content-judgment_, a
necessary-not-sufficient floor with the reviewer as the real enforcer:

- **What it asserts** — three mechanically-knowable findings: (1) _silent-open-box_ —
  an item counted as _done_ has an unchecked task box with no inline disposition
  (`done-otherwise` / `deferred→<home>` / `dropped-on-purpose` / `validation-owed`);
  (2) _deferred-none-lie_ — a `deferred: none` summary is contradicted by a
  `deferred→…` box (the summary can't override the boxes); (3) _state↔folder
  mismatch_ — a terminal `State:` disagrees with the folder (a `Done` item stranded
  in an active folder, or a draft/open item under a done-folder). Note the deliberate
  asymmetry the consumer PoC pinned down: the _contradiction_ (`none` vs a real
  deferral) is gated, but the mere _absence_ of an out-loud `Deferred:` summary is
  **not** — a `deferred→<home>` box already names its home, so demanding a summary
  line too would be the ceremony the "nudge, not instruct" thesis rejects. The gated
  failures are silence and self-contradiction, not missing paperwork.
- **Where it lives:** a _separate_ script (e.g. `check:ledger`) in the `validate`
  chain — **not** folded into `check:corpus`, whose `completed/` set is deliberately
  _frozen — reported, never gated_. It inverts that, taking done-items as its _only_
  scope. "Done" is per-project: a done-folder _or_ a terminal `State:` — which means
  **Phase 1 must standardize a `State:` done-token** (a required leading `Done` /
  `Won't-do`), or the selector has nothing deterministic to key on (eess closes by
  free-form status today, so this is a real dependency, not a nicety).
- **Proven non-vacuously:** committed fixtures — red (a done-item with an undisposed
  open box → fails), green (same, reconciled → passes), and false-positive guards (a
  `- [ ]` inside a code fence, inside a **blockquote**, and inside a seed template
  must _not_ trip). Echo "N done-items scanned" so an empty set is a visible no-op.
  (How the boxes are detected — parser or emulation — is a mechanism choice, not part
  of the clause; see _Mechanism is not the clause_ below.)
- **Activation on a mature corpus: warn-first, then gate.** A corpus with hundreds of
  legacy plans would red-wall on day one — run it as a _warning_ until the backlog is
  reconciled, then flip to hard-fail. (The reconciliation itself is an eess-internal
  chore, not part of the portable kit.)
- **First real dogfood:** this plan's own close. 0068 defers Phase 4; closing it with
  Phase 4 _silently_ dropped must go red, and with `deferred: Phase 4 → <home>` green.

**Mechanism is not the clause (from the consumer PoC).** An earlier draft of this phase
said "key off the mdast task-item state, never a line regex." Dogfooding the gate in
the consumer PoC (PR #68) showed that over-specifies: it is eess-config, not portable core. The
**clause** is "detect open ledger boxes and guard the three false-positive contexts
(fenced code, blockquotes, seed templates)." The **mechanism** is mdast where a parser
is available — and an explicit zero-dep emulation where the host repo's house style
forbids dependencies (that repo's corpus tools are zero-dep, so its gate strips fences in
place to preserve line numbers, skips `>` lines, and word-bounds the disposition
tokens so prose like "dropped in prod" can't falsely exempt a silent box). Both satisfy
the clause; a portable kit must not force a parser on every consumer. The reusable way
to honour the mdast intent _without_ hand-rolled regex is to grow a **task-item
primitive in `eess-md`** (which a consuming project may already vendor) and have the
gate use it — the regex emulation is the fallback, not the default. This is the split
the tier model already teaches, applied to the gate's own implementation: name the
clause, let the mechanism vary by context.

**Why the freeze is _not_ gated.** We considered a `check:ready` twin
(self-containment before an agent starts) and deliberately left it as **judgment**:
its one distinguishing clause — "the _right_ load-bearing artifacts were internalised"
— isn't a mechanically-knowable fact (it collapses to "internal links resolve," which
`check:corpus` already does, or it needs a link-annotation convention that would be
the compliance creep the method rejects), and its real justification — an autonomous
worktree hand-off — is out of scope here. So the freeze lives in the `/plan-ready`
**skill checklist**, not a gate. Naming _why_ it stays judgment (this paragraph) is
the point: the unenforced surface is stated, not silently unenforced.

**Deliverable (the non-hack implementation).** The gate ships as an **`eess-md`
preset** — a `taskItems()` primitive (GFM task-list items via mdast) plus a
`honestyAtClose(corpus, opts)` preset built on it — _not_ a copied zero-dep script.
The consumer PoC (`ledger-check.ts` + its 7 fixtures + 18 tests) is the **reference
spec**: its behaviour (the three findings, the disposition tokens, the asymmetry)
ports 1:1; only the parsing layer changes — the regex fence/blockquote emulation is
dropped because mdast gives those guards for free. A consuming repo (the PoC project first)
then retires its `ledger-check.ts` and calls the preset, exactly as it retired its
four hand-built corpus validators for `adrEnforcement`.

**Effort ≈ 1 session. Acceptance:** the red fixture fails and the green passes
(non-vacuous, per the scanned-count line); which clauses are gated versus left to
judgment is stated plainly, with nothing silently unverified.

### Phase 4 — Bootstrap (cuttable / future)

A one-command scaffold to introduce the kit into a new project: drop the `work/`
skeleton (core lanes), the corpus tools (`graph` / `check:corpus`), the seed
templates, and the `AGENTS.md` nudge — then tailor the lanes to the project.
Defer until Phases 1–3 have shaken out; a hand-copy works until then.

## Out of scope

- **Agent orchestration** — devboxes, MCP tool fleets, parallel-agent infra. eess
  is validation, not orchestration (per 0067).
- **A full `eess-workflow` dialect** (ROADMAP row 9) — mechanical validation of
  workflow-specific clauses _beyond_ honesty-at-close. Revisit only if Phase 3
  surfaces real demand for more gated workflow clauses; this kit is _docs +
  skills + templates + one promoted gate_, not a new dialect.
- **Turning the method into a regime** — the entire point is guidelines plus a
  thin mechanical floor; a phase that hardened the soft parts would be a
  regression, not progress.

## Success definition

- A fresh project can **adopt** the method: drop the kit, and an agent authors and
  closes a plan by it — reading the shape from the seed template, with the human
  giving only a one-line intent.
- The **ledger-reconciliation gate** catches a _silently_-open ledger in a
  done-item (red before reconciliation, green after) — proven non-vacuously by
  committed fixtures, with the truthfulness of a deferral left to the reviewer.
- The **freeze is honored as a habit, not a gate** — `/plan-ready`'s checklist
  refuses to flip a plan to `Ready` while its floor still dangles, and a draft is
  never picked up for autonomous implementation; the draft/ready distinction is
  documented in the method, not policed by a script.
- `working-method.md` is **current** (tier / three-layer / nudge / template folded
  in) and remains self-contained and portable.

## Strategic note

This dogfoods the method to build the method — the recursion is the point, and the
first real test of the kit is that we used it to plan the kit. It also completes
eess's story: **the harness (mechanical enforcement) + the method (guidelines) +
the skills (agent-callable execution)** are the three layers of one system —
_determinism where you can, honesty where you can't, and the agent free to think
in between._ Phases 1–2 remove the repetition and make the method portable; Phase 3
gives the guidelines one honest tooth — `check:ledger`, as an item reaches _done_ —
while the freeze at _ready_ stays a skill-borne habit: determinism only where a fact
is truly mechanical, judgment (named, not silent) everywhere else.
