# Plan 0142: bind accepted proposals to plans — the check bug 0141 diagnosed

## Status

- **State:** Draft — created 2026-08-14, following a six-persona review of
  [bug 0141](../bugs/0141-no-check-binds-accepted-proposals-to-plans.md)'s own
  draft Fix section. The review confirmed the gap but found the proposed
  mechanism unbuildable against this repo's real corpus in five independent,
  demonstrated ways (annotated in place in the bug record). This plan exists
  because the bug skill's own routing rule applies: real design/unknowns need
  working out first — a mechanical patch to the bug's regex is not enough.
  Two decisions are still open (below) and are small enough to settle inline
  before `/plan-ready`, not big enough for an ADR — nothing here is a binding
  decision about the eess tool's own architecture, only about this repo's
  `work/proposals/` lane convention (the same footing as bugs 0118/0119/0121
  fixing `check:ledger`'s state vocabulary without minting one).
- **Priority:** Medium — mirrors [bug 0141](../bugs/0141-no-check-binds-accepted-proposals-to-plans.md)'s
  own severity call and the same reasoning: zero proposals have ever been
  accepted in this repo, so the gap is unexercised, not currently lying. It
  would earn High the day a proposal is actually accepted without this landing
  first — closing it now is buying that gap shut before it can open.
- **Effort:** Small-Medium — no kernel changes; both phases are `scripts/` +
  `work/proposals/` + skill-file work. Phase 1 is small and independently
  useful; Phase 2 is mechanical once Phase 1 lands.
- **Created:** 2026-08-14

## Problem

`work/proposals/PROPOSALS.md` states the lifecycle directly: _"An accepted
proposal becomes a Draft plan on the roadmap."_ Nothing checks that this
happens — verified in [bug 0141](../bugs/0141-no-check-binds-accepted-proposals-to-plans.md):
`check:corpus` gates `work/proposals/**` for link resolution only, and
`check:ledger`'s proposals lane deliberately opts out of terminal-state
checking (bug 0121). The absence is invisible by construction, the same shape
[bug 0138](../bugs/0138-pointer-resolve-proves-existence-not-truth.md) names
for `path:line` pointers: a gate that proves a reference resolves is not a
gate that proves a required reference exists.

0141's own Fix section tried to close this directly — extend `check-corpus.mjs`
with a `correspondence()` binding accepted proposals to citing plans — and a
six-persona review found it fails on the real corpus in ways that compound,
not just one regex bug:

1. **There is no producer of a literal `Ruling` token.** The `review-proposal`
   skill never emits the word "Ruling" at all; `PROPOSALS.md:64-76` documents a
   six-value, title-case vocabulary; every real proposal file writes a third
   thing — free lowercase prose (`grep -n '^\*\*Ruling:' work/proposals/*.md`:
   `rewrite needed`, `docs-only`, and two lines with no em dash before a comma
   or period at all — `002:117`, `005:204`). No extraction regex can be made
   safe until the field is structured and literal.
2. **`matchBy` can't tell "implements" from "cites to exclude."** The only
   three real plan→proposal citations in this repo
   (`work/plans/0089-family-standalone-sufficiency.md:176`,
   `work/plans/0101-sibling-gates-go-fail-closed.md:117` — both excluding
   proposal 001 from scope; `work/plans/0090-adopt-ts-archunit-work-corpus.md:237`
   — citing 002 only as a dependency to re-check) would all satisfy a substring
   `plan.text.includes(...)` check. A textual co-occurrence is not the relation
   being asserted; it needs a declared, directed back-reference.
3. **A proposal can carry more than one Ruling.** `005` already has two
   (`:45`, `:204`, from two review rounds) — a non-global regex reads the
   wrong one on any re-reviewed proposal.
4. **The proposed non-vacuity fixture regresses to the exact tier
   [bug 0127](../bugs/fixed/0127-nonvacuity-proves-a-condition-not-a-wired-rule.md)
   deleted hours earlier the same day** — a standalone
   `scripts/nonvacuity/bad-proposal-plan-link.mjs` outside `check-corpus.mjs`'s
   `ROOTS`, structurally invisible to the check under test.
5. **The kernel-coupling and `kit/`-portability questions go unstated** —
   `correspondence()`/`beComplete()` are `@nielspeter/eess` kernel exports, and
   `kit/` ships no proposals lane at all (no skill, no template). Whatever
   ships here is repo-local unless a separate decision says otherwise.

Full findings are recorded in
[bug 0141](../bugs/0141-no-check-binds-accepted-proposals-to-plans.md)'s
`## Review — 2026-08-14` section.

## Approach

Two phases, strictly sequenced — Phase 2 is meaningless without Phase 1
(finding 1 above: there is nothing reliable to bind *from* until the Ruling
is a literal field).

### Phase 1 — Make `Ruling` a literal, parseable field

Change the producer, not the reader. `review-proposal`'s synthesis step
(`.claude/skills/review-proposal/SKILL.md`) currently free-writes a `## Review
— YYYY-MM-DD` section with a `**Ruling:` sentence in prose. Change it to emit
the verdict as its own bounded token, e.g.:

```markdown
## Review — YYYY-MM-DD

**Ruling: <verdict>**

<prose — the reasoning, the em-dash sentence, whatever reads naturally>
```

with `<verdict>` constrained to `PROPOSALS.md`'s six-value vocabulary
(`Ship as-is` / `Ship with changes` / `Split and sequence` / `Rewrite needed` /
`Docs-only` / `Reject`) and the bold span closing immediately after it — so a
parser reads `**Ruling: X**` as a fixed-shape header line, never a sentence to
truncate a regex against.

Decisions to settle before this phase is buildable (small, but real, so
naming them here rather than baking in an answer):

- **Casing.** All five real files already write lowercase free prose
  (`rewrite needed`, `docs-only`), not `PROPOSALS.md`'s title-case table. Pick
  one and change the other — most likely relax `PROPOSALS.md`'s vocabulary
  table to lowercase, since that's what actually shipped five times running,
  and normalizing five files against a table nobody followed is the wrong
  direction to force.
- **Normalizing the five existing proposals.** Once the shape is fixed,
  `002:117` and `005:45`/`205` need their `**Ruling:` lines reformatted to the
  new bounded shape (content unchanged — this is a formatting pass, not a
  re-review). `001` has no `**Ruling:` line at all despite `PROPOSALS.md:95`
  recording it as `Rewrite needed` — decide whether to backfill one or leave
  it as a named, separate gap (it's the board/file divergence testing flagged
  as bug-0141-adjacent).
- **One parser, not two.** `check:ledger`'s proposals lane
  (`scripts/check-ledger.mjs`, bug 0121) already scans this same lane with its
  own vocabulary matcher for `State:`. Phase 2's Ruling matcher should reuse
  that matcher's shape/location rather than becoming a second, independently
  drifting regex over the same file set (architect review, finding I6).

**Definition of done:** every `## Review —` section in `work/proposals/*.md`
carries a `**Ruling: <verdict>**` line in the fixed shape, drawn from the
closed vocabulary; `review-proposal`'s synthesis step emits it that way going
forward; `PROPOSALS.md`'s vocabulary table matches what the files actually
contain (no more casing drift between the doc and the corpus it describes).

### Phase 2 — Gate proposal→plan linkage in `check:corpus`

Extend `scripts/check-corpus.mjs` with a fourth check: every proposal whose
literal `**Ruling:` (Phase 1) is `Ship as-is` or `Ship with changes` must have
at least one plan that declares — not merely mentions — it implements that
proposal.

Decision to settle before this phase is buildable:

- **The back-reference convention.** `text.includes()` is out (problem
  statement, point 2). The corpus already has one organic precedent —
  002 ⇄ 0090 cite each other by name in prose, which `matchBy` still can't
  parse reliably. The candidates: (a) the plan's own header carries a
  declared line (e.g. `**Implements:** proposal 002`, the same shape
  `ROADMAP.md`'s `Blocked on` column already uses for a different relation),
  (b) the proposal carries a `→ plan NNNN` line once one exists (0141 notes
  this has literally never happened), or (c) both, so the binding is
  verifiably two-way rather than asserted from one side. Pick one; (a) is the
  cheapest to retrofit since plans, not proposals, are created after
  acceptance and can name their source at creation time.
- **`beComplete()` direction and cardinality.** `left-to-right` reports
  `leftAmbiguous` for a proposal matching more than one plan — the correct
  outcome for a `Split and sequence` ruling, but untested by 0141's spike
  (every fixture proposal had exactly one plan). Confirm this against a
  two-plan fixture before shipping.

Non-vacuity: follow `gateCorpusProbe()` (`scripts/check-nonvacuity.mjs`, the
shape [bug 0127](../bugs/fixed/0127-nonvacuity-proves-a-condition-not-a-wired-rule.md)
established) — plant a real, ephemeral accepted-and-orphaned proposal probe
under `work/proposals/`, run `scripts/check-corpus.mjs` both as
`--format json` (rule + file identity) and as the bare terminal invocation
(exit code), assert both. No standalone fixture corpus outside
`check-corpus.mjs`'s `ROOTS`.

**Definition of done:** `check:corpus` fails when an accepted proposal has no
declaring plan, stays green today (0 accepted proposals is a checked,
reported zero — not a silent one), and `check:nonvacuity` proves the new
check is wired to the production script, not a standalone rule.

## Test inventory

- Phase 1: a fixture (or the five real files, post-normalization) parses to
  the six-value vocabulary with zero unmatched `**Ruling:` lines; a garbled
  or missing Ruling is a reported finding (`ledger/unknown-state`'s shape),
  never a silent exclusion.
- Phase 2: `gateCorpusProbe`-style — a real accepted-and-orphaned proposal
  probe reddens `check:corpus` (both json and terminal exit); a real
  accepted-and-declared-by-a-plan probe stays green; a probe using an
  out-of-scope-style citation (mirroring 001's real exclusion citations) does
  **not** satisfy the check, proving the back-reference convention
  discriminates "implements" from "mentions." `check:nonvacuity` registers
  the row in `GATE_FOR['check:corpus']`.

## Files changed

- `.claude/skills/review-proposal/SKILL.md` — Ruling emission shape.
- `work/proposals/PROPOSALS.md` — vocabulary table casing reconciled to the
  corpus; back-reference convention documented once decided.
- `work/proposals/002-comment-embedded-links.md`,
  `003-future-dialect-candidates.md`, `004-corpus-content-explain.md`,
  `005-crossvalidate-stale-wip-detection.md` — `**Ruling:` lines reformatted
  to the fixed shape (content unchanged).
- `scripts/check-corpus.mjs` — fourth check.
- `scripts/check-nonvacuity.mjs` — new `gateCorpusProbe` row.
- [bug 0141](../bugs/0141-no-check-binds-accepted-proposals-to-plans.md) — closes
  once Phase 2 lands and the Fix section is superseded by this plan.

## Out of scope

- **Porting this to `kit/`.** `kit/` ships no proposals lane at all today.
  Whatever lands here is repo-local; if a future plan gives `kit/` a
  proposals lane, this becomes the reference implementation, not something
  ported speculatively now.
- **A kernel `keysBy: (el) => readonly string[]` multi-key join** — the
  architect review flagged this as a genuine kernel gap `matchBy` currently
  works around, but it's independent of this plan and shouldn't be smuggled
  in here.
- **The board's Status column** (whether a `## Review —` section exists at
  all) — a second, adjacent unmechanized derivation in the same file the
  architect review flagged as an easy adjacent win. Worth its own plan, not
  bundled into this one's ledger.
- **Fixing bug 0141's Fix section in place.** This plan supersedes it; 0141
  closes by reference to this plan rather than by its own Fix section being
  built as originally written.

## Success definition

- `PROPOSALS.md`'s stated lifecycle claim ("an accepted proposal becomes a
  Draft plan") has a real, fail-closed mechanism behind it — not prose
  asserted by whoever last touched the board.
- Zero silent exclusions: an unparseable or absent Ruling is a reported
  finding, not a quiet non-match.
- `check:nonvacuity` proves the new check is bound to the production script.
- `npm run validate` green end-to-end.

## Progress ledger

- [ ] Phase 1 — `Ruling` is a literal, bounded field; skill + docs + five
      real files aligned; casing and `001`'s missing line decided
- [ ] Phase 2 — `check:corpus` gates proposal→plan linkage; back-reference
      convention decided and documented; non-vacuity probe wired and proven
