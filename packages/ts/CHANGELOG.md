# @nielspeter/eess-ts

## 0.4.0

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

- 7031427: The baseline records what a measurement COUNTS, and refuses to compare across a change of unit — bug 0171.

  **Breaking (@nielspeter/eess-ts)** — 0.x, so a minor signals it, not a 1.0
  stability claim. A baseline that previously suppressed silently can now report on
  upgrade with no code change of its own, which is the same class as the other
  breaks in this release.

  **Why `eess-ts` is named as the owner and the other dialects are not.** The
  mechanism lives in the kernel's baseline, but only `eess-ts` produces findings
  carrying a `measured` value — `eess-md`, `-mermaid`, `-gherkin` and
  `-crossvalidate` produce none, so their adopters have no baselined measurement
  that could stop comparing. Declaring them would announce a change their users
  cannot observe. If a dialect ever gains a metric finding, this reasoning expires
  and it belongs in the list.

  **Read this if you hold a baseline with metric findings.** An accepted ceiling is
  a number in a unit, and until now the baseline compared across a change of unit
  without noticing. `linesOfCode` changing from span lines to code lines (same
  release) moved every baselined size ceiling by roughly 3x while the identity hash
  stayed put — so entries kept matching, kept suppressing, and a class could grow
  to about three times its accepted size with the build green the whole way.

  Violations now carry `measuredUnit`, baseline entries persist it, and a stored
  measurement is compared only when the units demonstrably agree. When they do
  not, the finding is **reported** rather than silently re-accepted, alongside a
  configuration finding naming the affected elements with both numbers and telling
  you to regenerate.

  **What you will see on upgrade:** if you have baselined `maxClassLines`,
  `maxMethodLines` or `maxFunctionLines` findings, they will be reported once,
  with an explanation. That is the point — your ceilings were recorded in span
  lines and this version measures code lines, so the old numbers cannot be
  compared. Check each element is genuinely acceptable at its new number, then
  regenerate. Baselines for `complexity`, `methods`, `parameters`, `properties`
  and `named-exports` are unaffected: those metrics count what they always
  counted, so old entries stay valid.

  Re-accepting without reading re-baselines whatever drift the old unit was hiding.

- 26f7352: **Breaking (@nielspeter/eess-ts)** — `check` now fails on a rule file that
  contributed **no rules**. 0.x, so a minor signals it, not a 1.0 stability claim.

  It used to print `✓ eess-ts — 0 rules across 1 file · 0 failing` and exit 0. A
  build that was green can now be red — which is the point: it was green over a gate
  that checked nothing. `doctor` already refused the same file with "no rules found
  in the given files"; the two commands now agree.

  **Migration:** if a run starts failing with "contributed no rules", look at what
  that file's default export actually contains. The usual cause is a preset spread
  without `report: 'builders'`:

  ```diff
  -export default [...recommended(p)]
  +export default [...recommended(p, { report: 'builders' })]
  ```

  `...recommended(p)` spreads the preset's _result_, not its builders. On a codebase
  with violations that fails loudly already; **on a clean one it spreads an empty
  array**, so the file exports `[]` and every rule silently disappears. That is the
  case this release turns red.

  If the file is deliberately empty, delete it rather than keeping a rule file that
  enforces nothing.

  **Migrating from `@nielspeter/ts-archunit`?** Its `recommended()` returned builders
  unconditionally and had no `report` option, so the line its own `init` scaffolded is
  exactly the one above. Adding `report: 'builders'` is the whole fix.

- 1593b8e: `crossProject()` is documented, and `crossLayer()` is marked deprecated with a
  successor.

  `crossProject` shipped as a public API with no page, no sidebar entry and no worked
  example — discoverable only from a deprecation callout on the page for the API it
  replaces. It now has [its own page](https://nielspeter.github.io/eess/cross-project),
  with three examples that compile in CI and a migration table from `crossLayer`.

  `crossLayer()` carries an `@deprecated` tag naming `crossProject()` as its
  successor. Nothing about `crossLayer` changes — it still works, and no API moves.

  **Declared `minor`, not `patch`, and the reason is the tag.** If you lint with
  `@typescript-eslint/no-deprecated`, this reddens your build the moment you upgrade —
  and `patch` is the bump renovate and dependabot auto-merge. It is not a break, so it
  carries no breaking marker; it is a `minor` so the upgrade is a decision.

  **It supersedes `crossLayer` for pairings that are key equality — most of them, not
  all — and it is a rewrite rather than a rename.** The page states the precondition
  and what falls outside it, so you can tell before you start:
  - A key function may return an **array**, which is what lets `haveConsistentExports`
    translate: one file expands into one key per exported symbol, with the pairing
    folded into the key's prefix.
  - A `.mapping(fn)` that is **not** key equality — prefix matching, directory
    nesting, "imports its schema" — has no key encoding. Keep `crossLayer`.
  - `satisfyPairCondition` builds its own violation, including `measured` /
    `metricUnit` for the baseline ratchet. No equivalent. Keep `crossLayer`.
  - A chain of 3+ layers becomes N−1 separate rules.

  Where it does apply, attribution degrades (the composite key lands in the message
  rather than the `element`), unpaired files go from silent to one finding per symbol,
  and **your baseline does not survive** — identity is `rule::element::message` and
  migrating changes all three.

- 7031427: **New:** `crossProject()` / `CrossProjectBuilder` — compare two
  independently-derived key sets within one TypeScript project.

  **Not marked breaking, and the reason is measured.** No published
  `@nielspeter/eess-ts` (`0.1.0`, `0.1.1`, `0.2.0`, `0.2.1`) exports
  `correspondence` or `CorrespondenceBuilder`, or even ships
  `dist/builders/correspondence-builder.js` — so no eess-ts adopter can perform a
  migration, and a `**Breaking**` lead here would head that package's changelog
  with a no-op for every reader of it.

  **If you are migrating from `@nielspeter/ts-archunit`** (the heritage package
  this repo folds in, which does publish `correspondence` at
  `dist/index.d.ts:100`), this is that API renamed. Exactly two symbols move:

  **Migration:** rename the import and the call. The `.side(…).side(…)` chain and
  the behaviour are unchanged — but note the violation `rule:` identity changes
  with the name (`correspondence [a <-> b]` → `crossProject [a <-> b]`), and
  `hashViolation` keys baselines on it, so regenerate any baseline holding these
  findings. `setCorrespondence` and `CorrespondenceResult` keep their names.

  ```diff
  -import { correspondence } from '@nielspeter/eess-ts'
  -correspondence(p).side(routes, byName()).side(handlers, byName()).beComplete().check()
  +import { crossProject } from '@nielspeter/eess-ts'
  +crossProject(p).side(routes, byName()).side(handlers, byName()).beComplete().check()
  ```

  **Why.** The name collided inside the family. `@nielspeter/eess` exports a
  different `correspondence({ left, right })` — a kernel primitive that binds two
  `Selection`s from any loaders — which `@nielspeter/eess-md` re-exports and
  `docs/markdown.md` teaches. Same word, same class name, sibling packages,
  incompatible signatures: a reader who learned `correspondence()` from the
  markdown page and wrote it in an eess-ts rule file got a different API, and
  anyone importing both dialects got a collision.

  `crossProject` matches the `crossLayer` / `CrossLayerBuilder` vocabulary it
  supersedes, so the family now has three distinct names for three distinct
  things: `crossLayer` (deprecated), `crossProject` (two sides, one TS project),
  and the kernel's `correspondence` (two selections, any loaders).

  The kernel's `correspondence` is untouched, and `eess-md` is unaffected.

  Renamed now rather than later because it was never released under the colliding
  name — this is free today and a real migration after the next publish.

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

- 7031427: `linesOfCode` counts code lines, not span lines — comments and blanks excluded (bug 0170).

  **Breaking (0.x — minor signals it, not a 1.0 stability claim):** `linesOfCode`
  returns substantially smaller numbers, so `maxClassLines`, `maxMethodLines`,
  `maxFunctionLines`, `haveMoreLinesThan` and `haveMoreFunctionLinesThan` all
  report fewer violations at the same threshold. A rule you tuned against the old
  behaviour is now looser than you intended.

  It was `end - start + 1`, which counts documentation as size. That made it
  collide with JSDoc-coverage rules head-on: requiring a doc block on every public
  method drives the same class over its line budget, so satisfying one rule broke
  the other. Measured on eess's own source, **seven of nine oversized classes and
  all four oversized methods were over on comment lines alone** — every one of
  them passes now, and the carve-outs that fact had justified were deleted with it.

  The count is now the distinct lines carrying at least one token. Comments are
  trivia and so are never tokens: they drop out structurally rather than by
  matching comment syntax in text, which was the original docstring's stated
  reason for preferring the span. Blank lines carry no token either. A line
  holding only `}` still counts — this stays a physical-source-lines metric, not
  a statement count.

  **Message and rule text changed.** A line finding now reads `Big has 120 code
lines (max: 100)` rather than `Big has 120 lines (max: 100)` — the old wording
  named a number you could not find by looking at the file — and the three
  conditions' `description` follows it (`have no more than 150 code lines`). If you
  grep build logs for the old phrasing, update the pattern.

  **Your line-metric baseline entries stop suppressing, by design.** Two mechanisms
  land together here. `hashViolation` keys on `rule::subject`, and `rule` is the
  condition's description, so renaming it moves the hash. Independently — and this
  is the one that matters — `maxClassLines`, `maxMethodLines` and
  `maxFunctionLines` now stamp `unit: 'code-lines'`, and the baseline refuses to
  compare a stored measurement against a current one under a different unit
  (bug 0171). An entry accepted under the old span count would otherwise have gone
  on suppressing a ceiling that now means something else.

  So these entries were already dead in this release before the rename; the rename
  does not add a migration, it rides an existing one. Re-run your baseline. The
  message is a red build, not a silent pass — the refusal fails closed.

  **Cost:** the metric reads the AST rather than doing arithmetic on two line
  numbers, so it is not free — but it is indexed **per source file**, so the walk
  is paid once per file rather than once per call. Measured on this repo's own
  source (42 classes across six packages, `node scripts/measure-class-sizes.mjs`):
  a cold pass over every class costs ~170ms in total, the same pass warm costs
  ~0.1ms, and re-measuring an already-indexed class costs ~0.05ms.

  Two consequences. Hoisting `linesOfCode` out of a loop is no longer worth
  doing — the index already does it. And the first measurement of a file is the
  expensive one, so a rule that measures one class in a large file pays for that
  file's whole index.

  **Migration:** re-tune your thresholds downward. As a rough guide, on a densely
  commented codebase the new number lands near a third of the old one — eess's own
  `TerminalBuilder` measures 372 where it used to measure 1218. If you want the
  previous behaviour for one rule, `node.getEndLineNumber() - node.getStartLineNumber() + 1`
  in a custom condition reproduces it exactly.

- 7031427: Presets enforce again when called with no `report` option, and the
  builder-returning form gains an explicit name: `report: 'builders'`.

  **Relative to published `eess-ts`, the default is unchanged** — a preset called
  with no options runs its rules, emits once, and throws if anything failed, as
  ADR-008 states and as `0.2.1` behaves. No adopter action is needed. What is new
  is `report: 'builders'`, which builds the rules and runs none of them, for
  callers who want to run them themselves (pair it with `checkAll()`).

  **Why this changeset exists at all.** Between releases, the default had become
  the builder-returning form — not by decision, but as a side effect of overload
  ordering when `report` was restored "additively". The effect was that the shape
  `docs/getting-started.md` teaches, a bare

  ```ts
  it('enforces layered architecture', () => {
    layeredArchitecture(p, { layers: {…}, strict: true })
  })
  ```

  constructed rules, ran none of them, and **passed unconditionally on any
  codebase, forever**. TypeScript could not catch it: the return value was already
  discarded, so the change was type-invisible at exactly the call site the docs
  prescribe. Every other mode — `'throw'`, `'return'`, `'warn'` — had a name; only
  this one was reachable by saying nothing.

  Naming it restores the default and keeps the capability. All five presets are
  affected: `recommended`, `layeredArchitecture`, `strictBoundaries`,
  `dataLayerIsolation`, `agentGuardrails`.

  Measured: re-introducing the old behaviour now fails **112 tests**. It shipped
  green.

- 7031427: Restores 20 exports the engine copy dropped from `@nielspeter/eess-ts`'s root,
  two more it dropped from the `/presets` subpath, and the clean-run summary line
  its CLI stopped printing.

  **Breaking (@nielspeter/eess-ts)** — two names are gone for real and are not
  coming back in this release: `GlobDiagnosis` and `diagnoseDeadGlobs`, whose
  module (`core/dead-glob.ts`) was deleted rather than merely unexported. A named
  import of either is a link-time error. Everything else listed below is restored,
  so if you hit a missing export that is not one of those two, it is back.

  On the `/presets` subpath: `dispatchRule` and `throwIfViolations`. The first
  version of this changeset audited the root barrel only and told you that anything
  missing other than the two below "is back" — which was false for those two, since
  a named import from `@nielspeter/eess-ts/presets` is a link-time error. Found by
  an adopter review that diffed every subpath rather than just `.`.

  Restored values: `pathUniverse`, `diskSet`, `buildDiskSet`, `globSitesOf`,
  `isDeadGlobTree`, `isDeadSite`, `emptyProjectAdvice`, `loadedNothing`,
  `isTypeOnlyReExport`, `splitGlobArgs`, `validateOverrides`. Restored types:
  `GlobFault`, `OnDisk`, `DiskSet`, `StrictFamilyFlag`, `Matcher`,
  `CollectResult`, `BaselineFilter`, `DiffFilterLike`, `UntestedReason`.

  `StrictFamilyFlag` is the sharpest of them: it lost its `export` keyword at the
  definition site while `isStrictFamily()` and `resolveFlag()` — both exported —
  keep it in their signatures, so the type was unnameable by anyone calling them.

  **`eess-ts check` prints its denominator again.** A clean run had been emitting
  zero bytes, so "20 rules passed" and "no rules loaded" looked identical. It now
  prints `✓ eess-ts — N rules across M files · 0 failing (t)` to stderr on the
  terminal path, as it did before. JSON and GitHub-annotation output on stdout are
  unchanged.

- 7031427: **Breaking for subclasses of `SmellBuilder`:** `protected abstract examinedCount(): number` is now `abstract examinedUnits(): number`.

  Two changes in one member, so a custom detector will fail to compile rather than
  silently keep an unused method:
  - **Renamed.** `examinedUnits` is the name the rest of the family uses for the
    ADR-010 evidence count, and `SmellBuilder` was the only surface still spelling
    it differently.
  - **No longer `protected`.** The count is now readable from outside the class,
    because a caller deciding whether a rule was inert has to be able to ask. It is
    what `inertAdvice()` reports and what the zero-examined floor reads.

  To migrate, rename the method and drop the `protected` modifier. The body is
  unchanged: return the number of units this detector actually looked at — not the
  number it could have looked at, and not a constant. A constant fails
  `tests/core/evidence-at-every-seam.test.ts`, which requires the count to respond
  to input in both directions.

- 6dbc6f4: `workspace()` now resolves per-package facts against each package's own root, not only the alphabetically-first (tie-break-winner) tsconfig's — plan 0148.

  **Fixed (0.x — minor signals the behavior change, not a 1.0 stability claim):**
  - **`workspace()` no longer silently applies one package's compiler options to every package.** `verbatimModuleSyntax` (read by cycle/erasure detection) is now tracked per package. Before this fix, a `beFreeOfCycles()`-style rule could report a real cycle as vanished for a non-primary package, or report a phantom cycle for one that had none — both silent, both wrong, both now corrected.
  - **Project-relative globs now match against each file's own project root**, not only the workspace's tie-break-winner package (or, for `resideInFolder`/`resideInFile`/`havePathMatching`/slice `resolveByDefinition`/`onlyImportFrom`/`notImportFrom`/`dependOn`/`onlyBeImportedVia`, not at all — this was broken for single-tsconfig `project()` callers too). `resideInFolder('src/domain/**')` (no leading `**/`) previously matched nothing, silently; it now matches that folder at each package's own root.

  **Migration:** if a rule using an unanchored, project-relative glob now selects more subjects or reports different violations than before, that's the fix working — the glob was previously matching nothing (or only the wrong package). If "anywhere in the project" was actually intended, anchor the glob with a leading `**/` instead.

### Patch Changes

- 26f7352: `eess-ts check --baseline` / `--changed` no longer fail in silence when a rule file
  reports its own findings — bug 0199.

  A rule file that calls a terminal at module scope prints its violations itself,
  before the CLI ever sees them, so no CLI-side filter can act on that output. With
  `--baseline` in play the result was a red build listing violations the user had
  already accepted, and nothing in the output mentioning the baseline at all.

  Measured against a real `@nielspeter/ts-archunit` baseline: **all 5 entries matched**
  and the build still exited 1 with every one of them printed. The hashes were never
  the problem; the printed output simply never reached the filter.

  The run now reports it as `eess-ts: reporting`, names the baseline **file** (not a
  flag you may have set in `eess-ts.config.ts` and never typed), and gives the remedy:
  move the rules into `export default [rule1, rule2]`, or — if they come from a preset
  — pass `report: 'builders'`.

  **Scope, stated because it is narrower than it sounds.** The notice fires only when
  a CLI-side filter was actually in play (`--baseline` or `--changed`) _and_ the rule
  file really did print something. A plain `eess-ts check` with no filter gets no
  notice, even though the same underlying leak is present — that case shows up as
  findings printed twice, and it is tracked separately, unfixed.

  **Migrating from `@nielspeter/ts-archunit`?** Its presets returned builders and never
  enforced inline, so a rules file carried over verbatim has no `report: 'builders'`
  and will hit this. Baseline files themselves transfer unchanged — same
  `hashVersion`, same `arch-baseline.json`, byte-identical hashing.

- 26f7352: `.check()` at module scope no longer prints its own report when the CLI is
  aggregating — bug 0201.

  `executeCheck` called `writeReport` unconditionally, one line before it threw. So a
  rule file calling a terminal at module scope printed its findings **before**
  `eess-ts check` could see them, and no CLI-side filter could act on that output:
  not `--baseline`, not `--changed`. Measured against a matching baseline, four
  already-accepted violations printed as failures.

  It now honours `callerAggregatesReports`, exactly as `executeWarn` always has.

  **Nothing changes for a `.check()` outside the CLI.** The flag defaults to `false`
  and only `eess-ts check` sets it, so a `.check()` in a test file — where there is no
  aggregator — prints exactly as before. The violations are not lost when it stays
  quiet either: they ride the thrown `ArchRuleError`, which the CLI collects and
  filters.

  **Still open, and this release does not fix it.** A _preset_ called without
  `report: 'builders'` emits through a different path, which this change does not
  touch. Its most visible symptom is that each finding is **printed twice** — once by
  the preset, once by the CLI — and that happens with no flags at all. Under
  `--baseline` or `--changed` the printed copy is additionally unfiltered, and in that
  case `check` now says so; without a filter flag it does not. Tracked separately.

- 26f7352: `reportViolations` counts the violations it writes, exposed as
  `violationsEmittedCount()`.

  Purely additive: an internal counter and an accessor, no behaviour change. Nothing
  about when or what `reportViolations` emits is different.

  **Why it exists.** A caller that aggregates reporting — `eess-ts check` — needs to
  know whether anything emitted while it was loading a rule file, so it can tell the
  user their `--baseline` / `--changed` did not apply to output that was printed
  before the CLI saw it.

  The version of that check which shipped first counted the writes it **suppressed**
  and read the absence of a suppression as "nothing was written". That is a double
  negative and it is unsound: a rule file that silences one terminal while leaking
  through another satisfies it _while leaking_. Measured — a `report: 'warn'` preset
  beside a silenced `.check()` in one file leaked 7 violation blocks and the run said
  nothing at all. A silence built on a stale signal is worse than the false claim it
  replaced.

  Counting emissions answers the question directly, at the site that does the
  emitting. `eess-ts` counts its own second emitter the same way and reads the sum.

  The accessor is kernel plumbing rather than a surface to write rules against, so
  `eess-ts` does not re-export it.

- 7031427: `linesOfCode` no longer returns a stale measurement after an in-process edit (bug 0173).

  The per-file line index was cached on a `WeakMap<SourceFile, …>` with no
  invalidation, on the stated reasoning that ts-morph replaces node objects when a
  file's text changes. It does not — a `SourceFile`'s object identity survives an
  edit, which this repo had already measured and written down twice elsewhere.

  The failure was not "returns the previous answer", which would at least be a
  number that once meant something. Positions come from the AST and stay fresh
  while the line table goes stale, so the two were read against each other: a class
  that grew from 5 code lines to 8 measured **6**.

  It bites hardest in the fixture pattern this project's own guidance prescribes —
  `createSourceFile(path, text, { overwrite: true })` — where every case after the
  first measured the first case's file. A rule author tuning thresholds against
  those numbers was tuning against nothing, with no signal that anything was wrong.

  The index now lives beside the other `SourceFile`-keyed caches and follows their
  convention: reachable from `resetProjectCache()`, and an `onModified` listener
  per file that drops it. If you call `linesOfCode` against a project you mutate,
  you no longer need to rebuild the project to get a true answer.

- 6f245b7: A migration guide for `@nielspeter/ts-archunit` users:
  https://github.com/nielspeter/eess/blob/main/docs/migrating-from-ts-archunit.md

  Docs only — nothing in the package changes.

  Most projects change one import line. Four things do change, and the page leads with
  the one that is silent: **a preset call in a rule file needs `report: 'builders'`.**
  ts-archunit's presets returned builders; eess-ts's enforce by default, so
  `export default [...recommended(p)]` spreads the preset's _result_. On a codebase
  with violations that fails loudly. On a clean one it spreads an empty array, and
  every rule disappears.

  The other three: inline `// ts-archunit-exclude` comments are `// eess-exclude` now
  (spread across your whole codebase, so the page gives you the grep);
  `correspondence()` is `crossProject()` — the only two exports that moved; and the
  CLI and config file are renamed.

  **Your baseline transfers unchanged** — same filename, same hash version, verified
  end-to-end rather than assumed.

- d93dc89: A preset enforcing at module scope no longer prints its findings twice — bug 0203.

  `recommended(p)` in a rule file emitted its violations and then threw. Under
  `eess-ts check` the CLI collected the same violations off that throw and reported
  them again: one violation, two blocks, two contradicting counters — **with no flags
  involved**. Measured, 13 violation blocks of which 6 were exact duplicates, under a
  summary line claiming `1 violation`.

  This is what a rule file carried over from `@nielspeter/ts-archunit` produces on the
  first `eess-ts check`, since its `recommended()` took no `report` option at all.

  `deliver()` and `checkAll()` now do what `.check()` already did: enforce, throw, and
  let an aggregating caller do the reporting.

  **Suppression lasts as long as the run, not the process.** Aggregation is declared
  by `eess-ts check` for the duration of its own run and restored afterwards, so a
  preset or a `checkAll()` used **outside** that run — in a test file, or by an
  embedder — prints exactly as before. That scoping is part of this release: the
  declaration used to be a latch nothing reset, which was invisible while only
  `.check()` read it and would have silenced a preset called anywhere later in the
  same process.

  The throw is unchanged in every case — the caller still learns the run failed, and
  the violations still ride the error, which is what the CLI collects and reports.

  **Only the default (throwing) mode.** `report: 'warn'` and `report: 'return'` are
  explicit choices about emission and are untouched — and `'warn'`'s violations do not
  ride a throw, so suppressing them would lose them.

  A consequence worth knowing: because the CLI is now the only thing reporting these
  findings, `--baseline` and `--changed` finally apply to them.

  **Warn-severity findings are unaffected by the suppression.** `checkAll()` throws
  only the error-severity subset, so its warn findings ride no throw — they are still
  written, and `check` says its filters did not reach them. Suppressing them too would
  have deleted them, which an early version of this change did.

  `eess-ts check`'s "this file stopped evaluating" remedy also names
  `report: 'builders'` now. It previously offered only "move its rules into an array
  export", which is a no-op for `export default [...recommended(p)]` — already an
  array export, and still enforcing at module scope because the spread evaluates
  first.

- 7031427: The published README's links work from the published package, and the docs stop teaching deprecated API.

  Two consumer-visible fixes, both found by pointing this package's own doc gates at
  the real repository for the first time (bug 0179).

  **README links.** `README.md` ships in the npm tarball; `../../README.md` and
  `../../docs/agent-integration.md` did not, because `files` is
  `['dist', 'README.md', 'LICENSE']`. Both links resolved to nothing for anyone
  reading the package on npm or in `node_modules` — which is where an agent
  inspecting an installed dependency looks. They are absolute now, and the same
  class of link is repaired in the other four packages' READMEs.

  **Scoped honestly:** this fixes the _relative_ links. The README also carries ten
  `nielspeter.github.io/eess/*` URLs, including the three in its masthead, and those
  currently 404 because no Pages deploy exists — tracked separately, not fixed here.

  **Deprecated API in the documentation.** The docs presented eight deprecated
  methods as the primary spelling, in "Available Conditions" tables rather than in a
  migration note: `notImportFromCondition`, `notImportFromConditionWithOptions`,
  `shouldExtend`, `shouldImplement`, `shouldHaveMethodNamed`,
  `conditionHaveNameMatching`, `shouldResideInFile` and `shouldResideInFolder`. Each
  is `@deprecated` in this package's own source, pointing at the replacement to use
  after `.should()`. The docs now name the replacements. No API changed — if you
  copied an example, your code still works, and the deprecation notice tells you what
  to move to.

- 5b318d1: `eess-ts check` no longer stays silent when a rule-level `.warn()` leaks past your
  filters — bug 0207.

  A `.warn()`'s advisory violations ride no throw, so the CLI never collects them and
  neither `--baseline` nor `--changed` can reach them. `check` is supposed to say so.
  It did not: the emitter writes through a different path from the other two, so the
  run's leak detector never saw the output and the notice stayed silent.

  Measured: a live `.warn()` beside a throwing `.check()` under `--baseline` printed
  its findings unfiltered while the run reported nothing unusual.

  Nothing about what is printed changes — only whether the run tells you those lines
  bypassed your filters.

- Updated dependencies [7031427]
- Updated dependencies [7031427]
- Updated dependencies [26f7352]
- Updated dependencies [7031427]
  - @nielspeter/eess@0.4.0

## 0.3.0

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

## 0.2.1

### Patch Changes

- 45f0f33: Load `eess-ts.config.ts` through jiti so the CLI works in CommonJS-default
  projects. `eess-ts init` scaffolds an ESM-syntax config; in a project whose
  `package.json` declares `"type": "commonjs"` (what `npm init -y` writes), the
  very first `eess-ts check` crashed with "Cannot use import statement outside a
  module". Fixes bug 0074.
- Updated dependencies
  - @nielspeter/eess@0.2.1

## 0.2.0

### Minor Changes

- 2f219de: Catch eess-ts up to ts-archunit 0.17.0 (plan 0071):
  - **`recommended(p)` and `agentGuardrails(p, { src })` presets** — the universal safety floor and the AI-agent-mistakes bundle, in eess's eager ADR-008 form (return `ArchViolation[]`, honour `report`/`format`/`overrides`).
  - **`explain --format agent`** — emits an imperative, sentinel-wrapped rules block for an AI agent's system prompt, built from a new `imperative` field on rule metadata (kernel).
  - **`tsconfig(p).requires(spec)`** — a Tier-1 config-assertion rule asserting resolved TypeScript compiler options (strict-family resolution, enum-by-name rendering).
  - **`eess-ts init`** — scaffolds a working setup (`arch.rules.ts` with the floor preset expanded as editable builders, `eess-ts.config.ts`, npm scripts); `--preset recommended|agent-guardrails`, `--dry-run`, `--force`, `--no-baseline`.

  Kernel: `RuleMetadata`/`RuleDescription` gain an optional `imperative` field; `dispatchRule` accepts full metadata (backward-compatible with the bare-id form).

### Patch Changes

- Updated dependencies [2f219de]
  - @nielspeter/eess@0.2.0

## 0.1.1

### Patch Changes

- Verify the tokenless release pipeline (OIDC trusted publishing + provenance) end-to-end. No API changes.
- Updated dependencies
  - @nielspeter/eess@0.1.1
