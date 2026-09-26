# Bug 0339: every `**/…` glob matches nothing when the project sits under a dot-directory

## Status

- **State:** Fixed — on branch `fix/0339-globs-under-a-dot-directory`. Inbound, adopted after
  every load-bearing claim was re-measured against our own source and reproduced on 0.7.0; the fix
  went wider than the report, because measuring the whole surface found four more sites and one
  classification table asserting a behaviour nothing checked.
- **Severity:** High — **a correct rule reports that it enforces nothing, and the remedy the tool
  prints turns that into a fake green.** Under a project path containing a dot-segment, every
  `**/…` glob selects 0 subjects, so ADR-010's guard fires on rules whose selectors are fine. Its
  message says "Its own narrowing may have removed them… widen the selector", and offers
  `.expectEmpty()`. A reader who follows either weakens a rule that was right. Worse, the tool's own
  glob advice recommends the broken form: `packages/ts/src/core/glob-diagnosis.ts:121` tells the user
  to "prefix these with `**/`".
- **Origin:** **inbound** — reported by an agent in a consuming project against
  `@nielspeter/eess-ts@0.4.0`, whose checkout lived under a dot-directory created by a git-worktree
  manager. Renumbered into this sequence; the reporting project's paths are re-sourced to a neutral
  fixture, and the reproduction below is ours.
- **Reported:** 2026-09-26

## Symptom

Reproduced on **0.7.0** (`0f0207f`), one fixture project, copied to two paths, same commit and same
`node_modules`. The rule is
`functions(p).that().resideInFile('**/src/**').should().beExported()`:

| project path        | subjects examined | findings                          |
| ------------------- | ----------------- | --------------------------------- |
| `<tmp>/.dotdir/app` | **0**             | 1 — ADR-010 "examined 0 subjects" |
| `<tmp>/plain/app`   | 1                 | 0                                 |

The result depends on where the repository sits on disk, not on the code.

**The mechanism, measured directly** (picomatch 4.0.4, the version this package depends on):

| glob           | path                                 | options     | match  |
| -------------- | ------------------------------------ | ----------- | ------ |
| `**/shared/**` | `/Users/me/.tooldir/app/shared/a.ts` | default     | **no** |
| `**/shared/**` | `/Users/me/.tooldir/app/shared/a.ts` | `dot: true` | yes    |
| `**/shared/**` | `/Users/me/Projects/app/shared/a.ts` | default     | yes    |

With picomatch's default `dot: false`, `**` does not cross a segment beginning with `.`, and these
globs are matched against the **absolute** path.

**The documented workaround holds**, measured under the dot-directory: `resideInFile('src/**')`
examines 1 subject where `resideInFile('**/src/**')` examines 0. A project-relative glob is retried
against the root-relative path, so nothing above the root takes part.

## Root cause

Two facts meet.

Line numbers below are **as released in 0.7.0** (`0f0207f`), which is the code this was measured
against; the fix rewrote all of them, so they are pinned to the tag rather than repointed. (The pointer
gate does not examine a record in `fixed/` — see [0330](../0330-what-a-rule-reads-is-ruled-in-archived-bug-records.md)
— so a repointed line here would be a claim nothing re-checks.)

1. `picomatch(glob)` was called with default options at 31 sites in `packages/ts/src`, matched against
   absolute paths — `predicates/identity.ts:77`, `predicates/module.ts`, `predicates/call.ts`,
   `core/disk-set.ts`, `core/glob-evaluator.ts`, `models/slice.ts`, `smells/*`, `graphql/*` among them.
2. The root-relative retry that would sidestep the ancestor path existed, but only for
   project-relative globs: `resideInFile` tried `relativeToRoot` only `if (relative)`
   (`predicates/identity.ts:89-91`), and `isProjectRelative` (`core/project-relative.ts:67`) is false
   for anything starting `**/` — by design, because `'**/x'` means "anywhere" and must keep meaning
   that. **What that design missed is that "anywhere" is location-independent in both views**, which
   is the whole of the fix.

So the one form the tool recommends for "anywhere in the project" is the one form that never gets the
retry, and the ancestor path decides whether it matches.

`glob-diagnosis.ts` already has a `'dot-segment'` fault, but it is about a `./` segment written in
the GLOB, not a dot segment in the project root. Nothing looks at the root.

## Fix

**Ruling: candidate 1, applied through one shared matcher — and deliberately not to every glob.**

`readsRootRelativePath(glob)` in `packages/ts/src/core/project-relative.ts` decides once, per glob,
whether the path named from the project root is a second view. `pathGlobMatcher(glob)` compiles the
glob beside that decision, and `matchesPath` / `anyMatchesPath` are the one place a path glob meets a
path **where a `SourceFile` is in hand** — `core/disk-set.ts` keeps a deliberate second copy for
walked disk paths, which have no `SourceFile` and are named from roots of their own.

Every site that matched a file path against a glob had its own copy of that three-line decision, and
they disagreed. Measured at `0f0207f` over the ten sites that carry a sabotage row below: **three**
gated the second view on `isProjectRelative` (`predicates/identity.ts`, `cross-layer-builder.ts`,
`slice.ts`'s `resolveByDefinition`), **one** applied it unconditionally (`duplicate-bodies.ts`), and
**six** never applied it at all. `conditions/reverse-dependency.ts` also applied it unconditionally
and needed no behavioural change, so it appears in the matrix only as a guard row.

_(An earlier version of this paragraph said "three / three / four". It was an asserted split, it
partitioned neither population, and it was caught by review — in a record whose own subject is a
classification written down instead of derived.)_

**Removing the gate outright was tried first, and this repository's own controls refused it.** Both
exclusions `isProjectRelative` makes are load-bearing, and neither is about anchoring:

| excluded  | why, measured                                                                                                                                                                                                                                                                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `./x/**`  | picomatch matches `'./src/domain/**'` against `src/domain`, so offering the view reinstates the split verdict `isProjectRelative`'s own comment records: 3 subjects selected AND a dead selector reported, in one run                                                                                                                                      |
| `../x/**` | excluded alongside it, and a **different** fault — `syntacticFault`'s dot-segment test is `/(?:^\|\/)\.\//`, which `'../x'` does not match, so it is reported `unanchored`. Nothing above the root has a second view, so no match is forged either way; only the fault name differs, and the first version of this record claimed one rule for both shapes |
| `*/x/**`  | it is the last reachable `unanchored` fault for a path glob. Normalizing it made the anchor advice and the whole `ANCHOR_ADVICE` grouping unreachable — 7 failures in `tests/builders/slice-rule-builder.test.ts`, whose subject is that each remedy is TRUE                                                                                               |

So: the second view goes to a glob that names a location relative to the root, and to one that says
"anywhere". Both readings are location-independent, which is the property this bug is about.

A `base: 'absolute'`/`'normalized'` declaration is still derived from `isProjectRelative` and **not**
from the wider predicate. The reason is **inertness, not reachability**: the two predicates differ
only by `'**/'`-led globs, and `syntacticFault`'s single base-sensitive branch is
`base === 'absolute' && !isAnchored(glob)`, which such a glob never reaches — so declaring the wider
population would change no verdict, and `base: 'absolute'` stays reachable either way (`'*/x/**'`
still declares it and still trips `unanchored`). An earlier version of this record and two source
comments said widening it would make that fault _unreachable_. That was wrong; the decision is right
and the stated reason was not.

### What the whole surface measured

One fixture, copied to `<tmp>/.tooldir/wt/app` and `<tmp>/plain/app`, every path-glob surface, five
globs. **26 of 55 rows differed before; 0 differ after.** The four surfaces the report did not name:

| surface                                          | before                                                                                                                                                      |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `conditions/structural.ts` `resideInFile/Folder` | a **false red on every subject** (2 failures vs 0), not an empty selection — and no root-relative view at all, so a project-relative glob was reported dead |
| `conditions/function.ts` `resideInFile/Folder`   | the same, for `ArchFunction`                                                                                                                                |
| `smells/sibling-files.ts` `groupFilesByFolder`   | grouped every file into no folder, so the detector reported itself inert. Bug 0036's fix was made in `duplicate-bodies.ts` and never in its twin            |
| `presets/boundaries.ts` discovery                | 0 boundaries discovered; the `shared` guard then told the adopter their correct glob was wrong                                                              |

`diskSet.classify` also reads both views. It is the one producer that states a fact about the
filesystem, and under a dot-segment it classified a directory that exists and holds TypeScript as
`absent` — whose advice says no such path was found and a segment must be misspelled.

**Not changed, measured unaffected.** `import-target` globs already append the root-relative
candidate unconditionally (`candidatesFor`, bug 0037), so `notImportFrom`/`onlyImportFrom` were never
broken by the project's location. `graphql/index.ts` matches a path already relative to the root.
`predicates/call.ts` and `predicates/module.ts` match string literals and specifiers, not paths.

### The census asserted the fix and nothing checked it

`tests/matrix/path-glob-surfaces.ts` (extracted from the test that held it) classified
`conditions/structural.ts`, `conditions/function.ts` and `smells/smell-builder.ts` as `'normalized'`
while the code under those keys **matched the absolute path alone** — for `smell-builder.ts` that is
one of the two detectors it covers (`inconsistentSiblings`; `duplicateBodies` did normalize, since bug
0036), which is the sharper version of the point: one key, two behaviours, one letter of
classification. A classification with no mechanism is a comment
with a type annotation — and it is the reason this bug could exist behind a census whose stated
purpose is that "a new surface added without normalization fails". The durable half of this fix is
that the same table is now read by a behavioural test: every non-`'fixed'` surface owes a probe, each
probe is measured from both project paths, and a probe that reaches nothing fails rather than passing
by symmetry (two zeroes agree perfectly).

### One deliberate reversal, flagged for review

`strictBoundaries`' `shared` guard was documented as "a GUARD, deliberately not normalization",
because a relative spelling created no allowance and silently produced a false red. Half that reason
survives — its symmetry argument, "`folders` is not normalized either", holds because both normalize
now. The other half does not: from a project path holding a dot-segment there was **no** spelling that
worked, so the remedy could not state one. Measured after the fix, `shared: ['src/shared/**']` gives
exactly the two real cross-boundary edges, identical to `['**/src/shared/**']`. The guard is not
deleted — its population shrank to globs that are genuinely dead, which the neighbouring case pins.

### The sabotage matrix

Seventeen rows, each a **literal edit** to one tracked file, the whole `eess-ts` suite run against it,
then a restore verified by sha256. Every row on **one tree** — the first pass mixed two, which review
caught, and a control measured against a different tree than the rows beneath it is the one thing a
control exists to rule out.

| row — one literal edit, restored and sha256-verified    | vitest        | what reddened                                                                                                                                                                           |
| ------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R0 control (no edit)                                    | `3849 passed` | —                                                                                                                                                                                       |
| R1 readsRootRelativePath: globstar case dropped         | `18 failed`   | the whole dot-directory suite (18) — **the bug itself**                                                                                                                                 |
| R2 readsRootRelativePath: both exclusions dropped       | `5 failed`    | the repo's own controls (5): the `./`-segment control, `an explicitly-anchored glob is NOT normalized`, and the slice anchor-advice group                                               |
| R3 matchesPath: never reads the second view             | `48 failed`   | 48 — the project-relative contract and the dot-directory suite together                                                                                                                 |
| R4 identity.resideInFile: absolute only                 | `10 failed`   | 10 — `'predicates/identity.ts' · 'resideInFile'`, the workspace-roots case, the workaround control                                                                                      |
| R5 structural.resideInFile: absolute only               | `1 failed`    | `'conditions/structural.ts' · 'resideInFile (failures)'` — the census-bound table is its only falsifier                                                                                 |
| R6 function.resideInFile: absolute only                 | `1 failed`    | `'conditions/function.ts' · 'resideInFile (failures)'`                                                                                                                                  |
| R7 cross-layer resolveLayer: absolute only              | `1 failed`    | `'builders/cross-layer-builder.ts' · 'layer (pairs)'`                                                                                                                                   |
| R8 slice resolveByMatching: absolute only               | `1 failed`    | `'builders/slice-rule-builder.ts' · 'matching'`                                                                                                                                         |
| R9 slice resolveByDefinition: absolute only             | `8 failed`    | 8 — `relative-globs-are-uniform` incl. `runtime and diagnosis agree for every surface`, and the workspace-roots cases                                                                   |
| R10 sibling-files: absolute only                        | `1 failed`    | `'smells/smell-builder.ts' · 'inconsistentSiblings().inFolder'`                                                                                                                         |
| R11 duplicate-bodies: absolute only                     | `1 failed`    | `'smells/smell-builder.ts' · 'duplicateBodies().inFolder'`                                                                                                                              |
| R12 boundaries folders: absolute only                   | `1 failed`    | `it('discovers boundaries from under a dot-directory')` — **this row fired nothing before review**, because `strictBoundaries` declares no glob site and nothing ran it from a dot-path |
| R13 disk-set classify: absolute only                    | `2 failed`    | `it('tells the truth about what is on disk')` and its roots-differ twin                                                                                                                 |
| R14 reverse-dependency: absolute only                   | `3 failed`    | 3 — the census probe, `relative-globs-are-uniform`, and the workspace-roots allowlist case                                                                                              |
| R15 boundaries shared: absolute only                    | `1 failed`    | `a relative spelling means the same as the anchored one (bug 0339)`                                                                                                                     |
| R16 census probe table: an empty probe array            | `1 failed`    | `every surface the census classifies has a probe that measures something` — **added after review**, which measured the old guard passing an empty array                                 |
| R17 disk-set: the walk root only, not the tsconfig root | `1 failed`    | `tells the truth about what is on disk when the roots differ` — **added after review**                                                                                                  |

It lives here rather than only in the PR body, which is where the first version left it: the evidence
for this record's strongest claim — that the fix is falsifiable at every site — belongs inside the
corpus the gates read.

### What review changed

Three lenses ran on PR #150 — enforcement and method (mandatory for this repo) and product, for the
`strictBoundaries` reversal. They found one Critical in the instrument this fix is built on, one in
the code, and a list of claims in this record that did not survive checking. What changed as a result,
because the findings are the interesting part of the record and not a footnote to it:

| finding                                                                                         | what it was                                                                                                                                                                                                                                                                                  | what changed                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **enforcement, Critical** — the probe table could be emptied per surface without failing        | the guard tested `PROBES[file] === undefined`, and `[]` is not `undefined`. Setting `'conditions/structural.ts': []` and reverting that file to the absolute path alone left the **whole suite green** — the bug this record is about, re-introduced, undetected                             | `(PROBES[file]?.length ?? 0) === 0`, plus `it('the table states its own denominator')` with a floor, as the census it reads already has                                                                     |
| **product, Critical** — two discovery remedies stated a contract this fix made false            | both said the glob "is matched against absolute file paths" and prescribed a `'**/'` prefix, which for an already-anchored glob yields `'**/**/no-such-dir/**'` — a different string, the identical finding, an agent that loops (ADR-009 rule 2)                                            | both rewritten to state that both views are tried and name the causes that remain; `suggestion`/`bypassFilters`/`severity` re-pinned, and a test that the one remedy which IS a spelling clears the finding |
| **product, Important** — `diskSet.classify` named its second view from the wrong root           | the walk starts at `discoverIdentityRoot` (the `.git` root) while every rule-facing matcher uses the tsconfig directory. In a monorepo package they differ, so the producer still answered `absent` for a path the runtime selects — and the first pin used a fixture where the two coincide | both prefixes are tried, and the pin now builds a package nested under a workspace marker so the roots really differ                                                                                        |
| **product, Important** / **method, Minor** — an `every()`→`some()` change rode along undeclared | it swapped a false red for a **false green**: `some` declares `'normalized'` for a mixed set, letting a genuinely dead `'*/b/**'` escape the `unanchored` branch                                                                                                                             | reverted to `every()` with the dilemma written down; the real answer is a per-glob `base`, filed as [0341](../0341-one-base-is-collapsed-over-a-set-of-globs-the-runtime-decides-per-glob.md)               |
| **enforcement, Important** / **method** — "13 rows, one per site" was short by two              | `conditions/reverse-dependency.ts` and `presets/boundaries.ts`'s `shared` discovery had no row. Neither was a hole, but R12 is the receipt for what an unrowed site costs                                                                                                                    | the matrix is 17 rows and re-run whole on the final tree                                                                                                                                                    |
| **method** — three stated numbers did not reproduce                                             | "three/three/four" partitioned neither population; "21 tests" was 22; "4578 tests" was 4480; and the control was measured on a tree that predated the R12 pin                                                                                                                                | the split restated from the matrix's own ten, every count re-taken from one run, and the matrix moved into this record                                                                                      |
| **method** — the ruling belongs where the next change can find it                               | 13 files under `packages/ts/src/` cite `0339` for a rule whose only statement is in a folder the corpus gate freezes                                                                                                                                                                         | [0330](../0330-what-a-rule-reads-is-ruled-in-archived-bug-records.md) now lists it, with why it is the sharpest instance so far                                                                             |
| **enforcement, Minor** — the census keys on _declaration_, not on _matching_                    | four surfaces this fix touched declare no glob site and are invisible to the scan; two were pinned by hand here                                                                                                                                                                              | filed as [0340](../0340-the-path-glob-census-keys-on-declaration-not-on-matching.md)                                                                                                                        |

Three source comments were also wrong and are corrected in place: `syntacticFault` reports
`dot-segment` for `./` only (`../` is `unanchored`), the `base` decision is about inertness rather
than reachability, and `matchesPath` is not "the ONE place" while `disk-set.ts` keeps its own copy.

## Related

- [0174](../0174-eess-ts-reports-a-clean-gate-with-no-denominator.md) — the other record about a rule
  that cannot say what it examined.
- [0330](../0330-what-a-rule-reads-is-ruled-in-archived-bug-records.md) — where a ruling about what a
  rule reads should live. This record filed itself there as a further entry rather than resting on the
  distinction it first drew ("about what a rule can SELECT"), which review called thin and is.
- [0340](../0340-the-path-glob-census-keys-on-declaration-not-on-matching.md) — the census blind spot
  R12 is the receipt for.
- [0341](../0341-one-base-is-collapsed-over-a-set-of-globs-the-runtime-decides-per-glob.md) — the
  per-glob `base` this record deliberately did not fix.
- [0342](../0342-the-release-gate-abstains-on-the-peer-edge-and-cites-a-closed-record-for-it.md) —
  `check:release` printing "0 edges" while this PR's break has a workspace peer dependent.

## Verification

- [x] every inbound claim re-measured against our own source and reproduced on 0.7.0 — the tables
      above: the picomatch behaviour, the 0-vs-1 subject count across two paths, the 31 call sites,
      the `if (relative)` retry, and the tool's own `**/`-prefix advice.
- [x] the reporter's preferred fix measured viable — a `**`-led glob does match a root-relative path
      in every shape tried.
- [x] the documented workaround measured working — a project-relative glob is unaffected.
- [x] a ruling on which fix lands, and where the project root comes from at each call site — candidate
      1, through one `pathGlobMatcher`/`matchesPath` pair, with the root taken from the element's own
      `SourceFile` (and the project's `tsConfigPath` as the fallback the builders already passed). The
      ruling that was NOT obvious is in `## Fix`: not every glob gets the second view, and this
      repository's own controls are what settled it.
- [x] a red-first regression test from a constructed dot-directory path —
      `packages/ts/tests/core/globs-under-a-dot-directory.test.ts`, confirmed red before the fix
      (4 of 5 failing, each returning the rule id because the only finding was ADR-010's vacuity
      report; the one that passed was the project-relative workaround, the control). Now 24 tests,
      because it also carries the table over the census, the boundaries and disk-set pins, and the
      nested-package fixture review asked for.
- [x] the fix, with the vacuity diagnosis telling the truth about the root — **done-otherwise, and the
      difference matters.** Candidate 3 proposed a new dot-segment diagnosis. Measured, the producer
      that printed the misleading remedy was never `glob-diagnosis`: `isDeadSite` already takes the
      union of the absolute and tsconfig-relative views, so a `'**/src/**'` under a dot-directory was
      _live_ to the diagnosis and dead at runtime. The wrong remedy came from ADR-010's vacuity guard
      firing on `examined: 0`, which the fix removes at the root. What candidate 3 was right about is
      `diskSet.classify`, the one producer that states a fact about the filesystem — it now reads both
      views, pinned by `it('tells the truth about what is on disk')`.
- [x] a changeset — `.changeset/globs-read-the-project-root.md`, `minor` and marked
      `**Breaking (@nielspeter/eess-ts):**`. A rule can select more, so a green build may report and a
      baseline entry may go unmatched; the `preset/boundaries/shared-discovery` finding for a relative
      spelling also disappears, because that spelling now works.
- [x] a sabotage matrix — **17 rows on one tree, every one of them fires**; the table is in `## Fix`
      above. Control R0 green at 3849. Two rows exist because review found them missing
      (`reverse-dependency`, `boundaries`' `shared`) and two because review found a guard that could
      not fail (the empty probe array, the disk-set root). **R12 fired nothing on the first pass** —
      reverting `strictBoundaries`' folder discovery left the whole suite green, because the preset
      declares no glob site and nothing ran it from a dot-path — and is pinned rather than left
      unfalsifiable. The two rows that matter most are the ones that red the repo's OWN controls:
      dropping both exclusions from `readsRootRelativePath` reds the `./`-segment control in
      `tests/core/project-relative-globs.test.ts` and the slice anchor-advice group, which is how the
      blanket fix was caught before it shipped.
- [x] reviewed — enforcement, method and product. Two Criticals, both fixed here; see
      `### What review changed`. Three findings were promoted to their own records (0340, 0341, 0342)
      rather than fixed in this PR.
- [x] `npm run validate` green.

Deferred: none.
