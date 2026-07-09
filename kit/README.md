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
| `bootstrap.mjs`               | one-command installer      | zero-dep, dry-run by default, never clobbers                         |

**The skills, by lane:**

- **Plan lane** — `/plan` (author, stops at Draft) → `/plan-ready` (the freeze) →
  `/plan-build` (build a Ready plan). Bare root authors; suffixes are later stages.
- **Bug lane** — `/bug` (author + fix, red test first).
- **Universal** — `/close` (close any item honestly; one ritual, every lane).
- **Optional** — `/refine` (volatile pre-plan lane), `/case` (support). Add only
  when a design tool + more people, or real users, actually enter.

## Install

**One command** (dry run first — it writes nothing until `--apply`):

```bash
node path/to/kit/bootstrap.mjs            # preview the plan
node path/to/kit/bootstrap.mjs --apply    # perform it
```

It installs the skills into `.claude/skills/`, seeds `work/` (boards + templates),
copies the method doc into `docs/`, and appends the agent-entry nudge — skipping
anything already present, so re-running is safe.

**Or by hand** — copy `skills/*` into `.claude/skills/` (or `~/.claude/skills/` for
all projects), `templates/work/` into `work/`, and paste `AGENTS.snippet.md` into
your agent-entry doc.

## Wire the gates

The kit's skills call two gates; wire them into `package.json` + CI so drift fails
the build. Both come from the [eess](https://github.com/nielspeter/eess) family
(`@nielspeter/eess-md`):

- `check:corpus` — cross-links resolve, `path:line` pointers ground, ADR enforcement
  tables are valid.
- `check:ledger` — a done-item carries no _silently_ open ledger box
  (`honestyAtClose`). Necessary-not-sufficient: the reviewer enforces whether a
  disposition is _truthful_; the gate catches the _silent_ case.

The `close` skill and the seed corpus assume these two script names; alias them if
your project names things differently.
