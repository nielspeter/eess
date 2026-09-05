# `work/` — the engineering corpus

All ongoing work lives here as **self-contained markdown items** — the team's
durable, reloadable memory. A fresh agent reconstitutes context by reading it. See
[the working method](../docs/working-method.md) for the full picture; this is the
one-screen map.

## Lanes (start with two; add more when the work demands them)

| Lane                         | Board          | What                           | Done-folder        |
| ---------------------------- | -------------- | ------------------------------ | ------------------ |
| [`plans/`](plans/ROADMAP.md) | **ROADMAP.md** | buildable implementation plans | `plans/completed/` |
| [`bugs/`](bugs/BUGS.md)      | **BUGS.md**    | concrete code defects          | `bugs/fixed/`      |

The **refinement** lane (volatile pre-plan discovery), the **support** lane
(customer cases) and the **spikes** lane (dated measurements of something outside
this repo) are not seeded here — add them only when a design tool + more people,
real users, or a genuine outside question actually enter. Until then they'd be
cargo-cult.

A spikes lane is the one with a different shape: its records **conclude rather
than close**, so it has no board and no done-folder — a spike is terminal the day
it is written. Freeze it if your corpus gates code pointers, because a spike
cites code you do not control.

## Conventions

- **Self-contained items** — everything about one item in one file, readable
  start to finish.
- **Point, don't duplicate** — external, still-moving sources (a design tool, the
  code) are referenced with a dated pointer; a _settled_ decision is recorded by
  value.
- **Honesty at close** — a finished item disposes every part (done · done-otherwise
  · deferred→home · dropped-on-purpose) and says the deferral count out loud. The
  `check:ledger` gate catches the _silent_ case; the reviewer enforces the rest.
- **State token** — every item's header carries `**State:**` with a leading
  `Draft` / `Ready` / `Open` / `Done` / `Won't-do`, then free prose. Terminal
  tokens (`Done` / `Won't-do`) live in the done-folder.

## Keeping it honest

Cross-references, `path:line` code pointers, and ADR enforcement tables are held
honest by `npm run check:corpus`, and close-out by `npm run check:ledger` — both
from the [eess](https://github.com/nielspeter/eess) family. Drift fails the build.
