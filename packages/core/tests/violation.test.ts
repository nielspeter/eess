import { describe, expect, it } from 'vitest'
import { severityFor, remedyRepeatsMessage } from '../src/violation.js'
import { formatViolations, formatViolationsPlain } from '../src/format.js'
import { formatViolationsGitHub } from '../src/format-github.js'
import type { ArchViolation } from '../src/violation.js'

describe('severityFor', () => {
  it('resolves to the fallback for an ordinary violation', () => {
    const v: ArchViolation = { rule: 'r', element: 'e', file: 'f.ts', line: 1, message: 'm' }
    expect(severityFor(v, 'warn')).toBe('warn')
    expect(severityFor(v, 'error')).toBe('error')
  })

  it('resolves to error for a bypassFilters violation, regardless of the fallback', () => {
    const v: ArchViolation = {
      rule: 'r',
      element: 'e',
      file: '',
      line: 0,
      message: 'm',
      bypassFilters: true,
    }
    expect(severityFor(v, 'warn')).toBe('error')
    expect(severityFor(v, 'error')).toBe('error')
  })
})

describe('remedyRepeatsMessage', () => {
  it('is false when there is no suggestion', () => {
    const v: ArchViolation = { rule: 'r', element: 'e', file: 'f.ts', line: 1, message: 'm' }
    expect(remedyRepeatsMessage(v)).toBe(false)
  })

  it('is false when the suggestion differs from the message', () => {
    const v: ArchViolation = {
      rule: 'r',
      element: 'e',
      file: 'f.ts',
      line: 1,
      message: 'm',
      suggestion: 'a distinct remedy',
    }
    expect(remedyRepeatsMessage(v)).toBe(false)
  })

  it('is true when the suggestion is byte-identical to the message', () => {
    const v: ArchViolation = {
      rule: 'r',
      element: 'e',
      file: 'f.ts',
      line: 1,
      message: 'this rule examined zero units.',
      suggestion: 'this rule examined zero units.',
    }
    expect(remedyRepeatsMessage(v)).toBe(true)
  })
})

/**
 * Plan 0147 (bug: every terminal-format producer printed a `bypassFilters`
 * finding's own message TWICE — once as the finding, once as its own "Fix:" —
 * reconciled against ts-archunit's `remedyRepeatsMessage`). Reproduced live
 * before the fix: `formatViolations` on a config finding whose `suggestion`
 * equals its `message` rendered both a `What:` and a `Fix:` line with the
 * exact same paragraph.
 */
describe('renderers suppress a Fix: line that repeats the message', () => {
  const repeating: ArchViolation = {
    rule: 'r',
    element: 'e',
    file: '',
    line: 0,
    message: 'this rule examined zero units.',
    suggestion: 'this rule examined zero units.',
    bypassFilters: true,
  }
  const distinct: ArchViolation = {
    rule: 'r',
    element: 'e',
    file: 'f.ts',
    line: 1,
    message: 'ServiceA does not extend BaseRepository',
    suggestion: 'extend BaseRepository',
  }

  it('formatViolations (rich terminal): suppresses Fix: when it repeats the message', () => {
    const out = formatViolations([repeating])
    expect(out).toContain('this rule examined zero units.')
    expect(out).not.toContain('Fix:')
  })

  it('formatViolations: still shows Fix: when the remedy is distinct', () => {
    const out = formatViolations([distinct])
    expect(out).toContain('Fix:')
    expect(out).toContain('extend BaseRepository')
  })

  it('formatViolationsPlain: suppresses Fix: when it repeats the message', () => {
    const out = formatViolationsPlain([repeating])
    expect(out).not.toContain('Fix:')
  })

  it('formatViolationsPlain: still shows Fix: when the remedy is distinct', () => {
    const out = formatViolationsPlain([distinct])
    expect(out).toContain('Fix:')
  })

  it('formatViolationsGitHub: suppresses the ". Fix:" suffix when it repeats the message', () => {
    const out = formatViolationsGitHub([repeating])
    expect(out).not.toContain('. Fix:')
  })

  it('formatViolationsGitHub: still shows the ". Fix:" suffix when the remedy is distinct', () => {
    const out = formatViolationsGitHub([distinct])
    expect(out).toContain('. Fix:')
  })
})
