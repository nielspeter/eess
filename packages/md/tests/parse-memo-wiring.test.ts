/**
 * Bug 0547: the memo `model/prose.ts` builds is the one every entry point reads through, and the
 * kernel's cache reset clears it. Counted at the parser itself, so a memo that holds nothing, or one
 * the readers bypass, is a parse too many here — `parse-memo.test.ts` builds its own memo and cannot
 * see that.
 */
import { clearRegisteredCaches } from '@nielspeter/eess/internal'
import type * as FromMarkdown from 'mdast-util-from-markdown'
import { describe, expect, it, vi } from 'vitest'
import { corpusFromText } from '../src/index.js'
import { findState } from '../src/rules/ledger.js'

const parses = vi.hoisted(() => ({ count: 0 }))
vi.mock('mdast-util-from-markdown', async (importOriginal) => {
  const real = await importOriginal<typeof FromMarkdown>()
  return {
    ...real,
    fromMarkdown: (...args: Parameters<typeof real.fromMarkdown>) => {
      parses.count++
      return real.fromMarkdown(...args)
    },
  }
})

describe('the memo every entry point reads through', () => {
  it('a text read by two corpora and by findState without its tree is parsed once', () => {
    const text = '# Plan 1\n\n- **State:** Done\n\n- [x] a\n'
    const before = parses.count
    corpusFromText({ 'a.md': text }).documents()
    expect(parses.count - before).toBe(1)
    corpusFromText({ 'b.md': text, 'c.md': text }).documents()
    expect(findState(text, ['Done'])?.state).toBe('Done')
    expect(parses.count - before).toBe(1)
  })

  it('clearing the kernel caches forgets every text', () => {
    const text = '# Cleared\n'
    corpusFromText({ 'a.md': text }).documents()
    const before = parses.count
    corpusFromText({ 'a.md': text }).documents()
    expect(parses.count - before).toBe(0)
    clearRegisteredCaches()
    corpusFromText({ 'a.md': text }).documents()
    expect(parses.count - before).toBe(1)
  })
})
