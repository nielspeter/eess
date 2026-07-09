<!--
  Paste this into your project's agent-entry doc (AGENTS.md, CLAUDE.md, or whatever
  the project uses). It's a thin nudge — it points at the method and notes the
  skills exist; it does not re-describe either. Keep it short.
-->

## Working method

This project tracks work as a self-contained markdown corpus under [`work/`](work/)
and follows [the working method](docs/working-method.md): lanes with a board and a
done-folder each, three firm things (honesty at close · point-don't-duplicate · keep
cross-references alive), and a draft→ready **freeze** before anything is built.

**Skills carry the repetitive mechanics** — prefer them over re-narrating:

- `/plan <intent>` — author a plan (stops at Draft) · `/plan-ready` — the freeze ·
  `/plan-build <n>` — build a Ready plan
- `/bug <symptom>` — author + fix a defect (red test first)
- `/close` — close any item honestly (walks the ledger, says deferrals out loud)
- `/refine`, `/case` — the volatile pre-plan and support lanes (add when needed)

**Gates** (drift fails the build): `npm run check:corpus` (links, `path:line`
pointers, ADR enforcement) and `npm run check:ledger` (no silent open box in a done
item). Run them before proposing a commit; a failing gate is the repo telling you a
spec and the code have drifted — fix the drift, don't route around it.
