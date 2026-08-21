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
 * `fresh: true` on every run in this file, and it is load-bearing.
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
 * Bug 0199 — a rule file that ENFORCES at module scope silently defeats `--baseline`.
 *
 * **Not because the CLI fails to filter.** `runCheck` collects a thrown terminal's
 * violations off the error and filters them normally; measured, its collection comes
 * back empty against a matching baseline. What the user reads is the rule file's OWN
 * print: `executeCheck` calls `writeReport` unconditionally one line before it throws
 * (`core/execute-rule.ts:460`), and `finishPreset` → `reportViolations` does the same
 * on the preset path. Those lines are emitted before the CLI sees anything.
 *
 * Two earlier explanations are recorded as wrong in the bug, because both were
 * believed here first: "the CLI never filtered them" and "the flag doesn't cross
 * jiti's module registry". The second is disproved by the fixtures below — they load
 * natively, in one registry, with `setCallerAggregatesReports(true)` fully visible,
 * and the leak reproduces anyway.
 *
 * Measured end-to-end from a packed install against a real ts-archunit baseline:
 * 5 of 5 hashes matched, and the build still exited 1 reporting 2 of them. The
 * hashes were never the problem.
 *
 * What ships is a NOTICE, not the repair — the CLI cannot un-print what another
 * call already wrote, so it says so. The repair is bug 0201.
 */
describe('a rule file that enforces at module scope, with --baseline', () => {
  it('says the baseline could not be applied, instead of failing in silence', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0199-'))
    try {
      const baselinePath = path.join(dir, 'arch-baseline.json')
      // Generated from the ARRAY twin, so it holds exactly the violations the
      // inline file emits — the state a user is in after `eess-ts baseline`.
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
      const code = await runCheck({
        ...baseArgs,
        format: 'json',
        ruleFiles: [fixture('enforcing-inline.rules.ts')],
        baseline: baselinePath,
      })

      // **This assertion is what pins the twin fixtures together.** Nothing else
      // does: the notice fires on `isArchRuleError && --baseline` alone, so if
      // `baselined-inline.rules.ts` drifted to a different selector its baseline
      // would hold unrelated entries and every other assertion here would still
      // pass — the test would stop demonstrating that ACCEPTED violations
      // resurfaced. Measured by review: changing the twin's selector left the whole
      // file green.
      //
      // It is also the only assertion that proves the notice's own sentence, "The
      // rules the CLI collected were filtered normally": the CLI's collection must
      // be EXACTLY the two configuration findings, with none of the four `parse*`
      // violations surviving the baseline. Under drift it would be six.
      const collected = jsonViolations(stdout.join(''))
      expect(collected).toHaveLength(2)
      expect(collected.filter((v) => v.element.startsWith('parse'))).toHaveLength(0)
      // A notice demoted to a warning would otherwise leave this green.
      expect(code).toBeGreaterThan(0)

      // The discriminator: the run must name the baseline as not applied. Asserting
      // only on the exit code would pass on the buggy build too. Read from the JSON
      // report rather than stderr, because in this mode stderr carries the rule
      // file's own leaked print and the CLI's report goes to stdout — which is the
      // very split this bug is about.
      const notice = collected.find((v) => v.rule === 'eess-ts: filtering')
      expect(notice).toBeDefined()
      expect(notice?.message).toContain('arch-baseline.json')
      expect(notice?.message).toMatch(/was not applied|could not be applied/i)
      // And it must say what to do about it. THIS fixture contains no preset — a
      // bare `functions(p)…check()` — so the remedy it needs is the generic one.
      // Asserting the preset advice here would assert guidance inapplicable to the
      // file under test, which is the ADR-009 rule 2 defect `ruleFileFailure`
      // names in this same source file. `jsonViolations` does not project
      // `suggestion`, so the remedy text itself is asserted by
      // `it('names the generic remedy for a rule file with no preset in it')`
      // below, which runs this same fixture in terminal format.
      expect(collected.some((v) => v.rule === 'eess-ts: rule file')).toBe(true)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  /**
   * The preset half of the remedy, asserted over a file it applies to — a preset
   * called without `report: 'builders'`, which is the common way to reach this
   * finding even though the trigger does not require a preset at all.
   */
  it('offers the preset remedy when the enforcement came from a preset', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0199-preset-'))
    try {
      const baselinePath = path.join(dir, 'arch-baseline.json')
      fs.writeFileSync(
        baselinePath,
        JSON.stringify({ generatedAt: '', hashVersion: 5, root: '.', count: 0, violations: [] }),
      )
      capture()
      await runCheck({
        ...baseArgs,
        ruleFiles: [fixture('enforcing-preset.rules.ts')],
        baseline: baselinePath,
      })
      const report = stderr.join('')
      expect(report).toMatch(/was not applied|could not be applied/i)
      expect(report).toContain("report: 'builders'")
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  /**
   * The remedy text for a preset-less file, asserted in terminal format because
   * `--format json` does not project `suggestion`. Its pair —
   * `it('offers the preset remedy when the enforcement came from a preset')` —
   * asserts the other branch over a file that HAS a preset.
   */
  it('names the generic remedy for a rule file with no preset in it', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0199-generic-'))
    try {
      const baselinePath = path.join(dir, 'arch-baseline.json')
      await runBaseline({
        ruleFiles: [fixture('baselined-inline.rules.ts')],
        output: baselinePath,
      })
      capture()
      await runCheck({
        ...baseArgs,
        ruleFiles: [fixture('enforcing-inline.rules.ts')],
        baseline: baselinePath,
      })
      const report = stderr.join('')
      expect(report).toContain('export default [rule1, rule2]')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  /**
   * **The remedy remediates** — the half that makes the census's `behavioural:`
   * claim true rather than `stated-only`.
   *
   * Same preset, same project, same baseline; the ONLY difference is the
   * `report: 'builders'` the finding tells you to add. The notice must clear, and
   * the rules must actually load — asserting only the notice's absence would also
   * pass if the file loaded zero rules, which is the silent green
   * `init.ts` documents.
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
      // Rules genuinely loaded — `0 rules across N file` is the alarm value.
      expect(report).not.toMatch(/— 0 rules across/)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  /**
   * **The false-positive case, found by review and measured.**
   *
   * `executeWarn` ALSO throws `ArchRuleError`, but when the CLI is aggregating it
   * writes only the non-`bypassFilters` entries — and a configuration finding is
   * `bypassFilters`, so it writes **nothing**. `truncating.rules.ts` is exactly that
   * shape: the rule file prints not one line, the CLI collects the config finding
   * and reports it once, and the baseline was applied to everything there was to
   * apply it to.
   *
   * The first version of this fix fired the notice there anyway, on the bare
   * `isArchRuleError && --baseline` condition. Both of its clauses were false for
   * that run, and the "violation printed above" it pointed at was one whose own text
   * says a baseline can never suppress it. Asserting a cause the run cannot verify
   * is the ADR-009 rule 2 defect that `ruleFileFailure` names three functions above
   * `baselineNotApplied` in the same source file.
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
      // The truncation notice is correct here and must stay.
      expect(report).toContain('stopped evaluating')
      // The baseline notice is NOT, and must not appear.
      expect(report).not.toMatch(/was not applied|could not be applied/i)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  /**
   * **`--changed` leaks identically, and shipped with nothing.** Found by the
   * adopter review, which measured a transcript that contradicts itself in three
   * consecutive lines: five violation blocks printed, then "Diff-aware mode
   * suppressed 5 findings outside the 0 changed files", then an exit claiming one.
   *
   * The first version of this fix gated on `args.baseline !== undefined`, which is
   * arbitrary — the condition that matters is "the rule file self-reported while a
   * CLI-side filter was in play", and `--changed` is such a filter.
   */
  it('fires for --changed too, not only --baseline', async () => {
    capture()
    await runCheck({
      ...baseArgs,
      ruleFiles: [fixture('enforcing-inline.rules.ts')],
      changed: true,
      base: 'HEAD',
    })
    const report = stderr.join('')
    expect(report).toMatch(/was not applied|could not be applied/i)
    expect(report).toContain('--changed')
  })

  /**
   * The discriminator in the other direction: an ordinary run that never enforces
   * inline must NOT carry this notice. A fix that printed it whenever `--baseline`
   * is passed would satisfy the test above and be useless.
   */
  it('does not warn when the rule file lets the CLI do the reporting', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0199-clean-'))
    try {
      const baselinePath = path.join(dir, 'arch-baseline.json')
      await runBaseline({
        ruleFiles: [fixture('baselined-inline.rules.ts')],
        output: baselinePath,
      })

      // Non-vacuity of the CONTROL, asserted here rather than borrowed from its
      // sibling: a dead selector would also yield exit 0, so without this the
      // control's own premise ("the baseline really did its job") is unproven.
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
      // The baseline really did its job here — that is what makes this a control.
      expect(code).toBe(0)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
