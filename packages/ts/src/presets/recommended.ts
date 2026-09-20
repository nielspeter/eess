import type { CollectResult } from '@nielspeter/eess'
import type { ArchProject } from '../core/project.js'
import type { RuleMetadata } from '@nielspeter/eess'
import type { Condition } from '@nielspeter/eess'
import type { ArchFunction } from '../models/arch-function.js'
import type { SourceFile } from 'ts-morph'
import { functions } from '../builders/function-rule-builder.js'
import type { FunctionRuleBuilder } from '../builders/function-rule-builder.js'
import { modules } from '../builders/module-rule-builder.js'
import type { ModuleRuleBuilder } from '../builders/module-rule-builder.js'
import { moduleNoEval, moduleNoFunctionConstructor } from '../rules/security.js'
import { moduleNoSilentCatch } from '../rules/errors.js'
import { noEmptyBodies } from '../rules/hygiene.js'
import type { RuleBuilderLike } from '@nielspeter/eess'
import type { PresetBaseOptions } from './shared.js'
import {
  overrideFindings,
  validateOverrides,
  declareEmptyIfListed,
  presetDeclarationSpelling,
  declaredEmptyFindings,
  deliver,
} from './shared.js'

export interface RecommendedOptions extends PresetBaseOptions<RecommendedRuleId> {
  /**
   * Source-file glob the rules apply to. Defaults to `'**\/src/**'`, matched
   * against each file's absolute path (picomatch). This scopes the rules to your
   * source tree by convention — it does NOT itself exclude `node_modules` or
   * generated files (any `src/` segment anywhere in the path matches). Projects
   * whose source lives outside a `src/` folder (e.g. `lib/`) should override.
   * Note: because the match is on the absolute path, an ancestor directory named
   * `src` (e.g. a clone under `~/src/`) widens scope — anchor with a project-root
   * glob if that matters.
   */
  include?: string
}

/**
 * A floor rule, and the SUBJECT it reads (bug 0333).
 *
 * Every rule here was built with `functions()`, which reads a function's body — so the floor said
 * nothing about code outside one. Measured on a file holding eleven positions: only `eval` inside a
 * function was reported. A bare `eval('x')` at top level, one in a class's static block, one in a
 * field initializer and one in a callback handed to a call all passed the preset an adopter
 * installs, under a rule named `no-eval`.
 *
 * The subject kinds NEST — a module's search reads the whole file, a class's reads its members —
 * so running two of them for one rule id reports the same call twice. Each rule therefore reads
 * exactly one subject: the broadest its condition has a variant for. For the three that have a
 * module variant that is `modules()`; `no-empty-bodies` stays on `functions()`, because an empty
 * body is a fact about a function and has no meaning at module scope.
 */
type RuleSubject = 'module' | 'function'

interface RuleSpec {
  condition: Condition<SourceFile> | Condition<ArchFunction>
  subject: RuleSubject
  meta: RuleMetadata & { id: string }
  default: 'error' | 'warn'
}

/**
 * Single source of truth for the floor. `RULE_IDS` (for override validation) and
 * the builder loop both derive from this — add a rule here and nothing else
 * needs updating.
 */
const SPECS = [
  {
    condition: moduleNoEval(),
    subject: 'module',
    meta: {
      id: 'preset/recommended/no-eval',
      because: 'eval() executes arbitrary code — a code-injection risk',
      suggestion: 'remove eval(); parse or dispatch explicitly',
      imperative: 'Do NOT call eval()',
    },
    default: 'error',
  },
  {
    condition: moduleNoFunctionConstructor(),
    subject: 'module',
    meta: {
      id: 'preset/recommended/no-function-constructor',
      because: 'the Function constructor is eval() in disguise',
      suggestion: 'define the function directly instead of building it from a string',
      imperative: 'Do NOT use the Function constructor',
    },
    default: 'error',
  },
  {
    condition: moduleNoSilentCatch(),
    subject: 'module',
    meta: {
      id: 'preset/recommended/no-silent-catch',
      because: 'a silent catch hides failures',
      suggestion: 'handle or rethrow the caught error (reference it in the catch)',
      imperative: 'Do NOT swallow errors in an empty catch',
    },
    default: 'warn',
  },
  {
    condition: noEmptyBodies(),
    subject: 'function',
    meta: {
      id: 'preset/recommended/no-empty-bodies',
      because: 'an empty function body is usually an unfinished stub',
      suggestion: 'implement the body or remove the function',
      imperative: 'Do NOT leave a function body empty',
    },
    default: 'warn',
  },
] as const satisfies readonly RuleSpec[]

/**
 * The builder a spec reads its subject with (bug 0333), selected and narrowed in one place so the
 * loop below cannot pair a condition with the wrong one.
 *
 * `satisfy` is called on the concrete builder while its element type is still known — a single
 * `satisfy` after the branch would need the union, which no condition accepts.
 */
function builderFor(
  p: ArchProject,
  spec: (typeof SPECS)[number],
  include: string,
): ModuleRuleBuilder | FunctionRuleBuilder {
  if (spec.subject === 'module') {
    return modules(p).that().resideInFile(include).should().satisfy(spec.condition)
  }
  return functions(p, { includeObjectLiteralFunctions: true })
    .that()
    .resideInFile(include)
    .should()
    .satisfy(spec.condition)
}

/**
 * Derived from `SPECS`, never restated. A hand-written union is a second list
 * that drifts the moment a rule is added — which is the whole shape of
 * [bug 0157](../../../../work/bugs/fixed/0157-a-typo-in-a-preset-override-key-is-a-silent-false-green.md)
 * and of the census in plan 0078.
 */
type RecommendedRuleId = (typeof SPECS)[number]['meta']['id']

const RULE_IDS: readonly string[] = SPECS.map((s) => s.meta.id)

/**
 * A deliberately **thin, universal safety floor** for any TypeScript project —
 * the handful of things dangerous regardless of project shape that fire ~never
 * on healthy code. Not a full architecture: shape-specific rules (layer order,
 * cycles, delegation) are yours to add.
 *
 * Returns severity-carrying builders (the returning form), so spread it into a
 * rule file: `export default [...recommended(p)]`. The two `error` rules fail
 * the run; the two `warn` rules (silent-catch, empty-bodies) are reported but
 * never fail **when the rule works** — they have known, suppressible false
 * positives. A configuration finding (a rule that examined zero units, or whose
 * glob is dead) is `error` regardless of severity and fails the build: `'warn'`
 * grades violations, not a rule that cannot enforce anything.
 *
 * Overlaps `agentGuardrails` on empty bodies and `eval`. For agent-focused
 * projects prefer `agentGuardrails` alone, or override the duplicated ids to
 * `'off'` in one preset.
 */
/**
 * `report` names a delivery mode; omitting it returns the un-executed builders.
 *
 * Overloaded so the common call keeps its exact type — a bare union would make
 * every existing `.violations()` call site an error (26 test files, measured).
 *
 * **The reporting overload is declared FIRST, and that ordering is load-bearing.**
 * `Parameters<typeof preset>[1]` resolves to the LAST overload, and several tests
 * type their options helper that way; with the builder overload last, that helper
 * keeps the shape callers actually use. Overload resolution still picks the
 * reporting one for a call that names `report`, because it is the first match.
 */
export function recommended(
  p: ArchProject,
  options: RecommendedOptions & { report: 'builders' },
): RuleBuilderLike[]
export function recommended(p: ArchProject, options?: RecommendedOptions): CollectResult
export function recommended(
  p: ArchProject,
  options: RecommendedOptions = {},
): RuleBuilderLike[] | CollectResult {
  const include = options.include ?? '**/src/**'
  validateOverrides(options.overrides, RULE_IDS)
  const overrideProblems = overrideFindings(options.overrides, RULE_IDS)

  const builders: RuleBuilderLike[] = []
  const constructed: string[] = []
  for (const spec of SPECS) {
    const { meta, default: def } = spec
    const sev = options.overrides?.[meta.id] ?? def
    if (sev === 'off') continue
    constructed.push(meta.id)
    builders.push(
      // Plan 0089's carrier. Applied at construction so it reaches every rule
      // this preset builds, not only the ones routed through `collectRule`.
      declareEmptyIfListed(
        builderFor(p, spec, include)
          .rule({ ...meta, declarationSpelling: presetDeclarationSpelling(meta.id) })
          .asSeverity(sev),
        meta.id,
        options,
      ),
    )
  }

  // Unknown override keys FIRST: they say the configuration is wrong, which
  // the reader needs before any finding produced under it (bug 0038).
  // Unbound declarations sit with the unknown-override findings: both say the
  // configuration is wrong, which the reader needs before any finding produced
  // under it (bug 0038).
  return deliver(
    [...overrideProblems, ...declaredEmptyFindings(options.expectEmpty, constructed), ...builders],
    options,
  )
}
