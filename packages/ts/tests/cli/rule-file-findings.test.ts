/**
 * The finding a rule file gets when it could not be evaluated at all.
 *
 * The behavioural half — that a throwing file no longer silences the run — is
 * wired into `cli/commands/check.ts` and `cli/commands/baseline.ts` (plan
 * 0147 Phase 2); see `tests/cli/check.test.ts` and
 * `tests/cli/baseline-cmd.test.ts` for that half. This pins the finding's own
 * shape.
 */
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import {
  attributeToRuleFile,
  failureOrViolations,
  ruleFileTruncated,
} from '../../src/cli/rule-file-findings.js'
import { formatViolationsGitHub, formatViolations, ArchRuleError } from '@nielspeter/eess'
import type { ArchViolation } from '@nielspeter/eess'

/** `ruleFileFailure` itself isn't exported — reached only through `failureOrViolations`'s non-`ArchRuleError` branch, which always returns exactly this one finding. */
function ruleFileFailure(file: string, error: unknown, ruleFiles: number): ArchViolation {
  const [finding] = failureOrViolations(file, error, ruleFiles)
  if (!finding) throw new Error('failureOrViolations returned no finding for a non-ArchRuleError')
  return finding
}

describe('ruleFileFailure', () => {
  const failure = ruleFileFailure('rules/arch.rules.ts', new RangeError('malformed rule'), 2)

  it('is located AT the rule file, which is the only locator it has', () => {
    // Not `file: ''`. A configuration finding from a builder has nowhere to
    // point — this one does, and the rule file is the thing the reader must
    // open.
    expect(failure.file).toBe('rules/arch.rules.ts')
    expect(formatViolations([failure], undefined, { codeFrames: false })).toContain(
      'rules/arch.rules.ts',
    )
  })

  it('names the path ONCE, so a file outside the cwd stays readable', () => {
    const outside = ruleFileFailure('/somewhere/else/deep/arch.rules.ts', new Error('boom'), 1)
    expect(outside.rule).not.toContain('/somewhere/else')
    expect(outside.element).not.toContain('/somewhere/else')
    expect(outside.suggestion).not.toContain('/somewhere/else')
    expect(outside.element).toBe('arch.rules.ts')
    expect(outside.file).toBe('/somewhere/else/deep/arch.rules.ts')
  })

  it('does not run the error text into the sentence after it', () => {
    const unpunctuated = ruleFileFailure('a.ts', new Error("reading 'config'"), 2)
    expect(unpunctuated.message).toContain("reading 'config'. The other rule files")
    const punctuated = ruleFileFailure('a.ts', new Error('got 1 side.'), 2)
    expect(punctuated.message).toContain('got 1 side. The other rule files')
    expect(punctuated.message).not.toContain('..')
  })

  it('uses line 1, because line 0 is not a valid annotation', () => {
    expect(failure.line).toBeGreaterThanOrEqual(1)
    const annotation = formatViolationsGitHub([failure])
    expect(annotation).toContain('file=rules/arch.rules.ts')
    expect(annotation).not.toContain('line=0')
    expect(annotation).toMatch(/line=[1-9]/)
  })

  it('is a configuration finding: unsuppressable via bypassFilters', () => {
    // eess has no severity-per-violation field (severity is asserted at
    // .check()/.warn() call time) — bypassFilters is the ADR-010 contract this
    // finding must carry instead.
    expect(failure.bypassFilters).toBe(true)
  })

  it('carries the error text as evidence, and a remedy that does not assert a cause', () => {
    expect(failure.message).toContain('malformed rule')
    expect(failure.message).toContain('enforced nothing')
    expect(failure.suggestion).toContain('this rule file')
    expect(failure.suggestion).toContain('If it names a builder method')
    expect(failure.message).not.toMatch(/syntax error|missing dependency|imports a test runner/)
  })

  it('mentions the other files only when there ARE other files', () => {
    const alone = ruleFileFailure('only.rules.ts', new Error('boom'), 1)
    expect(alone.message).not.toContain('other rule files')
    expect(failure.message).toContain('other rule files')
  })

  it('renders a non-Error throw without saying [object Object]', () => {
    expect(ruleFileFailure('r.ts', 'a bare string', 1).message).toContain('a bare string')
    expect(ruleFileFailure('r.ts', { code: 1 }, 1).message).not.toContain('undefined')
  })

  it('keeps the path as given, so it stays copyable', () => {
    const relative = ruleFileFailure('nested/dir/x.rules.ts', new Error('e'), 1)
    expect(relative.file).toBe('nested/dir/x.rules.ts')
    expect(path.isAbsolute(relative.file)).toBe(false)
  })
})

describe('attributeToRuleFile', () => {
  const configFinding: ArchViolation = {
    rule: 'my/rule-id',
    element: 'my/rule-id',
    file: '',
    line: 0,
    message: 'this rule asserts nothing and can never fail',
    suggestion: 'Add a condition after .should()',
    bypassFilters: true,
  }

  it('stamps the rule file onto a finding that has no location of its own', () => {
    const [stamped] = attributeToRuleFile([configFinding], 'rules/arch.rules.ts')
    expect(stamped?.file).toBe('rules/arch.rules.ts')
    expect(stamped?.line).toBe(1)
    expect(stamped?.rule).toBe('my/rule-id')
    expect(stamped?.suggestion).toBe(configFinding.suggestion)
    expect(stamped?.bypassFilters).toBe(true)
  })

  it('leaves a violation that already has a location alone', () => {
    // Ordinary violations point at the code they found, not at the rule file
    // that declared the rule. Overwriting that would be the whole feature
    // backwards.
    const located: ArchViolation = {
      ...configFinding,
      file: '/src/service.ts',
      line: 42,
      bypassFilters: undefined,
    }
    const [same] = attributeToRuleFile([located], 'rules/arch.rules.ts')
    expect(same?.file).toBe('/src/service.ts')
    expect(same?.line).toBe(42)
  })

  it('makes two identical vacuous rules distinguishable', () => {
    const a = attributeToRuleFile([configFinding], 'a.rules.ts')
    const b = attributeToRuleFile([configFinding], 'b.rules.ts')
    const rendered = formatViolations([...a, ...b], undefined, { codeFrames: false })
    expect(rendered).toContain('a.rules.ts')
    expect(rendered).toContain('b.rules.ts')
  })

  it('produces a file-level GitHub annotation with a usable line', () => {
    const stamped = attributeToRuleFile([configFinding], 'rules/arch.rules.ts')
    const annotation = formatViolationsGitHub(stamped)
    expect(annotation).toContain('file=rules/arch.rules.ts')
    expect(annotation).not.toContain('line=0')
    expect(annotation).toMatch(/line=[1-9]/)
  })
})

describe('failureOrViolations', () => {
  it('unwraps an ArchRuleError to the findings it already carries', () => {
    const violations: ArchViolation[] = [
      { rule: 'r', element: 'e', file: '/f.ts', line: 1, message: 'm' },
    ]
    const error = new ArchRuleError(violations, 'boom')
    expect(failureOrViolations('a.rules.ts', error, 1)).toBe(violations)
  })

  it('turns any other throw into one configuration finding naming the file', () => {
    const result = failureOrViolations('a.rules.ts', new Error('boom'), 1)
    expect(result).toHaveLength(1)
    expect(result[0]?.file).toBe('a.rules.ts')
    expect(result[0]?.bypassFilters).toBe(true)
  })
})

describe('ruleFileTruncated', () => {
  it('names the file and says nothing after the throw ran', () => {
    const finding = ruleFileTruncated('a.rules.ts', 2)
    expect(finding.file).toBe('a.rules.ts')
    expect(finding.line).toBe(1)
    expect(finding.bypassFilters).toBe(true)
    expect(finding.message).toContain('stopped evaluating')
    expect(finding.message).toContain('other rule files')
  })

  it('does not claim other files when run alone', () => {
    const finding = ruleFileTruncated('only.rules.ts', 1)
    expect(finding.message).not.toContain('other rule files')
  })

  it('points at the array-export escape hatch', () => {
    const finding = ruleFileTruncated('a.rules.ts', 1)
    expect(finding.suggestion).toContain('export default [rule1, rule2]')
  })
})
