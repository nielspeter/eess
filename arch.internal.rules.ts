/**
 * Intra-package architecture rules for the eess monorepo (plan 0060 Phase 4).
 * Uniform policy applied to every package — data-driven rather than five
 * copy-pasted per-package files; bespoke per-package rules would go in a
 * per-package file, but this is one policy, parameterized.
 *
 * Run with `arch.rules.ts` (cross-package) via `npm run check:arch`.
 * Exclusions here are a-priori declarations from `work/dogfood-coverage.md` —
 * each carries its reason. No baselines (plan 0060, user decision 1).
 */
import {
  workspace,
  modules,
  classes,
  functions,
  not,
  resideInFolder as inFolder,
} from '@nielspeter/eess-ts'
import { moduleNoSilentCatch } from '@nielspeter/eess-ts/rules/errors'
import {
  moduleNoEval,
  moduleNoConsoleLog,
  moduleNoProcessEnv,
} from '@nielspeter/eess-ts/rules/security'
import {
  moduleNoTypeAssertions,
  moduleNoNonNullAssertions,
} from '@nielspeter/eess-ts/rules/typescript'
import {
  noDeadModules,
  noUnusedExports,
  noStubComments,
  noEmptyBodies,
} from '@nielspeter/eess-ts/rules/hygiene'
import {
  requireJsDocOnPublicMethods,
  noPublicFields,
  noMagicNumbers,
} from '@nielspeter/eess-ts/rules/code-quality'
import {
  maxCyclomaticComplexity,
  maxClassLines,
  maxMethodLines,
  maxMethods,
  maxParameters,
} from '@nielspeter/eess-ts/rules/metrics'

const p = workspace([
  'packages/core/tsconfig.build.json',
  'packages/ts/tsconfig.build.json',
  'packages/mermaid/tsconfig.build.json',
  'packages/md/tsconfig.build.json',
  'packages/gherkin/tsconfig.build.json',
  'packages/crossvalidate/tsconfig.build.json',
])

// A-priori exclusions (work/dogfood-coverage.md):
// Generated Langium code — "fix the code" is meaningless. Scoped to only the
// rules generated code actually violates (public fields, unused exports); on
// every other rule the generated code is already clean, so excluding it there
// would be a vacuous exclusion (the nonvacuity gate flags those).
const GENERATED = /\/parser\/generated\//
const ENV_ADAPTERS = /\/core\/src\/(ansi|environment)\.ts$/ // these modules ARE the env boundary
// Entry points = import-graph roots (the packages' exports+bin maps, verbatim):
const ENTRY_POINTS = [
  /\/core\/src\/index\.ts$/,
  /\/ts\/src\/(index|cli\/bin|presets\/index|graphql\/index)\.ts$/,
  /\/ts\/src\/rules\/(typescript|security|errors|naming|dependencies|code-quality|metrics|architecture|hygiene)\.ts$/,
  /\/mermaid\/src\/(index|cli\/bin)\.ts$/,
  /\/md\/src\/(index|rules\/(adr|ledger))\.ts$/,
  /\/gherkin\/src\/index\.ts$/,
  /\/crossvalidate\/src\/(mermaid-ts|md-ts|md-mermaid|md-mermaid-er|md-gherkin|gherkin-ts|files)\.ts$/,
]

const src = () => modules(p).that().resideInFolder('**/packages/*/src/**')
const srcClasses = () => classes(p).that().resideInFolder('**/packages/*/src/**')
const srcFns = () => functions(p).that().resideInFolder('**/packages/*/src/**')

const rules = [
  // -- security --
  src()
    .and()
    .satisfy(not(inFolder('**/src/cli/**')))
    .should()
    .satisfy(moduleNoConsoleLog())
    .rule({ id: 'eess/no-console-outside-cli', because: 'stdout belongs to the CLIs' }),
  src().should().satisfy(moduleNoEval()).rule({ id: 'eess/no-eval' }),
  src()
    .and()
    .satisfy(not(inFolder('**/src/cli/**')))
    .excluding(ENV_ADAPTERS)
    .should()
    .satisfy(moduleNoProcessEnv())
    .rule({
      id: 'eess/no-process-env',
      because: 'ansi.ts/environment.ts are the declared env boundary',
    }),

  // -- errors --
  src().should().satisfy(moduleNoSilentCatch()).rule({
    id: 'eess/no-silent-catch',
    because: 'every discarded error carries a written reason',
  }),

  // -- ADR-005: first mechanical enforcement of the as/non-null ban --
  src().should().satisfy(moduleNoTypeAssertions()).rule({
    id: 'eess/adr005-no-type-assertions',
    because: 'ADR-005: sanctioned boundaries use eess-exclude with a reason',
  }),
  src()
    .should()
    .satisfy(moduleNoNonNullAssertions())
    .rule({ id: 'eess/adr005-no-non-null', because: 'ADR-005' }),

  // -- hygiene --
  src()
    .excluding(...ENTRY_POINTS)
    .should()
    .satisfy(noDeadModules())
    .rule({
      id: 'eess/no-dead-modules',
      because: 'entry points are import-graph roots (exports map)',
    }),
  src()
    .excluding(GENERATED)
    .excluding(...ENTRY_POINTS)
    .should()
    .satisfy(noUnusedExports())
    .rule({
      id: 'eess/no-unused-exports',
      because: 'entry-point exports exist for consumers; internal ones must be used',
    }),
  srcFns().should().satisfy(noStubComments()).rule({ id: 'eess/no-stub-comments' }),
  srcFns().should().satisfy(noEmptyBodies()).rule({ id: 'eess/no-empty-bodies' }),

  // -- code quality --
  srcClasses().should().satisfy(requireJsDocOnPublicMethods()).rule({
    id: 'eess/jsdoc-on-public-methods',
    because: 'the fluent surface is what users hover in IDEs',
  }),
  // No `GENERATED` exclusion: it went vacuous when `noPublicFields` stopped
  // reporting `readonly` and `#private` fields (plan 0165 — both were false
  // positives), and this repo's own unused-exclusion detector said so. A stale
  // carve-out reads as "generated code violates this" when it no longer does.
  srcClasses().should().satisfy(noPublicFields()).rule({
    id: 'eess/no-public-fields',
    because: "a public mutable field is someone else's invariant to break",
  }),
  srcClasses().should().satisfy(noMagicNumbers()).rule({ id: 'eess/no-magic-numbers' }),

  // -- metrics (builders + the two kernel grammar-base classes excluded per ADR-003: wide
  // fluent surfaces are the design). Plan 0088 Phase 4 folded RuleBuilder's terminal methods
  // (because/rule/excluding/check/warn/severity/copy) up into TerminalBuilder, and RuleBuilder
  // dropped back under both thresholds — this comment used to say it no longer needed the
  // exclusion.
  //
  // **Bug 0155 put it back over, and the exclusion is deliberate rather than a lowered bar.**
  // The assertion gate needs `assertsSomething()`/`assertionAdvice()` as OVERRIDABLE hooks —
  // that is how each builder family carries its own remedy — so they cannot be hoisted out
  // of the class the way the advice text itself was (`core/src/assertion-advice.ts`). The
  // thresholds are eess's own hygiene heuristic, not upstream's; a false green outranks a
  // class-size smell, so the gate lands and the split is owed.
  //
  // **The refactor is owed, not waived:** [bug 0164](./work/bugs/0164-rulebuilder-carries-the-assertion-gate-and-exceeds-its-own-size-rules.md).
  // Raising 300/20 globally was rejected — that lowers the bar for every class to
  // accommodate one.
  srcClasses().should().satisfy(maxCyclomaticComplexity(10)).rule({ id: 'eess/max-complexity' }),
  // **The thresholds are the honest unit conversion, and the gate is RED because
  // of it.** `linesOfCode` counting code rather than span made 300 and 50 about
  // twice as lax as they read: measured, the median class here carries 0.50 code
  // lines per span line, so `maxClassLines(300)` had quietly become "600 span
  // lines". Converting the unit preserves the bar that was intended; CHANGING
  // the strictness is a separate decision nobody made.
  //
  // A previous pass set 250/35 and called that "re-derived". It was not — 250
  // was chosen because it fired on nothing new, which is fitting the bar to the
  // code. 150/30 is what the conversion actually gives.
  //
  // Eleven of the thirteen findings that produced were FIXED, not waived: three
  // oversized methods split, and six classes split by concern — `Baseline`
  // 171->103, `DuplicateBodiesBuilder` 168->130, `InconsistentSiblingsBuilder`
  // 204->142, `CorrespondenceBuilder` 336->145, `SliceRuleBuilder` 237->137,
  // `RuleBuilder` 218->148.
  //
  // **The two that remain are real and are left red on purpose.** Both
  // `TerminalBuilder`s (372 in the dialect, 215 in the kernel) cannot reach 150
  // by extraction, and that is measured rather than assumed: the non-diagnosis
  // methods alone — the DSL and the terminals, check/warn/violations/severity/
  // excluding — sum to 189 code lines. Lifting out every piece of vacuity
  // machinery still leaves the class over. It needs the terminals split from the
  // declaration surface, which is the architectural change bug 0164 owns and
  // which plan 0165 records as waiting on the kernel project-abstraction ADR.
  //
  // No carve-out for them. A threshold this file can only satisfy by exempting
  // its own base class has stopped measuring anything, and the exemption would
  // outlive the memory of why it was added.
  //
  // `GENERATED` stays on the class rule: `MermaidUnitAstReflection` is langium
  // output, already excluded from `eess/no-unused-exports` for the same reason.
  srcClasses().excluding(GENERATED).should().satisfy(maxClassLines(150)).rule({
    id: 'eess/max-class-lines',
    because: 'a class past 150 lines of code is carrying more than one job',
  }),
  // No exclusions. Every one of the four methods this rule used to report —
  // `TerminalBuilder.collectWithAssertionGuard` (15 code / 61 span),
  // `Baseline.unmatchedBaselineFinding` (37/56),
  // `DuplicateBodiesBuilder.buildViolations` (32/54) and
  // `InconsistentSiblingsBuilder.detect` (27/61) — was under the threshold on
  // code and over it only on comment lines. Bug 0170 removed the cause, so the
  // whole carve-out list went with it.
  //
  // That also retires the live instance of
  // [bug 0167](./work/bugs/0167-method-size-rules-can-only-be-excluded-by-class.md):
  // a method-size exclusion can still only be spelled per CLASS, but this rule no
  // longer has one, so no class is unwatched on its account today.
  srcClasses().should().satisfy(maxMethodLines(30)).rule({
    id: 'eess/max-method-lines',
    because: 'a method past 30 lines of code is doing more than one thing',
  }),
  // Method COUNT, which bug 0170 does not touch — a fluent builder really does
  // carry 20+ methods, and ADR-003 makes that surface the design.
  //
  // Named by CLASS, not by folder. `/src/builders/` exempted the directory, so a
  // non-builder class added there inherited the exemption silently; these are the
  // nine fluent builders that actually exceed 20, and anything else in those
  // files is still watched.
  srcClasses()
    .excluding(
      /^(ClassRuleBuilder|FunctionRuleBuilder|ModuleRuleBuilder|SliceRuleBuilder|TypeRuleBuilder|SchemaRuleBuilder|CorrespondenceBuilder|RuleBuilder|TerminalBuilder)$/,
    )
    .should()
    .satisfy(maxMethods(20))
    .rule({
      id: 'eess/max-methods',
      because: 'ADR-003: builder method surfaces are the DSL, not a smell',
    }),
  srcClasses().should().satisfy(maxParameters(4)).rule({ id: 'eess/max-parameters' }),
]

export default rules
