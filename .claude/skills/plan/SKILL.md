---
name: plan
description: 'Author a new plan (new work or a refactor) in work/plans/ — confirm it is really a plan, take the next free number, follow the house shape from the corpus, write and link any prerequisite ADRs, put it on the board, and stop at State: Draft. Authoring is not committing to build.'
argument-hint: '<one-line intent>   e.g. /plan add per-tenant rate limiting'
---

# Author a plan (stop at Draft)

A **plan** is something _new_ or a _refactor_ — work that isn't a defect but needs
a _how_ worked out before building. This skill is a thin nudge over authoring one
the house way. It does **not** commit you to build it — authoring produces a
**Draft**; promoting to Ready (`/plan-ready`) and building (`/plan-build`) are
separate, deliberate acts.

Read the _shape_ from the corpus, not from this skill: skim two or three recent
plans in [`work/plans/`](../../../work/plans/) (and `completed/`) for the house
structure, and the board [`ROADMAP.md`](../../../work/plans/ROADMAP.md) for how
entries and priorities are written. **The corpus is the template** — don't invent a
shape this project doesn't already use.

## Run

1. **Confirm it's really a plan.** New work or a refactor with unknowns to work
   out → plan. A concrete defect that's wrong right now → `/bug` instead. Volatile,
   still-being-argued discovery against a moving source (a design tool,
   stakeholders) → `/refine` first. If it's small enough to just do, say so and skip
   the ceremony.

2. **Take the next free number.** Scan `work/plans/` **and** the board for the
   highest `NNN`; use `NNN+1`. Guard against a collision with an existing or
   board-listed number.

3. **Write it in the house shape** at `work/plans/NNN-slug.md`, matching the
   sections recent plans actually use (Problem · phases · Out of scope · Success —
   whatever the corpus shows). The header carries the neutral state token, with the
   project's own prose after it:
   `**State:** Draft — <free prose, e.g. "awaiting acceptance criteria">`.

4. **Prerequisite decisions become ADRs.** If a real design decision surfaces while
   drafting ("what must we decide before we can build this?"), write it as an ADR in
   the project's ADR directory (e.g. `adr/`) with its tiered `## Enforcement` table
   (the ADR gate requires it) and **link the plan to it** — don't bury the decision
   in the plan body.

5. **Put it on the board.** Add a row to `ROADMAP.md` (priority + link + one-line
   status), matching the existing rows.

6. **Optionally fan out review** before it's considered stable.

7. **Stop at Draft. Report** the number, the file, the board row, and any ADRs
   written. Do **not** start implementing — a Draft is not a work order.

## Guards (the failures models actually have)

- **Unclosable mega-plans** — a plan must be _closable_. Phases slice one
  coherent delivery; they are not a place to park a backlog. If a later phase
  could still be unbuilt when the rest is shipped and merged, it isn't a phase —
  it's a separate item, and the board is where unscheduled ones live. Split it
  now: a plan whose finished work reads as open work lies to every later reader.
- **Number collisions** — always check the board _and_ the folder.
- **Phantom numbers and naked ideas** — never reserve a number for work with no
  plan file, and never park an item on the board as a numberless "idea". Both
  make the board unreadable: a number resolving to nothing reads as an artifact
  that exists, and an idea with no plan has no state, no priority and nothing to
  read. **If it is worth listing, it is worth a Draft.** Authoring one is cheap
  and commits you to nothing — that is the entire point of stopping at Draft.
- **Un-placed items** — a plan not on the board is invisible; add the row.
- **Buried decisions** — a real design choice belongs in an ADR the plan links, not
  as a paragraph.
- **Barrelling into build** — authoring ends at Draft; don't code.
