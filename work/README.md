# `work/` — engineering corpus

Mutable work artifacts for the eess project. Durable docs live in `docs/`;
architecture decisions in `adr/` (kept at the repo root by convention).

| Folder              | What                 | Terminal (frozen) subfolders |
| ------------------- | -------------------- | ---------------------------- |
| [`plans/`](./plans) | Implementation plans | `completed/`, `wont-do/`     |

**Lifecycle:** work moves from the active folder into a terminal folder as it
finishes — `plans/0051-x.md` → `plans/completed/0051-x.md`. Terminal folders are
**frozen**: their links and code pointers describe things as they were, so
`npm run check:corpus` reports drift in them but never fails on it. The roadmap
is [`plans/ROADMAP.md`](./plans/ROADMAP.md).

This corpus is validated by `@nielspeter/eess-md` — `npm run check:corpus`
asserts internal cross-links resolve (the family dogfooding itself).
