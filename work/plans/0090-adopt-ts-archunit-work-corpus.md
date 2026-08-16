# Plan 0090: Adopt ts-archunit's work corpus — heritage in, open work re-homed

## Status

- **State:** Draft — created 2026-08-10. Part of the ts-archunit retirement
  family: [0088](./completed/0088-fold-ts-archunit-into-eess.md) is the fold (engine +
  ADR-008/009), [0089](./0089-family-standalone-sufficiency.md) is per-dialect
  standalone sufficiency, [0101](./0101-sibling-gates-go-fail-closed.md) takes the
  sibling gates fail-closed, [0100](./0100-publish-the-fold-retire-ts-archunit.md)
  publishes and retires — and this is the **work-corpus migration**: the plans,
  bugs, ADRs, proposals, and docs ts-archunit accumulated, brought into eess so
  retirement doesn't sever the lineage. Requires 0088 (the fold) as context; its
  open-work adoption is written against the engine that 0088 makes eess's. It does
  **not** wait on 0100's archival — an archived repo is still readable (0100
  Phase 2 states this from the other side).
- **Priority:** Medium — a consequence of retirement, not a prerequisite. History can
  stay in the archived repo until this lands; nothing gates on it.
- **Effort:** Medium-Large — mechanical move + a renumbering/re-homing decision
  per open item. The classification (Phase 1) dominates.
- **Created:** 2026-08-10

## Problem

`ts-archunit` accumulated a working corpus through 0102 plans, 0088 bugs, 10
ADRs, 11 proposals, and 33 docs. When 0088 retires ts-archunit, that corpus is
the project's **institutional memory** — the measured-failure prose, the refuted
alternatives, the per-plan blast-radius records. The working method's first firm
principle is _honesty at close_: nothing vanishes silently. Archiving the repo
and leaving the corpus there isn't a close — it's a memory that requires a second
repo to read, and (per the amnesiac-reader thesis) a fresh agent won't.

But the corpus does **not** migrate as one undifferentiated blob. It splits by
what it is _now_:

- **History** — 83 completed plans, 69 fixed bugs, 10 ADRs, 33 docs. These are
  _records_: settled, frozen, load-bearing only as provenance. They must come in
  as **heritage** — preserved, not re-audited — because eess's own gates would
  otherwise judge them.
- **Open work** — 15 open plans (14 engine-relevant + `ai-era-product-direction.md`),
  9 open bugs, 11 proposals. These describe _the engine that 0088 is folding in_.
  They are **live decisions**, not history: plan 0100 ("a preset that constructs
  nothing"), 0090 ("a warn that expires"), 0102 ("a detector that cannot fire says
  so") name real defects in the engine eess now owns. They must be **re-homed** —
  adopted as eess work or explicitly deferred-with-a-home — not frozen beside the
  history where nobody will read them.

Two mechanics force the split:

1. **`check:corpus` and `check:ledger` scan the live roots.** `check:corpus`
   (`work/plans/**`, `work/proposals/**`, `adr/**`, `docs/**`) checks cross-links
   and live code pointers; `check:ledger` (`work/plans/**`) audits honesty-at-close
   over everything in `completed/`. History migrated into those roots would be
   re-audited against eess's conventions — cross-links written relative to a
   different tree dangle, closes judged by a different method. eess's own frozen
   mechanism (`**/completed/**`, `**/wont-do/**`, `**/archived/**`) is the escape
   hatch, but it applies to _folders_, so heritage needs a home that is (or
   becomes) frozen.
2. **The numbering collides — and the two sequences now overlap almost entirely.**
   ts-archunit has plans through 0102 and bugs through 0088; eess shares one
   sequence across plans and bugs and has itself reached 0101. So nearly every
   ts-archunit number **also exists in eess, meaning something else**. Adopted
   open work must be **renumbered into eess's sequence** — a real, per-item
   decision, not a bulk copy — and the migration matrix must record
   `ts-archunit NNN → eess MMM` for every item, because after the move a bare
   number in migrated prose is ambiguous by default.

   Take the next free number **at migration time**, read from
   [`ROADMAP.md`](./ROADMAP.md) and [`BUGS.md`](../bugs/BUGS.md) — this plan
   deliberately does not name it, because a literal written here is stale the
   moment anything else is filed. (It already was: an earlier draft said "next
   free: 0091", written when that was true.)

## Implementation phases

### Phase 1 — Classify the corpus: heritage vs adoptable

For every ts-archunit item, place it in one bucket:

- **heritage** (settled record → frozen home): completed plans, fixed bugs, ADRs,
  docs, `ai-era-product-direction.md`, the CHANGELOG. No per-item decision.
- **adopt-open** (live, describes the folded engine → re-home into eess): the 14
  open plans + 9 open bugs that name a defect or feature of the engine 0088 owns
  (e.g. 0100, 0090, 0091, 0092, 0094, 0086, 0088, 0102, 0077; the residual-review
  plans whose findings still apply). Each gets a written re-homing: **adopt as an
  eess plan/bug** (renumbered) or **deferred-with-a-home** (an explicit "this is
  superseded by eess plan X / not worth carrying" note).
- **out-of-scope** (dies with the repo): open plans whose premise 0088/0089/0101
  already supersede (e.g. 0083 eat-our-own-dogfood — the dogfooding is 0088's own
  reconciliation; 0072 denylist-glob — refuted, per its own record), recorded as
  dropped-on-purpose with the reason.

**Deliverable:** a migration matrix in `work/dogfood-coverage.md` (or a plan
annex) — every item, its bucket, its re-homing. This is the honesty-at-close
record: nothing is copied or dropped silently.

### Phase 2 — Bring history in as heritage (frozen)

Choose a heritage home and make it frozen. Default: `docs/heritage/ts-archunit/`
mirroring ts-archunit's own layout (`plans/`, `bugs/`, `adr/`, `docs/`,
`CHANGELOG.md`), and add `**/heritage/**` to `check:corpus`'s `frozen` list (the
mechanism already exists for `completed/`/`wont-do/`/`archived/`).

**The frozen exemption is not free for links — a code change is required
(2026-08-10 review, verified).** `frozen` today exempts only the _pointer_ rule:
`packages/md/src/builders/pointers.ts` filters `areLive()` (not frozen), but the
_links_ rule (`packages/md/src/builders/links.ts`) and its `resolve.ts` condition
have **no frozen filter** — they iterate and resolve every internal link, frozen
docs included. A heritage doc linking a ts-archunit path (`./src/core/terminal-builder.ts`)
would fail `check:corpus` even when frozen. So this phase must either:

- **(chosen)** make `check:corpus`'s link rule frozen-aware — add a live-only
  filter to the links builder mirroring `pointers.ts`'s `areLive()`, so frozen
  heritage links are surfaced as informational, not failures — **or**
- rewrite/scrub heritage links to self-contained paths.

The frozen-aware link filter is the honest fix (it treats history like the other
frozen folders already do) and is a **code change 0090 must list**, not assume.

**Files changed:** `docs/heritage/ts-archunit/**` (new), `scripts/check-corpus.mjs`
(add `**/heritage/**` to `frozen`), `packages/md/src/builders/links.ts` +
`packages/md/src/conditions/resolve.ts` (add the live-only filter), plus a
`check:corpus` test crossing a frozen doc's internal link to a non-existent path
and asserting it is reported-informational, not a failure. `scripts/check-ledger.mjs`
needs no change (it scans `work/plans/**` only, so `docs/heritage/` is already out
of its reach). **Tests:** `check:corpus` green with heritage present and counted
as frozen (the denominator must rise, proving it's scanned-as-record, not silently
excluded); the new frozen-link test proves the exemption is real, not assumed.

### Phase 3 — Re-home the open work into eess's live corpus

For each adopt-open item: **copy the body, renumber into eess's sequence** (the
next free number in the shared plan/bug sequence, read from the two boards at
migration time — see Problem §2 for why no literal is written here), rewrite the
header (new `State: Draft`, `Created: 2026-08-10`, a `Migrated from: ts-archunit
plan NNN` provenance line), and place it on the eess board (ROADMAP row for plans,
BUGS.md for bugs). The body's references to ts-archunit files (`src/...`,
`plans/completed/...`) and **test fixtures** (e.g. ts-archunit plan 0100 cites
`tests/fixtures/presets/agent-guardrails`) are updated to the post-fold eess paths
(kernel `packages/core/`, eess-ts `packages/ts/`) — the same path remap 0088 Phase
4 does for the code — and the migration matrix tracks fixture-path remapping per
adopted plan so a re-homed plan never cites a missing fixture.

Deferred-with-a-home items get a one-line record in the migration matrix naming
the eess artifact that supersedes them — never a silent drop.

**Files changed:** the adopted plan/bug files in `work/plans/` + `work/bugs/`,
their ROADMAP/BUGS.md rows. **Tests / honesty-of-gating:** `check:ledger` green
(each adopted plan either stays Draft or, if closed, disposes every box),
`check:spec` green (ADR index if any ADR is adopted).

**The `work/bugs/**`gap — decided 2026-08-12.**`check:corpus`gates`work/plans/**`+`work/proposals/**`+`adr/**`+`docs/**`, but **not**
`work/bugs/**` (`scripts/check-corpus.mjs:22-24`, blocked on
[bug 0086](../bugs/fixed/0086-links-to-directories-do-not-resolve.md) — directory links
— and the `fixed/`frozen-folder omission it names). So a corpus claim over
_adopted bugs_ would be vacuous by construction. An earlier draft left this as an
open either/or: gate`work/bugs` here (closing 0086 inside this plan), or scope
the claim. **Scope the claim\*\* is the ruling, for two reasons:

- Closing 0086 inside 0090 would put a bug's fix, its red test, and its move to
  `fixed/` inside a plan's PR. A bug closes with **its own** PR
  ([`BUGS.md`](../bugs/BUGS.md#when-is-a-bug-fixed)); borrowing it here makes this
  plan's ledger carry work that isn't its own and couples a migration to a defect
  fix that has nothing to do with migrating.
- It would also make this plan unclosable-by-dependency: 0090 would wait on a bug
  whose scope (link resolution in `eess-md`) is a dialect change, not a corpus
  move.

So Phase 3's corpus claim covers **adopted plans only**, and adopted bugs are
stated `manual` — never presented as corpus-green when the corpus doesn't scan
them. This plan does **not** block on 0086.

If 0086 happens to land first — and it should, being cheap and the keystone that
makes the whole bug board enforceable — the caveat simply disappears and the
adopted bugs arrive in a gated corpus. That is a scheduling preference, not a
dependency, and it is recorded as such so it cannot re-acquire a phantom blocker.

### Phase 4 — Reconcile the gates on the migrated corpus

Run the full gate chain. The live corpus now contains the adopted open work; the
heritage is frozen. Confirm:

- `check:corpus` — heritage frozen + counted; adopted items' links resolve.
- `check:ledger` — no adopted-or-heritage item carries a silently-open box with a
  terminal `State:`. (Heritage under `docs/` is outside `work/plans/**`, so it is
  already ledger-safe; the adopted open plans are Draft, so they carry their open
  boxes honestly.)
- `check:nonvacuity` — the migration didn't silently empty a gate's audit surface.

**Definition of done:** `npm run validate` green end-to-end with (a) the heritage
corpus in place and frozen, (b) the adopt-open work on the board as real eess
items, (c) the migration matrix recording every item's disposition.

## Test inventory

- Phase 1: the migration matrix is the non-vacuity record (it must account for
  every item — the count is the measurement, and the migration matrix's
  accounting is itself `manual` (it lives in `work/dogfood-coverage.md`, outside
  every gate's roots — stated, not assumed gated)).
- Phase 2: `check:corpus` green, heritage counted as frozen **and the heritage
  file count equals the source corpus count** (83 plans + 69 bugs + 10 ADRs + 33
  docs + CHANGELOG — the "denominator must rise" is pinned to an expected number,
  so a partial copy can't pass); the frozen-link test proves the link exemption
  is real.
- Phase 3: `check:ledger` + `check:spec` green on adopted items; `check:corpus`
  green on **adopted plans** (adopted bugs are `manual` until 0086 gates
  `work/bugs/**` — stated honestly).
- Phase 4: `npm run validate` green; `check:nonvacuity` green.

## Out of scope

- **The engine fold** (0088), **per-dialect sufficiency** (0089), and **the
  sibling gates going fail-closed** (0101) —
  this plan adopts the corpus those two define as live work; it does not do their
  work.
- **Rewriting the adopted plans' substance** — they are re-homed, not re-authored.
  Where 0088/0089/0101 already supersede an open plan's premise, it is deferred-with-a-
  home (Phase 3), not rewritten.
- **Porting ts-archunit's test-suite fixtures wholesale** — 0088 owns the engine
  tests; this plan owns the _work records_.
- **The archived repo itself** — it stays as the canonical provenance source;
  this plan mirrors its corpus into eess, it does not claim to be the original.

## Success definition

- Every ts-archunit work item is accounted for in the migration matrix: heritage
  (frozen), adopt-open (renumbered + on the eess board), or dropped-on-purpose
  (with reason). Nothing vanishes silently.
- Heritage lives under `docs/heritage/ts-archunit/`, frozen, **its links made
  live-only-filtered** so `check:corpus` reports it as history — preserved, never
  gated — and its file count equals the source corpus count.
- The engine-relevant open work (0100, 0090, 0102, and siblings) is live eess work
  on the board, renumbered from 0091, readable by a fresh agent without opening
  the archived repo.
- `npm run validate` green end-to-end; the migration matrix is the honesty record
  (stated `manual`, since it lives outside the gated roots).
- **Deferred dependent re-checked at close.** Proposal
  [002](../proposals/002-comment-embedded-links.md) (comment-embedded doc
  citations) was reviewed 2026-08-12 and deferred **on this plan**: 49 of the 51
  unresolved citations in this repo's source comments are ts-archunit ancestor
  numbers, so a citation-resolution gate cannot go green until they are
  classified here. Closing 0090 is the trigger to re-open that ruling — recorded
  in this plan's success definition, not only in the proposal, so the dependency
  is visible from the side that resolves it.

## Progress ledger

- [ ] Phase 1 — classify every ts-archunit item (heritage / adopt-open / dropped)
- [ ] Phase 2 — bring history in as frozen heritage under `docs/heritage/`
- [ ] Phase 3 — re-home adopt-open work into eess (renumbered, on the board)
- [ ] Phase 4 — reconcile the gates on the migrated corpus (`validate` green)
