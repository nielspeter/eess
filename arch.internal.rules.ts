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
  srcClasses().excluding(GENERATED).should().satisfy(noPublicFields()).rule({
    id: 'eess/no-public-fields',
    because: 'generated Langium classes expose public fields by design',
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
  srcClasses()
    .excluding(/\/core\/src\/(terminal-builder|rule-builder)\.ts$/)
    .should()
    .satisfy(maxClassLines(300))
    .rule({
      id: 'eess/max-class-lines',
      because:
        'ADR-003: the kernel grammar-base classes are the fluent surface; RuleBuilder also ' +
        'carries bug 0155s assertion gate as overridable hooks (see bug 0164)',
    }),
  srcClasses().should().satisfy(maxMethodLines(50)).rule({ id: 'eess/max-method-lines' }),
  srcClasses()
    .excluding(/\/builders\/|\/core\/src\/rule-builder\.ts$/)
    .should()
    .satisfy(maxMethods(20))
    .rule({
      id: 'eess/max-methods',
      because: 'ADR-003: builder method surfaces are the DSL, not a smell',
    }),
  srcClasses().should().satisfy(maxParameters(4)).rule({ id: 'eess/max-parameters' }),
]

export default rules
