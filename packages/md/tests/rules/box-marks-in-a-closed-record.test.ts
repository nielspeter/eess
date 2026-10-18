/**
 * Bug 0445 — a checkbox state other than space or x is invisible. GFM reads `[ ]`, `[x]` and `[X]`;
 * `- [~] half done` is an ordinary list item, so `honestyAtClose` never saw it, and a closed record
 * whose boxes were all `[~]` passed. Plan 0454: an undeclared mark is a finding.
 */
import { describe, it, expect } from 'vitest'
import { corpus, type ArchViolation } from '../../src/index.js'
import { honestyAtClose } from '../../src/rules/ledger.js'
import { tree } from '../helpers/tree.js'

const RECORD = ['# Bug 1', '', '- **State:** Done', '', '- [~] a', '- [?] b', '- [ ] c', ''].join('\n')

/** `(finding id, line)` pairs, sorted: identity, not a count. */
const pairs = (found: readonly ArchViolation[]): string[] =>
  found.map((v) => `${v.ruleId ?? v.rule} @ ${String(v.line)}`).sort()

describe('a closed record with boxes GFM does not read (bug 0445)', () => {
  it('each undeclared mark is reported beside the silent open box', () => {
    const c = corpus({ cwd: tree({ 'completed/bug-1.md': RECORD }), roots: ['**/*.md'] })
    const found = honestyAtClose(c, { report: 'return' })
    expect(pairs(found)).toEqual([
      'ledger/silent-open-box @ 7',
      'md/undeclared-box-mark @ 5',
      'md/undeclared-box-mark @ 6',
    ])
  })
})
