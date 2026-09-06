/**
 * `preset/agent/no-verdict-outside-rules` —
 * [plan 0237](../../../../work/plans/0237-eess-runtime-use-only-in-rule-files.md),
 * reaching the two residuals
 * [ADR-014](../../../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)
 * states it cannot: a caller who sums receipts by hand, and one who never calls
 * an emitter at all.
 *
 * **RED FIRST.** Written against the option Phase 2 adds; until it lands these
 * do not compile, which is the intended red.
 *
 * **Each condition is isolated by a fixture only it can red** — ADR-009 rule 5.
 * `runtime-import.ts` trips the import leg with no emitter call; `wrapper-call.ts`
 * trips the call leg with a type-only import. A pair of fixtures that both
 * conditions catch would stay green if either condition were deleted, which is
 * the discrimination failure the sabotage matrix exists to find.
 *
 * Every assertion is keyed on the **file** a violation names, never on a count:
 * a module that trips both conditions reports twice, so a count assertion turns
 * a discrimination question into an arithmetic one.
 */
import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import path from 'node:path'
import type { ArchProject } from '../../src/core/project.js'
import { agentGuardrails } from '../../src/presets/agent-guardrails.js'
import type { ArchViolation } from '@nielspeter/eess'

const fixturesDir = path.resolve(
  import.meta.dirname,
  '../fixtures/presets/no-verdict-outside-rules',
)
const tsconfigPath = path.join(fixturesDir, 'tsconfig.json')

function loadTestProject(): ArchProject {
  const tsMorphProject = new Project({ tsConfigFilePath: tsconfigPath })
  return {
    tsConfigPath: tsconfigPath,
    _project: tsMorphProject,
    getSourceFiles: () => tsMorphProject.getSourceFiles(),
  }
}

const RULE = 'preset/agent/no-verdict-outside-rules'
const DEAD_ENTRY = 'preset/agent/rule-files-matches-nothing'

/** Run the rule alone, and hand back what it reported. */
function run(options: { ruleFiles?: string[] } = {}): ArchViolation[] {
  return [
    ...agentGuardrails(loadTestProject(), {
      src: '**/*.ts',
      noVerdictOutsideRules: true,
      report: 'return',
      ...options,
    }),
  ]
}

/** The basenames this rule flagged — identity, not arithmetic. */
function flagged(violations: readonly ArchViolation[], ruleId = RULE): string[] {
  return [
    ...new Set(
      violations.filter((v) => v.ruleId === ruleId).map((v) => path.basename(v.file ?? '')),
    ),
  ].sort()
}

/** The gate script is named, so only the "walked around the pipeline" shapes red. */
const NAMES_THE_GATE = { ruleFiles: ['**/gates/**', '**/local-preset.ts'] }

describe('the two conditions each catch what the other cannot', () => {
  it('reds a runtime import of a dialect, with no emitter call anywhere', () => {
    // The import leg alone. Delete `onlyHaveTypeImportsFrom` and only this fails.
    expect(flagged(run(NAMES_THE_GATE))).toContain('runtime-import.ts')
  })

  it('reds an emitter call reached through a local wrapper, under a type-only import', () => {
    // The call leg alone. The specifier globs cannot see this one: the only eess
    // import is `import type`, and `finishPreset` arrives from a local module.
    expect(flagged(run(NAMES_THE_GATE))).toContain('wrapper-call.ts')
  })

  it('reds a namespaced emitter call — the anchor, not a bare name match', () => {
    // `import * as eess` then `eess.finishPreset(...)`. The consuming project
    // that measured the field failure had this exact escape in its first version.
    expect(flagged(run(NAMES_THE_GATE))).toContain('namespace-call.ts')
  })
})

describe('every specifier shape, not only the bare package', () => {
  // An earlier draft used `@nielspeter/eess` and `@nielspeter/eess-*` alone.
  // Measured with picomatch: those match NONE of the three below, and the
  // subpath shapes are the ones real code uses.
  it.each([
    ['@nielspeter/eess/internal', 'specifier-internal.ts'],
    ['@nielspeter/eess-ts/presets', 'specifier-ts-presets.ts'],
    ['@nielspeter/eess-md/rules/adr', 'specifier-md-rules.ts'],
  ])('reds a runtime import from %s', (_specifier, file) => {
    expect(flagged(run(NAMES_THE_GATE))).toContain(file)
  })
})

describe('the exempted kinds stay green', () => {
  it.each([['corpus.rules.ts'], ['corpus.test.ts'], ['corpus.spec.ts']])(
    'does not red %s, which does the same thing in an exempt file',
    (file) => {
      expect(flagged(run(NAMES_THE_GATE))).not.toContain(file)
    },
  )

  it('does not red a gate script the caller named in ruleFiles', () => {
    expect(flagged(run(NAMES_THE_GATE))).not.toContain('check-corpus.ts')
  })

  it('DOES red that same gate script when it is not named — the exemption is load-bearing', () => {
    // Without this, "green" above could mean the rule never looked at it.
    expect(flagged(run({ ruleFiles: ['**/local-preset.ts'] }))).toContain('check-corpus.ts')
  })

  it('a declared preset module calling dispatchRule is green (narrowing 1, asserted)', () => {
    // Keeping `dispatchRule` off the call regex is not what spares this module —
    // it imports `dispatchRule` at RUNTIME, so the import leg would red it
    // whatever the regex says. A preset module is a verdict file by definition
    // and belongs in `ruleFiles`. The plan says so; this asserts it.
    expect(flagged(run(NAMES_THE_GATE))).not.toContain('local-preset.ts')
  })
})

describe('ruleFiles is a declared list, and a dead entry says so', () => {
  // Corrected at build: the plan said the dead-glob pipeline would cover this.
  // It cannot — `isDeadSite` returns false for negative polarity, and exclusion
  // sites are never faults. So this is its own check, asking `isDeadSite` about
  // each glob on its own at positive polarity.
  it('reds an entry that matches no file in the project', () => {
    const v = run({ ruleFiles: ['**/gates/**', '**/scriptz/**'] })
    expect(v.map((x) => x.ruleId)).toContain(DEAD_ENTRY)
  })

  it('names the offending glob, because which entry is wrong is the whole fix', () => {
    const v = run({ ruleFiles: ['**/gates/**', '**/scriptz/**'] })
    const found = v.find((x) => x.ruleId === DEAD_ENTRY)
    expect(found?.message).toContain('**/scriptz/**')
    expect(found?.message).not.toContain('**/gates/**')
  })

  it('CONTROL — every entry matching something reports nothing', () => {
    // Without this the check above is satisfied by a finding that always fires.
    const v = run(NAMES_THE_GATE)
    expect(v.map((x) => x.ruleId)).not.toContain(DEAD_ENTRY)
  })

  it('applying the remedy CLEARS it — the same entry, corrected', () => {
    // ADR-009 rule 2's behavioural corollary, and what the config-finding census
    // requires before this producer can be called verified: not "a finding
    // fires" but "the remedy the message states makes it stop". The message
    // says a bare directory name needs a leading `**/`; this does exactly that
    // to the SAME entry, rather than swapping in a different options object.
    const typo = run({ ruleFiles: ['gates/**'] })
    expect(typo.map((x) => x.ruleId)).toContain(DEAD_ENTRY)

    const corrected = run({ ruleFiles: ['**/gates/**'] })
    expect(corrected.map((x) => x.ruleId)).not.toContain(DEAD_ENTRY)
  })

  it('CONTROL — the default list alone is never reported', () => {
    // The defaults are not the caller's to fix, and a project with no *.spec.ts
    // is normal. Reporting them would make the rule unusable out of the box.
    const v = run()
    expect(v.map((x) => x.ruleId)).not.toContain(DEAD_ENTRY)
  })
})

describe('the option joins the preset properly (the four by-hand lists)', () => {
  it('accepts its overrides key rather than calling it unknown', () => {
    // `STATIC_RULE_IDS` feeds `knownOverrideIds`. Miss it and a correct,
    // correctly-spelled id is reported as "matches no rule in this preset".
    const v = [
      ...agentGuardrails(loadTestProject(), {
        src: '**/*.ts',
        noVerdictOutsideRules: true,
        overrides: { [RULE]: 'off' },
        report: 'return',
      }),
    ]
    expect(v.map((x) => x.ruleId)).not.toContain('preset/agent/unknown-override')
    expect(v.map((x) => x.ruleId)).not.toContain(RULE)
  })

  it('a preset enabling only this rule does not fire constructs-nothing on itself', () => {
    // `collectRuleIds` feeds `attempted`. Miss it and enabling only this flag
    // makes the preset report that nothing was enabled.
    const v = run(NAMES_THE_GATE)
    expect(v.map((x) => x.ruleId)).not.toContain('preset/agent/constructs-nothing')
  })

  it('the constructs-nothing remedy lists the new flag among the ones to set', () => {
    // `optionsHint` is that finding's list of flags. An omitted flag makes the
    // remedy incomplete for the rule this plan adds.
    const v = [...agentGuardrails(loadTestProject(), { src: '**/*.ts', report: 'return' })]
    const found = v.find((x) => x.ruleId === 'preset/agent/constructs-nothing')
    expect(found?.suggestion).toContain('noVerdictOutsideRules')
  })
})
