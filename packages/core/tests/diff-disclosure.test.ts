import { describe, it, expect, afterEach } from 'vitest'
import {
  suppressionNotice,
  activeNotice,
  resetDiffDisclosureForTests,
} from '../src/diff-disclosure.js'

afterEach(() => {
  resetDiffDisclosureForTests()
})

describe('suppressionNotice', () => {
  it('returns undefined when nothing was suppressed', () => {
    expect(suppressionNotice(0)).toBeUndefined()
    expect(suppressionNotice(-1)).toBeUndefined()
  })

  it('names the count, singular vs plural', () => {
    expect(suppressionNotice(1)).toMatch(/suppressed 1 finding /)
    expect(suppressionNotice(2)).toMatch(/suppressed 2 findings /)
  })

  it('names the changed-file scope when given', () => {
    const notice = suppressionNotice(3, 5)
    expect(notice).toContain('outside the 5 changed files')
  })

  it('drops the file-count clause when changedFiles is a negative sentinel', () => {
    const notice = suppressionNotice(3, -1)
    expect(notice).toContain('outside the changed files')
    expect(notice).not.toContain('changed -1')
  })

  it('names the base branch when given', () => {
    const notice = suppressionNotice(1, 2, 'main')
    expect(notice).toContain("diffed against 'main'")
  })

  it('is not gated by process-level state — repeatable across calls', () => {
    expect(suppressionNotice(1)).toBeDefined()
    expect(suppressionNotice(1)).toBeDefined()
  })
})

describe('activeNotice', () => {
  it('returns undefined when nothing was suppressed', () => {
    expect(activeNotice(0)).toBeUndefined()
  })

  it('fires once per process, then goes quiet even if more is suppressed', () => {
    const first = activeNotice(1)
    expect(first).toBeDefined()
    const second = activeNotice(5)
    expect(second).toBeUndefined()
  })

  it('resets for tests', () => {
    expect(activeNotice(1)).toBeDefined()
    expect(activeNotice(1)).toBeUndefined()
    resetDiffDisclosureForTests()
    expect(activeNotice(1)).toBeDefined()
  })

  it('names the scope and base branch when given', () => {
    const notice = activeNotice(1, 4, 'main')
    expect(notice).toContain('the 4 files changed')
    expect(notice).toContain("since 'main'")
  })
})
