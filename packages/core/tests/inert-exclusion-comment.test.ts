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

    // Asserted against the string the implementation ACTUALLY emits. The first
    // version of this line listed three phrases — "never applied", "declares no
    // id", "matched zero" — of which the working-directive report emits none, so
    // it could not fail for the mutation it exists to catch. Review proved it:
    // deleting the `spent` tracking made every working directive report
    // "suppressed nothing" and all six tests stayed green. Same vacuous-regex
    // class as the backtick assertion bug 0254 had to fix one commit earlier.
    expect(stderr).not.toMatch(/suppressed nothing/)
  })

  it('a working directive is not reported — the spent-tracking regression, pinned', () => {
    // The mutation the CONTROL above missed, made its own test so the property
    // has a witness that names it. Two directives, both of which DO suppress:
    // without `spent` tracking each would be reported as having suppressed
    // nothing, because the loop cannot tell which comment did the work.
    const file = write('two-working.md', [
      '<!-- eess-exclude demo/rule: first -->',
      'first violation here',
      '<!-- eess-exclude demo/rule: second -->',
      'second violation here',
    ])
    const { kept, stderr } = stderrFrom([violation(file, 2), violation(file, 4)], {
      metadata: { id: 'demo/rule' },
    })

    expect(kept).toHaveLength(0) // both suppressed
    expect(stderr).not.toMatch(/suppressed nothing/)
  })

  it('one working and one inert directive: only the inert one is named', () => {
    // The discriminating case. A file-level "did any comment suppress anything"
    // check would stay silent here, and a per-comment check with no `spent` set
    // would report both. Only correct bookkeeping names exactly one, and the
    // assertion is on WHICH line, not on a count.
    const file = write('mixed.md', [
      '<!-- eess-exclude demo/rule: this one works -->',
      'the violation is here',
      '<!-- eess-exclude demo/rule: this one reaches nothing -->',
      'a line with no violation on it',
    ])
    const { kept, stderr } = stderrFrom([violation(file, 2)], { metadata: { id: 'demo/rule' } })

    expect(kept).toHaveLength(0)
    const reported = [...stderr.matchAll(/mixed\.md:(\d+) suppressed nothing/g)].map((m) => m[1])
    expect(reported).toEqual(['3'])
  })

  it('the no-id report never prescribes an id that may belong to another rule', () => {
    // Review reproduced real harm here: the first version named each comment's
    // own rule id and told the reader to add `.rule({ id: <that id> })`. From
    // inside one rule's execution there is no way to know that id is unclaimed —
    // and in the reproduction it was actively in use by a working rule, so the
    // advice would have collided two rules onto one id.
    const file = write('borrowed-id.md', [
      '<!-- eess-exclude other/rule: works for another rule entirely -->',
      'the violation is here',
    ])
    const { stderr } = stderrFrom([violation(file, 2)], {})

    // It still reports — the directive genuinely cannot apply, which is the
    // whole point of bug 0255.
    expect(stderr).toMatch(/borrowed-id\.md/)
    expect(stderr).toMatch(/declares no id/)
    // But it must not hand the author someone else's id to claim.
    expect(stderr).not.toMatch(/\.rule\(\{ id: 'other\/rule' \}\)/)
  })

  it('a rule with a .because() reason is named by it (bug 0258)', () => {
    // An id-less rule has no id to name, so several id-less chains over one file
    // printed byte-identical lines and a reader could not tell which chain
    // needed the id. `.because()` is available on an id-less rule — the reason
    // is stamped onto violations before this scan runs — so it is a
    // discriminator that already exists rather than one to invent.
    const file = write('with-reason.md', ['<!-- eess-exclude a/one: r -->', 'x'])
    const { stderr } = stderrFrom([violation(file, 2)], {
      reason: 'no eval in handlers',
    })
    expect(stderr).toMatch(/This rule \("no eval in handlers"\) declares no id/)
  })

  it('two id-less rules over one file are now distinguishable', () => {
    // The symptom, asserted directly: the same file, two chains, two reasons.
    // Before this the two lines were byte-identical.
    const file = write('two-chains.md', ['<!-- eess-exclude a/one: r -->', 'x'])
    const first = stderrFrom([violation(file, 2)], { reason: 'no eval in handlers' }).stderr
    const second = stderrFrom([violation(file, 2)], { reason: 'no fs in the browser' }).stderr
    expect(first).not.toBe(second)
    expect(first).toMatch(/no eval in handlers/)
    expect(second).toMatch(/no fs in the browser/)
  })

  it('a rule with neither id nor reason is genuinely anonymous, and says so plainly', () => {
    // The control. A chain with no reason has nothing to name it by, and the
    // message must stay exactly as it was rather than growing an empty
    // parenthetical. Without this, a change that always emitted `("")` would
    // satisfy both tests above.
    const file = write('no-reason.md', ['<!-- eess-exclude a/one: r -->', 'x'])
    const { stderr } = stderrFrom([violation(file, 2)], {})
    expect(stderr).toMatch(/This rule declares no id/)
    expect(stderr).not.toMatch(/\(\s*"/)
  })

  it('a multi-line reason stays on one line, so the report keeps its shape', () => {
    // `.because()` takes prose and prose can wrap. The no-id report is
    // deliberately one line per file; a reason with a newline in it would break
    // that and make the output unparseable by eye.
    const file = write('wrapped-reason.md', ['<!-- eess-exclude a/one: r -->', 'x'])
    const { stderr } = stderrFrom([violation(file, 2)], {
      reason: 'no eval\n   in handlers',
    })
    expect(stderr.trimEnd().split('\n')).toHaveLength(1)
    expect(stderr).toMatch(/"no eval in handlers"/)
  })

  it('the no-id report is one line per file, not one per directive', () => {
    // Two id-less rules over a shared file already print once each; printing
    // once per directive on top of that is noise the sibling branch avoids by
    // scoping. Asserted by counting the lines, since that is the property.
    const file = write('many-directives.md', [
      '<!-- eess-exclude a/one: reason -->',
      'x',
      '<!-- eess-exclude b/two: reason -->',
      'the violation is here',
    ])
    const { stderr } = stderrFrom([violation(file, 4)], {})

    expect(stderr.split('\n').filter((l) => l.includes('declares no id'))).toHaveLength(1)
    // Both directives' lines are still named, so nothing is hidden by the merge.
    expect(stderr).toMatch(/lines 1, 3/)
  })

  it('a reason-free directive under a rule with no id still reports BOTH faults', () => {
    // The guard at the `undocumented` branch is load-bearing and was unpinned:
    // review removed it and all tests stayed green. Without an id there is
    // nothing to key the unsuppressable promotion on, so the undocumented
    // warning must fall through to stderr — and the inert report must still
    // fire. Two different faults, two lines, neither swallowing the other.
    const file = write('no-id-no-reason.md', [
      '<!-- eess-exclude demo/rule -->', // no colon, no reason
      'the violation is here',
    ])
    const { kept, stderr } = stderrFrom([violation(file, 2)], {})

    expect(kept).toHaveLength(1) // no id, so nothing is suppressed
    expect(stderr).toMatch(/declares no id/) // the inert report
    // The literal the warning emits, not a loose /reason/i — that matched other
    // text and passed under the very mutation this test exists to catch.
    expect(stderr).toMatch(/Undocumented exclusion/)
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

    // Asserted on the FILE AND LINE, not on the other rule's id. The report
    // names the RUNNING rule ("Exclusion comment for 'demo/rule' at …"), so
    // `other/rule` never appears in it even when the scoping is removed — a
    // regex looking for that string cannot fail. Found by sabotage: dropping the
    // `c.ruleId !== ruleId` filter left this test green. That is the third
    // vacuous-regex assertion in three commits, and the pattern is always the
    // same — asserting on a string the implementation does not emit.
    expect(stderr).not.toMatch(/other-rule\.md:1 suppressed nothing/)
  })
})
