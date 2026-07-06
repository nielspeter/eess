import { describe, it, expect } from 'vitest'
import { parseExclusionComments, isExcludedByComment } from '@nielspeter/eess'
import type { ExclusionComment } from '@nielspeter/eess'
import type { ArchViolation } from '../../src/core/violation.js'
import { TestRuleBuilder, stubProject, alwaysFail } from '../support/test-rule-builder.js'
import type { TestElement } from '../support/test-rule-builder.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('parseExclusionComments', () => {
  it('parses single-line exclusion comment', () => {
    const source = [
      'const x = 1',
      '// eess-exclude sdk/no-manual-urlsearchparams: builds image transform URL',
      'const params = new URLSearchParams()',
    ].join('\n')

    const result = parseExclusionComments(source, 'src/foo.ts')
    expect(result.exclusions).toHaveLength(1)
    expect(result.exclusions[0]?.ruleId).toBe('sdk/no-manual-urlsearchparams')
    expect(result.exclusions[0]?.reason).toBe('builds image transform URL')
    expect(result.exclusions[0]?.file).toBe('src/foo.ts')
    expect(result.exclusions[0]?.line).toBe(2)
    expect(result.exclusions[0]?.isBlock).toBe(false)
    expect(result.warnings).toHaveLength(0)
  })

  it('parses block exclusion (start/end) with line range', () => {
    const source = [
      '// eess-exclude-start sdk/no-manual-urlsearchparams: image URL builder',
      'async function getImageUrl() {',
      '  const params = new URLSearchParams()',
      '  return params.toString()',
      '}',
      '// eess-exclude-end',
    ].join('\n')

    const result = parseExclusionComments(source, 'src/asset.ts')
    expect(result.exclusions).toHaveLength(1)
    expect(result.exclusions[0]?.ruleId).toBe('sdk/no-manual-urlsearchparams')
    expect(result.exclusions[0]?.reason).toBe('image URL builder')
    expect(result.exclusions[0]?.isBlock).toBe(true)
    expect(result.exclusions[0]?.line).toBe(1)
    expect(result.exclusions[0]?.endLine).toBe(6)
    expect(result.warnings).toHaveLength(0)
  })

  it('parses multiple rule IDs on one line (comma-separated)', () => {
    const source = ['// eess-exclude rule-a, rule-b: shared reason', 'doSomething()'].join('\n')

    const result = parseExclusionComments(source, 'src/bar.ts')
    expect(result.exclusions).toHaveLength(2)
    expect(result.exclusions[0]?.ruleId).toBe('rule-a')
    expect(result.exclusions[1]?.ruleId).toBe('rule-b')
    expect(result.exclusions[0]?.reason).toBe('shared reason')
    expect(result.exclusions[1]?.reason).toBe('shared reason')
  })

  it('warns about missing reason', () => {
    const source = [
      '// eess-exclude sdk/no-manual-urlsearchparams',
      'const params = new URLSearchParams()',
    ].join('\n')

    const result = parseExclusionComments(source, 'src/foo.ts')
    expect(result.exclusions).toHaveLength(1)
    expect(result.exclusions[0]?.reason).toBe('')
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]?.message).toContain('Undocumented exclusion')
    expect(result.warnings[0]?.message).toContain('Add a reason')
  })

  it('reports nested block start as warning', () => {
    const source = [
      '// eess-exclude-start rule-a: outer block',
      'const x = 1',
      '// eess-exclude-start rule-b: inner block',
      'const y = 2',
      '// eess-exclude-end',
    ].join('\n')

    const result = parseExclusionComments(source, 'src/nested.ts')
    expect(result.warnings.length).toBeGreaterThanOrEqual(1)
    const nestedWarning = result.warnings.find((w) => w.message.includes('Nested'))
    expect(nestedWarning).toBeDefined()
  })
})

describe('isExcludedByComment', () => {
  it('matches violation within block line range', () => {
    const comment: ExclusionComment = {
      ruleId: 'test/rule',
      reason: 'intentional',
      file: 'src/foo.ts',
      line: 5,
      isBlock: true,
      endLine: 10,
    }

    const violation: ArchViolation = {
      rule: 'test rule',
      ruleId: 'test/rule',
      element: 'doSomething',
      file: 'src/foo.ts',
      line: 7,
      message: 'violation',
    }

    expect(isExcludedByComment(violation, [comment])).toBe(true)
  })

  it('matches single-line exclusion on next line', () => {
    const comment: ExclusionComment = {
      ruleId: 'test/rule',
      reason: 'intentional',
      file: 'src/foo.ts',
      line: 5,
      isBlock: false,
    }

    const violation: ArchViolation = {
      rule: 'test rule',
      ruleId: 'test/rule',
      element: 'doSomething',
      file: 'src/foo.ts',
      line: 6,
      message: 'violation',
    }

    expect(isExcludedByComment(violation, [comment])).toBe(true)
  })

  it('does not match wrong rule ID', () => {
    const comment: ExclusionComment = {
      ruleId: 'rule-a',
      reason: 'intentional',
      file: 'src/foo.ts',
      line: 5,
      isBlock: false,
    }

    const violation: ArchViolation = {
      rule: 'test rule',
      ruleId: 'rule-b',
      element: 'doSomething',
      file: 'src/foo.ts',
      line: 6,
      message: 'violation',
    }

    expect(isExcludedByComment(violation, [comment])).toBe(false)
  })

  it('does not match wrong file', () => {
    const comment: ExclusionComment = {
      ruleId: 'test/rule',
      reason: 'intentional',
      file: 'src/foo.ts',
      line: 5,
      isBlock: false,
    }

    const violation: ArchViolation = {
      rule: 'test rule',
      ruleId: 'test/rule',
      element: 'doSomething',
      file: 'src/bar.ts',
      line: 6,
      message: 'violation',
    }

    expect(isExcludedByComment(violation, [comment])).toBe(false)
  })
})

describe('inline exclusion end-to-end', () => {
  it('inline exclusion comment suppresses violation in full pipeline', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-ts-test-'))
    const filePath = path.join(tmpDir, 'test-source.ts')
    const sourceContent = [
      'const x = 1',
      '// eess-exclude my/test-rule: intentional violation for testing',
      'function doSomething() {}',
    ].join('\n')
    fs.writeFileSync(filePath, sourceContent)

    const elements: TestElement[] = [
      { name: 'doSomething', file: filePath, line: 3, exported: true },
    ]

    const builder = new TestRuleBuilder(stubProject, elements)
    // With rule ID matching the exclusion comment, the violation should be suppressed
    expect(() => {
      builder.should().withCondition(alwaysFail()).rule({ id: 'my/test-rule' }).check()
    }).not.toThrow()

    // Clean up
    fs.unlinkSync(filePath)
    fs.rmdirSync(tmpDir)
  })
})

describe('parseExclusionComments — HTML-comment form (markdown/text dialects)', () => {
  it('parses a single-line HTML exclusion with reason', () => {
    const source = [
      'Some prose.',
      '<!-- eess-exclude corpus/pointers-resolve: illustrative example, not a live claim -->',
      'An example pointer `file.ts:10-20` in prose.',
    ].join('\n')

    const result = parseExclusionComments(source, 'docs/example.md')
    expect(result.exclusions).toHaveLength(1)
    expect(result.exclusions[0]?.ruleId).toBe('corpus/pointers-resolve')
    expect(result.exclusions[0]?.reason).toBe('illustrative example, not a live claim')
    expect(result.exclusions[0]?.line).toBe(2)
    expect(result.exclusions[0]?.isBlock).toBe(false)
    expect(result.warnings).toHaveLength(0)
  })

  it('parses HTML block start/end covering a range', () => {
    const source = [
      '<!-- eess-exclude-start corpus/broken-links: quoted foreign snippet -->',
      '[dead](./nope.md)',
      '<!-- eess-exclude-end -->',
    ].join('\n')

    const result = parseExclusionComments(source, 'docs/example.md')
    expect(result.exclusions).toHaveLength(1)
    expect(result.exclusions[0]?.isBlock).toBe(true)
    expect(result.exclusions[0]?.endLine).toBe(3)
  })

  it('warns on an undocumented HTML exclusion (no reason)', () => {
    const result = parseExclusionComments('<!-- eess-exclude some/rule -->\nx', 'docs/example.md')
    expect(result.exclusions).toHaveLength(1)
    expect(result.warnings.some((w) => w.message.includes('Undocumented'))).toBe(true)
  })
})
