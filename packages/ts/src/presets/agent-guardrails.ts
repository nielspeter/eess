import type { CollectResult } from '@nielspeter/eess'
import type { ArchProject } from '../core/project.js'
import type { RuleMetadata } from '@nielspeter/eess'
import { functions } from '../builders/function-rule-builder.js'
import type { FunctionRuleBuilder } from '../builders/function-rule-builder.js'
import { modules } from '../builders/module-rule-builder.js'
import type { ModuleRuleBuilder } from '../builders/module-rule-builder.js'
import { resideInFile } from '../predicates/identity.js'
import { not, or } from '../core/combinators.js'
import { isDeadSite } from '../core/glob-evaluator.js'
import { isProjectRelative } from '../core/project-relative.js'
import { pathUniverse } from '../core/path-universe.js'
import type { ArchViolation } from '@nielspeter/eess'
import { collectResult } from '@nielspeter/eess'
import { UNSUPPRESSABLE } from '@nielspeter/eess/internal'
import { call } from '../helpers/matchers.js'
import { functionNoGenericErrors } from '../rules/errors.js'
import { noStubComments, noEmptyBodies } from '../rules/hygiene.js'
import { smells } from '../smells/index.js'
import type { DuplicateBodiesBuilder } from '../smells/duplicate-bodies.js'
import type { RuleBuilderLike } from '@nielspeter/eess'
import type { PresetBaseOptions } from './shared.js'
import {
  overrideFindings,
  validateOverrides,
  declareEmptyIfListed,
  presetDeclarationSpelling,
  declaredEmptyFindings,
  assertEnabled,
  deliver,
} from './shared.js'
import type { RuleSeverity } from './shared.js'

/**
 * This preset's rule ids. The `no-inline-logic` arm is a **template literal**
 * because those ids are built from the caller's own `noInlineLogic` entries, so
 * the set is not closed. A typo in the API name is therefore still accepted by
 * the type — the runtime finding is what covers that arm.
 */
type AgentGuardrailsRuleId =
  | `preset/agent/no-inline-logic/${string}`
  | 'preset/agent/no-generic-errors'
  | 'preset/agent/no-stubs'
  | 'preset/agent/no-empty-bodies'
  | 'preset/agent/no-copy-paste'
  | 'preset/agent/no-verdict-outside-rules'

export interface AgentGuardrailsOptions extends PresetBaseOptions<AgentGuardrailsRuleId> {
  /** Glob for the source files the rules apply to. */
  src: string
  /** Banned call names — one rule generated per entry (e.g. `['parseInt', 'eval']`). */
  noInlineLogic?: string[]
  noGenericErrors?: boolean
  noStubs?: boolean
  noEmptyBodies?: boolean
  noCopyPaste?: boolean
  /**
   * Ban eess at runtime, and every emitter call, outside a file that is meant to
   * write a verdict — [plan 0237](../../../../work/plans/completed/0237-eess-runtime-use-only-in-rule-files.md),
   * reaching the two residuals ADR-014 states its own contract cannot.
   */
  noVerdictOutsideRules?: boolean
  /**
   * Where else eess may be used as a value. **Extends**
   * {@link DEFAULT_RULE_FILES} rather than replacing it, so an adopter naming
   * `scripts/**` does not thereby red every one of their rule files.
   *
   * A list, and ADR-009 rule 3's corollary is right to be wary of one — a marker
   * an agent can stamp to go green is worse than none. Two things make this one
   * honest. It lives in the preset's options, so stamping it is a visible line in
   * the config diff, exactly like `overrides`: a Tier 5 defence, review-enforced,
   * and named as such rather than dressed as a mechanism. And a file named here
   * is still under ADR-014 the moment it calls an emitter — the list decides
   * WHERE a verdict may be written, not whether it needs evidence.
   *
   * An entry matching no file is reported as
   * `preset/agent/rule-files-matches-nothing`, so the list cannot rot in silence.
   * An unanchored entry (`scripts/**`) is matched relative to the tsconfig root,
   * exactly as `resideInFile` does it — the check and the rule share one
   * derivation rather than two that can drift apart.
   */
  ruleFiles?: string[]
}

/**
 * The rule-file kinds exempt without the caller naming anything — proposal 009's
 * own list. `*.spec.ts` is here because an earlier draft of plan 0237 dropped it
 * with no reason given, and half the ecosystem names tests that way.
 */
const DEFAULT_RULE_FILES = ['**/*.rules.ts', '**/*.test.ts', '**/*.spec.ts']

/**
 * Every specifier shape, not only the bare package.
 *
 * Measured with picomatch before this list was written: `@nielspeter/eess` and
 * `@nielspeter/eess-*` alone match NONE of `@nielspeter/eess/internal`,
 * `@nielspeter/eess-ts/presets` or `@nielspeter/eess-md/rules/adr` — and those
 * subpath shapes are what real code imports, this repo's own guardrails script
 * included. An earlier draft shipped the two bare globs.
 */
const EESS_PACKAGES = [
  '@nielspeter/eess',
  '@nielspeter/eess/**',
  '@nielspeter/eess-*',
  '@nielspeter/eess-*/**',
]

/**
 * The emitters, anchored on the callee.
 *
 * `(^|\.)` so `import * as eess` followed by `eess.finishPreset(...)` is caught
 * — the consuming project that measured the field failure had exactly that
 * escape in its own first version of this rule. A RENAMED import
 * (`finishPreset as done`) escapes this leg and is caught by the import leg, so
 * the two conditions cover each other's blind spot.
 *
 * **The two legs cover each other for a STATIC renamed import, and NOT for a
 * dynamic one.** `import { finishPreset as done }` escapes this regex and is
 * caught by the import leg — asserted, not assumed. But
 * `const { finishPreset: done } = await import('@nielspeter/eess')` escapes
 * BOTH on one line: the import leg because `TYPE_IMPORT_KINDS` sets
 * `dynamic: false` by design, this one because the callee text is `done`. That
 * is [bug 0264](../../../../work/bugs/0264-a-dynamic-import-escapes-the-verdict-rule.md),
 * found by review, pinned by a KNOWN-GAP test, and named here rather than left
 * for the next reader to discover — an unstated ceiling reads as coverage.
 *
 * `dispatchRule` is deliberately absent: it is the sanctioned preset-authoring
 * call. That is not what spares a preset module, though — such a module imports
 * `dispatchRule` at runtime, so the import leg reds it whatever this regex says.
 * A preset module is a verdict file by definition and belongs in `ruleFiles`.
 *
 * `throwIfViolations` stays until it leaves the public surface (plan 0263
 * Phase 5); an adopter on an older kernel still has the alias, and a dead name
 * in a regex is harmless.
 */
const EMITTERS = /(^|\.)(finishPreset|reportViolations|throwIfViolations)$/

/**
 * Preset targeting the mistakes AI coding agents make most often — inline
 * logic, generic errors, stub comments, empty bodies, copy-paste.
 *
 * Returns severity-carrying builders (the returning form, plan 0060), so an
 * agent's rules file does `export default [...agentGuardrails(p, { ... })]` and
 * `eess-ts check --format json` surfaces every violation, including the
 * copy-paste **warn**. Each rule carries agent-facing `because` / `suggestion` /
 * `imperative` metadata so `explain --format agent` and the check JSON give the
 * agent an actionable fix.
 *
 * Uses function-variant rules so standalone functions, arrow functions, and
 * class methods are all covered.
 */
// Presets collect object-literal functions unconditionally. `functions()`
// keeps it opt-in because widening a selector the USER wrote silently changes
// their rule; a preset's subject set is the preset's own, and this one already
// promises "standalone functions, arrow functions, and class methods are all
// covered". A handler map — the shape agents generate most — was none of the
// three, so `{ POST: () => {} }` slipped every guardrail (bug 0013).
const COLLECT_ALL = { includeObjectLiteralFunctions: true } as const

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
export function agentGuardrails(
  p: ArchProject,
  options: AgentGuardrailsOptions & { report: 'builders' },
): RuleBuilderLike[]
export function agentGuardrails(p: ArchProject, options: AgentGuardrailsOptions): CollectResult
export function agentGuardrails(
  p: ArchProject,
  options: AgentGuardrailsOptions,
): RuleBuilderLike[] | CollectResult {
  // Plan 0100's `attempted`: the ids the caller's OPTIONS ask for, before any
  // override is consulted — every rule this preset can build sits behind an
  // optional flag, so this can legitimately be `[]` (nothing was ever enabled).
  // NOT what override validation uses below — see `knownOverrideIds`'s own doc.
  const attempted = collectRuleIds(options)
  const knownIds = knownOverrideIds(options)
  validateOverrides(options.overrides, knownIds)
  const overrideProblems = overrideFindings(options.overrides, knownIds)

  const builders: RuleBuilderLike[] = []
  // Recorded HERE, at the one place a rule is actually built — the same argument
  // `collectRule` makes for its `constructed` parameter ("the known-id list
  // cannot answer this"). Deriving it instead from `collectRuleIds()` filtered by
  // severity restates the construction conditionals a second time; the two agree
  // today only because they are kept in step by hand, and the first rule added to
  // one and not the other makes a declaration bind to a rule that was never built.
  const constructed: string[] = []
  const push = (
    builder: FunctionRuleBuilder | DuplicateBodiesBuilder | ModuleRuleBuilder,
    meta: RuleMetadata & { id: string },
    def: 'error' | 'warn',
  ): void => {
    const sev = lookup(options.overrides, meta.id) ?? def
    // Plan 0089's carrier, applied here as well as in `collectRule` — this
    // preset builds through its own helper, and a carrier that reached only the
    // shared path would cover the families someone remembered.
    if (sev !== 'off') {
      constructed.push(meta.id)
      builders.push(
        declareEmptyIfListed(
          builder
            .rule({ ...meta, declarationSpelling: presetDeclarationSpelling(meta.id) })
            .asSeverity(sev),
          meta.id,
          options,
        ),
      )
    }
  }

  for (const api of options.noInlineLogic ?? []) {
    push(
      functions(p, COLLECT_ALL).that().resideInFile(options.src).should().notContain(call(api)),
      {
        id: `preset/agent/no-inline-logic/${api}`,
        because: `${api} inline in a function is logic that belongs behind a named helper`,
        suggestion: `extract the ${api} call into a named helper function`,
        imperative: `Do NOT call ${api} inline — extract it behind a named helper`,
      },
      'error',
    )
  }

  if (options.noGenericErrors) {
    push(
      functions(p, COLLECT_ALL)
        .that()
        .resideInFile(options.src)
        .should()
        .satisfy(functionNoGenericErrors()),
      {
        id: 'preset/agent/no-generic-errors',
        because: 'a generic Error loses the type/context callers need to handle it',
        suggestion: 'throw a domain-specific error (NotFoundError, ValidationError, …)',
        imperative: 'Do NOT throw new Error() — throw a domain-specific error class',
      },
      'error',
    )
  }

  if (options.noStubs) {
    push(
      functions(p, COLLECT_ALL).that().resideInFile(options.src).should().satisfy(noStubComments()),
      {
        id: 'preset/agent/no-stubs',
        because: 'stub comments (TODO/FIXME/"not implemented") ship unfinished work',
        suggestion: 'implement the body or remove the stub before committing',
        imperative: 'Do NOT leave stub comments (TODO/FIXME/"not implemented") in a function body',
      },
      'error',
    )
  }

  if (options.noEmptyBodies) {
    push(
      functions(p, COLLECT_ALL).that().resideInFile(options.src).should().satisfy(noEmptyBodies()),
      {
        id: 'preset/agent/no-empty-bodies',
        because: 'an empty function body is almost always an unfinished stub',
        suggestion: 'implement the body — every function must have at least one statement',
        imperative: 'Do NOT leave a function body empty',
      },
      'error',
    )
  }

  if (options.noCopyPaste) {
    push(
      smells.duplicateBodies(p).withMinSimilarity(0.9),
      {
        id: 'preset/agent/no-copy-paste',
        because: 'near-identical bodies are copy-paste instead of reuse',
        suggestion: 'extract the shared logic into one function',
        imperative: 'Do NOT duplicate a function body — extract the shared logic',
      },
      'warn',
    )
  }

  if (options.noVerdictOutsideRules) {
    // The exemption EXTENDS the default; an adopter naming `scripts/**` must not
    // lose `*.rules.ts` by doing so.
    const ruleFiles = [...DEFAULT_RULE_FILES, ...(options.ruleFiles ?? [])]
    push(
      modules(p)
        .that()
        .resideInFile(options.src)
        .and()
        // `not(or(...))` rather than a `notResideInFile` the builder does not
        // have. Both combinators compose the globs their inputs declare, so the
        // exclusion is a declared site rather than an opaque one — it just is
        // not a site the dead-glob pipeline will ever call a fault, which is
        // what `ruleFilesFindings` below exists for.
        .satisfy(not(or(...ruleFiles.map((glob) => resideInFile(glob)))))
        .should()
        .onlyHaveTypeImportsFrom(...EESS_PACKAGES)
        .andShould()
        .notContain(call(EMITTERS)),
      {
        id: 'preset/agent/no-verdict-outside-rules',
        because:
          'outside a rule file nothing counts what was examined, so a pass there is a claim with ' +
          'no evidence — a loop that skips every item looks identical to one that checked them all',
        // The remedy must NOT lead with "move it into a *.rules.ts file": the
        // same hand-written loop moved there is inside the exemption and green,
        // so an agent following that Fix line would un-detect the problem rather
        // than remediate it (ADR-009 rule 2).
        suggestion:
          'express the check as a Condition and reach the verdict through a builder (.check(), or ' +
          'a preset), so the evidence floor sees it; moving the same loop into a *.rules.ts file ' +
          'hides it, it does not fix it. If this module is a gate script that finishes through an ' +
          'emitter, name it in ruleFiles',
        imperative:
          'Do NOT import eess as a value (only `import type`), or call ' +
          'finishPreset/reportViolations, outside a rule file, a test, or a file listed in ' +
          'ruleFiles — and inside one, reach the verdict through a builder, never a hand-written ' +
          'loop: a green built by hand certifies nothing',
      },
      'error',
    )
  }

  // Unknown override keys FIRST: they say the configuration is wrong, which
  // the reader needs before any finding produced under it (bug 0038).
  // `constructed` is recorded at the `push` site above, not re-derived here.
  const otherFindings = [
    ...overrideProblems,
    ...declaredEmptyFindings(options.expectEmpty, constructed),
    ...ruleFilesFindings(p, options),
  ]
  return deliver(
    [
      ...otherFindings,
      // Plan 0100, LAST of the config-findings: only when nothing else above
      // already explains the empty result (an unknown override key, an unbound
      // `expectEmpty`) does "no rule was ever enabled" get to be the diagnosis.
      ...assertEnabled(attempted, otherFindings, {
        id: 'preset/agent/constructs-nothing',
        presetName: 'agentGuardrails',
        optionsHint:
          'noInlineLogic, noGenericErrors, noStubs, noEmptyBodies, noCopyPaste, noVerdictOutsideRules',
      }),
      ...builders,
    ],
    options,
  )
}

/**
 * Widen the typed override map for a lookup by a runtime-built id.
 *
 * `no-inline-logic/${api}` ids are constructed from the caller's own options, so
 * the key here is a `string` and the map is keyed by a literal union. The
 * widening is confined to this one function rather than loosening the option
 * type, which is what makes the typo a compile error for every other key.
 */
function lookup(
  overrides: Partial<Record<AgentGuardrailsRuleId, RuleSeverity>> | undefined,
  id: string,
): RuleSeverity | undefined {
  const widened: Partial<Record<string, RuleSeverity>> | undefined = overrides
  return widened?.[id]
}

/**
 * The four ids this preset can construct regardless of whether their flag is
 * currently set — fixed, matching `AgentGuardrailsRuleId`'s own closed union
 * members (everything but the open `no-inline-logic/${string}` arm).
 */
const STATIC_RULE_IDS = [
  'preset/agent/no-generic-errors',
  'preset/agent/no-stubs',
  'preset/agent/no-empty-bodies',
  'preset/agent/no-copy-paste',
  'preset/agent/no-verdict-outside-rules',
] as const

/**
 * Rule ids the given options WOULD generate if every flag were on — for
 * override-key validation. Static ids are always known (a key for a rule not
 * yet enabled is still a real rule, not a typo); `no-inline-logic/${api}` ids
 * stay scoped to what `noInlineLogic` actually named, because that arm is open
 * by construction and the only way to catch a typo in it is to compare against
 * what the caller wrote.
 *
 * Deliberately NOT `attempted` below, which is flag-gated. Reusing `attempted`
 * here was the bug plan 0100's review found: `overrides: { 'preset/agent/no-
 * generic-errors': 'off' } }` with `noGenericErrors` unset reported "matches no
 * rule in this preset" with an EMPTY enumeration — a real, correctly-spelled id
 * misdiagnosed as unknown, and `otherFindings.length > 0` from that wrong
 * finding then silently suppressed the correct `constructs-nothing` finding
 * `assertEnabled` would otherwise have reported. `dataLayerIsolation` never had
 * this bug: it already validates against the full static `RULE_IDS`, not its
 * flag-gated `attempted`.
 */
function knownOverrideIds(options: AgentGuardrailsOptions): string[] {
  const ids: string[] = [...STATIC_RULE_IDS]
  for (const api of options.noInlineLogic ?? []) ids.push(`preset/agent/no-inline-logic/${api}`)
  return ids
}

/**
 * Ids plan 0100's `attempted` needs: the ones the caller's OPTIONS actually
 * ask for, flag-gated — `assertEnabled` fires when this is empty. NOT for
 * override validation; see {@link knownOverrideIds}.
 *
 * Kept in step with the five `if (options.x)` blocks in `agentGuardrails`
 * itself BY HAND — same shape of fragility this file already notes for
 * `constructed` (review: nothing enforces the two stay copy-identical as
 * flags are added).
 */
function collectRuleIds(options: AgentGuardrailsOptions): string[] {
  const ids: string[] = []
  for (const api of options.noInlineLogic ?? []) ids.push(`preset/agent/no-inline-logic/${api}`)
  if (options.noGenericErrors) ids.push('preset/agent/no-generic-errors')
  if (options.noStubs) ids.push('preset/agent/no-stubs')
  if (options.noEmptyBodies) ids.push('preset/agent/no-empty-bodies')
  if (options.noCopyPaste) ids.push('preset/agent/no-copy-paste')
  if (options.noVerdictOutsideRules) ids.push('preset/agent/no-verdict-outside-rules')
  return ids
}

/**
 * A `ruleFiles` entry that matches no file in the project.
 *
 * **Why this is its own check and not the dead-glob pipeline** — plan 0237's
 * build finding. The exclusion is `not(or(...))`, and `isDeadSite` opens with
 * `if ((site.polarity ?? 'positive') === 'negative') return false`, because
 * `not(dead)` over-selects rather than under-selecting. Exclusion sites are
 * never faults either: "a condition glob matching nothing is indistinguishable
 * from an armed tripwire that has not fired". Both decisions are correct and
 * neither is weakened here.
 *
 * So the question is asked differently: `isDeadSite` about each caller-supplied
 * glob **on its own, at positive polarity**. Same computation, same
 * `syntacticFault` anchoring — so this check and `doctor`'s pre-flight cannot
 * disagree about what matches nothing.
 *
 * **Only the caller's entries.** {@link DEFAULT_RULE_FILES} is never reported: a
 * project with no `*.spec.ts` is ordinary, the defaults are not the caller's to
 * fix, and reporting them would red the preset out of the box.
 *
 * The finding is legibility, not a hole, and says so. A dead entry is already
 * fail-CLOSED — an exemption that exempts nothing reds the files it names rather
 * than going quiet. What it prevents is the loop: without it a typo surfaces as
 * "your gate script violates no-verdict-outside-rules", whose remedy says "name
 * it in ruleFiles", which the adopter did — with a typo.
 */
function ruleFilesFindings(p: ArchProject, options: AgentGuardrailsOptions): RuleBuilderLike[] {
  if (options.noVerdictOutsideRules !== true) return []
  const declared = options.ruleFiles ?? []
  if (declared.length === 0) return []

  const universe = pathUniverse(p)
  // Asked at POSITIVE polarity and `position: 'discovery'`, deliberately. In the
  // rule this same glob sits negated inside an exclusion, where `isDeadSite`
  // answers `false` by design (twice over). Here the question is the honest one:
  // "does this glob, by itself, match anything?"
  //
  // **`base` is DERIVED, not hard-coded, and that is the whole correctness of
  // this check.** An architect review measured what a hard-coded
  // `base: 'absolute'` did: `ruleFiles: ['gates/**']` genuinely exempted
  // `gates/check-corpus.ts` — `resideInFile` falls back to matching the path
  // relative to the tsconfig root for an unanchored glob (plan 0067 C) — while
  // this producer reported "matches no file in this project, so it exempts
  // nothing" about the same string. Both in one run. That is two derivations
  // disagreeing about one glob, which is the failure this project spends most
  // of its guards on, and the remedy it printed told the adopter to WIDEN a
  // correctly-scoped exemption to silence a finding that was wrong.
  //
  // So the derivation is `resideInFile`'s own, taken from the same helper:
  // every other site that stamps a `GlobSite` does `relative ? 'normalized' :
  // 'absolute'` (`identity.ts:83`, `:114`, `:157`), and this one now does too.
  const dead = declared.filter((glob) =>
    isDeadSite(
      {
        glob,
        kind: 'file-path',
        base: isProjectRelative(glob) ? 'normalized' : 'absolute',
        position: 'discovery',
        origin: `ruleFiles entry "${glob}"`,
      },
      universe,
    ),
  )
  if (dead.length === 0) return []

  const violations: ArchViolation[] = dead.map((glob) => ({
    rule: `preset ruleFiles '${glob}'`,
    ruleId: 'preset/agent/rule-files-matches-nothing',
    element: glob,
    file: '',
    line: 0,
    message: `ruleFiles entry '${glob}' matches no file in this project, so it exempts nothing.`,
    because:
      'an exemption that exempts nothing is not a weaker exemption, it is a typo — and the rule ' +
      'it was meant to quiet will red the very files the entry names, sending the reader back to ' +
      'a list that already says what they meant',
    suggestion:
      `Correct the glob or remove it. An unanchored glob like 'scripts/**' is matched ` +
      `against the path relative to your tsconfig root, so it is already correct for a ` +
      `top-level directory; '**/scripts/**' matches one at any depth. Check the spelling ` +
      `and the depth before widening. ` +
      UNSUPPRESSABLE,
    bypassFilters: true,
  }))
  // `examined: 0` and honest: a CONFIGURATION finding, not a rule that examined
  // units. The receipt carries a violation, so ADR-014 §4 passes it through.
  return [{ violations: () => collectResult(violations, { examined: 0 }) }]
}
