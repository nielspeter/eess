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
  'packages/crossvalidate/tsconfig.build.json',
])

// A-priori exclusions (work/dogfood-coverage.md):
const GENERATED = /\/parser\/generated\// // generated Langium code — "fix the code" is meaningless
const ENV_ADAPTERS = /\/core\/src\/(ansi|environment)\.ts$/ // these modules ARE the env boundary
// Entry points = import-graph roots (the packages' exports+bin maps, verbatim):
const ENTRY_POINTS = [
  /\/core\/src\/index\.ts$/,
  /\/ts\/src\/(index|cli\/bin|presets\/index|graphql\/index)\.ts$/,
  /\/ts\/src\/rules\/(typescript|security|errors|naming|dependencies|code-quality|metrics|architecture|hygiene)\.ts$/,
  /\/mermaid\/src\/(index|cli\/bin)\.ts$/,
  /\/md\/src\/(index|rules\/(adr|ledger))\.ts$/,
  /\/crossvalidate\/src\/(mermaid-ts|md-ts|md-mermaid|files)\.ts$/,
]

const src = () => modules(p).that().resideInFolder('**/packages/*/src/**')
const srcClasses = () =>
  classes(p).that().resideInFolder('**/packages/*/src/**').excluding(GENERATED)
const srcFns = () => functions(p).that().resideInFolder('**/packages/*/src/**').excluding(GENERATED)

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
  src().excluding(GENERATED).should().satisfy(moduleNoSilentCatch()).rule({
    id: 'eess/no-silent-catch',
    because: 'every discarded error carries a written reason',
  }),

  // -- ADR-005: first mechanical enforcement of the as/non-null ban --
  src().excluding(GENERATED).should().satisfy(moduleNoTypeAssertions()).rule({
    id: 'eess/adr005-no-type-assertions',
    because: 'ADR-005: sanctioned boundaries use eess-exclude with a reason',
  }),
  src()
    .excluding(GENERATED)
    .should()
    .satisfy(moduleNoNonNullAssertions())
    .rule({ id: 'eess/adr005-no-non-null', because: 'ADR-005' }),

  // -- hygiene --
  src()
    .excluding(GENERATED)
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
  srcClasses().should().satisfy(noPublicFields()).rule({ id: 'eess/no-public-fields' }),
  srcClasses().should().satisfy(noMagicNumbers()).rule({ id: 'eess/no-magic-numbers' }),

  // -- metrics (builders + kernel RuleBuilder excluded per ADR-003: wide fluent surfaces are the design) --
  srcClasses().should().satisfy(maxCyclomaticComplexity(10)).rule({ id: 'eess/max-complexity' }),
  srcClasses()
    .excluding(/\/core\/src\/rule-builder\.ts$/)
    .should()
    .satisfy(maxClassLines(300))
    .rule({
      id: 'eess/max-class-lines',
      because: 'ADR-003: the kernel RuleBuilder is the fluent grammar base',
    }),
  srcClasses().should().satisfy(maxMethodLines(50)).rule({ id: 'eess/max-method-lines' }),
  srcClasses()
    .excluding(/\/builders\//)
    .excluding(/\/core\/src\/rule-builder\.ts$/)
    .should()
    .satisfy(maxMethods(20))
    .rule({
      id: 'eess/max-methods',
      because: 'ADR-003: builder method surfaces are the DSL, not a smell',
    }),
  srcClasses().should().satisfy(maxParameters(4)).rule({ id: 'eess/max-parameters' }),
]

export default rules
