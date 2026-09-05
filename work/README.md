# `work/` — engineering corpus

Mutable work artifacts for the eess project — the durable, reloadable memory a
fresh agent reads to reconstitute context. Durable docs live in `docs/`;
architecture decisions in `adr/` (kept at the repo root by convention). eess follows
[the working method](../docs/working-method.md) it packages as a kit under
[`kit/`](../kit/); this is the one-screen map.

## Lanes

| Lane                        | What                                          | Board                                      | Terminal (frozen) subfolders |
| --------------------------- | --------------------------------------------- | ------------------------------------------ | ---------------------------- |
| [`plans/`](./plans)         | Implementation plans                          | [`ROADMAP.md`](./plans/ROADMAP.md)         | `completed/`, `wont-do/`     |
| [`bugs/`](./bugs)           | Concrete defects in the code                  | [`BUGS.md`](./bugs/BUGS.md)                | `fixed/`, `wont-do/`         |
| [`proposals/`](./proposals) | Design under debate, before it becomes a plan | [`PROPOSALS.md`](./proposals/PROPOSALS.md) | `promoted/`, `declined/`     |
| [`spikes/`](./spikes)       | Dated measurements of something we don't own  | none — a spike is terminal when written    | the whole lane               |

**The `Lane` column is checked.** `check:corpus` binds it to the real directories
under `work/`: a lane added without a row fails the build, and so does a row
naming a directory that does not exist. It used to list one lane and call the rest
cargo-cult while four existed — see
[bug 0108](./bugs/fixed/0108-work-readme-lanes-table-lists-one-lane.md).

The other three columns are prose, not claims a gate has checked. The terminal
subfolders in particular are **conventions, created when a lane first needs one**:
`plans/wont-do/`, `bugs/wont-do/` and `proposals/declined/` are named here and do
not exist on disk yet. Read the column as where a thing goes, not as what is
there.

Further lanes — `refinement/` (volatile pre-plan discovery), `support/` (customer
cases) — are the same skeleton and appear only when the work calls for them. They
take numbers from the **same sequence as every other lane**
([0107](./bugs/fixed/0107-number-allocation-scans-one-lane.md)), so a plan and a
bug never collide. `spikes/` is the one with a different shape: its records
_conclude_ rather than close, so it has no board and no done-folder, and the whole
lane is frozen ([0256](./bugs/fixed/0256-the-spike-lane-is-run-but-never-declared.md)).

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
