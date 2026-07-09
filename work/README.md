# `work/` — engineering corpus

Mutable work artifacts for the eess project — the durable, reloadable memory a
fresh agent reads to reconstitute context. Durable docs live in `docs/`;
architecture decisions in `adr/` (kept at the repo root by convention). eess follows
[the working method](../docs/working-method.md) it packages as a kit under
[`kit/`](../kit/); this is the one-screen map.

## Lanes

| Folder              | What                 | Board                              | Terminal (frozen) subfolders |
| ------------------- | -------------------- | ---------------------------------- | ---------------------------- |
| [`plans/`](./plans) | Implementation plans | [`ROADMAP.md`](./plans/ROADMAP.md) | `completed/`, `wont-do/`     |

eess is a **solo-greenfield** instance — one lane. The `bugs/`, `refinement/`, and
`support/` lanes (with `fixed/` · `promoted/` · `delivered/` done-folders) are the
same skeleton and appear only when the work calls for them; until then they'd be
cargo-cult.

## Close convention (honesty at close)

Every item's header carries a neutral **`State:`** token, then free prose:

| Token      | Meaning                    | Terminal? |
| ---------- | -------------------------- | --------- |
| `Draft`    | authored, not committed    | no        |
| `Ready`    | frozen, committed to build | no        |
| `Done`     | merged + green + closed    | **yes**   |
| `Won't-do` | dropped on purpose         | **yes**   |

A terminal token — **or** living in a terminal folder — marks an item _done_.
Closing one means **disposing every open `- [ ]`** in its ledger with a disposition
token, and **saying the deferral count out loud**:

| Disposition          | Means                                        |
| -------------------- | -------------------------------------------- |
| `done-otherwise`     | happened, but not as written — told straight |
| `deferred→<home>`    | moved to a named home (a plan, an ADR)       |
| `dropped-on-purpose` | intentionally not doing it                   |
| `validation-owed`    | merged, but real-world validation still owed |

`Deferred: none` beside a `deferred→…` box is a lie the gate catches. Silence is not
"nothing deferred."

## Lifecycle

Work moves from the active folder into a terminal folder **as it finishes, in the
same PR** — `plans/0051-x.md` → `plans/completed/0051-x.md`. Riding the move in the
diff makes completion atomic with the merge and reviewable. Terminal folders are
**frozen**: their code pointers describe things as they were, so `check:corpus`
reports drift in them but never fails on it (links must still resolve).

## Keeping the corpus honest

Validated by the eess family dogfooding itself — drift fails the build:

- `npm run check:corpus` — cross-links resolve, `path:line` pointers ground, ADR
  enforcement tables are valid (`@nielspeter/eess-md`).
- `npm run check:ledger` — no _silently_-open box in a done item
  (`honestyAtClose`). Necessary-not-sufficient: the reviewer enforces whether a
  disposition is _truthful_; the gate catches the _silent_ case.
