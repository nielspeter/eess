# A Working Method for Human + AI Knowledge Work

_(This is the portable version — the method itself, not one project's copy of it.
It emerged in practice and has already travelled between projects, gaining
shape as it went. It still needs a name; for now, "the method." It is the
guidelines companion to eess's mechanical-enforcement half — see
[eess as a harness](./eess-as-a-harness.md) and the [manifesto](./manifesto.md).)_

Read this as a **seasoned colleague describing how they work**, not as a rulebook.
It is **guidelines and structure, not a regime.** Its whole purpose is to let a
human and an AI agent do open-ended discovery _and keep what they discover_ —
durably, honestly, and reloadable by a fresh agent next session. Where it is firm,
it is firm only to protect the discovery from being lost or corrupted. Everywhere
else it is a _default you should deviate from when something better serves the
work._

## The spirit (please read this first)

We structure **the memory and the handoffs — never the thinking.** Where things
live, how they're recorded, how they pass from one stage to the next, how the
corpus stays honest: that is worth structuring, because it's what makes discovery
_accumulate_ instead of evaporate. _How to investigate, how to design, when a new
kind of artifact is warranted, when to break the pattern:_ that stays free. The
method is deliberately silent on how to reason.

This split is chosen on purpose, and it ages well. Structure that _records and
remembers_ becomes **more** valuable as models get smarter — a sharper agent uses
good memory better. Structure that _constrains behaviour_ becomes **friction** as
models get smarter — you'd be second-guessing a more capable colleague with
yesterday's rules. So we invest in memory, not compliance. **A rule earns its place
only if it protects the discovery; the moment it's policing the discovery, it has
gone too far.** That is the test.

And the method is **yours to extend.** Its own lanes were not decreed — they were
_discovered_ when the work demanded them (a "refinement" lane appeared when more
people and a design tool entered; a "support" lane appeared when real customers
did). If the work in front of you wants a shape that isn't here, invent it, use it,
and — if it proves out — write it down. A self-amending method is the whole point.

## The three firm things (and only these)

Everything in this document is a soft default _except_ these three, and each of
them exists to **serve** the discovery, not to fence it in:

1. **Honesty at close.** When an item is finished, every part of it ends as
   _done_, _done-otherwise_ (what actually happened, told straight — not what was
   hoped), _deferred to a named home_, or _dropped on purpose_. Nothing vanishes
   silently. This is firm because a corpus that quietly loses scope stops being
   trustworthy, and an untrustworthy memory is worse than none.

2. **Point, don't duplicate — but freeze what you commit to.** A source that is
   _still live authority and still moving_ — the code, a design still being argued
   over — is _referenced with a dated pointer_, never mirrored: a mirror of a moving
   thing goes stale and lies. But a _settled decision_ or a _load-bearing input_ —
   the chosen layout, the resolved answer, the exact image an item needs to be
   built — is **recorded by value**: captured into the corpus so nothing can move or
   vanish beneath the item that depends on it. Point at the moving; freeze the
   decided. This is firm because the two ways a cache betrays you are a pointer that
   _lies_ (source moved) and a pointer that _dangles_ (source vanished), and an item
   you actually commit to building must be exposed to neither. The test for which
   bucket: _has the decision been made yet?_ Before it, point; after it, record.

3. **Keep the cross-references alive.** Items link to each other and to decisions;
   those links are kept from rotting (a link-integrity check earns its keep here).
   This is firm because the accumulated corpus is only useful if you can still
   navigate it.

If you ever feel these three fighting the work rather than serving it, that's a
signal to revisit _them_ — not a licence to skip them quietly.

## The corpus

Work lives as **self-contained markdown items** in one place (a `work/` corpus is
a good home). Self-contained means: everything about one item is in one file —
readable start to finish without hunting. Items are grouped into **lanes** by the
_kind_ of work; each lane has a **board** (one index over everything in that lane,
open and closed) and a **done-subfolder** for finished items.

The corpus _is the team's durable, reloadable memory_ — the standing-in for the
meetings, the board, the retro, and the institutional "why did we do it that way."
A fresh agent reconstitutes context by reading it. That's why we point rather than
duplicate, and why we don't let it rot.

**The corpus is the template.** The house shape of a plan or a bug isn't kept as a
form to fill in — it's _read from the last few real items_. When authoring, skim two
or three recent items in the lane and match what they actually do. A brand-new
project with no examples yet may seed a minimal template to bootstrap the shape, but
that template is scaffolding: **delete it the moment real items exist to imitate.** A
living example is a truer template than a frozen form, and a form that outlives its
examples quietly starts to lie about the shape.

## The lanes are a toolkit, not a pipeline

Reach for the shape that fits the work. These are the ones that have proven
useful; none is mandatory, and a piece of work needn't pass through all of them:

- **Plan** — something _new_ or a _refactor_: work that isn't a defect but needs a
  _how_ worked out before building. Forward-looking, design with unknowns.
- **Bug** — _something is wrong in the code, right there._ A concrete defect. It
  can stand entirely on its own; it needn't come from anywhere.
- **Refinement** _(reach for it when discovery is volatile and shared)_ — a
  pre-plan lane where understanding is reconciled against a moving external source
  (a design tool, a stakeholder answering over days) and open questions live until
  a topic is _ripe_. Deliberately messy; the goal is _current_, not _tidy_.
- **Support** _(reach for it when real people report things)_ — customer-facing
  _cases_ (distinct from the engineering _defect_ a case might spawn), with raw
  evidence kept by pointer.
- **Decision record (ADR)** — a binding choice worth citing later. These are rarely
  _chosen_ up front; they **surface during planning** ("what must we decide before
  we can build this?"), and the agent writes them.

A common flow — offered as a default, not a law — is _refinement → plan → build →
bug_, with support feeding either side. Use it when it fits; ignore it when it
doesn't.

## How work moves — habits, not gates

**Deciding what to write (together).** Talk it through; agree what kind of thing it
is — or that it's small enough to just do. The plan/bug distinction is by _nature_
(needs-a-plan vs wrong-right-now), not by size.

**Authoring.** Give it the next number, write it in the lane's usual shape, put it
on the board, and — a good habit — run it past review. Prerequisite decisions
(ADRs, supporting docs) that surface while designing get written here too, and the
item points at them. Authoring produces a **draft**, not a mandate: a plan can sit
as a thought worth keeping that you are _not yet committed to build._ Promoting it
to **ready** is a separate, deliberate act — the _freeze_, below. And even a ready
item isn't implemented until someone chooses to.

**Implementing.** Two modes, and the method leans different amounts on each:

- _Interactively_, with a human steering: load the relevant decisions and the
  existing code first so you're working from real patterns, then build. Raise it if
  the item's approach won't work as written rather than silently swapping it.
- _Autonomously_ (a landed item handed off, often in a worktree): now the item is
  the only driver, so it has to carry _more of itself_ — the context to load, the
  ambiguities already resolved, and what "done" looks like — because no one is
  there to supply them. Proceed without stopping to ask, keep the item's status
  live as you go, and **the diff is reviewed before it merges.** Nothing is a black
  box.

**Verifying.** Green typecheck / lint / architecture tests / the suite, plus — for
anything that can't be exercised that way (infrastructure, deploy config) — an
honest note that real validation is still owed.

**Closing out.** This is the one ritual worth doing the same way every time,
because it's where the first firm principle lives. Walk the item's own list and
mark each part _done / done-otherwise / deferred-with-a-home / dropped-on-purpose_,
and say the deferral count _out loud_ — "deferred: none," or the list with where
each went. Silence is not "nothing deferred." Re-home every deferral to a real
place (a plan, a bug, an explicit accept-the-risk decision), never a footnote in a
nearly-done item.

## Draft, ready, and the freeze between them

Authoring a plan is not committing to it. A **draft** is allowed to still behave
like refinement — pointing at live, moving sources, carrying open questions, its
floor not yet nailed down. Nobody starts building a draft, and an _autonomous_ agent
must refuse to: an uncommitted plan is not a work order.

Promoting a draft to **ready** is where the **freeze** happens, and it exists to
make one guarantee — _the floor cannot be ripped out from under whoever implements
it._ When an agent picks up a ready plan, often alone in a worktree, a link that now
dangles or an image that drifted is silent corruption, and the method's answer to
silent corruption is **stop, don't start.** So going ready means: harvest the ripe
refinement; **internalise every load-bearing artifact** (export the design frame
into the corpus, distil the decision into the plan or an ADR); **cut the
load-bearing cords to live sources** (keep their URLs only as dated provenance,
never as something the build depends on); and **resolve or re-home every open
question.** After the freeze, the refinement it grew from can be closed — the ready
plan no longer depends on it staying alive. How _much_ freeze is proportionate to the
hand-off: an interactive build you're steering needs only enough that you don't
mislead yourself, while an autonomous worktree hand-off is where it has to be
airtight — no one is there to notice the floor moved.

A frozen artifact going "no longer relevant" later is not a bug. The plan it belongs
to is by then done or superseded, and a _new_ refinement→plan supersedes it.
Relevance-drift is handled by the item's lifecycle, not by artifacts forever chasing
a moving source.

The same shape holds one lane over. A **support case** points at raw customer
evidence (email, screenshots — live, volatile); the **bug** it spawns internalises
the reproduction and the distilled evidence so it stands alone. Case points; bug
freezes. The rule generalises: **volatile working lanes (refinement, support) point
outward and may rot; committed execution artifacts (plan, bug) are frozen and
self-contained; the hand-off between them is always a freeze.**

## When is it done?

A good, boring definition — easier than waiting for someone to bless production:
**it's done when its own ledger is reconciled _and_ the checks are green _and_ the
change is merged.** A green-but-unmerged change is _ready_, not done. Anything that
breaks _later_ is a new item (usually a bug), not a reopening.

One habit makes this clean: **author the "move to done" inside the same change/PR**
— set the status and move the file as part of the diff. Why in the PR rather than
after the merge? A post-merge move is a step no one owns and nothing triggers, so
it's forgotten, and the item sits looking active while it's actually done — a new,
invisible limbo. Riding the move in the diff makes completion _atomic with the
merge_ (nothing to remember) **and reviewable** (the reviewer can check the ledger
against what the diff actually did — which is what catches quietly-dropped scope).

A caution worth keeping honest: **green checks prove what was built is correct, not
that everything planned was built**, and for work that can't be tested in CI at all
(infrastructure especially), "merged + green" means _merged, not proven_. Say so —
mark it "validation owed" — rather than letting a green checkmark overstate it.

## Keeping the memory honest — the open edge

The hardest, least-solved part, and worth naming plainly: **the corpus is a cache
of external truth (a design tool, email, and the code itself), and caches go
stale.** A plan or a decision record can quietly drift from what the code now does
and mislead the next agent — a lying memory is worse than a missing one. Pointing
rather than duplicating helps; dated snapshots ("as of this date, re-sync from the
source") help; and a little tooling helps more (link-integrity checks; checks that
a decision record still matches the code; a "how stale is this snapshot" signal).
Freezing every _load-bearing_ artifact at the draft→ready boundary closes one half
of this — a frozen thing can't vanish or dangle — leaving the residual, harder half:
pointers to _live_ authority (the code) that can still _drift_. Checked pointers
(drift fails a gate) and a freshness signal on dated snapshots blunt it, but this is
still the frontier for _both_ the projects this method has lived in — treat it as
unfinished, not solved.

## Three layers: the method, the skills, the harness

This method is one layer of three, and knowing which layer a thing belongs to is
what keeps each of them honest:

- **The method (this document)** — the _guidelines_. How the work moves, what the
  lanes are, the three firm things. Read by humans and agents alike; it teaches
  judgment, it doesn't police it.
- **The skills** — thin, agent-callable _nudges_ that carry the method's
  **repetitive mechanics** (author a plan the house way, walk the close-out ledger)
  so nobody re-narrates them each session. A skill is a paragraph aimed at the few
  things a capable model actually forgets — above all, _state the deferrals out
  loud_ — not a re-description of the whole procedure. **Nudge, not instruct:** the
  model already knows how to write a plan, so the skill points it at the corpus for
  the shape and guards the failure mode, then gets out of the way. A skill that
  swells into a manual has become the compliance regime this method rejects.
- **The harness** — the mechanical _gates_ that fail the build when a spec and the
  code (or two specs) drift. This is where determinism lives, and _only_ here.

The line between "leave it to judgment" and "make it a gate" is the **tier model**
the harness half uses (Tier 1 static · 2 behavioural · 3 operational · 4
semantic/judgment · 5 ratification). Most of what this method asks for is **Tier
4** — honest, but not mechanically knowable, so it stays a habit a skill nudges and
a reviewer enforces. A clause earns a gate _only when it names a
mechanically-knowable fact_, and then you **promote** it: keep the guideline, add
the gate beneath it, and say plainly which slice is gated and which stays judgment.
Three of this method's clauses have earned that promotion — _keep cross-references
alive_ and _point, don't duplicate_ (a corpus link-and-pointer gate), and the
**silent** slice of _honesty at close_ (a ledger-reconciliation gate: it catches an
undisposed box and a self-contradicting deferral summary, but whether a disposition
is _truthful_ stays with the reviewer). Everything else is deliberately left
un-gated — and _naming_ the unenforced surface, rather than quietly leaving it
unchecked, is itself part of the discipline.

Promotion runs one way only: a guideline may grow a gate beneath it; a gate may
never quietly widen into policing judgment. When in doubt, it stays a habit — the
same test as the three firm things: a mechanism earns its place only if it protects
the discovery, never if it starts policing it.

## Core vs per-project configuration

What makes the method _portable_ is the line between what you carry unchanged and
what you tailor:

- **Carry unchanged (the method):** self-contained items in a corpus; lanes as a
  toolkit; a board and a done-folder per lane; the three firm principles; the
  draft→ready freeze (point live authority, record settled decisions by value); the
  close-out honesty ritual; the merged-and-green definition of done; human-gated
  authoring/review with optionally-autonomous implementation; the corpus as
  reloadable memory; the three-layer split (method / skills / harness) and the
  one-way promote-a-clause path; corpus-as-template; and the standing invitation to
  invent new shapes.
- **Tailor per project:** which lanes exist; the numbering and id style; the exact
  state names and any gate checklists; the tooling's tech; and _which_ external
  sources of truth apply.

## Two instances (worked examples, not the method)

- **Solo greenfield.** Two lanes — _plans_ and _bugs_ — a single priority board, a
  completed/fixed folder each. The refinement and support lanes simply aren't
  needed yet; they'd be cargo-cult. Discovery is fast because the loop is short.
- **Multi-stakeholder, with real users.** The same skeleton, plus a _refinement_
  lane (design churn and open questions before a plan is stable) and a _support_
  lane (customer cases, with raw email kept by pointer). Same three firm
  principles, same close-out honesty — more lanes because more of the world is
  involved.

The point of showing both: _the core is identical; the lanes are configuration._
That's the whole promise of a portable method — drop the core into a new project,
then pick the lanes the work actually calls for.

---

_In the intended voice: a colleague's habits, not a compliance regime. Three things
firm because they protect the discovery; everything else a default to bend when the
work is better for it; and explicit room for a smarter agent to invent structure
this document doesn't yet have. Current, not finished — the honest open edge above
says which part is still frontier. Correct freely._
