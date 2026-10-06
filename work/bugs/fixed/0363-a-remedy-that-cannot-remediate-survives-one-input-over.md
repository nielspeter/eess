# Bug 0363: a `parent-dir` glob naming a file outside the project is told to widen an include that cannot help

## Status

- **State:** Fixed — the route has one owner, consulted by the admission gate and by both
  tools' messages, so the reason a finding exists and the reason it gives can no longer be two
  derivations. Fixed together with
  [0364](./0364-doctor-states-the-cause-and-never-the-remedy.md), because both records
  said the seam was the same and fixing one would have grown a second copy.
- **Severity:** Medium — **no wrong verdict; an impossible remedy on an unsuppressable
  finding.** The finding is correct and the `Fix:` line beside it cannot be carried out.
  ADR-009 rule 2: "a message whose stated fix is impossible on the path that produced it
  is worse than no message: the agent tries it, it fails, and the agent then does the
  forbidden thing."
- **Origin:** review of [0362](./0362-a-typod-ratchet-is-green-in-both-tools.md).
  Two independent lenses reached the same cell from opposite directions — one from the
  emitted text, one from the mechanism.
- **Reported:** 2026-09-29

## Symptom

A cardinality rule whose selector is a `parent-dir` glob naming a **file** that sits
outside the tsconfig:

```ts
modules(p).that().resideInFolder('**/apps/legacy/src/old**').should().satisfy(notExist())
```

`diskSet.classify` matches files as well as directories and is not kind-aware, so the
glob classifies `holds-typescript` and the finding takes the disk-contradicts branch:

> **Fix:** Widen the tsconfig include to cover this path, or correct the selector — do
> not delete this rule, it is what detected the gap.

Widening the include cannot make that glob match anything. `resideInFolder` reads the
directory portion of each path, and the glob names a file — so the fault survives any
`include`. The second half of the sentence ("or correct the selector") is achievable; the
first half, which is what an agent reads first, is not.

## Root cause

Two questions are being conflated at the boundary between `disk-set.ts` and
`vacuity-diagnosis.ts`:

- `classify` answers **"is there TypeScript at this path?"** — about paths, always.
- the remedy needs **"is the tsconfig the lever for this fault?"** — which depends on the
  glob's `kind` and on the fault, not only on what is on disk.

For the `no-match` fault those two coincide, which is why the branch was written as it
was. For `file-not-folder` they do not: the fault is decidable without the filesystem,
and 0362's second fix made the _in-project_ case correct by reading `diagnosis.onDisk`
(`undefined` for `file-not-folder`, because `diagnoseGlob` returns before consulting the
disk). The _out-of-project_ case reaches the same branch through the admission filter,
which calls `classify` directly and does get an answer.

So `cardinalityDeadSiteIsAtFault` admits the finding **because the disk contradicts the
absence claim**, and the message beside it — correctly — reports that the disk did not
decide. Both are right about their own question; the pair is what is wrong.

**Correction, 2026-10-01 — this section has the mechanism wrong, and the Fix below is where it
is right.** `diagnosis.onDisk` was **not** undefined for the out-of-project case: the glob fell
through to `no-match`, the disk answered `holds-typescript`, and the route was genuinely
`contradicted-by-disk`. The two derivations did disagree, but the fault was **undetectable**,
not merely mis-explained — which is why keying the remedy off the route would have fixed
nothing on its own. Left standing with this note rather than rewritten: the reasoning here is
what the first fix attempt was built on, and a reader who meets only the corrected version
learns nothing about how it was got wrong. Flagged by method review, which pointed out that a
top-down reader takes the wrong mechanism away.

## Fix

**Built as proposed**, with one thing the proposal did not see.

`deadSiteRoute(diagnosis)` in `glob-diagnosis.ts` is the single owner — exhaustive over
`GlobFault`, returning `'syntactic' | 'names-a-file' | 'contradicted-by-disk' | undefined`.
`CARDINALITY_REMEDY` and `ROUTE_HOLDS_IN_ANY_PROJECT` key off it as `Readonly<Record<…>>`,
the idiom `FAULT_ADVICE` and `ON_DISK_ADVICE` already establish in that file. Three consumers
now read one value: `check`'s admission filter, `check`'s message, and `doctor`.
`cardinalityDeadSiteIsAtFault` is gone.

**What the proposal missed: the fault was not merely mis-remedied, it was undetectable.**
`diagnoseGlob` detects `file-not-folder` from `universe.filePaths` — the **project's** files.
A file OUTSIDE the project is not in that list, so the glob fell through to `no-match`, the
disk said `holds-typescript`, and the route was genuinely `contradicted-by-disk`. Keying the
remedy off the route would have changed nothing: the route itself was wrong.

So the fix completes the detection at its source. `DiskSet` gains `matchesOnlyFiles(glob)` —
the kind-aware question `classify` cannot answer, since `classify` is about paths and this is
about whether any **directory** matches — and `diagnoseGlob` consults it for the
out-of-project case. It answers `false` when the walk cannot say, so the fault is never
claimed without evidence.

**And a test caught an error in the new table.** The first draft set
`ROUTE_HOLDS_IN_ANY_PROJECT['names-a-file'] = true`. It is **false**: the fault is contingent
on the filesystem, because the same glob matches fine in a project where that name is a
directory. `doctor-and-check-agree-about-a-ratchet.test.ts`'s row for that route reddened —
the row that exists precisely because it is the one input separating that claim from a
constant.

## Related

- [0362](./0362-a-typod-ratchet-is-green-in-both-tools.md) — fixed the same class
  on the two routes it could reach without changing that boundary. This is the third.
- [0355](./0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md)
  — where the disk became a discriminator at all.
- [0354](../0354-the-glob-view-doctrine-is-settled-in-three-bug-records-and-no-adr.md) —
  the same complaint one level up: this boundary's doctrine lives in bug records.

**An open question, recorded rather than answered.** Enforcement review asked whether a
cardinality rule can have a dead **discovery** glob, which would be silent in both paths
(`cardinalitySelectorMissedDisk` returns `deadSitesIn(...).selector` and discards
`.discovery`; `deadSelectorFindings` returns empty for cardinality outright).

**Not constructible — and the first version of this paragraph got there on evidence that was
refuted.** It said the only `position: 'discovery'` construction was a preset's internal
diagnostic. Method review grepped `'discovery'` instead and found **five more, in public
builders** (`slice-rule-builder.ts:149` and `:174`, `cross-layer-builder.ts:229`,
`smell-builder.ts:148`, `resolver-rule-builder.ts:110`) which pass the position as a bare
argument rather than a named property. **A survey that searches one spelling and reports
absence** is the failure `CLAUDE.md` records about its own gate table — repeated here by the
author who had quoted that lesson earlier the same day.

The conclusion holds for a different reason: `assertsCardinality()` is a constant `false` on
`TerminalBuilder` (`packages/ts/src/core/terminal-builder.ts:507` on `91b420a`), overridden in exactly one
place — `RuleBuilder` (`packages/ts/src/core/rule-builder.ts:221`) — and every one of those
five builders extends `TerminalBuilder` or `GraphqlRuleBuilder` directly and overrides nothing.
A rule that stamps a discovery glob therefore always answers `false`, and never enters the
cardinality path these exemptions live on. Carried to
[0371](../rejected/0371-can-a-cardinality-rule-have-a-dead-discovery-glob.md), including the part
nothing guards: a future builder that both stamps a discovery glob and overrides
`assertsCardinality()` would reopen it silently.

## The refactor was unpinned, and a stray `git checkout` is what revealed it

Worth recording because the mechanism is general. This fix has two halves: **detection**
(`matchesOnlyFiles`, so the fault is seen at all) and **one owner** (the route table, so
admission and message cannot disagree). The red test asserted
`suggestion` contains `Correct the selector` — and the **detection half alone produces that**,
because without the route table the old `isCardinality`/`onDiskContradicts` branch reaches the
same sentence once `diagnoseGlob` returns `file-not-folder`.

So the one-owner half — this bug's actual ruling — was asserted by nothing. It was found when a
sabotage script's cleanup ran `git checkout --` on `vacuity-diagnosis.ts` and reverted the
refactor: **the suite stayed green at 3,910 tests**, and only `check:arch`'s unused-export rule
noticed, by reporting `DeadSiteRoute` and `ROUTE_HOLDS_IN_ANY_PROJECT` as referenced by no
other file. A dead export was the only visible trace of a reverted design.

Fixed two ways. The `names-a-file` route now has its **own** sentence ("name the DIRECTORY you
mean"), which only the route table can produce, and the test asserts it — verified by
replacing the table with a hand-rolled equivalent, which reds. And the lesson about the tool:
`git checkout --` inside a sabotage script is the same hazard as `git stash`, which this
project already warns about — it silently discards the work under test rather than the
mutation.

## Two more defects, found by review, in the fix itself

Both measured by reviewers and neither caught by this suite — which stayed at 3,910 tests
across both.

**`matchesOnlyFiles` asserted a kind-fact the walk cannot witness.** It computed
`hits(everyFile) && !hits(dirs)`, and `dirs` is not a sound "no directory" witness twice over:

- a **pruned** directory is recorded before `isDirectory()` is asked, so it is in neither list —
  the inference `classify` refuses ten lines away;
- a **symlinked** directory has `isDirectory() === false` under `withFileTypes`, so it lands in
  `everyFile` looking like a file. The walk's own comment licenses that mis-recording because
  it is "wrong in the direction that only weakens a message" — and this consumer made it
  _strengthen_ a claim.

Measured on the unfixed tree: a symlink to a directory full of TypeScript was told "this matches
a FILE but is used where a directory is read… name the DIRECTORY you mean". And with a pruned
`dist/` beside a sibling `distribution.md`, the same — on the one route whose entire point is
that the tsconfig is not your lever. **Bug 0363 in mirror image.** Both now refuse: `pruned` and
an unresolved-symlink list, the second kept separate so `classify`'s documented trade is
untouched.

_The fixture looks odd for a reason worth writing down._ `'**/apps/legacy/vendor**'` has no
slash after `vendor`, so it matches the **sibling** `vendor-notes.ts` within the segment — that
sibling is what satisfies the first conjunct at all. With a trailing slash
(`'…/vendor/**'`) nothing matches and the defect is unreachable. I spent several probes
concluding the conjunct was dead because I had built it with the slash.

**Admission was keyed on glob TEXT with last-write-wins.** One glob at two fault-position sites
— `resideInFolder` declares `parent-dir`, `resideInFile` declares `file-path` — and `Map.set`
let the second site's "no route" erase the first's. Measured: `check` went **green** on a
ratchet that can never match while `doctor` reported it, which is the divergence the kernel's
own `glob-site.ts` records as "bug 0040's silence half". The other order reported twice, the
extra finding carrying the **non-cardinality** remedy — "remove the rule" — on an unsuppressable
cardinality finding, which is the ADR-009 rule 2 defect this family has already shipped once and
which `CARDINALITY_REMEDY`'s own docstring forbids.

Now a disjunction over **dead** sites only (first defined route wins, `Map.has` rather than
`get() !== undefined`), which restores exactly what the deleted predicate did —
`hasSyntacticFault || contradictsAbsence(…)` was a disjunction, its syntactic half a set over all
sites. The `isDeadSite` guard also stops `diagnoseGlob` being called against its documented
contract: without it the map held routes for healthy, live globs.

**Residual, recorded not fixed:** admission is still keyed on glob text, so a finding for one
site can be admitted because a sibling site has a route — each finding still explained from its
own site. That is what the deleted predicate did too, so it is pre-existing rather than a
regression, and the reachable shapes need one glob text at two fault positions. Per-site
admission would mean `deadSitesIn` carrying the site with each violation; that is a change to a
boundary three fixes have now touched, so it is a decision rather than a patch.

## Two more, from architecture review: a false exhaustiveness claim and a public break

**`deadSiteRoute`'s docstring claimed a compile-time guarantee it did not have.** It said a
fifth `GlobFault` "stops this compiling". Measured with the repo's own `tsc`: it does not.
Because `undefined` is a legal return value, a `switch` missing a case simply **falls off the
end and compiles**, so the new fault would have become silently "not a fault" in both tools.
The module did red — at `FAULT_ADVICE`, a different line with a different fix, so an author adds
an advice string, goes green, and ships the hole.

The predecessor this refactor deleted, `isSyntacticFault(fault): boolean`, could not fail that
way: a boolean return makes falling off the end an error. **The refactor traded a compile-time
check for a sentinel and the docstring asserted the opposite.** Fixed with the `never` witness
`isFaultPosition` carries for the same measured reason — verified by adding a fifth fault and
watching `deadSiteRoute` itself red rather than only its neighbour.

The same docstring cited `contradictsAbsence` as a model for exhaustiveness. It is not one: it
also compiles clean against a fifth `OnDisk`. What is exhaustive there is the **test** that
enumerates the union, not the function. Corrected in place.

**`matchesOnlyFiles` was added as a REQUIRED member of a public interface.** `DiskSet` is on
the dialect root (`packages/ts/src/index.ts`), so `const d: DiskSet = { classify: … }` stopped
compiling for every consumer — a break that `check:release` cannot see (it reads the
`**Breaking**` marker, not prose) and `check:surface` cannot see either (it tracks export
_names_, not interface members). Made **optional** instead, which costs nothing: the one call
site already treats an absent answer as "cannot say", and the no-evidence sets still implement
it. A new required member on a published interface is a break; a new optional one is not.

**And a cosmetic one worth the line it takes.** `doctor` joined cause and remedy with a bare
space while `check` uses `". "`, so the shipped output read "…inside a directory Correct the
selector…" — two sentences run together. Measured in review, not noticed here.

## Designed behaviour worth knowing, not a defect

For the instance this bug was filed on — a file **outside** the project — the `names-a-file`
remedy is a **step, not a terminal fix**. Both of its branches leave the rule matching nothing,
so the next run reports again, this time on the `contradicted-by-disk` route, and _then_ names
the tsconfig. Two iterations, each with a true next edit, no false green at any point. Product
review measured it and judged it correct; recorded so the next reader does not file it as a bug.

## The sabotage matrix

Published rather than counted. 0362 was corrected two days before this for writing "three
sabotage rows cover it" and publishing none; claiming six and publishing none is that same
lapse by the successor record, and method review called it.

Each row a literal edit, restored from a sha256-verified backup with the restore verified. `t1`
is `one-owner-for-the-route-and-the-remedy.test.ts`, `t2`
`doctor-and-check-agree-about-a-ratchet.test.ts`.

| row | edit                                                                    | result            |
| --- | ----------------------------------------------------------------------- | ----------------- |
| R0  | control, unmodified                                                     | green (both)      |
| S1  | drop `matchesOnlyFiles` from `diagnoseGlob` — restores this bug         | **RED** (1)       |
| S2  | `matchesOnlyFiles` ignores directories, so any on-disk match counts     | **RED** (2)       |
| S3  | `doctor` stops appending the remedy — restores 0364                     | **RED** (1)       |
| S4  | the `names-a-file` route reuses the tsconfig remedy                     | **RED** (1)       |
| S5  | `ROUTE_HOLDS_IN_ANY_PROJECT['names-a-file']` flipped to `true`          | **RED** in t2 (1) |
| S6  | the admission filter ignores the route, admitting every dead selector   | **RED** in t2 (2) |
| S7  | the route table replaced by a hand-rolled copy (the pre-refactor shape) | **RED** (1)       |
| S8  | `names-a-file` collapsed onto `contradicted-by-disk`'s remedy           | **RED** (2)       |

Four more after review, each guard checked **independently** — every row takes the file from 7
passing to 6, so none of the four is carried by another:

| row | edit                                                     | result      |
| --- | -------------------------------------------------------- | ----------- |
| S9  | the `pruned` guard dropped from `matchesOnlyFiles`       | **RED** (1) |
| S10 | the unresolved-symlink guard dropped                     | **RED** (1) |
| S11 | last-write-wins admission restored                       | **RED** (1) |
| S12 | the deletion sentence restored for `route === undefined` | **RED** (1) |

S11 and S12 only fire because the tests drive **one glob text at two fault-position sites, in all
three chainings** (`.and()` both ways, and without `.and()`). A first version swept single-site
globs and could not red on either — the defects are unreachable from a single site, which is why
this suite missed what two reviewers measured.

**S7 is the row that matters most, because its absence is what let the refactor be silently
reverted** during authoring — the original assertion was satisfied by the detection half alone.
S7 and S8 were added after review, and both fire.

## Verification

- [x] a red-first test driving a `parent-dir` glob naming a file **outside** the project —
      `one-owner-for-the-route-and-the-remedy.test.ts` ·
      `it('a glob naming a FILE is not offered the tsconfig')`, measured red before the fix
      (`expected 'this path exists and contains TypeScript…' not to contain 'tsconfig'`).
- [x] a CONTROL that the FOLDER case still IS offered the tsconfig, so this is a
      discrimination and not the removal of a word.
- [x] the route decided and recorded, with the two questions named separately: `classify`
      answers about paths, `matchesOnlyFiles` about kinds.
- [x] the in-project case still green — 0362 pins it as
      `it('the third admission route is not offered the tsconfig either')`, and that row is
      what caught the scope error in the new table.
- [x] a sabotage matrix — **published below**, not merely counted.
- [x] `npm run validate` green.
- [ ] the discovery-glob question measured, and either filed or closed with the evidence —
      `deferred→`[0371](../rejected/0371-can-a-cardinality-rule-have-a-dead-discovery-glob.md). Not
      needed by this fix, and recorded rather than carried: a question asked three times and
      answered none is how a bug record becomes an argument.

Deferred: [0371](../rejected/0371-can-a-cardinality-rule-have-a-dead-discovery-glob.md).
