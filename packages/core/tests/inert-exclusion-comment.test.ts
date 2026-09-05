import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { applyFilters } from '../src/internal.js'
import { resetStderrGuardForTests } from '../src/stderr.js'
import type { ArchViolation } from '../src/violation.js'

/**
 * Bug 0255 — an exclusion comment that cannot possibly apply says nothing.
 *
 * `.excluding()` patterns already get this: a pattern matching zero violations
 * writes "Unused exclusion … it may be stale after a rename." A comment
 * directive had no equivalent, so the two documented ways of the same failure
 * were silent:
 *
 *  1. **Placement** — the directive's scope is the NEXT line, and inside a GFM
 *     table every cell is on one physical line, so an in-cell directive can
 *     never reach the violation beside it. Well-formed, correctly spelled,
 *     naming a real rule id, and inert.
 *  2. **No rule id** — a comment matches a violation by rule id, so a chain
 *     without `.rule({ id })` has nothing to match. This one is worse: the
 *     whole exclusion block is gated on the id, so the file is never even
 *     parsed. Found by an adopter review of bug 0254, whose changeset had
 *     handed people this exact recipe.
 *
 * Both leave the author staring at a violation their sanction was supposed to
 * cover, with no signal about why it did not.
 */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0255-'))
const files: string[] = []

const write = (name: string, lines: string[]): string => {
  const file = path.join(tmp, name)
  fs.writeFileSync(file, lines.join('\n'))
  files.push(file)
  return file
}

const violation = (file: string, line: number): ArchViolation => ({
  rule: 'demo rule',
  element: 'thing',
  file,
  line,
  message: 'a real finding',
})

/** Run `applyFilters` and return every line it wrote to stderr. */
const stderrFrom = (violations: ArchViolation[], ctx: Parameters<typeof applyFilters>[1]) => {
  resetStderrGuardForTests()
  const lines: string[] = []
  const spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    lines.push(String(chunk))
    return true
  })
  try {
    const kept = applyFilters(violations, ctx)
    return { kept, stderr: lines.join('') }
  } finally {
    spy.mockRestore()
  }
}

afterEach(() => {
  resetStderrGuardForTests()
})

describe('a directive that cannot apply is reported (bug 0255)', () => {
  it('reports a directive whose placement never reaches the violation', () => {
    // The table case, reduced to its mechanism: the directive is on line 1 and
    // so covers line 2; the violation is on line 3.
    const file = write('placement.md', [
      '<!-- eess-exclude demo/rule: illustrative -->',
      'a line the directive covers, with nothing on it',
      'the violation is here',
    ])
    const { kept, stderr } = stderrFrom([violation(file, 3)], { metadata: { id: 'demo/rule' } })

    // The violation still fires — the directive did not apply. That is the
    // premise, asserted so this test cannot pass by the sanction working.
    expect(kept).toHaveLength(1)
    expect(stderr).toMatch(/demo\/rule/)
    expect(stderr).toMatch(/placement\.md/)
    // Names the line the directive is ON, which is what the author must move.
    expect(stderr).toMatch(/:1\b/)
  })

  it('reports a directive that can never match because the rule declares no id', () => {
    // The adopter case from bug 0254's review. `isExcludedByComment` returns
    // false for every violation when `ruleId` is undefined, so this directive is
    // provably inert — not merely unmatched this run.
    const file = write('no-id.md', [
      '<!-- eess-exclude demo/rule: illustrative -->',
      'the violation is here',
    ])
    const { kept, stderr } = stderrFrom([violation(file, 2)], {})

    expect(kept).toHaveLength(1)
    // The remedy, not just the fault: ADR-009 rule 1.
    expect(stderr).toMatch(/rule\(\{ id/)
    expect(stderr).toMatch(/no-id\.md/)
  })

  it('CONTROL — a directive that DOES apply is not reported', () => {
    // Without this, a change that warned on every directive would satisfy both
    // tests above. Here the directive covers the violation's own line.
    const file = write('applies.md', [
      '<!-- eess-exclude demo/rule: illustrative -->',
      'the violation is here',
    ])
    const { kept, stderr } = stderrFrom([violation(file, 2)], { metadata: { id: 'demo/rule' } })

    expect(kept).toHaveLength(0) // suppressed, as intended
    expect(stderr).not.toMatch(/never applied|declares no id|matched zero/i)
  })

  it('CONTROL — a clean file is never parsed, so a defensive region cannot be reported', () => {
    // The requirement bug 0255 wrote for itself: the report must not fire on an
    // `eess-exclude-start`/`-end` region that legitimately covers a
    // violation-free span. It holds by construction rather than by a special
    // case — comments are only read for files that already produced a violation,
    // so a clean file's directives are never seen at all. Asserted because
    // "by construction" is exactly the kind of claim that stops being true.
    const file = write('clean-region.md', [
      '<!-- eess-exclude-start demo/rule: defensive, nothing here today -->',
      'just prose',
      '<!-- eess-exclude-end -->',
    ])
    const other = write('elsewhere.md', ['a violation lives here'])
    const { stderr } = stderrFrom([violation(other, 1)], { metadata: { id: 'demo/rule' } })

    expect(stderr).not.toMatch(/clean-region\.md/)
    expect(fs.readFileSync(file, 'utf8')).toContain('eess-exclude-start') // fixture is real
  })

  it('a region that suppresses nothing IN A FILE THAT DID FAIL is reported — the boundary, pinned', () => {
    // The other side of that boundary, stated rather than left to be discovered.
    // Here the file DOES have a violation, so it is parsed, and the region
    // covers none of it. That is a stale sanction by the same reasoning as a
    // stale `.excluding()` pattern, and it is reported for the same reason.
    const file = write('stale-region.md', [
      '<!-- eess-exclude-start demo/rule: covers nothing any more -->',
      'just prose',
      '<!-- eess-exclude-end -->',
      'the violation is here, outside the region',
    ])
    const { kept, stderr } = stderrFrom([violation(file, 4)], { metadata: { id: 'demo/rule' } })

    expect(kept).toHaveLength(1)
    expect(stderr).toMatch(/stale-region\.md/)
    expect(stderr).toMatch(/stale/)
  })

  it("CONTROL — a directive for a DIFFERENT rule is not reported as this rule's problem", () => {
    // A file can carry directives for many rules. When rule A runs, a directive
    // naming rule B matched nothing — correctly, and it is not a fault. Without
    // this, the report would fire once per unrelated directive per rule.
    const file = write('other-rule.md', [
      '<!-- eess-exclude other/rule: for a different rule entirely -->',
      'the violation is here',
    ])
    const { stderr } = stderrFrom([violation(file, 2)], { metadata: { id: 'demo/rule' } })

    expect(stderr).not.toMatch(/other\/rule/)
  })
})
