import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import type { ArchViolation } from '@nielspeter/eess'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  hashViolation,
  generateBaseline,
  withBaseline,
  Baseline,
} from '../../src/helpers/baseline.js'
import type { BaselineFile } from '../../src/helpers/baseline.js'
import { makeViolation } from '../support/test-rule-builder.js'

// --- Helpers ---

/** Shorthand with baseline-test defaults. */
function mv(overrides: Partial<Parameters<typeof makeViolation>[0]> = {}) {
  return makeViolation({
    element: 'ProductService',
    rule: 'should not contain call to parseInt',
    file: '/project/src/services/product.ts',
    line: 42,
    message: 'contains call to parseInt',
    ...overrides,
  })
}

let tmpDir: string | undefined

function createTmpDir(): string {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-archunit-baseline-'))
  return tmpDir
}

afterEach(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true })
    tmpDir = undefined
  }
})

describe('hashViolation', () => {
  it('produces consistent hashes for the same violation', () => {
    const v = mv()
    const hash1 = hashViolation(v)
    const hash2 = hashViolation(v)
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(16)
  })

  it('produces different hashes for different violations', () => {
    const v1 = mv({ element: 'ProductService' })
    const v2 = mv({ element: 'OrderService' })
    expect(hashViolation(v1)).not.toBe(hashViolation(v2))
  })

  it('survives line number change (same hash)', () => {
    const v1 = mv({ line: 42 })
    const v2 = mv({ line: 99 })
    expect(hashViolation(v1)).toBe(hashViolation(v2))
  })

  it('changes when element name changes', () => {
    const v1 = mv({ element: 'OldName' })
    const v2 = mv({ element: 'NewName' })
    expect(hashViolation(v1)).not.toBe(hashViolation(v2))
  })
})

describe('generateBaseline', () => {
  it('writes valid JSON with correct structure', () => {
    const dir = createTmpDir()
    const outputPath = path.join(dir, 'baseline.json')
    const violations = [mv(), mv({ element: 'OrderService' })]

    generateBaseline(violations, outputPath)

    const raw = fs.readFileSync(outputPath, 'utf-8')
    const data = JSON.parse(raw) as BaselineFile
    expect(data.count).toBe(2)
    expect(data.violations).toHaveLength(2)
    expect(data.generatedAt).toBeDefined()
    expect(data.violations[0]?.hash).toHaveLength(16)
  })

  it('stores relative paths', () => {
    const dir = createTmpDir()
    const outputPath = path.join(dir, 'baseline.json')
    const violations = [mv({ file: path.join(dir, 'src', 'services', 'product.ts') })]

    generateBaseline(violations, outputPath)

    const raw = fs.readFileSync(outputPath, 'utf-8')
    const data = JSON.parse(raw) as BaselineFile
    const entry = data.violations[0]
    expect(entry).toBeDefined()
    expect(entry?.file).toBe(path.join('src', 'services', 'product.ts'))
    expect(path.isAbsolute(entry?.file ?? '')).toBe(false)
  })
})

describe('withBaseline', () => {
  it('loads hashes and isKnown works', () => {
    const dir = createTmpDir()
    const outputPath = path.join(dir, 'baseline.json')
    const v = mv()
    generateBaseline([v], outputPath)

    const baseline = withBaseline(outputPath)
    expect(baseline.isKnown(v)).toBe(true)
    expect(baseline.size).toBe(1)
  })

  it('returns empty baseline for missing file', () => {
    const baseline = withBaseline('/nonexistent/path/baseline.json')
    expect(baseline.size).toBe(0)
    expect(baseline.isKnown(mv())).toBe(false)
  })
})

describe('Baseline', () => {
  it('filterNew removes known violations', () => {
    const known1 = mv({ element: 'Known1' })
    const known2 = mv({ element: 'Known2' })
    const unknown1 = mv({ element: 'Unknown1' })

    const dir = createTmpDir()
    const outputPath = path.join(dir, 'baseline.json')
    generateBaseline([known1, known2], outputPath)

    const baseline = withBaseline(outputPath)
    const newViolations = baseline.filterNew([known1, known2, unknown1])
    expect(newViolations).toHaveLength(1)
    expect(newViolations[0]?.element).toBe('Unknown1')
  })

  it('filterNew returns all when baseline is empty', () => {
    const baseline = new Baseline(new Set(), '/tmp')
    const violations = [mv({ element: 'A' }), mv({ element: 'B' })]
    const result = baseline.filterNew(violations)
    // "returns all" means these two, in order — returning A twice also had length 2.
    expect(result.map((v) => v.element)).toEqual(['A', 'B'])
  })
})

describe('bypassFilters meta-findings (plan 0067)', () => {
  it('never baselines away a bypassFilters finding, even when its hash is known (ADR-008)', () => {
    const outputPath = path.join(createTmpDir(), 'baseline.json')
    // Seed with a NON-bypass finding; hash is rule::element::message (excludes
    // bypassFilters), so a same-shaped bypass finding hashes identically.
    const seed = mv({ element: 'selector', message: 'empty selector' })
    generateBaseline([seed], outputPath)
    const baseline = withBaseline(outputPath)
    // Vacuity guard: the non-bypass finding IS known → correctly dropped.
    expect(baseline.filterNew([seed])).toEqual([])
    // The same finding flagged bypassFilters survives despite being "known".
    const meta = mv({ element: 'selector', message: 'empty selector', bypassFilters: true })
    expect(baseline.filterNew([meta])).toEqual([meta])
  })

  it('generateBaseline does not write bypassFilters findings into the file', () => {
    const outputPath = path.join(createTmpDir(), 'baseline.json')
    const meta = mv({ rule: 'empty-selector', message: 'empty selector', bypassFilters: true })
    const normal = mv({ element: 'A' })
    generateBaseline([meta, normal], outputPath)
    const written = JSON.parse(fs.readFileSync(outputPath, 'utf-8')) as BaselineFile
    expect(written.count).toBe(1)
    expect(written.violations.some((e) => e.rule === 'empty-selector')).toBe(false)
  })
})

describe('which violations plan 0082 actually moved in the baseline', () => {
  // Plan 0082's Phase 2 row 1 called this "not optional and not a follow-up", and
  // then it did not ship — so the migration note went out unverified, and was
  // WRONG for the rule it quoted. ts-archunit's `docs/upgrading.md` said the hash is "over rule
  // + element + message"; `hashViolation` is `identity ?? \`${element}::${message}\``,
  // and a producer that sets `identity` supersedes both.
  //
  // The consequence is the opposite of what was published: body-analysis rules —
  // the ones an adopter would most likely write about a callback — keep their
  // hashes, because their identity is the call site, not the function's name.
  // Telling those adopters to regenerate is advice that costs them work and fixes
  // nothing. ADR-009 rule 2's behavioural corollary: nobody applied the remedy and
  // checked it cleared.
  const before = (extra: Partial<ArchViolation>): ArchViolation =>
    mv({ element: '<anonymous>', message: "does not contain call to 'x'", ...extra })
  const after = (extra: Partial<ArchViolation>): ArchViolation =>
    mv({ element: 'handler', message: "does not contain call to 'x'", ...extra })

  it('a producer that sets identity keeps its hash — the name is not in it', () => {
    const identity = "function-body::/src/a.ts::CallExpression::call to 'x'#1"
    expect(hashViolation(before({ identity }))).toBe(hashViolation(after({ identity })))
  })

  it('a producer with no identity DOES move, which is what the note should say', () => {
    // Structural conditions compose the subject from element + message, so renaming
    // `<anonymous>` to `handler` is a different violation as far as the baseline is
    // concerned. These are the entries that need regenerating — and only these.
    expect(hashViolation(before({}))).not.toBe(hashViolation(after({})))
  })

  it('VACUITY: the two fixtures differ only in element', () => {
    // Without this the rows above could pass on two violations that differ in some
    // other field, and the first would be asserting nothing about names at all.
    const a = before({})
    const b = after({})
    const diff = (Object.keys(a) as (keyof ArchViolation)[]).filter((k) => a[k] !== b[k])
    expect(diff).toEqual(['element'])
  })
})

/**
 * [Bug 0171](../../../../work/bugs/0171-a-metric-unit-change-silently-loosens-every-baselined-ratchet.md):
 * an accepted ceiling is a number IN A UNIT, and the baseline used to compare
 * across a change of unit without noticing.
 *
 * Bug 0170 changed `linesOfCode` from counting a span to counting code — on this
 * repo's own source `TerminalBuilder` went 1218 to 372. The identity hash is
 * `file::element::metric` and none of that moved, so every baselined entry kept
 * matching and kept suppressing, now against a ceiling denominated in something
 * the tool no longer produces. The class could grow to 1218 CODE lines — about
 * three times its real size — with the build green the whole way.
 */
describe('a metric whose unit changed cannot be compared against an old ceiling', () => {
  let dir: string
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-baseline-unit-'))
  })
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  function metricViolationAt(
    measured: number,
    measuredUnit: string,
    metric: string,
  ): ArchViolation {
    return {
      rule: 'have no more than 300 lines',
      element: 'TerminalBuilder',
      file: path.join(dir, 'src/terminal-builder.ts'),
      line: 1,
      message: `TerminalBuilder has ${String(measured)} lines (max: 300)`,
      identity: `${path.join(dir, 'src/terminal-builder.ts')}::TerminalBuilder::${metric}`,
      measured,
      measuredUnit,
    }
  }

  /** A baseline file as written BEFORE units were stamped — no `measuredUnit`. */
  function writeUnstampedBaseline(violation: ArchViolation, accepted: number): string {
    const file = path.join(dir, 'arch-baseline.json')
    const baseline: BaselineFile = {
      generatedAt: new Date().toISOString(),
      hashVersion: 5,
      root: '.',
      count: 1,
      violations: [
        {
          rule: violation.rule,
          file: 'src/terminal-builder.ts',
          line: violation.line,
          hash: hashViolation(violation, dir),
          measured: accepted,
        },
      ],
    }
    fs.writeFileSync(file, JSON.stringify(baseline, null, 2))
    return file
  }

  it('stops suppressing when the stored measurement predates unit stamping', () => {
    // Accepted 1218 span lines; this run measures 372 CODE lines. `372 <= 1218`
    // is true and meaningless — that arithmetic is the bug.
    const violation = metricViolationAt(372, 'code-lines', 'lines')
    const file = writeUnstampedBaseline(violation, 1218)

    const kept = withBaseline(file, { root: dir }).filterNew([violation])

    expect(kept).toContainEqual(expect.objectContaining({ element: 'TerminalBuilder' }))
  })

  it('says WHY, so it does not read as fresh rot in the code', () => {
    const violation = metricViolationAt(372, 'code-lines', 'lines')
    const file = writeUnstampedBaseline(violation, 1218)

    const kept = withBaseline(file, { root: dir }).filterNew([violation])
    const meta = kept.find((v) => v.element === 'baseline')

    // The cause, the affected identity with both numbers, and a remedy — the
    // author is looking at a finding on code they did not touch.
    expect(meta?.message).toContain('no longer produces')
    expect(meta?.message).toContain('TerminalBuilder (accepted 1218, now 372)')
    expect(meta?.suggestion).toContain('eess-ts baseline')
    // Unsuppressable: a baseline must not be able to hide the finding that says
    // the baseline cannot be trusted.
    expect(meta?.bypassFilters).toBe(true)
  })

  it('is cleared by the remedy it names — regenerating stamps the unit', () => {
    // The finding says "regenerate". This proves that actually works, rather
    // than asserting a remedy nobody ran (ADR-009 rule 2 — a remedy that does
    // not remediate is the failure this repo exists to catch).
    const violation = metricViolationAt(372, 'code-lines', 'lines')
    const stale = writeUnstampedBaseline(violation, 1218)
    expect(withBaseline(stale, { root: dir }).filterNew([violation])).not.toEqual([])

    const regenerated = path.join(dir, 'regenerated.json')
    generateBaseline([violation], regenerated, { root: dir })

    // The unit is now on disk...
    const written: BaselineFile = JSON.parse(fs.readFileSync(regenerated, 'utf-8')) as BaselineFile
    expect(written.violations[0]?.measuredUnit).toBe('code-lines')
    // ...and the finding is gone.
    expect(withBaseline(regenerated, { root: dir }).filterNew([violation])).toEqual([])
  })

  it('still compares a metric whose meaning never changed', () => {
    // The other half, and the reason this is not a blanket invalidation: an old
    // entry for `complexity` counts what it always counted, so failing it would
    // be a false regression on every upgraded baseline.
    const violation = metricViolationAt(5, 'complexity', 'complexity')
    const file = writeUnstampedBaseline(violation, 10)

    const kept = withBaseline(file, { root: dir }).filterNew([violation])

    expect(kept.filter((v) => v.element === 'TerminalBuilder')).toEqual([])
  })

  it('ratchets normally once both sides carry the same unit', () => {
    const violation = metricViolationAt(372, 'code-lines', 'lines')
    const file = path.join(dir, 'stamped.json')
    const baseline: BaselineFile = {
      generatedAt: new Date().toISOString(),
      hashVersion: 5,
      root: '.',
      count: 1,
      violations: [
        {
          rule: violation.rule,
          file: 'src/terminal-builder.ts',
          line: violation.line,
          hash: hashViolation(violation, dir),
          measured: 400,
          measuredUnit: 'code-lines',
        },
      ],
    }
    fs.writeFileSync(file, JSON.stringify(baseline, null, 2))

    // 372 <= 400 in the SAME unit — a real improvement, correctly stays green.
    expect(withBaseline(file, { root: dir }).filterNew([violation])).toEqual([])

    // And a genuine regression past it still fails.
    const worse = metricViolationAt(420, 'code-lines', 'lines')
    expect(
      withBaseline(file, { root: dir })
        .filterNew([worse])
        .filter((v) => v.element === 'TerminalBuilder'),
    ).toHaveLength(1)
  })
})
