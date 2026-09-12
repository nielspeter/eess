# @nielspeter/eess

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

- abc5957: **Fixed: `not()`, `and()` and `or()` were dropping the glob declarations of the
  predicates they compose.**

  The dead-glob diagnosis reads `Predicate.globs` to tell an author that a
  selector like `resideInFolder('scr/**')` matched nothing. The kernel's
  combinators built a new predicate without that field, so composing any
  predicate with them made its declaration invisible — and a diagnosis that
  reports nothing reads exactly like a healthy rule.

  `eess-ts` had fixed this on its own copy of `combinators.ts`; the kernel never
  adopted it. So `eess-md`, `eess-mermaid`, `eess-gherkin` and
  `eess-crossvalidate` all lost the declaration on any composed selector, and a
  mistyped glob under `or(...)` in a markdown rule was silently undiagnosable.
  `negateGlobs` and `combineGlobs` were already the kernel's own, exported from
  `/internal` for `eess-ts` to use — only these three call sites were missing.

  The operator is the load-bearing part, not the presence of a field: a
  conjunction selects nothing as soon as ONE input does (`all`), a disjunction
  only when EVERY input does (`any`), and `not` inverts the operator as well as
  each leaf's polarity — a negated site over-selects rather than going vacuous,
  but a `not` nested inside the subtree flips it back.

  Consequence for adopters: a composed selector whose glob is dead can now
  produce a configuration finding where it previously produced silence. That is
  the diagnosis working, not a new rule — but a rule file with a typo that was
  quietly passing will now say so.

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

- 725281f: An `// eess-exclude` directive is only read where a comment can actually appear.

  The parser scanned raw source line by line, so text that merely looked like a
  directive — inside a string, a template literal, or a block comment describing
  the grammar — was parsed as a real waiver and **silently suppressed a genuine
  finding on the next line**. A suppression nobody wrote is the worst direction a
  suppression system can fail in.

  Strings, templates, regex literals and block comments are now blanked before
  directives are read (length- and line-preserving, so reported positions are
  unchanged), a directive must open the line's first `//` comment, and the
  HTML-comment forms apply only to non-code files. Measured: the parser read its
  own documentation as 12 waivers; it now reads 0. Real directives are unaffected —
  this repo's own 20 live waivers still apply.

  A directive must also **state a reason**, and block directives **nest**. A
  reason-free `// eess-exclude <rule-id>` used to suppress with only a line on
  stderr — a working kill switch for any rule, on any line, that did not fail the
  build. It now reports instead of suppressing. And `-end` closed _every_ open
  block, so an inner one silently ended the outer; blocks are a stack and `-end`
  pops the innermost. Nesting was previously refused outright rather than
  supported.

  Audited this repo's own 25 files carrying directives: 24 exclusions, 0 warnings —
  every waiver already stated a reason, so nothing here changed behaviour.

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

## 0.4.0

> **Upgrading from 0.2.2? Read the 0.3.0 section below as well.**
> 0.3.0 was versioned but **never published to npm** — the last release
> of this package was 0.2.2, so this release carries two minors' worth of
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

### Patch Changes

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

## 0.2.2

### Patch Changes

- 0385ecb: Violations now state what is wrong, and two-sided rules carry their own metadata
  (bugs 0122, 0113).

  **Two visible changes. No violation appears or disappears, and your baseline
  file keeps matching** — violation identity is `rule::element::message`, and none
  of those change.

  **1. The terminal report gains a `What:` line, for every rule.** The formatter
  never printed `message`. For a one-sided rule that was survivable: the element,
  the rule description and the code frame usually carry the meaning. For a
  two-sided rule `message` is the only place the finding lives, so a
  `correspondence()` failure rendered like this:

  ```
    Rule: correspondence
    CLAUDE.md:24 — 099
    Why: the ADR index is a spec: every ADR is listed, every listing is real
  ```

  — a name and a rationale, and no statement of which side drifted. It now reads:

  ```
    What: CLAUDE.md ADR index row "099" has no matching ADR file
  ```

  The whole message is rendered, not just its first line, so a `correspondence()`
  per-side `suggest` remedy — which is appended as a continuation — becomes visible
  too. It was being written and silently dropped.

  **2. `correspondence()` and `tsconfig()` violations carry `ruleId`, `because`,
  `suggestion` and `docs`.** These builders construct violations directly and had
  no path for the rule's own metadata. Concretely, `.rule({ suggestion })` on a
  two-sided rule type-checked, ran, and could never render a `Fix:` line:

  ```ts
  const v = correspondence({ left, right, keyBy })
    .should()
    .beComplete({ direction: 'left-to-right' })
    .because('an index row that names no file is a spec pointing at nothing')
    .rule({ id: 'spec/index-matches-files', suggestion: 'remove the row' })
    .violations()

  v[0].because // was undefined — now the rationale
  v[0].suggestion // was undefined — now 'remove the row'
  ```

  The rationale was the sharper loss on the `.violations()` route — ADR-008's
  caller-owns-reporting path — where it was lost in every format. `--format json`
  returned `"because": null` there; it no longer does. On the `.check()` path the
  default terminal format is unchanged for `because` (it already fell back to the
  rule's reason); `--format json` and `--format github` gain it on both routes.

  One-sided rules built with `RuleBuilder` were never affected — they thread this
  through the condition context, and are unchanged.

  **Choosing between the two remedy routes.** A rule-level `suggestion` is stamped
  onto every violation, including all three branches a `correspondence()` can emit
  — so on a `direction: 'both'` rule, one remedy is shown for "this row has no
  file" _and_ for "this file has no row", where the correct advice is opposite.
  Prefer the per-side `suggest` callbacks when the remedy differs by cause; they
  render now. Reserve `.rule({ suggestion })` for a remedy that is true of every
  way the rule can fail.

  A value a condition computed for a specific violation is never replaced by the
  rule's — `tsconfig()`'s per-key remedy and any per-element `suggestion` survive.

## 0.2.1

### Patch Changes

- README: lead with what the kernel is for rather than the retired acronym. The
  package page is a live surface — it kept showing "Executable Enforceable
  Specification System" after that expansion was removed everywhere else.

## 0.2.0

### Minor Changes

- 2f219de: Catch eess-ts up to ts-archunit 0.17.0 (plan 0071):
  - **`recommended(p)` and `agentGuardrails(p, { src })` presets** — the universal safety floor and the AI-agent-mistakes bundle, in eess's eager ADR-008 form (return `ArchViolation[]`, honour `report`/`format`/`overrides`).
  - **`explain --format agent`** — emits an imperative, sentinel-wrapped rules block for an AI agent's system prompt, built from a new `imperative` field on rule metadata (kernel).
  - **`tsconfig(p).requires(spec)`** — a Tier-1 config-assertion rule asserting resolved TypeScript compiler options (strict-family resolution, enum-by-name rendering).
  - **`eess-ts init`** — scaffolds a working setup (`arch.rules.ts` with the floor preset expanded as editable builders, `eess-ts.config.ts`, npm scripts); `--preset recommended|agent-guardrails`, `--dry-run`, `--force`, `--no-baseline`.

  Kernel: `RuleMetadata`/`RuleDescription` gain an optional `imperative` field; `dispatchRule` accepts full metadata (backward-compatible with the bare-id form).

## 0.1.1

### Patch Changes

- Verify the tokenless release pipeline (OIDC trusted publishing + provenance) end-to-end. No API changes.
