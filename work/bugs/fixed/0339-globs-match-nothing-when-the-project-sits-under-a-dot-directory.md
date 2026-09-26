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

`readsRootRelativePath(glob)` (`packages/ts/src/core/project-relative.ts:313`) decides once, per
glob, whether the path named from the project root is a second view. `pathGlobMatcher(glob)` compiles
the glob beside that decision, and `matchesPath` / `anyMatchesPath` are the one place a path glob
meets a path. Every site that matched a file path against a glob had its own copy of that three-line
decision, and they disagreed: three offered the second view only for a project-relative glob, three
offered it always, four never offered it at all.

**Removing the gate outright was tried first, and this repository's own controls refused it.** Both
exclusions `isProjectRelative` makes are load-bearing, and neither is about anchoring:

| excluded         | why, measured                                                                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `./x/**`, `../x` | picomatch matches `'./src/domain/**'` against `src/domain`, so offering the view reinstates the split verdict `isProjectRelative`'s own comment records: 3 subjects selected AND a dead selector reported, in one run                                        |
| `*/x/**`         | it is the last reachable `unanchored` fault for a path glob. Normalizing it made the anchor advice and the whole `ANCHOR_ADVICE` grouping unreachable — 7 failures in `tests/builders/slice-rule-builder.test.ts`, whose subject is that each remedy is TRUE |

So: the second view goes to a glob that names a location relative to the root, and to one that says
"anywhere". Both readings are location-independent, which is the property this bug is about. A
`base: 'absolute'`/`'normalized'` declaration is still derived from `isProjectRelative` and **not**
from the wider predicate — widening it would make the `unanchored` fault unreachable, which is the
same mistake one level up.

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
while **all three matched the absolute path alone**. A classification with no mechanism is a comment
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

## Related

- [0174](../0174-eess-ts-reports-a-clean-gate-with-no-denominator.md) — the other record about a rule
  that cannot say what it examined.
- [0330](../0330-what-a-rule-reads-is-ruled-in-archived-bug-records.md) — where a ruling about what a
  rule reads should live; this one is about what a rule can SELECT.

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
      report; the one that passed was the project-relative workaround, the control). Now 21 tests,
      because it also carries the table over the census.
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
- [x] a sabotage matrix — 13 rows, one per site plus three on the shared decision, each a literal edit
      restored and verified by sha256. Control R0 green at 3844. **One row fired nothing on the first
      pass** — reverting `strictBoundaries`' folder discovery left all 3844 tests green, because the
      preset declares no glob site (so the census table cannot see it) and nothing ran it from a
      dot-path. Pinned rather than left unfalsifiable, with
      `it('discovers boundaries from under a dot-directory')`; the re-run reds exactly that test. The
      two rows that matter most are the ones that red the repo's OWN controls: dropping both
      exclusions from `readsRootRelativePath` reds the `./`-segment control in
      `tests/core/project-relative-globs.test.ts` and the slice anchor-advice group, which is how the
      blanket fix was caught before it shipped. The table is in the PR body.
- [x] `npm run validate` green.

Deferred: none.
