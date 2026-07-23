# Plan 0075: Manifesto reconciliation

## Status

- **State:** Draft — waiting on adopter feedback. The 2026-07-19 honesty pass
  labelled each architecture layer shipped/partial/vision and added the
  staleness and constraints-not-a-map stances; that bought time, not a
  resolution. A deep restructure written without a real adopter's reading is
  guesswork about which half of the document is load-bearing. A 2026-07-20
  discovery session added a **candidate thesis** (the constitution + gate
  formulation, below) — internal-clarity material the restructure can start from;
  it does not lift the adopter-feedback gate on Phases 2–3.
- **Priority:** P3 — the document is currently _honest_, which is the property
  that mattered most; restructuring is improvement, not repair.
- **Effort:** ~1 session.
- **Created:** 2026-07-19
- **Adopter data-point (2026-07-23):** a real external spec corpus exercised the
  dialects — confirming eess already validates a project's whole corpus in-repo, and
  that "spec-first" is the manifesto's existing mission generalised, not a new one.
  One reading toward the restructure; does not lift the Phase 2–3 gate.

## Problem

`docs/manifesto.md` is three documents wearing one cover:

1. a **defensible thesis** (specs must be executable, or they drift);
2. **shipped doctrine** — the tier model, the ADR Enforcement convention, the
   drift-fails-the-build gates, all of which exist and run in CI;
3. a **horizon** — Tiers 2–5 as described capability, where eess today only
   resolves a cited test.

A reader cannot tell which is which without knowing the codebase. The 2026-07-19
pass added labels to the architecture layers, but the document's _structure_
still interleaves the three, so the labels do work the outline should be doing.

There is a second, subtler problem: the manifesto is treated as binding — CLAUDE.md
names it the design specification alongside the ADRs — yet unlike every ADR it
carries no `## Enforcement` table and has never been ratified. A binding document
that no mechanism touches is exactly the drift eess exists to catch.

## Approach (sketch — a Draft, not a frozen floor)

**Phase 1 — separate the three voices structurally.** Thesis first and short;
shipped doctrine second, each claim citing the gate that enforces it; horizon
last and explicitly labelled as such. Labels stop carrying structural load. The
thesis is **reframed**, not merely relocated — see the candidate below.

**Phase 2 — bind it.** Give the manifesto the same treatment every ADR gets: an
Enforcement table over its enforceable clauses, so `check:corpus`'s ADR gate (or
a sibling) can hold it. Clauses that are genuinely unenforceable get `manual` or
`n/a` — honestly, not by omission.

**Phase 3 — ratify.** A Tier-5 act: the document becomes a decision of record
with a date, not a living essay that quietly changes meaning.

## Candidate thesis — constitution + gate, honesty-forward (discovery, 2026-07-20)

Discovery input, not a frozen decision — captured so the reconciliation starts
from a thesis instead of inventing one cold, pressure-tested across a 2026-07-20
session (external inputs: two AI-native-dev talks on harness engineering; the
spec-graveyard / consumer-principle argument), and hardened by a Codex
second-opinion pass (2026-07-20) that caught three overclaims — see the note
below. It must still breathe before it touches `docs/manifesto.md`.

**The settled formulation.** eess is two layers welded, and honest about the seam:

> **eess makes your project's decisions a constitution that enforces itself where a
> machine can — and declares, in the open, everywhere it can't.** The boundaries
> that must hold, gated deterministically; every clause a machine can't check
> marked as such, never faked green.

"Constitution" is carried as **analogy** — _makes your decisions a constitution_ —
not a literal identity claim. eess is the gate plus the honesty, not the law's
content (which you author). And "decisions," not "architecture": eess gates ADR
indexes, doc pointers, package tables, diagram↔code and citation correspondence,
and corpus hygiene — the whole project record, not only its layering.

- **Constitution — the law (essence).** The boundaries that must hold — which
  layer may call which, what a router may import, which decision governs, but also
  which pointer must resolve, which diagram must match the code, which table must
  stay true. Human-authored, amended by a deliberate act (a Tier-5 ratification,
  not a side-effect), binding on everyone equally — senior, junior, human, agent,
  and the author who wrote it. It draws boundaries; it never scripts the work
  inside them.
- **Gate — the enforcement (mechanism).** Deterministic, mechanical, no mind and
  no discretion. It doesn't reason, judge, or negotiate — it compels obedience by
  failing the build. There is no one to appeal to, which is exactly why it can't
  be lobbied, worn down, or bribed. Its force is real but _contingent_ — it holds
  only where the gate is wired and non-vacuous, hence "where a machine can," not a
  blanket "self-enforcing."
- **The weld — why it's more than either half.** A constitution with no gate is
  parchment (the ADR / wiki / UML everyone admired and no one upheld, until it
  rotted into folklore). A gate with no constitution is a checkpoint guarding
  nothing (a vacuous gate — the exact failure the non-vacuity discipline exists to
  catch). eess fuses them: law and enforcement as one object, so the law can't
  become a lie — the gate fails the instant code and constitution disagree.
- **Honesty — the distinctive half (the second-opinion's sharpest catch).** Lots
  of tools enforce; eess's more original claim is that it _refuses to fake_
  enforcement. The tier / mechanism / status model makes every clause declare what
  kind it is, what checks it, and whether that check actually gates; non-vacuity
  proves the gate isn't hollow. That honesty — not enforcement per se — is the
  payload the thesis must carry, which is why it now sits in the headline
  ("declares, in the open, everywhere it can't"), not in a footnote.

**The drift it fixes.** The current Core Thesis is _artifact-centric_ —
"specifications become the authoritative semantic representation; code becomes a
realization artifact." It reads as spec-primacy, which is why the manifesto has to
follow it _immediately_ with "Constraints, not a map" to walk the prescriptive
reading back. A **constitution** absorbs that caveat instead of apologizing for it:
a constitution _is_ boundaries-not-a-map by definition, so the defensive section
folds into the thesis. A reframe that lets you delete a rebuttal is more coherent,
not merely better-sounding.

**Why it moved (common ground → constitution + gate).** The session first landed on
"eess is the project's common ground." Pressure-testing broke that three ways: it
named a _state_ eess only _guards_ (the ground-vs-guardian category error), its
distinctive payload sat in an adjective ("enforced") that a slogan would shed, and
it covered only the codifiable subset of real common ground. What survived for the
**law-book** layer was _constitution_ (binding, boundaries-not-map,
amendable-by-the-people); what survived for the **enforcement** was _gate_
(deterministic, self-executing — "sensor" was rejected for naming only detection,
not the consequence). "Common ground" and "governance" remain the stronger
_positioning / buyer_ words for the front door; constitution + gate is the
_essence_ — what eess is. The lesson that fixed the wording: the enforcement has to
be **in the words, not implied** — hence "enforces itself," payload in the verb.

**The enforceability split it forces (feeds Phase 1's shipped/horizon cut) — three
buckets, not two.** The second opinion corrected an earlier two-bucket framing:
much of what eess touches is _permanently_ declared-not-gated by design, not a
horizon waiting to be closed.

- **Gated — the structural constitution.** Architecture rules, corpus integrity
  (links / pointers / ledger), cross-validation, the kit. Deterministic; drift
  fails the build. This is the part that literally enforces itself.
- **Declared, not gated — permanent by design.** Tier 4 (semantic flags), Tier 5
  (ratification under governance), and `pending` clauses. Here eess enforces
  _declaration, traceability, and honesty_ — that the clause says what checks it
  and whether that check gates — **not compliance**. This is not a gap to close;
  it is the honesty layer, and it stays.
- **Horizon — the behavioural constitution.** Binding _behaviour_ to a
  deterministic gate without the ceremony creeping back — the frontier of
  [plan 0079](./0079-tier-2-3-mechanization.md), the half every prior generation
  (CASE, MDA, Gherkin) died on. eess does **not** gate behavioural law today.

So "a constitution that enforces itself" is true of the _gated_ articles in full,
honest-by-declaration for the permanent middle, and horizon for the behavioural
ones — the thesis's "where a machine can / everywhere it can't" carries exactly
that split, and the manifesto must keep it, or it overclaims.

**Second opinion (Codex, 2026-07-20).** An independent critical pass flagged three
overclaims, now fixed above: (1) "self-enforcing" overstates a _contingent_ gate →
"where a machine can"; (2) "architecture" is too narrow for what eess gates → "your
project's decisions"; (3) the ungated tiers are permanent honesty-not-compliance,
not horizon → the three-bucket split. It also argued the honesty / tier model is
eess's sharper payload (adopted into the headline), and offered **charter** as a
lower-overclaim alternative to _constitution_ — parked as a dial: charter sheds the
"foundational-whole" baggage but also the _supremacy_ (binds-all-equally) that
constitution buys; kept as analogy, constitution still earns its place.

This bears on the first open question below: the thesis refinement is an
_internal-clarity_ move and is **not** gated on adopter feedback (that gate was
for the full restructure + ratification). It can proceed; Phases 2–3 still wait.

## Out of scope

- Renaming eess, or reopening the acronym. Settled 2026-07-19: the name stays,
  the expansion is retired from every live surface, the manifesto's origin note
  stays as the one place that answers "what did it stand for?".
- Rewriting the walkthrough or the docs site — this is the manifesto only.

## Success definition

A newcomer reading top-to-bottom can state, unprompted, which capabilities exist
today and which are horizon — without cross-checking the code. And a future
change to a load-bearing manifesto claim fails a gate rather than passing
silently.

## Open questions (resolve before Ready)

- [ ] Which adopter feedback actually gates this? Name the signal, or drop the
      dependency and schedule it.
- [ ] Can the existing `adrEnforcement` preset hold a non-ADR document, or does
      binding the manifesto need its own rule?
- [ ] Does ratification mean an ADR _about_ the manifesto, or a state token in
      the manifesto itself?
