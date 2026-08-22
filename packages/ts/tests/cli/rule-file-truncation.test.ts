/**
 * Two bugs at one boundary: a rule file whose module scope throws.
 *
 * - **Bug 0029** — a rule file that stops evaluating partway must say so.
 * - **Bug 0199** — a terminal firing at module scope PRINTS before the CLI can
 *   filter, so `--baseline` did not apply to what the user just read.
 *
 * Both are reached through the same `isArchRuleError` catch in `runCheck`, and both
 * need a real on-disk module whose scope throws — which is why they live here and
 * not in `check.test.ts` (see "Why this file does not mock `loadRuleFiles`" below).
 *
 * Since v0.23.0 `.warn()` throws for a configuration finding (plan 0069 R3a). In a
 * **self-executing** rule file, the shape `init` scaffolds, a throw at module scope
 * aborts the module: every rule declared after it is never evaluated, the CLI folds
 * the thrown finding into the run, and the output looks entirely ordinary. R3a
 * specified the other half — *"the CLI reports the truncation rather than absorbing
 * it"* — and shipped without it.
 *
 * Measured on v0.28.0, the same two rules in each shape:
 *
 * | rule file shape                 | findings reported |
 * | ------------------------------- | ----------------- |
 * | `export default [rule1, rule2]` | **5** — the configuration finding and all four violations |
 * | self-executing                  | **1** — the four violations silently absent |
 *
 * ## Why this file does not mock `loadRuleFiles`
 *
 * `tests/cli/check.test.ts` does, which is exactly why nothing caught this: with the
 * loader mocked, no test ever evaluates a real module whose scope throws partway
 * through. So these run `runCheck` against **real fixture rule files on disk**. That
 * is the whole point of the file and it is why it is slower than its neighbours.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { runCheck } from '../../src/cli/commands/check.js'
import { runBaseline } from '../../src/cli/commands/baseline.js'
import type { ArchViolation } from '@nielspeter/eess'

const fixture = (name: string): string =>
  path.join(import.meta.dirname, '../fixtures/rule-files', name)

/**
 * `fresh: true` on every run in this file, and it is load-bearing — **but it does
 * not buy full order-independence, and an earlier version of this note claimed it
 * did.**
 *
 * Measured: 12 tests, 2 module executions. ESM caches an evaluation *error*, and
 * the cache-busting import does not reliably force a re-execution under vitest —
 * a counter in a fixture's module scope stayed frozen across three consecutive
 * `runCheck`s. So a test is only guaranteed to see a fresh module if it is the
 * FIRST loader of that fixture in the file.
 *
 * The practical rule, and why the fixtures below look duplicative: **a test whose
 * assertion depends on the fixture's module scope actually running needs its own
 * fixture file.** `enforcing-preset-changed.rules.ts` is a byte-copy of
 * `enforcing-preset.rules.ts` for exactly that reason — sharing it made the
 * `--changed` test pass in isolation and fail in file order, asserting over a run
 * in which the preset never executed.
 *
 * A rule file's module is cached after its first import, so a second `runCheck` on the
 * same path does not re-execute its module scope — no terminal fires, and
 * `executeWarn`'s write never happens. Measured: the double-print assertion below saw
 * two stderr writes when its test ran first in the process and **one** when it ran
 * third, so it silently stopped testing anything depending on position in the file.
 * `fresh` uses cache-busting imports, which is what makes these order-independent.
 */
const baseArgs = { changed: false, base: 'main', format: 'terminal' as const, fresh: true }

let stderr: string[] = []
let stdout: string[] = []

afterEach(() => {
  vi.restoreAllMocks()
  stderr = []
  stdout = []
})

function capture(): void {
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    stderr.push(String(chunk))
    return true
  })
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout.push(String(chunk))
    return true
  })
}

/** The `violations` array of a `--format json` run. */
function jsonViolations(raw: string): ArchViolation[] {
  const parsed: unknown = JSON.parse(raw)
  if (parsed === null || typeof parsed !== 'object' || !('violations' in parsed)) {
    throw new Error(`no violations in report: ${raw.slice(0, 200)}`)
  }
  if (!Array.isArray(parsed.violations)) throw new Error('violations is not an array')
  // `readonly unknown[]`, not the narrowed `any[]`: after `Array.isArray` the elements
  // are `any`, and ADR-005 bars both `any` and the `as` that would re-narrow them.
  // Assigning to this type is allowed and hands each element back as `unknown` — the
  // same idiom `withBaseline` uses on the same shape.
  const list: readonly unknown[] = parsed.violations
  const out: ArchViolation[] = []
  for (const v of list) {
    if (v !== null && typeof v === 'object' && 'message' in v && typeof v.message === 'string') {
      const file = 'file' in v && typeof v.file === 'string' ? v.file : ''
      const element = 'element' in v && typeof v.element === 'string' ? v.element : ''
      const rule = 'rule' in v && typeof v.rule === 'string' ? v.rule : ''
      const line = 'line' in v && typeof v.line === 'number' ? v.line : 0
      out.push({ rule, element, file, line, message: v.message })
    }
  }
  return out
}

describe('a self-executing rule file that throws partway', () => {
  it('reports the truncation, and names the file it happened in', async () => {
    capture()

    const code = await runCheck({ ...baseArgs, ruleFiles: [fixture('truncating.rules.ts')] })

    // `runCheck` returns the error-severity COUNT, not a 0/1 code — two here, both
    // configuration findings, which `severityFor` forces to error.
    expect(code).toBe(2)
    const report = stderr.join('')
    expect(report).toContain('stopped evaluating at the finding above')
    // Attributed to the rule file, not to a source file it was checking.
    expect(report).toContain('truncating.rules.ts')
  })

  /**
   * **The lost violations stay lost, and that is the honest state.**
   *
   * The module never finished, so nothing can recover `rule2`'s findings in this run.
   * Asserting that they appear would be asserting a fix nobody built. What must be
   * true is that the report *says* something is missing — so this asserts the absence
   * AND the notice together, because either alone is satisfied by the bug.
   */
  it('does not invent the lost findings, and does not stay silent about them', async () => {
    capture()

    await runCheck({
      ...baseArgs,
      format: 'json',
      ruleFiles: [fixture('truncating.rules.ts')],
    })

    const found = jsonViolations(stdout.join(''))
    // `rule2` found four `parse*` functions when it ran in the control below. Here it
    // never ran, so none of them can be present.
    expect(found.filter((v) => v.element.startsWith('parse'))).toEqual([])
    // …and the report says so, rather than reading as a clean two-finding run.
    expect(found.some((v) => v.message.includes('stopped evaluating'))).toBe(true)
  })

  it('reports each finding exactly once', async () => {
    capture()

    // Its OWN fixture, because this is the one assertion that depends on the module
    // executing: a cached re-import never reaches `executeWarn`, so the extra write
    // cannot happen and the test passes for the wrong reason. Measured — it saw two
    // writes running first in this file and one running third.
    await runCheck({ ...baseArgs, ruleFiles: [fixture('truncating-print-once.rules.ts')] })

    // `executeWarn` used to write every violation and THEN throw the configuration
    // findings, so whoever caught the error and reported `error.violations` printed
    // them a second time — two `Architecture Violation [1 of 1]` blocks with
    // identical content, while `--format json` said 1.
    const report = stderr.join('')
    // R3b (plan 0074) supersedes this: the selector is STATICALLY dead, so the glob gate reports it before the runtime empty-selection check ever runs. Strictly stronger — "can never match" implies "matched nothing" — and reporting both would be one fact twice, which is bug 0031's shape.
    expect(report.match(/can never match anything in this project/g)).toHaveLength(1)
    expect(report.match(/stopped evaluating at the finding above/g)).toHaveLength(1)
  })

  it('agrees between the terminal and json surfaces', async () => {
    capture()
    await runCheck({ ...baseArgs, ruleFiles: [fixture('truncating.rules.ts')] })
    const terminalHeaders = (stderr.join('').match(/Architecture Violation \[/g) ?? []).length

    stderr = []
    stdout = []
    await runCheck({ ...baseArgs, format: 'json', ruleFiles: [fixture('truncating.rules.ts')] })
    const jsonCount = jsonViolations(stdout.join('')).length

    // The double print was visible only because these two disagreed: 2 blocks against
    // `total: 1`. Comparing them is what makes a future divergence fail rather than
    // needing someone to count blocks by eye.
    expect(terminalHeaders).toBe(jsonCount)
    expect(jsonCount).toBe(2)
  })
})

describe('the array-export shape is not truncated, and must not be told it was', () => {
  /**
   * The discriminator. An array export builds every rule before any of them runs, so
   * no terminal fires at module scope and nothing can be lost.
   *
   * Without this, a "fix" that emitted the truncation notice for *every* rule file
   * would satisfy every assertion above.
   */
  it('evaluates both rules and reports no truncation', async () => {
    capture()

    await runCheck({
      ...baseArgs,
      format: 'json',
      ruleFiles: [fixture('array-export.rules.ts')],
    })

    const found = jsonViolations(stdout.join(''))
    // The configuration finding plus all four `parse*` violations.
    expect(found).toHaveLength(5)
    expect(found.filter((v) => v.element.startsWith('parse'))).toHaveLength(4)
    // And nothing claiming the file stopped early, because it did not.
    expect(found.some((v) => v.message.includes('stopped evaluating'))).toBe(false)
  })

  it('is the same two rules, so the contrast is the shape and nothing else', async () => {
    capture()
    await runCheck({
      ...baseArgs,
      format: 'json',
      ruleFiles: [fixture('array-export.rules.ts')],
    })
    const control = jsonViolations(stdout.join(''))

    stderr = []
    stdout = []
    await runCheck({
      ...baseArgs,
      format: 'json',
      ruleFiles: [fixture('truncating.rules.ts')],
    })
    const truncated = jsonViolations(stdout.join(''))

    // Both files carry the identical configuration finding, which is what proves the
    // two fixtures really are the same rules in two shapes. If they drifted, the
    // comparison above would be measuring two different things.
    const selectorFinding = (found: ArchViolation[]): string | undefined =>
      found.find((v) => v.message.includes('can never match anything in this project'))?.message
    expect(selectorFinding(control)).toBeDefined()
    expect(selectorFinding(truncated)).toBe(selectorFinding(control))

    // Four findings exist in one shape and not the other. That difference IS the bug.
    expect(control.length - truncated.length).toBe(3)
  })
})

/**
 * Bug 0199 / 0201 — a rule file that ENFORCES at module scope, under a CLI-side filter.
 *
 * **Two paths, and after bug 0201's `.check()` half only one of them still leaks.**
 *
 * `runCheck` collects a thrown terminal's violations off the error and filters them
 * normally — that was never broken. What the user reads is whatever the rule file
 * PRINTED before throwing, which no CLI-side filter can touch:
 *
 * | path in the rule file        | emits through                    | after 0201's fix     |
 * | ---------------------------- | -------------------------------- | -------------------- |
 * | `.check()` at module scope   | ts `executeCheck` → `writeReport` | **silent** — fixed   |
 * | a preset without `'builders'` | kernel `finishPreset` → `reportViolations` | still leaks |
 *
 * `executeCheck` now honours `callerAggregatesReports`, exactly as `executeWarn`
 * always has. The kernel half has no such flag to honour and is filed separately.
 *
 * Two earlier explanations are recorded as wrong in bug 0199, because both were
 * believed here first: "the CLI never filtered them", and "the flag doesn't cross
 * jiti's module registry". The second is disproved by these fixtures — they load
 * natively, in one registry, with the flag fully visible, and the leak reproduced
 * anyway until `executeCheck` was changed.
 */
describe('a rule file that enforces at module scope, under a CLI-side filter', () => {
  /**
   * **The 0201 regression test.** A `.check()` at module scope must now print
   * NOTHING of its own — and must therefore get no "unfiltered output" notice,
   * because there is no longer any unfiltered output to warn about.
   *
   * Measured before the fix: 6 violation blocks, four of them already accepted in
   * the baseline. After: 2, both of them the CLI's own configuration findings.
   */
  it('no longer prints its own findings, so no notice is owed', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0201-'))
    try {
      const baselinePath = path.join(dir, 'arch-baseline.json')
      await runBaseline({
        ruleFiles: [fixture('baselined-inline.rules.ts')],
        output: baselinePath,
      })
      const accepted: unknown = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'))
      expect(
        accepted !== null && typeof accepted === 'object' && 'count' in accepted
          ? accepted.count
          : 0,
      ).toBeGreaterThan(0)

      capture()
      await runCheck({
        ...baseArgs,
        format: 'json',
        ruleFiles: [fixture('enforcing-inline.rules.ts')],
        baseline: baselinePath,
      })

      // The leak itself: not one accepted violation may reach stderr.
      expect(stderr.join('')).not.toContain('parseFooOrder')
      // And with nothing leaked, the notice must not fire — it would be a claim
      // constructed from a default rather than from evidence (ADR-010).
      const collected = jsonViolations(stdout.join(''))
      expect(collected.filter((v) => v.rule === 'eess-ts: reporting')).toHaveLength(0)
      // **By its own text, not its label.** `ruleFileTruncated` and
      // `ruleFileFailure` share the rule string `eess-ts: rule file`, so asserting
      // the label is satisfied by a fixture that failed to evaluate for an
      // unrelated reason — measured: emptying this fixture's selector left every
      // assertion here green, because the rest are absences and absences hold
      // trivially. Assert the identity, which is this repo's own rule.
      expect(collected.some((v) => v.message.includes('stopped evaluating'))).toBe(true)
      expect(collected.filter((v) => v.element.startsWith('parse'))).toHaveLength(0)

      // "Nothing leaked" must be distinguishable from "nothing existed". Re-run the
      // same fixture with NO baseline: it must produce the four `parse*` violations
      // the baseline suppressed above. Without this, emptying the fixture's
      // selector satisfies every assertion in this test.
      stderr = []
      stdout = []
      await runCheck({
        ...baseArgs,
        format: 'json',
        ruleFiles: [fixture('enforcing-inline.rules.ts')],
      })
      expect(
        jsonViolations(stdout.join('')).filter((v) => v.element.startsWith('parse')),
      ).toHaveLength(4)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  /**
   * **The half that still leaks**, and the notice that covers it. A preset emits
   * through the kernel's `reportViolations`, which no ts-side flag reaches — so its
   * findings are printed before the CLI sees them and the baseline cannot apply.
   */
  it('no longer leaks when a preset enforces at module scope either', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0199-'))
    try {
      const baselinePath = path.join(dir, 'arch-baseline.json')
      fs.writeFileSync(
        baselinePath,
        JSON.stringify({ generatedAt: '', hashVersion: 5, root: '.', count: 0, violations: [] }),
      )
      capture()
      const code = await runCheck({
        ...baseArgs,
        ruleFiles: [fixture('enforcing-preset.rules.ts')],
        baseline: baselinePath,
      })
      const report = stderr.join('')
      // Bug 0203: `deliver()` now honours the aggregating caller, so the preset
      // enforces (still throws) without emitting. Nothing leaked, so no notice is
      // owed — and the CLI reports the violations once, off the throw.
      expect(report).not.toMatch(/was not applied|could not be applied/i)
      expect(report).toContain('stopped evaluating')
      // The run still fails: the throw is unchanged, only the emission moved.
      expect(code).toBeGreaterThan(0)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  /**
   * `--changed` is a CLI-side filter too, and shipped with nothing until an adopter
   * measured a transcript that contradicted itself in three consecutive lines:
   * violations printed, then "Diff-aware mode suppressed N findings", then an exit
   * claiming fewer. Gating the notice on `--baseline` alone was arbitrary.
   */
  it('fires for --changed too, not only --baseline', async () => {
    capture()
    await runCheck({
      ...baseArgs,
      ruleFiles: [fixture('warn-leaks-under-changed.rules.ts')],
      changed: true,
      base: 'HEAD',
    })
    const report = stderr.join('')
    expect(report).toMatch(/was not applied|could not be applied/i)
    expect(report).toContain('--changed')
  })

  /**
   * **The remedy remediates** — what makes the census's `behavioural:` claim true
   * rather than `stated-only`. Same preset, same baseline; the only difference is
   * the `report: 'builders'` the finding tells you to add.
   */
  it('clears once the remedy it names is applied, and the rules then load', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0199-fixed-'))
    try {
      const baselinePath = path.join(dir, 'arch-baseline.json')
      fs.writeFileSync(
        baselinePath,
        JSON.stringify({ generatedAt: '', hashVersion: 5, root: '.', count: 0, violations: [] }),
      )
      capture()
      await runCheck({
        ...baseArgs,
        ruleFiles: [fixture('enforcing-preset-fixed.rules.ts')],
        baseline: baselinePath,
      })
      const report = stderr.join('')
      expect(report).not.toMatch(/was not applied|could not be applied/i)
      expect(report).not.toContain('stopped evaluating')
      // Rules genuinely loaded — asserting only the absence would also pass on a
      // run that loaded nothing.
      expect(report).not.toMatch(/— 0 rules across/)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  /**
   * **The third leaking path**, and the one that kept the ts-side emission counter
   * unfalsifiable. `checkAll()` calls `writeReport` unconditionally
   * (`core/check-all.ts`), ignoring `callerAggregatesReports` — the same defect
   * `executeCheck` was fixed for in bug 0201, three files away in the same package.
   *
   * Sabotage-measured: without this test, deleting the counter increment inside
   * `writeReport` left the entire suite green.
   */
  it('no longer leaks for checkAll() at module scope either', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0199-checkall-'))
    try {
      const baselinePath = path.join(dir, 'arch-baseline.json')
      fs.writeFileSync(
        baselinePath,
        JSON.stringify({ generatedAt: '', hashVersion: 5, root: '.', count: 0, violations: [] }),
      )
      capture()
      await runCheck({
        ...baseArgs,
        ruleFiles: [fixture('checkall-at-module-scope.rules.ts')],
        baseline: baselinePath,
      })
      const report = stderr.join('')
      // **The positive anchor first.** The conversion of this test originally
      // dropped it and asserted only the absence — measured: replacing the fixture
      // with a module that calls no `checkAll` at all left the test green, because
      // the run it then graded was a `ruleFileFailure` ("could not be evaluated")
      // that the absence regex does not match. Its sibling two tests down states
      // the rule in its own comment: asserting only an absence also passes on a
      // run that did nothing.
      expect(report).toMatch(/Architecture Violation \[/)
      expect(report).toContain('parseFooOrder')
      // Bug 0203's third emitter: `check-all.ts` honours the flag now, so the
      // findings reach the user once, through the CLI, with the baseline applied.
      expect(report).not.toMatch(/was not applied|could not be applied/i)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  /**
   * **The false-NEGATIVE case** — a silence is worse than a wrong claim, because
   * the run says nothing at all.
   *
   * A rule file can both silence a terminal and leak through another:
   * `report: 'warn'` emits through the kernel without throwing, while a `.check()`
   * beside it is silenced by bug 0201's fix and throws. The first version of this
   * trigger counted SUPPRESSED writes and read the absence of one as "nothing
   * leaked" — a double negative that this shape satisfies while leaking. Measured
   * before the fix: 7 violation blocks reached the user unfiltered and no notice
   * fired.
   */
  it('fires when a file both silences one terminal and leaks through another', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0199-mixed-'))
    try {
      // An EMPTY baseline: the filter is in play (so the notice is eligible) but
      // suppresses nothing, so the `.check()` still throws and reaches the catch.
      // `--changed` cannot be used here — with no changed files it filters the
      // `.check()` to empty, so it never throws and the catch never runs.
      const baselinePath = path.join(dir, 'arch-baseline.json')
      fs.writeFileSync(
        baselinePath,
        JSON.stringify({ generatedAt: '', hashVersion: 5, root: '.', count: 0, violations: [] }),
      )
      capture()
      await runCheck({
        ...baseArgs,
        ruleFiles: [fixture('mixed-quiet-and-leaking.rules.ts')],
        baseline: baselinePath,
      })
      const report = stderr.join('')
      // The leak is real — the preset's findings reached stderr.
      expect(report).toMatch(/Architecture Violation \[/)
      // ...so the notice is owed.
      expect(report).toMatch(/was not applied|could not be applied/i)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  /**
   * **The false-positive case.** `executeWarn` throws the same error type while
   * writing nothing when the CLI aggregates, because a configuration finding is
   * `bypassFilters`. The first version of this fix fired the notice there anyway —
   * asserting a leak that never happened, over a finding whose own text says a
   * baseline can never suppress it.
   */
  it('does not fire when the throw carried nothing the rule file could print', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0199-warn-'))
    try {
      const baselinePath = path.join(dir, 'arch-baseline.json')
      fs.writeFileSync(
        baselinePath,
        JSON.stringify({ generatedAt: '', hashVersion: 5, root: '.', count: 0, violations: [] }),
      )
      capture()
      await runCheck({
        ...baseArgs,
        ruleFiles: [fixture('truncating.rules.ts')],
        baseline: baselinePath,
      })
      const report = stderr.join('')
      expect(report).toContain('stopped evaluating')
      expect(report).not.toMatch(/was not applied|could not be applied/i)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  /**
   * The discriminator in the other direction: a run the CLI reports must carry no
   * notice at all. A fix that printed it whenever a filter was passed would satisfy
   * every test above and fail this one.
   */
  it('does not warn when the rule file lets the CLI do the reporting', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0199-clean-'))
    try {
      const baselinePath = path.join(dir, 'arch-baseline.json')
      await runBaseline({
        ruleFiles: [fixture('baselined-inline.rules.ts')],
        output: baselinePath,
      })
      // Non-vacuity of the CONTROL: a dead selector would also yield exit 0.
      const accepted: unknown = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'))
      expect(
        accepted !== null && typeof accepted === 'object' && 'count' in accepted
          ? accepted.count
          : 0,
      ).toBeGreaterThan(0)

      capture()
      const code = await runCheck({
        ...baseArgs,
        ruleFiles: [fixture('baselined-inline.rules.ts')],
        baseline: baselinePath,
      })
      const report = stderr.join('')
      expect(report).not.toMatch(/was not applied|could not be applied/i)
      expect(code).toBe(0)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
