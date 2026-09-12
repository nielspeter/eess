# @nielspeter/eess-ts

## 0.5.1

### Patch Changes

- bc38ee1: **Fix: a rule file may import a sibling module under `"type": "module"`.**

  TypeScript requires the emitted `.js` specifier for a relative import under
  `nodenext`, and Node performs no `.js` → `.ts` substitution — so the specifier
  `tsc` demands is the one Node cannot resolve. The failure was
  `ERR_MODULE_NOT_FOUND` rather than a `SyntaxError`, which the loader's fallback
  does not recognise, so the error rethrew:

  ```
  Error: rules.ts could not be loaded (Cannot find module '/…/sibling.js'
  imported from /…/rules.ts), so none of it could be diagnosed.
  ```

  `check`, `doctor` and `explain` all failed, and `explain` failed with a raw
  stack. In practice a TypeScript ESM project could use the CLI only while every
  rule fitted in one file with no local imports — the moment rules were split to
  share a `project()` instance, the CLI stopped working.

  The process loader now performs the substitution and the native import is
  retried. Resolution is the only thing that changed; execution is untouched, so
  a rule file still loads into the CLI's own module registry.

  Nothing to change in your rule files. If you split them, this is the release
  that lets the sibling line resolve: a relative `import { p } from './sibling.js'`
  in `arch.rules.ts`, alongside the package imports it already had.

  ```ts
  import { classes, project } from '@nielspeter/eess-ts'
  ```

  That relative specifier names a file in your tree, not an export of ours, so it
  is written here as prose rather than as a checked fence — this repo has no way
  to resolve it. The gap that makes that necessary is bug 0280.

  Two related repairs ship with it. `doctor` no longer suggests a test runner as
  the cause for a file that imports none — the sentence misled the reporter of
  this bug into concluding, in writing, that `doctor` refuses any file importing
  vitest. And `eess-mermaid`'s config loader carried the same shape and takes the
  same fix.

- 14137a6: **Fix: `isStrictFamily` and `resolveFlag` are on the `@nielspeter/eess-ts` barrel again.**

  `0.5.0` removed them while keeping `STRICT_FAMILY_SIZE` and the
  `StrictFamilyFlag` type, which come from the same module. That left the published
  surface able to name a strict-family flag and count the family, and unable to
  test whether a key belongs to it or resolve one against compiler options.

  If your rule file imports either, `0.5.0` does not fail to type-check — it fails
  to **load**, because ESM resolves named imports up front:

  ```
  SyntaxError: The requested module '@nielspeter/eess-ts'
  does not provide an export named 'isStrictFamily'
  ```

  Upgrade to this version and the import works again, unchanged:

  ```ts
  import { isStrictFamily, resolveFlag, STRICT_FAMILY_SIZE } from '@nielspeter/eess-ts'
  ```

  Nothing else moved, and no other symbol removed in `0.5.0` is affected — the
  `0.5` migration guide now lists all of them by name so you can check your own
  imports against it.

- Updated dependencies [bc38ee1]
  - @nielspeter/eess@0.5.1

## 0.5.0

### Minor Changes

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

- 3a68b5c: **Breaking (@nielspeter/eess-ts):** `eess-ts check`, `eess-ts check --fix`, `eess-ts baseline` and `checkAll()` now fail on a builder that hands back a bare array instead of a receipt — a behavioural break, not a signature one

  ADR-014 requires every emitter to refuse a verdict it has no evidence for. Four doors in this
  package did not: `runCheck` and `runBaseline` built their reports by pushing
  `attributeToRuleFile(builder.violations(), …)` into a plain array, and `runFix` and `checkAll`
  aggregated with `flatMap`. All four drop the `examined` count that `violations()` returns, so none
  reached the evidence gate.

  Measured before this change, over a rule file containing `export default [{ violations: () => [] }]`:
  `eess-ts check` reported `"total": 0`, `"examined": null`, **exit 0**; `eess-ts baseline` wrote a
  baseline file and exited 0; `eess-ts check --fix` exited 0; and `checkAll()` returned silently.

  The three CLI doors now run the gate **per builder**, where the rule file is known, so the finding
  names the file it came from — and three dead builders in one file are three findings, not one.

  **`--fix` refuses before it writes, per builder.** A fix is an edit derived from a verdict, so a
  refused verdict refuses the edits computed from it. Measured before this change,
  `eess-ts check --fix --apply` over an evidence-free builder **rewrote the target file** while the
  same run reported the finding and exited 1. It now reports that builder and applies nothing from it
  — and still applies the fixes from every other builder, which were each verified. The refusal is
  scoped to the emitter's own findings: a dead selector or a stale exclusion says the rule matched
  nothing, not that its verdict is unreadable, and refusing on those made `--fix` a no-op in any
  project with one mis-globbed preset option.

  **`eess-ts check --fix` and `eess-ts baseline` now fail on a rule file that contributes no rules**,
  which `eess-ts check` has always done. A file that loads cleanly and exports `[]` enforces nothing;
  measured before this change, both commands exited 0 over exactly that, and `baseline` wrote a
  baseline from it.

  **A rule you turned off no longer reds a per-builder door.** `mergeCollectResults` has always exempted
  a `notRun` member from its dead-member filter — that exemption is what `notRun` is for — and the
  evidence gate had no matching branch. Measured: `checkAll([healthy, off])` was green while
  `eess-ts check` over the same two builders reported `1 of 2 rules failing`. The gate now exempts it
  too. It is still falsifiable: a `notRun` beside a non-zero `examined` or any violation remains
  `emitter/contradictory-evidence`, and a run where _every_ rule is off still reds, because the merged
  receipt carries no `notRun`. `checkAll` merges its builders' receipts with `mergeCollectResults`
  (fail-closed per member, so one dead builder among many is named rather than absorbed) and consults
  the same gate. A builder with no receipt is `emitter/no-receipt`; one that ran and examined nothing,
  with no declaration, is `emitter/pass-without-evidence`. Both findings are unsuppressable and set the
  exit code.

  **`eess-ts baseline` refuses rather than accepting.** A baseline is a persisted verdict, so a
  builder that certified nothing must not contribute to one. The command still writes the entries it
  _could_ accept, prints the refused finding with its rule file, and exits 1 — the behaviour it
  already had for other unsuppressable findings.

  **`checkAll([])` now throws**, with a message written for that door: guard the array —
  `if (rules.length > 0) checkAll(rules)` — or pass the rules you meant to check. There is no
  declaration form at this door, and the finding no longer offers one: a preset that legitimately
  produces no rules declares that where it is built, not here.

  **`eess-ts doctor` is unchanged, and that is a gap rather than a decision.** A diagnostic returns no
  verdict, so it is outside this clause. But measured against this same probe it prints `No rules that
cannot enforce anything.` and exits 0 — the command whose stated job is reporting rules that cannot
  enforce anything. That is bug 0268 — filed, not excused. A sibling dialect's door is bug 0269.

  **One door stays open, stated rather than implied:** the exported `collectViolations` helper is
  typed to accept a bare array and documented as not throwing, so calling it with `generateBaseline`
  by hand still bypasses the gate. Closing that is a public-API decision rather than a wiring one, and
  it is not made here.

  **The kernel's `dedupeConfigFindings` no longer collapses emitter findings.** It keys on `(rule file,
rule id, offending glob)`, and an emitter finding carries `element: ruleId` and `file: ''` — it points
  at a verdict, not at a place in code — so every occurrence in a run shared one key and merged, with a
  note claiming they were "one edit". Three hand-rolled builders are three edits in three places.
  `keyFor` now returns no key for the four ids in `emitter-findings.ts`.

  **`emitter/no-receipt` now names the call that fixes it.** The message was written for someone calling
  `finishPreset([])` directly; it is now also what a rule-file author meets, and their builder _is_ the
  thing returning the array — so "hand the emitter a builder's `violations()`" described what they had
  already done. It now says `collectResult(violations, { examined })`, and `mergeCollectResults([...])`
  for the combining case. Everything else is unchanged:
  preset fan-out still collapses, and so does a rule with a real narrowing and no glob to name.

  **What breaks.** A rule file or test that hands any of these doors a hand-rolled builder — an object with
  a `violations()` that returns a plain array — used to pass and now fails. That is the point: it was
  certifying nothing. **What to do:** return `collectResult(violations, { examined })` from your
  builder (`import { collectResult } from '@nielspeter/eess-ts'` — no second install), or declare a legitimately empty result with `declaredEmpty: true`. A builder produced by
  this package's own fluent API already carries its receipt and is unaffected; every rule file in this
  repository passes unchanged.

- 8934365: Report an exclusion comment that cannot apply, instead of leaving it silently inert

  `.excluding()` patterns have warned about matching zero violations since bug 0044. Comment directives never did, so the two ways one goes inert were both
  silent — the author saw the violation their sanction was supposed to cover, and
  nothing else:
  - **The chain declares no rule id.** A comment matches a violation by rule id, so
    `pointers(c).that().areLive().should().resolve().check()` — no `.rule()` — can
    never match one. Worse, the whole exclusion scan was gated on having an id, so
    the file was not even parsed. Found by an adopter review whose own docs had
    just recommended this exact sanction.
  - **The directive is out of reach.** A single-line directive covers the _next_
    line, so one that is not immediately above the finding covers nothing. (What
    "the next line" means where a single physical line holds several logical ones —
    a markdown table row, say — is documented per dialect; the diagnostic itself
    stays domain-neutral, because the kernel emits it for every dialect.)

  Both now print a stderr diagnostic naming the file and line. Neither is a
  finding: the violation is already firing, so the build is red and the author is
  looking at it.

  The two are **not** symmetric, and the difference matters. The out-of-reach case
  knows the directive is this rule's — it matches on id — so it can name the
  region primitive as the fix. The no-id case cannot: a directive in the file may
  belong to another, working rule, and from inside one rule's run there is no way
  to tell. So it states the fact and leaves the id to you, rather than prescribing
  one that might already be claimed.

  **No behaviour changes for a directive that works.** Nothing new is suppressed or
  un-suppressed, and no exit code moves. The one visible change beyond the
  diagnostics is that a rule with no id now parses exclusion comments in files that
  already failed — bounded the same way it always was, and the reason it can report
  this at all.

  A directive in a file with no violations is still never read, so a defensive
  region over clean code costs nothing and is not reported.

  **`@nielspeter/eess-ts` gets the same change, and that is not incidental.**
  It carries its own copy of `applyFilters` (`packages/ts/src/core/execute-rule.ts`
  — an independent fork, tracked by plan 0188), so a fix landing only in the kernel
  would have reached `eess-md`, `eess-mermaid` and `eess-gherkin` while leaving the
  dialect most people install exactly as silent as before. Review caught the first
  version doing precisely that, with a changeset that said "eess now prints…" —
  and found an `eess-ts` test still certifying the old behaviour.

  Both diagnostics now exist in both copies, **print identical text**, and a gate
  holds them to it: `engine/applyfilters-parity` runs the same scenarios through
  both and fails on any divergence. That exists because hand-porting failed three
  times on this one bug — the copy was missed, then its wording drifted once
  ported, then its coverage was never written. Each half has its own test on each
  side now, too.

  `orphanExclusions`'s docstring is corrected alongside: it documented this gap as
  one it could not close and priced it at "a parse per file per rule". The fix came
  in under that estimate, leaving the docstring claiming a gap that no longer
  exists. It now says what that module still uniquely covers — a directive in a
  file that produced no violation, which the enforcement path never reads.

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

- e82c27d: eess now runs its own `agentGuardrails` preset against its own source
  (`check:guardrails`, in the validate chain and in CI). It used to dogfood only
  `recommended`; the preset written for "the mistakes AI coding agents make most
  often" was the one exempted, in a repo written by AI coding agents.

  The exemption lived as a comment claiming the rules fired on legitimate style —
  "18 `throw new Error`, 270 by-design-similar rule-wrapper bodies". That rationale
  was self-sealing: it was the reason not to run the preset, so nothing ever tested
  it. Run, it reported 84 copy-paste findings rather than 270 — most of them true
  duplicates — and all 17 bare `Error`s were a real finding.

  **New: `ArchConfigError` and `isArchConfigError` on `@nielspeter/eess`** (re-exported
  from `@nielspeter/eess-ts`). Thrown when a RULE is misconfigured — bad arguments to
  a condition, a malformed rule file — as distinct from `ArchRuleError`, which means
  the architecture under test is wrong. It carries `subject`, naming what was
  misconfigured.

  This is not cosmetic. `rule-file-findings.ts` already branched on
  `isArchRuleError(error)` and routed everything else down one generic "rule file
  failed" path, so a rule author who mistyped an argument saw the same surface as an
  unhandled crash. The 17 sites that threw a bare `Error` — argument validation in
  `conditions/`, rule-file loading in `cli/load-rules.ts`, project resolution,
  GraphQL schema loading — now throw `ArchConfigError`. `ErrorOptions` is forwarded,
  so the `cause` chain that distinguishes "graphql is missing" from "graphql failed
  to load" is preserved.

  The preset asked for this type and the repo did not have it. That is what
  dogfooding is for.

  Remaining honestly: `no-copy-paste` warnings, down from 84 at the moment the
  preset was first run to 38 as this ships. Every reduction is an extraction, not a
  threshold move — the shared owner each one produced is named in its own commit,
  and several turned out to be fixes rather than tidying, because the duplicate
  copies had already drifted apart. What is left divides into findings whose
  remedy is a DSL decision (a `haveX`/`notHaveX` pair is duplicated by
  construction, and collapsing it changes the public API) and a handful the
  detector reports on eight or more varying axes, which is same-shape rather than
  copy-paste. Plan 0188 owns the remainder. The gate blocks on errors and prints
  the warnings; it does not call them clean.

- 0a10e1f: **Breaking for baselines only:** `smells.duplicateBodies()` now reports one
  finding per CLUSTER of mutually-similar bodies instead of one per pair. A
  two-member cluster keeps the message and identity it already had, so most
  baselines are untouched; a group of three or more collapses into a single
  finding with a new `duplicate-cluster::` identity, and those entries need
  regenerating. Nothing is dropped and no score changed — this is what the
  detector says, not what it scores.

  Measured on a ~5,600-file production monorepo: **4,770 pair findings became
  407** — an 11.7x reduction. The old output had more findings than the 3,810
  bodies that produced them, because N mutually-similar bodies carry one
  observation and emit N^2/2 lines of it. The eight largest groups alone were 49%
  of the output; one group of 89 emitted 398 lines; the worst single function was
  named 29 times. On this repo, 220 became 93.

  **Findings now say what varies.** A percentage cannot distinguish "one call
  target differs" from "every property name differs", and those are opposite
  verdicts:

  ```
  isExcludedByComment (core) is 100% similar to isExcludedByComment (ts)
    — identical text: a literal copy
  assertHomogeneous   (core) is 100% similar to assertHomogeneous   (ts)
    — 1 varying axis: '...Matcher functions...' -> '...TypeMatcher functions...'
  functionContain is 85% similar to haveOnlyReadonlyProperties
    — 12 varying axes: fn -> element, ArchFunction -> PropertyBearingNode, +9 more
  ```

  A systematic rename counts as ONE axis however many times it occurs, because it
  is one decision to evaluate. Reported, never filtered on: measured, the bucket
  that is mostly convergent idiom carries a median of 6 axes against 4 for the
  rest, which is real information and not a classifier.

  **Findings are ordered by how likely they are to be worth acting on** — a copy
  of one function into another file first. The detector ignores identifiers by
  design (that is what makes it a type-2 clone score) and was also ignoring the
  declaration's own name, where the evidence was. Bucketed over that corpus:
  different-file-same-name is 14% of findings and is where the real copies are;
  different-file-different-name is 56% and is mostly shared idiom. A ranking, not
  a filter — dropping either bucket loses real duplication.

  New public API on `@nielspeter/eess-ts`: `variationBetween`, and the types
  `Variation` and `VariationAxis`. `Fingerprint` gains a `texts` field, parallel to
  `kinds`; `computeSimilarity` does not read it and must not.

- bef0ebd: **Breaking: which file a duplicate finding is reported at no longer depends on
  the filesystem.**

  Marked breaking on purpose. An inline `// eess-exclude` you committed against a duplicate can stop
  suppressing after this upgrade, with no change on your side — a green build goes
  red. That the old location was never durable is the defect being fixed, not a
  reason to ship the change quietly as a patch.

  A duplicate concerns several bodies and is reported at one of them. That location
  is where you put `// eess-exclude`. It was whichever member the source walk
  reached first — so the same duplicate could report at `a.ts` on your machine and
  `b.ts` in CI, and a waiver committed against the first would silently stop
  suppressing.

  The identity beside it was already sorted for exactly this reason. The location
  now uses the same ordering, by path then line.

  Baselines are unaffected: the identity has not changed. What can change is the
  `file`, `line` and `element` printed for a duplicate whose members were
  previously reported in a different order — and if you have an inline waiver that
  was working, it was working against a location that could have moved anyway.

  Five smaller things move with it, all of them the same defect further down the
  same finding, and all of them output you may be reading or diffing:
  - A cluster finding lists the members it shows in path-then-line order rather
    than walk order. `+N more` elides the rest, so which member you never saw used
    to be the filesystem's choice.
  - The varying axes quoted as evidence come from a pair chosen the same way, and
    the `from -> to` direction follows the members rather than the walk — for pair
    findings as well as clusters. The same finding could read `'x' -> 'y'` locally
    and `'y' -> 'x'` in CI.
  - `.groupByFolder()` groups by the folder a finding is REPORTED in. It grouped by
    the walk-order endpoint, which stopped agreeing with the reported location once
    the anchor moved.
  - **The order findings are reported in** is now deterministic. Duplicate findings
    are ranked into four buckets and the sort is stable, so equal-ranked findings —
    the overwhelming majority — kept whatever order the filesystem produced. They
    now tie-break on the anchor path.
  - Folder names are compared directly rather than with `localeCompare`, whose
    result depends on the runtime's ICU build and default locale. Same reason: a
    report should read the same on two machines.

  If you diff eess-ts output between runs or machines, expect this release to be
  the last one where those diffs are noise.

- 95bedfb: **Fixed: `--changed` hid the duplicate you had just created.**

  A duplicate-body finding concerns two or more files and carries one `file`, which
  is where it is reported. `diffAware()` keeps a violation when that one path is in
  the changed set — so if you pasted a body into a second file, the finding sat on
  the file you had _not_ touched and was filtered away. Which file that was came
  down to source walk order, i.e. to how the OS enumerated a directory.

  This was true for a plain two-body duplicate, which is the common case, and the
  pair-to-cluster collapse widened it: a family of three reported at one file
  instead of two.

  **New on `ArchViolation`: `relatedFiles?: readonly string[]`** — the other files
  one finding concerns. Optional and additive: a single-file finding omits it,
  existing producers keep compiling, and a consumer that ignores it behaves exactly
  as before. `diffAware()` now keeps a violation when its own file _or_ any related
  file changed. `smells.duplicateBodies()` populates it for pairs and clusters.

  Output volume is unchanged — a finding that names three files is still one
  finding, not three. The alternative considered was emitting the finding once per
  member file, which fixes the filter and gives back part of the 11.7x reduction
  the cluster collapse exists for.

  If you consume violations and filter them by file yourself, read `relatedFiles`
  too, or you will reproduce this bug in your own tooling.

- 8ab50f5: **New rule:** `preset/agent/no-verdict-outside-rules` on `agentGuardrails`,
  behind `noVerdictOutsideRules` (default **off**).

  A module that is not a rule file, a test, or a file you name in the companion
  `ruleFiles` option must not import eess as a value — only `import type` — and
  must not call `finishPreset` / `reportViolations` / `throwIfViolations`.

  **Why.** A consuming project shipped four corpus gates as hand-rolled loops,
  importing eess's types and its printer and never a `RuleBuilder`. Three went
  inert in one week and each printed green. `ADR-014` makes an evidence-free
  verdict unrepresentable at every seam eess owns, and names honestly what it
  cannot reach: a caller who sums receipts by hand, and one who never calls an
  emitter at all. This rule is what reaches those two.

  **The flag defaults off, so the upgrade is silent** — no adopter reds on
  install. A dogfooder running every flag must add this one. Turn it off again
  with `overrides: { 'preset/agent/no-verdict-outside-rules': 'off' }`.

  **Expect a first red on your own preset modules.** A module that builds rules
  imports `dispatchRule` at runtime, so it trips this rule until you name it in
  `ruleFiles` — correct, because a preset module is a verdict file by definition.

  `ruleFiles` **extends** the default `['**/*.rules.ts', '**/*.test.ts', '**/*.spec.ts']`
  rather than replacing it, and an entry matching no file is reported as
  `preset/agent/rule-files-matches-nothing` so the list cannot rot in silence.
  Its globs behave as they do everywhere else in `eess-ts`: an unanchored
  `scripts/**` is matched against the path relative to your tsconfig root, and the
  dead-entry check derives that the same way the rule does rather than deciding it
  separately.

  **What it does not reach**, stated because an unstated ceiling reads as
  coverage: nothing inside a rule file; no `.mjs` script outside your `tsconfig`;
  a dynamic import destructured under a new name
  (`const { finishPreset: done } = await import(…)`), though a static renamed
  import is caught; and no equivalent for adopters without `eess-ts` — there is no
  AST engine to build one on, and for them the kernel contract is the whole
  protection.

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

- e72c061: `haveNoUnusedExports()` anchors a finding about a re-exported name on the barrel's own export line

  A barrel's finding named the barrel as `file` and took `line` from the declaring node in the
  _other_ file, so a one-line `index.ts` reported its re-export at line 5 — a line that exists
  only in `lib.ts`. The code frame pointed at nothing and an `// eess-exclude` on the barrel's real
  line did not apply. The finding now carries the line of the `export { name } from` specifier,
  the `export * as name from` statement, or the `export *` statement that forwards the name. An
  own declaration keeps the line it always had. The verdict is unchanged; only the location moves
  (bug 0265). Baseline hashes do not include the line, so no baseline entry changes.

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

- c03d856: **A misconfigured rule file no longer renders as a crash.**

  `ArchConfigError` was added so that a rule author who mistyped an argument would
  see something different from an unhandled failure. It shipped with 17 throw
  sites and nothing reading it: every one landed in the same generic branch as a
  syntax error or a missing dependency, which is the surface it was introduced to
  fix.

  The CLI now branches on it. A configuration fault names **what** was
  misconfigured — `havePropertyNamed`, `requireGraphQL`, `workspace` — points at
  the call rather than the file, and says plainly that editing the code under test
  cannot clear it. The generic path is unchanged and still refuses to guess a
  cause, which is why the two are worth telling apart.

  It also surfaces `cause`, which nothing rendered before. That is the only thing
  separating "the graphql package is not installed" from "it is installed but
  failed to load" — the same distinction the loader's own code takes care to
  preserve and which was being dropped on the way to the reader.

- 3c58845: Name an id-less rule by its `.because()` reason in the "declares no id" diagnostic

  A rule with no `.rule({ id })` cannot honour an exclusion comment, and eess says
  so. But an id-less rule has no id to name, so several such chains over one file
  printed byte-identical lines — three chains, three identical warnings, and no way
  to tell which one needed the id without re-reading the rule file and counting.

  Every rule already knows how to describe itself — `describeRule()` is on the
  builder that constructs the filter context — so the message names it by its own
  sentence, with no author action required:

  ```
  [eess] This rule ("that extend Base should not import Legacy") declares no id,
  so no exclusion comment can apply to it — …
  ```

  If a builder has no sentence to give (its `describeRule()` reports `unnamed`), a
  `.because()` reason is used instead; `.because()` works without `.rule({ id })`.
  A rule with neither is genuinely anonymous, and its message is unchanged. Whitespace in the reason is collapsed, because the reason is prose and
  may wrap while this report is deliberately one line per file.

  Diagnostic text only — nothing is suppressed differently and no exit code moves.
  Both copies of `applyFilters` changed together, which
  `engine/applyfilters-parity` checks: landing it in the kernel alone makes the
  copies diverge and fails the build.

- 725281f: Body-analysis rules now see two function shapes they previously missed.

  `eval` in a concise arrow body (`() => eval(x)`) or in a function expression
  (`const a = function () { … }`) passed the `recommended` floor — the preset
  described as "the universal safety floor every consumer gets". Two causes: both
  match paths walked descendants only, so a concise arrow's body (which _is_ the
  expression) was never tested; and a `VariableDeclaration` with a
  `FunctionExpression` initializer was collected by nothing.

  Affects every body-analysis rule, not only `no-eval` — the traversal fix is
  shared. `fromArrowVariableDeclaration` is renamed `fromFunctionInitializerDeclaration`
  and kept as a `@deprecated` alias.

- bb211c6: **Fixed: `smells.duplicateBodies()` reported two functions that share no
  identifier or literal at all.**

  The detector had two fast rejections before scoring and both measured each body
  on its own — plan 0103's `minDistinctVocabulary` asks "does this body carry
  enough vocabulary to be evidence?". Nothing asked the pairwise question, "do
  these two carry any of the _same_ vocabulary?", and `computeSimilarity` cannot
  answer it: it scores syntax kinds only, which is what makes it a type-2 clone
  score that survives renaming.

  So a pair could reach 100% on shape with an empty vocabulary intersection. The
  shipped instance in this repo was a rule builder's `asDeclared()` against a
  smell detector's `scope()` — two functions that each gather six of their own
  fields into a record, with not one name in common. "Extract the shared logic
  into one function" named something that did not exist.

  A pair is now rejected when both bodies have vocabulary and share none of it.
  `=== 0`, not a threshold: measured across all 89 pairs this repo produces, two
  share nothing, none share one or two, and the nearest real finding shares four.
  The rejection defers to `minDistinctVocabulary` when either body has no
  vocabulary at all — two bodies that are pure control flow share their entire
  content, and whether that is worth reporting stays the caller's decision.

  For adopters: strictly fewer findings, and only of this shape. No configuration
  changes.

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

## 0.4.0

> **Upgrading from 0.2.1? Read the 0.3.0 section below as well.**
> 0.3.0 was versioned but **never published to npm** — the last release
> of this package was 0.2.1, so this release carries two minors' worth of
> changes. A `## 0.3.0` heading normally means "a version you already
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
  replaces. It now has [its own page](https://github.com/nielspeter/eess/blob/main/docs/cross-project.md),
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

- 7031427: **Breaking for subclasses of `SmellBuilder`:** the class now declares
  `abstract examinedUnits(): number`, which your subclass must implement.

  **If you subclassed the published `SmellBuilder` (0.2.1 or earlier), this is a NEW
  abstract member, not a rename.** Your subclass will stop compiling with _"does not
  implement inherited abstract member `examinedUnits`"_.

  **To migrate: implement `examinedUnits()`.** Return the number of units this
  detector actually looked at — not the number it could have looked at, and not a
  constant. A constant fails `tests/core/evidence-at-every-seam.test.ts`, which
  requires the count to respond to input in both directions.

  `examinedUnits` is the name the rest of the family uses for the ADR-010 evidence
  count, and it is public rather than `protected` because a caller deciding whether
  a rule was inert has to be able to ask: it is what `inertAdvice()` reports and what
  the zero-examined floor reads.

  _An earlier draft of this entry described it as renaming `examinedCount`. That
  member existed only between releases — `grep examinedCount` over the published
  `0.2.1` tarball returns nothing — so "rename the method" was an instruction no
  adopter could follow._

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
