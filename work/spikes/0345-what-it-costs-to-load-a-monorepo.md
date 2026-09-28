# Spike 0345: what it costs eess-ts to load a monorepo

Measured 2026-09-28 against an adopter's monorepo — twelve packages, one
`tests/architecture/projects.ts` that constructs **twelve `project()` instances as
module-level `export const`**, all alive at once in a single vitest fork
(`singleFork`, for module-cache reuse). Their CI gives that step
`--max-old-space-size=8192` with the comment "the 16GB runner has room"; four
runners now share one 16 GB box, so the ceilings can exceed the machine. No job
has actually OOM'd — this is a latent capacity question, not a live failure.

**The question this spike answers:** is eess-ts wise about what it loads, or is
the memory the adopter is budgeting for something we could avoid?

## Method

`ts-morph` 27, Node 24, **one process per configuration** so nothing accumulates
across measurements, peak `process.memoryUsage().rss` after constructing every
project and calling `getSourceFiles()`.

A first attempt ran all configurations in **one** process and is discarded: the
heap figures accumulated, and `skipLoadingLibFiles` read _higher_ than the
defaults, which is impossible. Recorded because the number looked plausible and
would have shipped as a finding.

The corpus is deliberately **not** this repository. eess's own tree is 199 files
with almost no runtime dependencies; it cannot exhibit the shape under test.

## Headline numbers

| configuration                       | source-file instances | peak RSS          |
| ----------------------------------- | --------------------- | ----------------- |
| one project                         | 1,076                 | 728 MB            |
| **all twelve, as the adopter runs** | **2,682**             | **2,320 MB**      |
| `skipLoadingLibFiles`               | 2,682                 | 2,175 MB (−6%)    |
| `skipFileDependencyResolution`      | 1,838                 | **661 MB (−72%)** |
| both                                | 1,838                 | 659 MB            |

**Dependency resolution is nearly the whole cost.** Lib files are noise beside it.

## What we do today

`project()` is `new Project({ tsConfigFilePath: resolved })` and nothing else
(`packages/ts/src/core/project.ts`). Every ts-morph default applies, including
`skipFileDependencyResolution: false`, which walks the import graph and adds
every file it reaches. We pass no options and share nothing between calls.

## The duplication is real and smaller than it looks

The first reading of the table was that twelve Programs must be holding the same
files over and over. Measured, they are not:

|                                           |                      |
| ----------------------------------------- | -------------------- |
| file instances across the twelve projects | 2,682                |
| **distinct files**                        | **2,043**            |
| ratio                                     | **1.31×**            |
| files reached by more than one project    | 198 (one of them 9×) |
| redundant instances                       | 639                  |

So a shared document registry across `project()` calls would remove at most ~24%
of the instances, not most of them. Worth knowing before anyone builds one: the
intuitive fix is the smaller lever.

**None of the extra files are `node_modules`.** Every configuration reports
`own == total`. The 844 files that dependency resolution adds are the adopter's
own sources, reached across package boundaries.

## They already use `workspace()` — and hold both representations at once

**This section replaces one that asked "should they use `workspace()`?" and
answered "no". That answer rested on a false premise: the adopter's
`projects.ts` declares `workspace([...fifteen configs])` fifty lines below the
`project()` exports, with the comment "Makes cross-workspace imports visible to
noUnusedExports() and beImported()". The reading stopped at the first block.**
Recorded rather than deleted, because the wrong answer was confidently argued
from two real facts and still did not survive reading the rest of one file.

What is true is sharper than the question. They hold **both** shapes
simultaneously — fifteen per-package Programs _and_ one merged Program — because
each answers a need the other cannot:

| need                                                                  | shape that serves it              |
| --------------------------------------------------------------------- | --------------------------------- |
| per-package rules that cannot drift (`modules(cell)`, `modules(sdk)`) | fifteen named `project()` handles |
| cross-workspace `noUnusedExports()` / `beImported()`                  | one `workspace()` Program         |

Measured, peak RSS, isolated processes, using the real calls:

| what `projects.ts` loads                | peak RSS     |
| --------------------------------------- | ------------ |
| the fifteen `project()` instances alone | 2,943 MB     |
| `fullWorkspace` alone                   | 1,040 MB     |
| **both, as the file does today**        | **3,729 MB** |

**3.7 GB before a single rule executes** — which revises this spike's own earlier
framing. Loading is roughly two-thirds of their ~6 GB step, not one-third.

**One Program for fifteen configs costs ~65% less than fifteen Programs**
(1,040 vs 2,943 MB). That is far more than the ~24% predicted from the 1.31×
instance duplication, and the prediction used the wrong proxy: per-Program
_fixed_ overhead dominates — fifteen lib sets, fifteen compiler hosts, fifteen
sets of type structures. Duplicate file instances were never the main cost.

### Why they cannot simply collapse onto the workspace

Two reasons, both measured in their tree:

1. **Their rules address projects by name**, so scoping is structural. Under one
   merged Program each rule needs a path glob instead, and a glob that drifts is
   a rule that silently widens. Named handles cannot drift.
2. **Compiler options genuinely differ.** `packages/ui` declares
   `lib: ["ES2024","DOM","DOM.Iterable"]`; `apps/api` declares `jsx` and no
   explicit lib. `workspace()` builds its Program from the **alphabetically
   first** tsconfig and `apps/` sorts before `packages/`, so UI code would be
   checked without DOM. eess patched its own `getCompilerOptions()` to answer per
   package (bug 0058), but the Program still uses one config's options — so any
   rule needing type resolution in `packages/ui` is not safe to move.

### The product gap, stated precisely

eess offers per-package Programs **or** one merged Program. An adopter needing
both holds both, and the same file is parsed into two Programs that share
nothing. Neither `project()` nor `workspace()` is wrong; what is missing is that
they cannot share a file cache.

The bound on that fix is worth stating before anyone builds it: file text and AST
could be shared between Programs; **per-Program type structures cannot**, and on
these numbers the type structures look like the larger half. A shared cache is
therefore a partial win of unknown size, not a halving.

## An adopter is waiting on this decision

Recorded because it changes the decision's weight, not its content. The adopter
read this spike and replied that `skipFileDependencyResolution`, "if it lands, is
the real memory fix for us" — so a candidate here is on someone's critical path.

**They were told not to plan around it**, and the reason is the gap this spike
already declares: 72% is a _parse-time_ saving, and roughly two-thirds of their
footprint is rules executing plus vitest, which no flag here touches. Their own
diagnosis also points at a kernel OOM under four concurrent runners on one 16 GB
box — a scheduling ceiling that no eess-side change can lift.

The measurement that would close this spike's largest gap is theirs to take and
was asked for: peak RSS of the arch step **as it actually runs**
(`/usr/bin/time -v`), not of project construction. Near 2.3 GB means loading is
the problem; near 6 GB means execution is, and the candidates below are headroom
rather than a fix.

## The largest gap is closed: loading is the majority

This spike's headline caveat was that 2.3 GB (later 3.7 GB, once the fifteen
projects and the workspace were both counted) is _parse time_, and that it could
not see how much sat above it. The adopter took that measurement.

|                                                          |                                 |
| -------------------------------------------------------- | ------------------------------- |
| peak RSS of the arch step as it really runs              | **6,157 MiB** (6.01 GiB), 422 s |
| what loading accounts for, measured here                 | **3,729 MiB**                   |
| **loading's share of peak**                              | **60.6%**                       |
| above loading — rules executing, vitest, everything else | 2,428 MiB                       |

**It is the loading half**, and this spike guessed the other way: it recorded
"roughly two-thirds of the footprint is the rules executing plus vitest". That
guess was wrong and is kept rather than edited out — the spike's value was in
refusing to _claim_ the number, and the refusal is what got it measured.

It does not change the advice that went with it. The reported symptom is a worker
dying with no V8 heap message under four runners sharing a 16 GB box, which is a
scheduling ceiling: 60% of 6 GiB is still 6 GiB when four run at once.

## What this spike still does not answer

- **Whether `skipFileDependencyResolution` is safe.** `candidatesFor`
  (`packages/ts/src/core/import-candidates.ts`) resolves a module specifier through
  `decl.getModuleSpecifierSourceFile()`, so every import and dependency rule
  depends on resolution, and type-level rules need the checker. The population of
  rules that genuinely need it is unmeasured, and that is the question a fix turns
  on.
- **Whether peak or steady state matters** for a runner hosting four jobs. The flag
  is a ceiling, not a reservation.

## The decision this brings back

Three candidates, none costed beyond the table above:

- **Expose the ts-morph options.** Cheapest, and it moves the decision to the
  adopter — who cannot know which of their rules need resolution either. A
  footgun with a 72% prize on it.
- **Derive it.** Decide per run whether resolution is needed by asking the
  declared rules — the glob/`GlobSite` model already makes a rule's needs
  partly inspectable, and ADR-010's evidence discipline means a rule that
  silently needed resolution would have to fail rather than pass thin.
- **Share a file cache between `project()` and `workspace()`.** Invisible to rule
  authors. The case for it is the section above: an adopter who needs both shapes
  holds both, and they share nothing. Bounded — AST and file text can be shared,
  per-Program type structures cannot — so size it before building it.

**Nothing is decided here.** The next step is a ruling on which of the three, and
that ruling needs the missing measurement: which rules actually need resolution.

## Related

- [0174](../bugs/0174-eess-ts-reports-a-clean-gate-with-no-denominator.md) — the
  other record about what a run can say for itself.
- The adopter's `projects.ts` also carries a hard guard refusing to run from a
  worktree inside a dot-directory. That is
  [0339](../bugs/fixed/0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md),
  fixed in eess-ts 0.8.0 — the guard can go once they upgrade.
