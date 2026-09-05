# Working-Method Kit

A portable, agent-usable packaging of [the working method](../docs/working-method.md)
— the _guidelines_ half of eess's harness (the mechanical half is the `check:*`
gates). It carries the method's **repetitive mechanics** as thin agent-callable
skills so nobody re-narrates them each session, plus the corpus skeleton and gates a
new project needs to start.

Everything here is **language-neutral (English)** on purpose: the kit is drop-in and
identical across projects. Your _corpus content_ — plan bodies, bug reports, the
board — stays in whatever language your project works in. The gates and skills key on
neutral tokens (`State:`, the disposition tokens); they ignore the prose.

## What's in it

| Path                          | What                       | Notes                                                                |
| ----------------------------- | -------------------------- | -------------------------------------------------------------------- |
| `skills/`                     | 7 agent-callable skills    | drop into `.claude/skills/`; invoked as `/plan`, `/bug`, `/close`, … |
| `templates/work/`             | cold-start corpus skeleton | lane README + `ROADMAP.md` / `BUGS.md` boards                        |
| `templates/plan.md`, `bug.md` | seed item templates        | **delete once real items exist** — the corpus is the template        |
| `AGENTS.snippet.md`           | agent-entry nudge          | paste into your `AGENTS.md` / `CLAUDE.md`                            |
| `scripts/next-number.mjs`     | number allocator + gate    | one definition of the numbering rule; `--check` gates collisions     |
| `bootstrap.mjs`               | one-command installer      | zero-dep, dry-run by default, never clobbers                         |

**The skills, by lane:**

- **Plan lane** — `/plan` (author, stops at Draft) → `/plan-ready` (the freeze) →
  `/plan-build` (build a Ready plan). Bare root authors; suffixes are later stages.
- **Bug lane** — `/bug` (author + fix, red test first).
- **Universal** — `/close` (close any item honestly; one ritual, every lane).
- **No skill, by design** — the **spikes** lane. A spike is one document written
  after measuring something outside the repo; there is no sequence to walk, no
  ledger to reconcile and no close ritual, so a skill would be ceremony around a
  single act. The lane is described in the working method and named in the
  corpus template; it is not scaffolded.
- **Optional** — `/refine` (volatile pre-plan lane), `/case` (support). Add only
  when a design tool + more people, or real users, actually enter.

## Install

**One command** (dry run first — it writes nothing until `--apply`):

```bash
node path/to/kit/bootstrap.mjs            # preview the plan
node path/to/kit/bootstrap.mjs --apply    # perform it
```

It installs the skills into `.claude/skills/`, the number allocator into
`scripts/next-number.mjs`, seeds `work/` (boards + templates), copies the method doc
into `docs/`, and appends the agent-entry nudge — skipping anything already present,
so re-running is safe.

**Or by hand** — copy `skills/*` into `.claude/skills/` (or `~/.claude/skills/` for
all projects), `scripts/next-number.mjs` into `scripts/`, `templates/work/` into
`work/`, and paste `AGENTS.snippet.md` into your agent-entry doc.

## Wire the gates

The kit's skills call these by **script name**, not by path — wire them into
`package.json` + CI so drift fails the build.

Two come from the [eess](https://github.com/nielspeter/eess) family
(`@nielspeter/eess-md`):

- `check:corpus` — cross-links resolve, `path:line` pointers ground, ADR enforcement
  tables are valid.
- `check:ledger` — a done-item carries no _silently_ open ledger box
  (`honestyAtClose`). Necessary-not-sufficient: the reviewer enforces whether a
  disposition is _truthful_; the gate catches the _silent_ case.

Two are the number allocator `bootstrap.mjs` installs at `scripts/next-number.mjs`:

```
"next-number":   "node scripts/next-number.mjs",
"check:numbers": "node scripts/next-number.mjs --check"
```

- `next-number` — what `/plan`, `/bug` and `/case` call to allocate. A corpus runs
  **one sequence per number width, shared across every lane**, so `work/plans/0100-…`
  and `work/bugs/0100-…` are the same number claimed twice. An allocator that scans
  only its own lane hands out a number another lane already holds — the failure is
  intermittent (it only bites once the other lane pulls ahead), so it survives until
  two people or two agents work the corpus at once.
- `check:numbers` — the gate for the same invariant: exits non-zero when any number
  is claimed twice at the same width. Run it in CI; a collision is cheap to fix at
  the commit and expensive to unpick later, because every board row, `path:line`
  pointer and `[NNN](…)` link then resolves ambiguously.

The `close` skill and the seed corpus assume these script names; alias them if your
project names things differently.
