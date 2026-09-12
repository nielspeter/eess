# @nielspeter/eess-md

## 0.6.1

### Patch Changes

- 14137a6: **Correction: two names on the `@nielspeter/eess-ts` removal list are back.**

  The `0.5.0` entry in this changelog published a list of nineteen
  `@nielspeter/eess-ts` symbols removed from that package's barrel. Two of them —
  `isStrictFamily` and `resolveFlag` — were removed by mistake and are restored.
  The other seventeen are still gone.

  This package itself is unchanged; the bump exists so the correction reaches the
  readers the claim reached. A removal list published in a sibling's changelog has
  no other way to be corrected, because only the package that shipped the fix would
  otherwise bump — the reverse of the rule that makes a breaking change name its
  dependents.

  The full, current list of what left each barrel in `0.5.0`, and which symbols
  still resolve from `@nielspeter/eess/internal`, is in the
  [0.5 migration guide](https://github.com/NielsPeter/eess/blob/main/docs/migrating-to-0.5.md).

- Updated dependencies [bc38ee1]
  - @nielspeter/eess@0.5.1

## 0.6.0

### Minor Changes

- ca4e19b: **Breaking (behavioural):** an ambiguous code pointer is now a violation instead of being skipped

  `pointers().should().resolve()` in `suffix` mode classified a pointer matching
  two or more files as `ambiguous` and returned no violation for it — the source
  comment read "reported elsewhere, never failed". There was no elsewhere: nothing
  counted, printed or surfaced an ambiguous pointer, and it stayed inside the
  denominator the caller reports. In this repo's own corpus that was **16 of 463
  live pointers** sitting inside a summary line reading "all ground in code",
  having grounded in nothing. Two resolved by hand were pointing at the wrong
  file's line and could not have failed.

  An ambiguous pointer now produces a violation naming every candidate and the
  remedy:

  ```
  ambiguous code pointer: "rule-builder.ts:1" matches 2 files
  (packages/core/src/rule-builder.ts, packages/ts/src/core/rule-builder.ts)
  — cite a longer suffix so it names one
  ```

  This matches `@nielspeter/eess-crossvalidate`, which has always reported an
  ambiguous citation as a violation with the same remedy.

  **Why this is marked breaking on a `0.x` minor rather than a patch:** it can turn
  a green build red without the consumer changing a line. If your corpus has bare
  filenames that match several files, `check()` will now fail on them. Three ways
  out, in order of preference:
  1. **Cite a longer suffix** — the message names the candidates, so the shortest
     disambiguating prefix is visible without opening either file.
  2. **Sanction the region** where the citation is deliberately historical:
     `<!-- eess-exclude-start <rule-id>: reason -->` … `<!-- eess-exclude-end -->`.
     **This requires `.rule({ id })` on the chain**, because an exclusion comment
     matches a violation by rule id and a chain without `.rule()` has none — the
     comment is then silently inert, with no diagnostic. So
     `pointers(c).that().areLive().should().resolve().check()` (the form this
     README shows) must become
     `pointers(c).that().areLive().should().resolve().rule({ id: 'my/pointers' }).check()`
     before any sanction takes effect. This prerequisite is not new, but it was
     only ever written down in `docs/violation-reporting.md`, far from the place
     you need it.
  3. **Move that rule to `.warn()`** while you work through them — reports without
     touching the exit code.

  No autofix is attached, deliberately — choosing among the candidates is a
  judgement, and a deterministic rewrite would pick whichever sorted first.
  `exact` mode is unaffected — it never consulted suffix matching, so it cannot
  produce an ambiguity.

  With `externalRoots` configured, a root that **resolves** the pointer still wins:
  an in-repo ambiguity is not evidence about an external checkout. If the roots do
  not resolve it — including when none of them is present on disk — the ambiguity
  is reported, naming the roots that were searched. Those two exits used to skip
  silently and to report a false `not in the repo` respectively; both are fixed
  here and both now have tests.

  `@nielspeter/eess-crossvalidate` is named as a courtesy, not because the gate
  required it: its dependency on `eess-md` is an **optional peer**, and every
  import is `import type`, so `check:release`'s dependents graph (which is scoped
  to real `dependencies`) never asked for it. Its own ambiguous-citation handling
  is separate, pre-existing code. **Nothing about its behaviour changes** — if you
  use crossvalidate, there is nothing here to migrate.

- 48bf698: **Breaking (@nielspeter/eess):** an empty source can no longer be declared away, and it gets its own finding

  ADR-014 §4 states the precedence: "an empty source (`sourceEmpty`) outranks any declaration and names
  the source." The evidence gate honoured `declaredEmpty` before it ever read `sourceEmpty`, so a
  hand-assembled receipt could set both and pass. Measured before this change:

  ```js
  finishPreset(collectResult([], { examined: 0, sourceEmpty: true, declaredEmpty: true }))
  // -> green
  ```

  That is a verdict declaring away a source that loaded nothing — the escape hatch the comment beside
  that branch claimed this ADR had closed. It now reds, and so does the same receipt with `notRun`.

  **New finding id: `emitter/source-empty`.** An empty source previously produced the generic
  `emitter/pass-without-evidence`, whose remedy is "widen the selection, or declare it" — both wrong
  here, because no declaration can make an absent source into evidence. The new finding names the
  source and says so: fix the project, the tsconfig, or the glob. If you match on `ruleId`, this case
  moves from `emitter/pass-without-evidence` to `emitter/source-empty`.

  **The zero-examined message no longer names a preset's option.** It said `expectEmpty: true in a
preset's report options`, which ADR-014 §4 forbids at a seam that is frequently not a preset — the
  same defect that made `checkAll([])`'s remedy unreachable. It now names what a hand-assembled receipt
  can actually do: `collectResult(violations, { examined, declaredEmpty: true })`, or `.expectEmpty()`
  on a builder.

  **Every dialect is named at `minor` because every dialect ships this break.** They depend on the
  kernel, so an adopter installing one of them takes the new precedence without asking — and
  changesets propagates a dependency bump as a patch regardless, which is the release a `^0.x` range
  accepts silently (bug 0185's shape).

  **Both seams, not just one.** `mergeCollectResults` exempted a `sourceEmpty` member from its
  dead-member filter — correct for "did this member say why it contributed nothing", wrong once §4
  makes that answer a fault. Fixing only the gate left the two doors disagreeing about one receipt:
  `finishPreset` reddened it while `mergeCollectResults([thatMember, aHealthyOne])` stayed green. The
  merge names an empty-source member now.

  **`sourceEmpty` can now be contradicted, like every other flag that quiets a zero.** A source that
  loaded nothing cannot have yielded units to examine, so `{ examined: 900, sourceEmpty: true }` is
  `emitter/contradictory-evidence` — it used to be silent. `notRun` and `declaredEmpty` beside evidence
  already reddened; this was the one flag in the vocabulary with no falsifier.

  **The contradiction names the flag it contradicts.** `emitter/contradictory-evidence` hardcoded
  `notRun` in its message, so a contradicted `sourceEmpty` told you to "drop the notRun flag" — one you
  never set. It names the actual flag now, with the matching remedy.

  **Not affected:** every builder-produced verdict. A terminal that loaded nothing already carried its
  own source finding and exits before this gate. The population this changes is the hand-assembled
  receipt, which is what ADR-014's gate exists for.

- 725281f: **Breaking** — the published barrels stop re-exporting 37 internal helpers.

  These were on the entry point but were never API: nothing outside their own
  package's `src/` referenced them, no `docs/` page or README taught them, and every
  test that used one reached past the barrel into the source module already. Measured
  before the change: 253 of 664 exported symbols appeared in no documentation at all,
  and these 37 were the subset that no reader could have found and no consumer could
  have learned to use.

  `eess-mermaid` loses the free predicate/condition functions — `haveNameMatching`,
  `areAbstract`, `notDependOnStereotype` and the rest of that block. The documented
  surface is the fluent builder that wraps every one of them
  (`classes(d).that().areAbstract()`), per ADR-003; the free functions were the
  plumbing behind it. Names like `haveNameMatching` looked documented only because
  `docs/classes.md` and `docs/api-reference.md` are the **TypeScript** dialect's pages
  and the names collide.

  `eess-ts` loses glob-evaluator, disk-set, project-registration and diagnosis
  internals. `eess-md` loses nothing (`presentExternalRoots` was removed and then
  restored — see below).

  Kept deliberately, because "unreferenced in this repo" is not the same as
  "accidental" for a library: `taskItems()` and `TaskItemRuleBuilder` are a builder
  entry point exactly like `docs()` and `links()`, `RowMatchOptions` is a **required**
  argument to `rows()`, and `parseClassDiagram` throws the already-documented
  `MermaidUnitParseError`. Seven more went back on the barrel because removing them
  turned them from undocumented API into dead code, which is a different decision than
  this one — they stay visible as undocumented surface in `check:docs-code` rather
  than being quietly deleted.

  `eess-crossvalidate` is named here because it peer-depends on all three dialects.
  It imports none of the removed symbols and needs no change — but a consumer reading
  its changelog should see the break named, not "Updated dependencies" (bug 0185).

  ## Removed with no replacement — the full list

  These 37 are dialect-local. They were never kernel symbols, so
  `@nielspeter/eess/internal` does **not** have them and no import path reaches them any
  more. If you used one, the fluent builder is the supported route.

  **`@nielspeter/eess-ts` (19)** — FAULT_ADVICE, ON_DISK_ADVICE, buildDiskSet, collectCalls, collectObjectLiteralFunctions, diagnoseGlob, emptyProjectAdvice, fromObjectLiteralFunction, globSitesOf, isDeadGlobTree, isDeadSite, isStrictFamily, isTypeOnlyReExport, loadedNothing, registerProjectRoots, registerRootCompilerOptions, resolveFlag, splitGlobArgs, verbatimModuleSyntaxFor

  **`@nielspeter/eess-mermaid` (18)** — areAbstract, conditionHaveStereotype, dependOn, extendClass, extendName, haveAtLeastOneMethod, haveMemberNamed, haveMethodNamed, haveNameEndingWith, haveNameMatching, haveNameStartingWith, haveNoMembers, notDependOn, notDependOnStereotype, notExist, notExtendStereotype, notHaveStereotype, predicateHaveStereotype

  The mermaid list is the free predicate/condition block in full. Every one is available
  as a builder method (`classes(d).that().areAbstract()`, `.should().notHaveStereotype(x)`)
  — that is the documented surface per ADR-003, and it is unchanged.

  Two eess-ts entries are worth calling out because their siblings survived:
  `collectCalls` went while `fromCallExpression` from the same module stayed, and
  `fromObjectLiteralFunction` went while `fromFunctionDeclaration` and
  `fromMethodDeclaration` stayed. In both cases the survivor is reachable from a
  documented path and the removed one was not.

- 725281f: **Breaking** — the kernel splits into two entry points. Family plumbing moves from
  `@nielspeter/eess` to `@nielspeter/eess/internal` (ADR-011).

  `@nielspeter/eess` had never declared what its public API was. It was implied — the
  union of whatever the five dialects happened to import — so nothing could check the
  boundary, and 78 engine internals sat on the published surface: `shallowClone`,
  `isRecord`, `resetEdgeCoverage`, the glob-tree vocabulary, the suppression and
  edge-coverage counters. Because `check:family` required each dialect to re-export
  every kernel symbol its own source imports, each of those was published again by
  every dialect that touched it.

  **What moved.** 71 symbols now live at `@nielspeter/eess/internal`. If you import one
  from `@nielspeter/eess`, change the specifier — nothing was deleted or renamed.

  If you consume a DIALECT and hit one of these, note that `@nielspeter/eess/internal`
  resolves for you only if the kernel is hoisted to your `node_modules` root. Under
  pnpm's isolated layout or Yarn PnP it will not: add `@nielspeter/eess` to your own
  dependencies. That is a direct dependency the family otherwise does not ask of you,
  and it is the honest cost of reaching plumbing.

  **What did not move**, because "unreferenced in this repo" is not "not API":
  `correspondence` and `CorrespondenceBuilder` (documented on six pages, and the public
  surface of eess-md and eess-crossvalidate), `reportViolations` and `finishPreset`
  (named seams in ADR-008), and the `ArchJson*` types, which describe the `--format
json` output that `docs/agent-integration.md` teaches.

  Also still on the root, and worth naming because an earlier draft of this changeset
  said otherwise: `globNode` and `globAnyOf` (the constructors a user-written
  `definePredicate` needs to declare its globs — a documented extension point), and
  `CorrespondenceOptions`, `RelationSpec` and `KeyBy` (the parameter types of
  `correspondence()` and `preserveRelations()`, both public). **Do not rewrite imports
  of those five to `/internal`** — they are not there.

  **The dialects' surfaces shrink too.** A dialect no longer re-exports kernel plumbing
  it only uses internally, so `eess-ts`, `eess-md` and `eess-mermaid` each drop what they
  used to forward. For those, the rule above applies — the symbol is a KERNEL symbol and
  `@nielspeter/eess/internal` has it.

  **That rule does not cover the 37 dialect-local symbols removed in the same release.**
  Those were never kernel symbols, so `/internal` does not have them and there is no
  replacement path; see the companion changeset for the list and the reasoning.

  Measured at release: the kernel root goes 156 → 86 exports, with 673 scanned across
  the family's published entry points. All 86 root exports are documented; 116
  dialect-side exports are still undocumented and are reported rather than gated — ADR-011 clause 1
  covers the kernel root, and no ruling covers the dialects yet (bug 0220).

  `@nielspeter/eess/internal` is a published, versioned contract — breaking it still
  needs a changeset. What it is not is API: nothing there is taught by `docs/` or a
  README, and a consumer writing rules never names it. That boundary is enforced inside
  this repo and is convention outside it, which ADR-011's Enforcement table records as
  `manual` rather than claiming otherwise.

  **Also in this release, and narrower than it sounds:** `@nielspeter/eess-crossvalidate`
  raises its peer floors on the four dialects from `>=0.1.1` to the versions current at
  release. `>=0.1.1` admitted any dialect ever published, which since the kernel split can
  resolve **two copies of `@nielspeter/eess`** — and the kernel holds module-level state
  (coverage counters, suppression counters, identity collisions, the cache registry), so
  that state splits silently. If you pin an older dialect alongside crossvalidate you will
  now get an `ERESOLVE` instead, which is the point.

- 4fa5e84: **Breaking (@nielspeter/eess):** every builder's `violations()` returns a
  receipt, and the emitters take one.

  [ADR-014](https://github.com/nielspeter/eess/blob/main/adr/014-the-emitter-refuses-a-verdict-without-evidence.md):
  evidence is required at every seam where a verdict leaves eess, not only at the
  terminal. `CollectResult` is now an `ArchViolation[]` carrying `examined`,
  `sourceEmpty` and `declaredEmpty` as own properties. `finishPreset`,
  `reportViolations` and `throwIfViolations` accept and return it.

  **Why this break exists.** A consuming project shipped four corpus gates as
  hand-rolled loops, importing eess's types and its printer and never a
  `RuleBuilder`. Three went inert in one week — a `continue` on a malformed row, a
  counter that fell from 38 compared against 0, a header count compared against
  nothing. Each printed green. The agent that wrote them had been told to use eess
  properly and had a working rule file in the same directory, so neither
  documentation nor example reached it. The seam had to refuse.

  **What breaks for you.**
  - `.violations()` returns `CollectResult`, not `ArchViolation[]`. It is still an
    array — `.length`, iteration, `map`, `filter` and `for…of` are unchanged — so
    most call sites keep compiling. Across this whole workspace the retype produced
    **15 type errors**, which is the measured size of the migration.
  - **`expect(x.violations()).toEqual([])` now fails.** A deep-equal against a bare
    `[]` compares the receipt's own properties too. Use `toHaveLength(0)`, or
    `expect(v.map((x) => x.ruleId)).toEqual([])` to keep asserting identity.
  - A custom builder's `collectViolations()` must return `collectResult(violations,
{ examined })` instead of an object literal. You get one compile error naming
    the member.
  - Handing an emitter a bare array is now a type error, and at runtime a
    configuration finding — `emitter/no-receipt`.

  **Three new unsuppressable rule ids**, the kernel's first hardcoded ones:
  `emitter/no-receipt` (no evidence at all), `emitter/pass-without-evidence` (zero
  examined, zero violations, no declaration) and `emitter/expired-declaration`
  (declared empty, then examined something).

  **A preset that examines nothing now says so**, which is the point and the part
  most likely to redden an existing build. If your corpus legitimately has none of
  a preset's subject — no ER diagrams, no exemptions — declare it with
  `expectEmpty: true`, now on `PresetReportOptions` and therefore on every preset
  in the family. The declaration **expires**: the day the subject appears, it reds
  with `emitter/expired-declaration`. That expiry is what makes it a declaration
  rather than a mute button, and it is why `overrides: { id: 'off' }` is not
  accepted as one — an instruction eess would have to read intent into, and a claim
  nothing can contradict.

  `--format json`'s `summary` gains `examined` (`null` when the caller supplied no
  evidence), because `JSON.stringify` drops an array's own properties.

  The five dialects are named because the break is the kernel's and their
  changelogs should say what changed rather than "Updated dependencies"
  (bug 0185). The four with a barrel — `eess-ts`, `eess-mermaid`, `eess-md` and
  `eess-gherkin` — also re-export the receipt seam, so a standalone consumer of one
  of them never needs a second kernel install to build, merge, report or finish
  one. `eess-crossvalidate` is the exception: it ships flat entry files rather than
  a barrel, and each carries only what its own bindings use, so reaching the
  constructors from there may still need the kernel directly.

- 4fa5e84: **Breaking (@nielspeter/eess):** `presetConstructsNothingViolation` is removed
  from `@nielspeter/eess/internal`.

  It had **no call site anywhere**: not in any of the five dialects, not in this
  repo's scripts, not in a test. Measured before removal — the only occurrence of
  `presetConstructsNothingViolation(` in the workspace was its own definition. It
  was a constructor for a finding nothing constructed, which is
  [bug 0190](https://github.com/nielspeter/eess/blob/main/work/bugs/0190-the-preset-constructs-nothing-finding-cannot-fire.md):
  an id with no producer reads as coverage while certifying nothing.

  **Deleted rather than wired**, and that is the decision worth naming. The obvious
  fix was to give it a caller. It was rejected because the finding it produces
  names `(presetName, optionsHint)` — dialect vocabulary the kernel emitter cannot
  know — and because
  [ADR-014](https://github.com/nielspeter/eess/blob/main/adr/014-the-emitter-refuses-a-verdict-without-evidence.md)
  makes the emitter refuse an evidence-free verdict directly, which reaches every
  hand-assembler rather than only the presets someone remembered to guard. A
  finding with an id and no producer is bug 0190's shape with a label on it.

  The preset-shaped diagnosis it was meant to carry already exists dialect-side and
  is unchanged: `eess-ts`'s `assertEnabled` builds it with its own `ruleId`,
  `bypassFilters` and remedy.

  **Nothing that ran before stops running.** `dispatchRule`, `validateOverrides`,
  `throwIfViolations` and `finishPreset` are untouched, and the `'off'` /
  `'warn'` / `bypassFilters` precedence in `dispatchRule` is unchanged — the test
  pinning it still passes.

  The five dialects are named because they depend on the kernel and this is a
  removed export, so their changelogs should say what changed rather than
  "Updated dependencies" (bug 0185). None of them imported it; none needs a source
  change.

  **New (@nielspeter/eess, @nielspeter/eess-ts):** `EMITTER_CONTRADICTORY_EVIDENCE`
  (`emitter/contradictory-evidence`) joins the three emitter rule ids on both roots.

  It fires when a receipt marked `notRun: true` carries a non-zero `examined` or a
  violation — a rule that never ran can have neither. `notRun` is the flag that
  exempts a member from `mergeCollectResults`'s dead-member filter, so without this
  it was the one thing in the evidence vocabulary that could quiet a zero and could
  not be contradicted. `declaredEmpty` always had its expiry; this is the same
  property for the third state.

  Additive: nothing that was green goes red unless it was already claiming both
  that a rule did not run and that it examined something.

- 99a00d4: **Breaking (@nielspeter/eess, @nielspeter/eess-ts): `throwIfViolations` is removed from the public surface.**

  It is gone from three barrels: the kernel root (`@nielspeter/eess`), the
  `eess-ts` root, and the `@nielspeter/eess-ts/presets` subpath.

  **What to do instead.** The call was a one-line alias for `finishPreset` in its
  default mode, and always had been. Replace

  ```ts
  throwIfViolations(violations)
  ```

  with

  ```ts
  import { finishPreset } from '@nielspeter/eess-ts/presets'

  finishPreset(violations, { report: 'throw' })
  ```

  It is on all three barrels, so the import line does not move wherever you took
  the old one from:

  ```ts
  import { finishPreset } from '@nielspeter/eess'
  import { finishPreset as fromTsRoot } from '@nielspeter/eess-ts'
  import { finishPreset as fromPresets } from '@nielspeter/eess-ts/presets'
  ```

  Behaviour is identical — emit to stderr, then throw one aggregated
  `ArchRuleError`. Taking the option explicitly is the point: you can choose
  `report: 'return'` or `'warn'` at the same seam, which the alias hid.

  On `@nielspeter/eess-ts/presets` that became true in this release: the alias was
  published on that subpath and its replacement never was, so `finishPreset` is
  added there now. If you import from `/presets`, you need this version or later
  for the migration to resolve.

  **Why an alias was worth removing.** Not because it was unsafe — your current
  call is type-correct and always has been. It goes because it was a second name
  for one door, and the name hard-coded a choice that belongs to you: whether a
  preset throws, returns its violations, or warns. `finishPreset` makes that an
  argument you pass rather than a decision baked into which function you call.

  The four dialects take a **minor**, not a patch. They do not use the symbol, but
  they depend on the kernel, so this break reaches an adopter through whichever
  dialect they installed. A patch would not be enough: changesets propagates an
  inherited bump as a patch whatever the config says, and a patch is the release
  your caret range takes without asking, under a changelog reading "Updated
  dependencies". Naming them at minor is the only way you get told.

### Patch Changes

- 725281f: Every package removes `dist/` before it builds.

  `tsc -p` overwrites; it never deletes. A source file that is deleted or moved left
  its `.js` and `.d.ts` behind forever, and `dist/` is gitignored, so nothing showed
  it. Measured before the fix: **36 orphaned `.d.ts`** across the workspace — 34 in
  `eess-ts` — the oldest from plan 0165's engine copy, whose `src/` counterparts no
  longer exist.

  That is shipped output, not a local artifact: `dist/` is what a consumer installs.
  It also silently corrupts any measurement that reads the emitted types — a survey
  of the dialects' public type surface was run against `dist/` during this work and
  answered from files whose source had been deleted.

  `check:integrity` now requires every package that builds to clean first. It checks
  the mechanism rather than scanning for stale files: after this change there are
  never any, and a check that cannot fail is worth less than no check (ADR-009). What
  can still regress is a package added later with no `prebuild`, and that is what it
  catches.

- 8247a3c: Document how to resolve a citation form `adrEnforcement` does not know.

  The preset's citation check recognises a backticked file path and an `it('…')`
  title. A Mechanism cell citing a rule id from your own architecture tool matches
  neither, and three places — the docs page, this README and the preset's own
  docstring — said "compose your own gate" without showing how. A consuming project
  read all three, concluded the dialect could not do it, and wrote fifty lines of
  its own.

  The compose path is two primitives that already ship: `rows()` over the Mechanism
  column, and `correspondence().beComplete({ direction: 'both' })` against the set
  you hold. The docs page gains the worked recipe; `adrEnforcement`'s docstring and
  the README point at it. No code changes. The docstring ships in the published
  types, which is why this is a patch rather than `none`.

- 488931a: Document the corpus listing surface.

  `corpus()` returns a `Corpus` you can inspect — `documents()`, `root`, `fileIndex` — and
  `features()` returns a `FeatureSet` with `root`, `features()` and `scenarios()`. Both were
  public API and documented nowhere: measured before this change, `documents()`, `root` and
  `fileIndex` appeared in **0** files under `docs/` and **0** package READMEs.

  This is what you reach for when a gate passes and you want to know what it passed _over_ —
  a `0` from `documents().length` means the globs matched nothing, not that all is well.

  No code changes; the README that ships with each package gains a section, which is why
  this is a patch rather than `none`.

- 00b7720: Correct the `frozen` documentation: pointers in frozen documents are not examined at all

  `CorpusOptions.frozen` and `MdDocument.frozen` both documented frozen documents
  as ones "whose drift is reported but never failed", and the package README said
  the same in a copy-pasteable example. Measured: the pointer rule selects
  `.areLive()`, so a frozen document's pointers are filtered out before evaluation
  — nothing is reported. Links in frozen documents _are_ still gated, which is the
  half that was always true.

  No behaviour changes. The docs now say what the code does, and point at the
  one-line recipe for the report the old wording implied you already had:

  ```typescript
  pointers(c).that().areFrozen().should().resolve().warn()
  ```

  `.areFrozen()` and `.warn()` both already shipped; they were undocumented, which
  is why the capability read as missing.

- 39517a3: One path-suffix resolver, shared by the dialects that had written it twice

  `eess-md` resolved `path:line` code pointers against the repo's file index;
  `eess-crossvalidate` resolved `.feature` citations against a feature set. Same
  algorithm, same three-way answer (exact / unique suffix / ambiguous), same
  exact-wins precedence — and, after the ambiguity work in bug 0254, the same
  "cite a longer suffix" remedy. Two implementations of one idea.

  `pathSuffixIndex` now lives in the kernel behind `@nielspeter/eess/internal`, and
  both dialects call it. It is pure string work over a list of paths — no
  `ArchProject`, no ts-morph — which is the same argument `PathUniverse` already
  makes for living there.

  **No behaviour changes.** Both dialects' existing tests pass unchanged (119 and
  89, none edited — no test file under either package is in the diff), and the
  messages were already identical. Confirmed independently by differential fuzzing
  old against new over 20,000 generated citations. `eess-crossvalidate`'s
  internal `resolveFeature` is deleted; it was not reachable through the package's
  `exports` map, so nothing an adopter could import has moved.

  One small improvement rode along: `resolveFeature` rebuilt its path list on every
  citation, and the index is built once per binding.

  `@nielspeter/eess` takes a `minor` because `/internal` is a published subpath and
  this adds an export to it. The dialects take a `patch` — they lost private code
  and gained nothing an adopter can observe.

- Updated dependencies [48bf698]
- Updated dependencies [3a68b5c]
- Updated dependencies [8934365]
- Updated dependencies [725281f]
- Updated dependencies [abc5957]
- Updated dependencies [e82c27d]
- Updated dependencies [95bedfb]
- Updated dependencies [725281f]
- Updated dependencies [725281f]
- Updated dependencies [d4e586c]
- Updated dependencies [3c58845]
- Updated dependencies [39517a3]
- Updated dependencies [4fa5e84]
- Updated dependencies [4fa5e84]
- Updated dependencies [99a00d4]
  - @nielspeter/eess@0.5.0

## 0.5.0

> **Upgrading from 0.3.0? Read the 0.4.0 section below as well.**
> 0.4.0 was versioned but **never published to npm** — the last release
> of this package was 0.3.0, so this release carries two minors' worth of
> changes. A `## 0.4.0` heading normally means "a version you already
> have"; here it does not, and some of the changes that will affect your
> build are in it.

### Minor Changes

- 7031427: A rule that selects subjects and asserts nothing about them now fails — bug 0155.

  **Breaking (0.x — minor signals it, not a 1.0 stability claim):** a rule
  written as `.that().<predicate>.should()` with no condition after it used to
  pass in **total silence**. It now produces an unsuppressable configuration
  finding, so a build that was green on such a rule will go red on upgrade with
  no code change of its own.

  That is the fix working. Such a rule cannot fail, so it certifies nothing while
  reading as coverage — the false-green class ADR-009 and ADR-010 exist to make
  unrepresentable.
  - **The guard was unreachable, not merely quiet.** It tested
    `_conditions.length === 0 && _phase === 'predicate'`, and `should()` sets the
    phase to `'condition'` — so for every rule shape the DSL documents it could
    never fire. Even the stderr warning it was routed to never appeared. The
    `_phase` term is gone.
  - **A finding, not a warning**, per ADR-009 rule 1's discriminator: the remedy
    is not optional. There is no state in which "keeps asserting nothing" is
    correct — add a condition, or delete the rule. (`no-silent-catch` and
    `no-empty-bodies` stay `warn` precisely because they carry suppressible false
    positives a reader must judge one by one. This carries none.)
  - **`bypassFilters`**: `error` regardless of `.asSeverity('warn')`, refused by
    `.excluding()`, skipped by diff and baseline. It reports that the rule's own
    instrument is broken, not a fault in what was examined.
  - **A dead selector still reports as a dead selector.** This finding fires only
    when subjects were actually selected; a rule with a dead glob and no
    condition reports the dead glob, the more useful root cause.
  - **Every builder gives the same answer.** `slices()`, `schema()`,
    `schemaFromSDL()` and `resolvers()` carried the identical branch as a stderr
    warning and now fail too, each with its own remedy. Fixing only the kernel
    would have left one DSL with four different answers to the same mistake.

  **Every dialect is named deliberately.** The behaviour change is in the kernel,
  but an adopter installs `eess-ts` (or `-md`, `-mermaid`, …) and reads _that_
  package's changelog. Declaring only the kernel would route this text to a
  package they may not know exists, while their own changelog said "Updated
  dependencies" — the standalone-sufficiency failure `check:family` exists to
  prevent, in documentation rather than code.

  **Migration:** each finding names the rule and both remedies. Add the condition
  you meant to assert, or delete the rule. If a rule was deliberately held as a
  reusable _selection_, keep holding it — the finding fires only when a rule is
  actually executed, not when a selection is derived from.

  Measured before landing: **zero** assertion-less rules across this repo's own
  five gate files, and one affected test — a kernel contract test that was green
  for the wrong reason and is rewritten here to prove its contract directly.

- 5c4a3ec: New kernel re-exports closing real standalone-sufficiency gaps — plan 0089 Phase 1.

  **Fixed (0.x — minor signals the addition, not a 1.0 stability claim):** each
  sibling dialect promises to be a complete tool on its own — a user installing
  only one package gets everything they need, with no second, direct
  `@nielspeter/eess` install. A new `family.rules.ts` dogfood gate
  (`check:family`) now asserts this mechanically, and running it against the
  real repo for the first time surfaced genuine gaps in every dialect:
  - **`@nielspeter/eess-mermaid`** was missing `marksAssertsCardinality` — the
    one kernel symbol `conditions/class.ts` used internally that its own
    `core/index.ts` barrel didn't carry.
  - **`@nielspeter/eess-gherkin`** had **zero** kernel re-exports before this
    fix, despite its own `builder.ts` importing `RuleBuilder`, `Condition`,
    `Predicate`, and `ArchViolation` directly. All four are now re-exported.
  - **`@nielspeter/eess-crossvalidate`** — the family's binding tool, and the
    one dialect with no allowlist exception — had none of its 7 flat entry
    files (`mermaid-ts`, `md-ts`, `md-mermaid`, `files`, `md-gherkin`,
    `gherkin-ts`, `md-mermaid-er`) re-exporting the kernel symbols each one
    imports (`correspondence`, `finishPreset`, `ArchViolation`, `Direction`,
    `Selection`, `ElementInfo`, `PresetReportOptions`). Each subpath now
    re-exports exactly what it itself imports.
  - **`@nielspeter/eess-md`** had **zero** kernel re-exports before this fix,
    despite `rules/ledger.ts`/`rules/adr.ts` using `RuleBuilder`, `Predicate`,
    `Condition`, `ConditionContext`, `ArchFix`, `PresetReportOptions`,
    `PresetBaseOptions`, `finishPreset`, `generateCodeFrame`, `not`,
    `dispatchRule`, `validateOverrides` internally. All now re-exported. Also:
    `correspondence`/`CorrespondenceBuilder` — required by this package's own
    README example (`rows()` + `correspondence()`, the flagship way to bind a
    markdown table to code) but never actually re-exported, so that documented
    example did not compile against `@nielspeter/eess-md` alone; found in
    review, fixed the same way.
  - **`@nielspeter/eess-ts`** gained its whole preset-authoring toolkit
    (`reportViolations`, `dispatchRule`, `validateOverrides`,
    `throwIfViolations`, `finishPreset`, `presetConstructsNothingViolation`,
    `RuleSeverity`, `PresetBaseOptions`, `PresetReportOptions`, `ReportMode`,
    `ReportOptions`) at the package root — a convenience, not a gap fix: these
    were already reachable via the `/presets` subpath, and 0088 already
    ratified "root or presets" as satisfying standalone sufficiency for this
    package. No second install was ever required here.

  **Migration:** none needed — every change here is a new, additive re-export.
  Nothing that worked before stops working.

- 7031427: **Breaking (@nielspeter/eess)** — a second `.should()` no longer discards the
  first assertion (bug 0156, the kernel half). 0.x, so a minor signals it.

  The kernel's `RuleBuilder.fork()` cleared the condition list, so
  `.should().X().should().Y()` silently dropped `X`. A rule that asserted two
  things asserted one, and nothing reported the loss — a false green in the
  engine itself.

  **Read this if you write rules with `eess-md`, `eess-mermaid` or
  `eess-gherkin`.** All three extend the kernel's `RuleBuilder`, so all three
  carried this. On upgrade, a rule spelled with two `.should()` calls starts
  enforcing the assertion it was silently dropping, and **can report violations it
  never reported before**. Those findings were always real; they were being
  discarded. Check each one on its merits rather than re-baselining.

  The dialects are named at `minor` rather than inheriting a `patch` because the
  change is observable in their output (bug 0185).

  **`eess-ts` is named too, and it is the one dialect this does not actually
  change.** It carries its own copy of the builder stack, already fixed, so its
  behaviour is identical before and after. `check:release` required it anyway and
  is right to: the rule reads the dependency graph, and eess-ts really does depend
  on `@nielspeter/eess`, so an adopter of eess-ts would otherwise inherit this
  release as a silent patch. That the declaration over-states what changes _for
  that one package_ is a consequence of the duplication, not of the rule — the
  gate cannot know a dialect quietly stopped using the kernel module it depends
  on. Recorded rather than waived.

  **Why it was one-sided.** `eess-ts` got this fix when plan 0165 copied the
  upstream engine in; the kernel did not, and nothing recorded the split. The
  duplication that allows it is [plan 0188](https://github.com/nielspeter/eess/blob/main/work/plans/0188-unify-the-duplicated-engine-modules.md).

- 121f46b: `honestyAtClose` is now expressed through the builder DSL (`docs()` / `taskItems()`), not raw corpus iteration — bug 0131.

  **Breaking (0.x — minor signals it, not a 1.0 stability claim):** a corpus that
  previously passed `honestyAtClose` silently on a dead or misconfigured selector
  can now fail on upgrade with no code change of its own — this is the same
  "a rule that examines zero units now throws by default" mechanism plan 0088
  landed on the kernel, now reaching this preset.
  - **The header/placement check (`ledger/state-folder-mismatch`) now inherits the fold's fail-closed evidence gate.** Previously `honestyAtClose` hand-iterated the corpus directly, calling no `RuleBuilder`/`TerminalBuilder` — invisible to every kernel-level guarantee, including the zero-examined guard plan 0088 landed. A dead selector (e.g. a `boardFiles` config that absorbed every real document) could pass silently forever. It is now caught by default: an examined-zero header selection fails loudly instead of reading as "nothing to report."
  - **New option `expectEmptyHeaders`.** A corpus that may legitimately hold zero non-board documents right now — a freshly-bootstrapped lane before its first real item is authored — needs to declare this explicitly (it isn't inferrable). Per ADR-010 the declaration expires: the day a real document appears, it must be removed or the build fails on the stale declaration itself.
  - **The two done-item-scoped checks (`ledger/silent-open-box`, `ledger/deferred-none-lie`) are also now protected against a broken selector** — but narrower than the header check: they're guarded against corruption of the specific predicates that scope them (`belongsToADoneItem`, `hasDeferredDisposedBox`), verified by independent sabotage-testing of both, not against corruption of the shared `isDoneItem`/`collectTaskItems` machinery all three checks ultimately depend on. A corpus with an established history (never legitimately zero done-items) should assert that on top, the way `scripts/check-ledger.mjs` now does for this repo's own corpus — see that file for the pattern.
  - Detection logic and messages are unchanged — same regexes, same `findState`/`isDoneItem` helpers, same violation text. Only the iteration mechanism changed; output over the real corpus is byte-identical to before this fix.

  **Migration:** if your own corpus has a lane that may legitimately be entirely board files right now (e.g. a `kit/`-seeded lane before its first item), pass `{ expectEmptyHeaders: true }` to `honestyAtClose` for that lane and remove it once the lane has real content. If a lane's done-item checks previously relied on a silently-broken `belongsToADoneItem`/`hasDeferredDisposedBox`, that's now reported rather than silent — fix the underlying selector.

### Patch Changes

- Updated dependencies [7031427]
- Updated dependencies [7031427]
- Updated dependencies [26f7352]
- Updated dependencies [7031427]
  - @nielspeter/eess@0.4.0

## 0.4.0

### Minor Changes

- 928ce4a: Fold ts-archunit's fail-closed engine into the kernel (plan 0088), porting
  its ADR-008/ADR-009 doctrine as eess ADR-009 (Agent-First Failure Surfaces)
  and ADR-010 (A Pass Is Constructed From Evidence).

  **Breaking (0.x — minor signals it, not a 1.0 stability claim):**
  - **A rule that examines zero units now throws by default.** Previously,
    many rule shapes silently passed when a predicate matched nothing, a
    glob resolved to no files, or a project loaded no source at all —
    indistinguishable from "correctly found nothing wrong." That's now an
    unsuppressable configuration finding (`bypassFilters: true` on the
    violation) unless declared intentional with the new `.expectEmpty()`
    chain method. `.excluding()` and inline exclusion comments cannot
    silence it; ordinary `.check({ baseline })`/`.check({ diff })` filtering
    doesn't either.
    **Migration:** if a rule you own legitimately expects an empty corpus
    right now (mid-migration, a folder not yet populated), add
    `.expectEmpty()` to the chain. Everything else needs no change — the
    new throw only fires where the rule's own instrument was already silently
    broken.
  - **A held selection is no longer mutated by chain methods.**
    `.that()`/`.excluding()`/`.rule()`/`.because()`/`.expectEmpty()` (and
    `RuleBuilder`'s `.addPredicate()`/`.addCondition()`) now return an
    independent copy instead of mutating `this` — a real bug fix (a second
    rule built from a held selection could previously inherit the first
    rule's narrowing/exclusions/id silently). Code that relied on the old
    in-place mutation (holding a builder variable across multiple mutating
    calls and expecting each call's effect to be visible through the
    original reference) will behave differently — correctly. No known
    consumer code does this; it's named here in case any does.
  - **`eess-ts`'s `layeredArchitecture()` preset's `restrictedPackages`
    option now correctly enforces.** It silently under-enforced before (a
    discarded accumulator only worked by accident under the old mutation
    semantics) — an existing ruleset using this option may see new,
    correct violations it was never actually checking for.

  **Unchanged:** predicate/condition semantics and names, rule syntax,
  `// eess-ts:disable` comment syntax, `arch-baseline.json`'s format,
  `ruleId`/`because`/`Fix:`/`Docs:` violation fields, the existing
  `eess-ts` test suite (1961 tests) — only ~13 of which needed updating,
  each because it asserted the old silent-pass as if it were a feature,
  not because any rule-authoring API changed.

  **New, exported from both `@nielspeter/eess` and `@nielspeter/eess-ts`:**
  `CollectResult`, `.expectEmpty()`/`.expectNonEmpty()` (the latter is the
  sharper opposite — it overrides a `.notExist()`-shaped condition's own
  cardinality exemption, reddening if the corpus you declared "must have
  subjects" doesn't), `marksAssertsCardinality`/`assertsCardinality` (the
  extension point for a custom `defineCondition()` to gain the same
  exemption `.notExist()` has), `Matcher`, `BaselineFilter`/`DiffFilterLike`.
  `reportViolations`/`finishPreset` are now also reachable from
  `@nielspeter/eess-ts/presets` for a standalone consumer building a custom
  preset.

  `@nielspeter/eess-md`, `-mermaid`, `-gherkin`, `-crossvalidate` ship no
  source changes of their own in this release — the minor bump tracks the
  kernel's dependency range (their `RuleBuilder<T, P>`/`correspondence()`
  usage inherits the new evidence gate for free) and, per plan 0088's own
  "family boundary" note, is a live capability the moment a consumer
  upgrades: an existing rule in any of these dialects that silently passed
  on an empty corpus will now throw too, not staged behind a later opt-in.

### Patch Changes

- Updated dependencies [928ce4a]
  - @nielspeter/eess@0.3.0

## 0.3.0

### Minor Changes

- 3a4600b: `resolve()` can now resolve a link naming a real directory, even with no index
  file: `LinkResolveOptions.resolveDirectories` (default `false`).

  A link to `./fixed/` (or `./fixed`, no trailing slash — both forms resolve)
  was always reported broken if `fixed/` had no `tryIndex` file inside it, even
  though the directory genuinely exists and GitHub/GitLab render it fine as a
  listing. There was no resolvable shape for "this is a directory" at all —
  `tryIndex` only covers "this directory's page is its index file," a different,
  narrower claim.

  ```ts
  links(c).that().areInternal().should().resolve({ resolveDirectories: true })
  ```

  Directory existence is derived from the corpus's own file index — every
  indexed file's ancestors are known directories — so this costs no new
  filesystem access.

  **Off by default, deliberately.** Widening what "resolves" means is a false
  green waiting to happen: correct for a repo-hosted corpus (GitHub, GitLab
  render any real directory), wrong for a static-site corpus where a bare
  directory with no index is not a page the site would actually serve. Existing
  callers see no behaviour change unless they opt in.

### Patch Changes

- cd0361b: `linkResolves()`'s broken-link message now names the near-miss when the
  target is a real directory: `broken link: "./guide/" does not resolve to a
file in the repo — "docs/guide" is a real directory; this check runs with
resolveDirectories off`.

  Before this, a link to a real directory with `resolveDirectories` off and a
  link to a target that doesn't exist at all reported the identical generic
  message. A corpus that deliberately runs different resolution profiles for
  different regions (a static-site guide vs. repo-hosted markdown, say) gave an
  author no way to tell, from the message alone, which case they'd hit.

  The hint only appears when it's true — a genuinely nonexistent target keeps
  the plain message unchanged — and is computed lazily, only when a violation
  is actually being reported, so a clean corpus pays nothing extra.

- d54b041: Fix `honestyAtClose`/`ledgerStats` silently misreading a `**State:**` line when
  `states` is an empty array — a legitimate config for a lane where nothing is
  ever ledger-closed (a corpus-content vocabulary this repo now uses for its own
  proposals lane, where the review outcome is a separate field, not a second
  `State` token).

  `stateMatcher([])` built its regex's capture group from zero alternatives —
  `()`, a zero-width match that fires at almost any position — so every genuine
  `State:`-shaped line was read as "readable, value `''`" instead of falling
  through to the unreadable-token fallback. Callers passing a non-empty
  `terminalStates` were never affected. A caller passing `terminalStates: []`
  (the only way to trigger this) still got the right answer from `isDoneItem`,
  but only because `[].includes('')` happens to be `false` — not because
  `findState` reported "no known state" for the right reason. `ledgerStats`'s own
  `withReadableState`/`unreadableState` counts were wrong for such a lane: a
  directory full of `State:`-shaped records would report as `withReadableState`
  instead of `unreadableState`, which matters to any caller distinguishing "has
  state-shaped content" from "has content in my declared vocabulary" — exactly
  the distinction a coverage-style check needs.

  Fixed with a one-line guard: an empty vocabulary now never matches, forcing the
  documented unreadable-token fallback for every path. No change to any existing
  caller with a non-empty `states`/`terminalStates`.

## 0.2.0

### Minor Changes

- b8d8517: `honestyAtClose` now actually runs its state↔folder placement check, and lets a
  corpus declare its own `State:` vocabulary (bugs 0118, 0119).

  **Read this before upgrading — the placement check may have been silent in your
  corpus too.** It located the `State:` token by scanning from the top of the
  document and stopping at the **first** `##` heading. The common template puts it
  one heading further down:

  ```markdown
  # Plan 0060: …

  ## Status

  - **State:** Done
  ```

  For any document in that shape the token was never found, so the check returned
  without a word. In the repo this preset was written for, that was **every single
  record** — 55 of 55 with a `State:` line — and the gate reported `0 findings` for
  its entire existence. The region is now the preamble **and the first section**,
  so both shapes are read. Expect placement findings on first run; they are drift
  that was always there.

  **New: `states` and `terminalStates`.** The vocabulary was hard-coded to
  `Draft | Ready | Open | Done | Won't-do`. A corpus with a different one — a bug
  lane closing on `Fixed`/`Rejected`, say — can now declare it:

  ```ts
  honestyAtClose(corpus, {
    states: ['Draft', 'Ready', 'Fixed', 'Rejected', 'Parked'],
    terminalStates: ['Fixed', 'Rejected'],
  })
  ```

  **The value is matched against your declared vocabulary**, not grabbed as the
  next whitespace-delimited run — so `**State: Done**`, `- **State:** Done.`,
  `**State**: Done`, an emphasised `**Done**`, a lowercase `done` and a
  smart-quoted `Won’t-do` all read as the states they obviously are. A colon is
  required, so a prose line like `Stateless rendering is the default` is not a
  state declaration. Multi-word states (`In progress`) work.

  **New finding: `ledger/unknown-state`.** A `State:` token outside the declared
  vocabulary is now reported rather than skipped. Previously an unrecognised token
  looked identical to "no state at all" and disabled the placement check for that
  document silently — a check that stops running without saying so is the failure
  this preset exists to prevent. If you use tokens outside the default set, declare
  them in `states` or correct them; do not expect silence.

### Patch Changes

- Updated dependencies [0385ecb]
  - @nielspeter/eess@0.2.2

## 0.1.2

### Patch Changes

- Updated dependencies [2f219de]
  - @nielspeter/eess@0.2.0

## 0.1.1

### Patch Changes

- Verify the tokenless release pipeline (OIDC trusted publishing + provenance) end-to-end. No API changes.
- Updated dependencies
  - @nielspeter/eess@0.1.1
