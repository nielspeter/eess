/**
 * A preset that constructs nothing says so, and the aggregating path agrees with
 * the emitter — bugs [0190](../../../../work/bugs/fixed/0190-the-preset-constructs-nothing-finding-cannot-fire.md),
 * [0206](../../../../work/bugs/fixed/0206-deliver-bypasses-the-kernel-finisher-on-the-default-path.md)
 * and [0261](../../../../work/bugs/fixed/0261-an-all-off-preset-returns-neither-a-finding-nor-a-declaration.md),
 * closed by plan 0235 rather than by a guard of their own.
 *
 * **Why these live together.** All three are the same seam seen from three
 * sides: 0190 is a finding with no producer, 0261 is a producer with no
 * finding, and 0206 is a door that bypasses the producer entirely. The receipt
 * contract answers all three at once, so one file pins it or nothing does.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { Project } from 'ts-morph'
import path from 'node:path'
import { ArchRuleError, EMITTER_PASS_WITHOUT_EVIDENCE } from '@nielspeter/eess'
import type { ArchProject } from '../../src/core/project.js'
import { recommended, layeredArchitecture } from '../../src/presets/index.js'
import { withCallerAggregating } from '../../src/core/execute-rule.js'

afterEach(() => vi.restoreAllMocks())

// A tsconfig-backed fixture, not an in-memory project: the preset's own path
// helpers read `tsConfigPath`, so an in-memory one throws before a rule runs —
// and would have made every CONTROL here pass for the wrong reason.
const tsconfigPath = path.resolve(
  import.meta.dirname,
  '../fixtures/presets/recommended/tsconfig.json',
)
const project = (): ArchProject => {
  const tsMorphProject = new Project({ tsConfigFilePath: tsconfigPath })
  return {
    tsConfigPath: tsconfigPath,
    _project: tsMorphProject,
    getSourceFiles: () => tsMorphProject.getSourceFiles(),
  }
}

const ids = (vs: readonly { ruleId?: string }[]): (string | undefined)[] => vs.map((v) => v.ruleId)

const ALL_OFF_RECOMMENDED = {
  'preset/recommended/no-eval': 'off',
  'preset/recommended/no-function-constructor': 'off',
  'preset/recommended/no-silent-catch': 'off',
  'preset/recommended/no-empty-bodies': 'off',
} as const

describe('a preset that constructed nothing (bugs 0190, 0261)', () => {
  it('recommended() with every rule off reports, instead of returning a silent []', () => {
    // Bug 0261's measurement, inverted into a guard. Before plan 0235 this
    // returned `[]`: the flagship dialect's flagship preset could be switched
    // off entirely and every gate reported it healthy.
    const out = recommended(project(), {
      report: 'return',
      overrides: { ...ALL_OFF_RECOMMENDED },
    })
    expect(ids(out)).toContain(EMITTER_PASS_WITHOUT_EVIDENCE)
    expect(out.examined).toBe(0)
  })

  it('layeredArchitecture() with every rule off reports too', () => {
    const out = layeredArchitecture(project(), {
      layers: { outer: 'src/outer/**', inner: 'src/inner/**' },
      report: 'return',
      overrides: {
        'preset/layered/layer-order': 'off',
        'preset/layered/no-cycles': 'off',
        'preset/layered/innermost-isolation': 'off',
        'preset/layered/type-imports-only': 'off',
        'preset/layered/restricted-packages': 'off',
      },
    })
    expect(ids(out)).toContain(EMITTER_PASS_WITHOUT_EVIDENCE)
  })

  it('CONTROL — a preset that constructed rules and found nothing stays green', () => {
    // The direction that matters most: a guard which cannot stay quiet is a
    // guard people switch off. Identity, not a count, so an unrelated finding
    // arriving beside it would not silently satisfy this.
    const out = recommended(project(), { report: 'return' })
    expect(ids(out)).not.toContain(EMITTER_PASS_WITHOUT_EVIDENCE)
    expect(out.examined).toBeGreaterThan(0)
  })

  it('CONTROL — ONE rule off among others does not report; the preset still ran', () => {
    // `dispatchRule`'s `'off'` branch marks `notRun`, so an absent rule is not a
    // dead check. Without that distinction one disabled rule reddened a whole
    // preset whose others examined real files.
    const out = recommended(project(), {
      report: 'return',
      overrides: { 'preset/recommended/no-eval': 'off' },
    })
    expect(ids(out)).not.toContain(EMITTER_PASS_WITHOUT_EVIDENCE)
    expect(out.examined).toBeGreaterThan(0)
  })
})

describe("deliver()'s aggregating path agrees with the emitter (bug 0206)", () => {
  it('the receipt rides the throw, so an aggregating caller sees the evidence', async () => {
    // 0206's picked direction: the aggregating branch keeps throwing without
    // emitting, and the `ArchRuleError` carries the receipt with the finding
    // already in it. Before this, that branch bypassed `finishPreset` entirely,
    // so anything the finisher added was invisible to the CLI.
    const err = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    let thrown: unknown
    await withCallerAggregating(() => {
      try {
        recommended(project(), { overrides: { ...ALL_OFF_RECOMMENDED } })
      } catch (e) {
        thrown = e
      }
      return Promise.resolve(undefined)
    })
    expect(thrown).toBeInstanceOf(ArchRuleError)
    const violations = (thrown as ArchRuleError).violations
    expect(ids(violations)).toContain(EMITTER_PASS_WITHOUT_EVIDENCE)
    // Aggregating means the CALLER reports: the branch must not have emitted.
    expect(err).not.toHaveBeenCalled()
  })

  it('and the non-aggregating default reaches the same verdict', () => {
    // The two doors must agree. They disagreeing silently is what 0206 is about,
    // and asserting only one of them is how that went unnoticed.
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    let thrown: unknown
    try {
      recommended(project(), { overrides: { ...ALL_OFF_RECOMMENDED } })
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(ArchRuleError)
    expect(ids((thrown as ArchRuleError).violations)).toContain(EMITTER_PASS_WITHOUT_EVIDENCE)
  })
})
