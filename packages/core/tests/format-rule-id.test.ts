import { describe, expect, it } from 'vitest'
import { formatViolations, formatViolationsPlain } from '../src/format.js'
import type { ArchViolation } from '../src/violation.js'

// Bug 0606: the terminal and plain formats never printed a violation's `ruleId`, the handle an
// author needs for `// eess-exclude <id>` or a preset's `overrides`; JSON and GitHub did.

const ESC = String.fromCharCode(27)
const strip = (s: string): string =>
  s
    .split(ESC)
    .map((p, i) => (i === 0 ? p : p.replace(/^\[[0-9;]*m/, '')))
    .join('')
const v = (over: Partial<ArchViolation>): ArchViolation => ({
  rule: 'records sit in the folder their state names',
  element: 'e',
  file: '/repo/a.md',
  line: 3,
  message: 'm',
  ...over,
})

describe('the text formats print the rule id (bug 0606)', () => {
  it('the terminal format prints the id before the description', () => {
    const out = strip(
      formatViolations([v({ ruleId: 'records/placement' })], undefined, { cwd: '/repo' }),
    )
    expect(out).toContain('Rule: records/placement — records sit in the folder their state names')
  })

  it('the plain format prints the id', () => {
    expect(formatViolationsPlain([v({ ruleId: 'records/placement' })])).toContain(
      '[records/placement] e: m',
    )
  })

  it('a violation without an id reads as before', () => {
    expect(strip(formatViolations([v({})], undefined, { cwd: '/repo' }))).toContain(
      'Rule: records sit in the folder their state names',
    )
    expect(formatViolationsPlain([v({})])).toContain('[1/1] e: m (/repo/a.md:3)')
  })

  it('a finding whose description is its id prints it once', () => {
    const out = strip(
      formatViolations([v({ rule: 'emitter/no-receipt', ruleId: 'emitter/no-receipt', file: '' })]),
    )
    expect(out).toContain('Rule: emitter/no-receipt\n')
    expect(out.match(/emitter\/no-receipt/g)).toHaveLength(1)
    expect(formatViolationsPlain([v({ rule: 'x/y', ruleId: 'x/y' })]).match(/x\/y/g)).toHaveLength(
      1,
    )
  })
})
