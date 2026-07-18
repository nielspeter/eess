---
name: close
description: 'Close out a finished work-item (plan / bug / support case) honestly — walk its ledger, say the deferral count out loud, re-home every deferral, move it to the done-folder in the same PR, and run the ledger gate. The one ritual worth doing the same way every time.'
argument-hint: '[path/to/item.md]  (defaults to the item in context / the branch diff)'
---

# Close-out (honesty at close)

The working method's first firm principle: **when an item is finished, every part
of it ends as _done_, _done-otherwise_, _deferred to a named home_, or _dropped on
purpose_ — nothing vanishes silently.** This skill is a thin nudge over the one
ritual worth doing identically every time. It is the same across lanes (plan / bug
/ support), so there is one `/close`, not one per lane — only the done-folder
differs.

Guard the failure model actually has: **silent deferral** (an open ledger box left
undisposed) and the **orphaned post-merge move** (a done item that sits looking
active). Everything else — how to reason about whether the work is really done —
stays your judgment.

## When

The work is **merged-and-green** _or_ about to be, and you're authoring the
move-to-done **inside the same PR** (never as a forgotten post-merge step). Done =
_ledger reconciled + checks green + change merged._ Green-but-unmerged is _Ready_,
not done.

## The convention this keys on

Neutral machine token, project-local prose after it — see
[`docs/working-method.md`](../../../docs/working-method.md).

- Header: `**State:** Done — <free prose>` (or `Won't-do`).
- Every unchecked `- [ ]` in the ledger gets a **disposition token** inline:
  `done-otherwise` · `deferred→<home>` · `dropped-on-purpose` · `validation-owed`.
  The reason follows as free prose.

## Run

1. **Find the item.** Use `$ARGUMENTS` if given; else the item referenced in
   context, else the plan/bug/case touched by the current branch diff.

2. **Walk the ledger — every box.** For each unchecked `- [ ]`, decide and write
   its disposition token:
   - `done-otherwise` — it happened, but not as written; say how, straight.
   - `deferred→<home>` — moved to a real home (a plan, a bug, an ADR). **Create or
     name the home now** — never a footnote in the nearly-done item.
   - `dropped-on-purpose` — intentionally not doing it; say why.
   - `validation-owed` — merged, but real-world validation still owed (infra,
     deploy config that CI can't exercise). Don't let a green check overstate it.

3. **Say the deferral count out loud.** Add/verify the summary line —
   `Deferred: none`, or `Deferred: <home>, <home>`. **Silence is not "nothing
   deferred."** `Deferred: none` beside a `deferred→…` box is a lie the gate
   catches — reconcile it.

4. **Set the state + move the file — in this PR.** Set `**State:** Done`
   (`Won't-do` if dropped). Move the file to the lane's done-folder
   (`plans/completed/` · `bugs/fixed/` · `support/delivered/` — `wont-do/` for
   `Won't-do`) as part of the diff, so completion is atomic with the merge and
   reviewable.

5. **Update the board.** Mark it done on `ROADMAP.md` / `BUGS.md` / the lane's board
   (strikethrough + a "done (PR #NN) → completed/" note, the house style).

6. **Fix the links, then run the gates.** The move breaks inbound links — repair
   them (the corpus gate ships a deterministic autofix for unique moves), then run
   **`npm run check:corpus`** and **`npm run check:ledger`** — the ledger must
   reconcile (no silent box).

7. **Report the disposition out loud to the human**: the deferral count and where
   each went, plus the gate results. Don't bury it.

## Honesty caveat

Green checks prove what was built is correct, **not** that everything planned was
built — and for infra that CI can't exercise, "merged + green" means _merged, not
proven_. Mark it `validation-owed` rather than letting a checkmark overstate it.
The reviewer reading the ledger against the diff is the real enforcer of _truthful_
dispositions; the gate only catches the _silent_ ones.
