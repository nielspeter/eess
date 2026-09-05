import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import path from 'node:path'
// Bound to the source under test, not to `@nielspeter/eess`. During plan 0165's
// baseline the kernel and `packages/ts/src` carry SEPARATE copies of these, so a
// kernel import gives `instanceof` a different class and `commentSuppressions()`
// a different registry than the code writes to — green or red for the wrong
// reason. Phase 2 re-unifies them; until then the package's own source is the
// only honest target.
import { ArchRuleError } from '@nielspeter/eess'
import {
  resetCommentSuppression,
  commentSuppressions,
  commentSuppressionNotice,
} from '@nielspeter/eess/internal'
import fs from 'node:fs'
import os from 'node:os'
import { project, functions, call, smells } from '../../src/index.js'
import { functionNotContain } from '../../src/conditions/body-analysis-function.js'
import { applyFilters } from '../../src/core/execute-rule.js'
import type { ArchViolation } from '@nielspeter/eess'

/** Temp fixture roots, removed after each test. */
const created: string[] = []

afterEach(() => {
  while (created.length > 0) {
    const dir = created.pop()
    if (dir !== undefined && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
  }
})

/**
 * End-to-end coverage for inline exclusion comments
 * (`// eess-exclude <rule-id>: <reason>`).
 *
 * The mechanism was inert for most conditions: only the few conditions that
 * stamped `ruleId` onto their violations (cross-layer, jsx) were excludable,
 * because `isExcludedByComment` early-returns `false` when a violation has no
 * `ruleId`. The fix stamps the rule's own id (`ctx.metadata.id`) onto un-tagged
 * violations inside `applyFilters` before the comment scan, so exclusion works
 * for every condition.
 *
 * `notContain(call(...))` (body-analysis) is exactly a non-stamping condition:
 * `functionNotContain` builds its violations via a hand-rolled object literal
 * with no `ruleId` field. So these tests exercise the regression through the
 * real public path — a fluent rule with `.rule({ id })` over a fixture project —
 * and would fail on the pre-fix kernel.
 */

const tsconfigPath = path.resolve(import.meta.dirname, '../fixtures/exclusion-e2e/tsconfig.json')

const RULE_ID = 'test/no-forbidden-call'
const OTHER_ID = 'test/some-other-rule'

/** A `notContain(call('forbiddenFn'))` rule scoped to a single fixture file. */
function forbiddenCallRule(file: string, id: string) {
  return functions(project(tsconfigPath))
    .that()
    .resideInFile(`**/${file}`)
    .should()
    .notContain(call('forbiddenFn'))
    .rule({ id })
}

describe('inline exclusion comments — end-to-end (condition → applyFilters → exclusion)', () => {
  it('(a) throws when the forbidden call has no exclusion comment', () => {
    let caught: ArchRuleError | undefined
    try {
      forbiddenCallRule('violating-plain.ts', RULE_ID).check()
    } catch (err) {
      caught = err as ArchRuleError
    }
    expect(caught).toBeInstanceOf(ArchRuleError)
    expect(caught!.violations).toHaveLength(1)
    expect(caught!.violations[0]!.ruleId).toBe(RULE_ID)
  })

  it('(b) passes when a matching single-line exclude comment sits above the violation', () => {
    // Regression case: notContain() does not stamp ruleId itself, so this only
    // passes because applyFilters stamps RULE_ID before scanning comments.
    expect(() => forbiddenCallRule('excluded-single.ts', RULE_ID).check()).not.toThrow()
  })

  it('(c) still throws when the exclude comment names a DIFFERENT rule id (id-scoped)', () => {
    let caught: ArchRuleError | undefined
    try {
      forbiddenCallRule('excluded-single.ts', OTHER_ID).check()
    } catch (err) {
      caught = err as ArchRuleError
    }
    expect(caught).toBeInstanceOf(ArchRuleError)
    expect(caught!.violations).toHaveLength(1)
    expect(caught!.violations[0]!.ruleId).toBe(OTHER_ID)
  })

  it('(d) a rule with NO id cannot be excluded by comment (the id is load-bearing)', () => {
    // Without .rule({ id }) there is no ctx.metadata.id, so the comment has no
    // id to match against and the violation stands.
    //
    // The comment here used to add "applyFilters never stamps or scans", and
    // bug 0255 made the second half false: it now DOES scan, precisely so it
    // can say why the directive did nothing. What is load-bearing — and what
    // this test pins — is that the violation still fires. Review found this
    // test certifying the old wording on a branch that had changed it, because
    // the fix landed in the kernel's copy of `applyFilters` and not this one.
    expect(() =>
      functions(project(tsconfigPath))
        .that()
        .resideInFile('**/excluded-single.ts')
        .should()
        .notContain(call('forbiddenFn'))
        .check(),
    ).toThrow(ArchRuleError)
  })

  it('(d2) …and eess-ts says WHY the directive did nothing (bug 0255)', () => {
    // The half that was missing from this dialect entirely. Without it an
    // adopter of eess-ts — the dialect most people install — got the same
    // silence bug 0255 was filed about, while the changeset said "eess now
    // prints…". Asserted on stderr because that is the channel, and on the
    // absence of a borrowed id because prescribing one collides two rules.
    const lines: string[] = []
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk))
      return true
    })
    try {
      expect(() =>
        functions(project(tsconfigPath))
          .that()
          .resideInFile('**/excluded-single.ts')
          .should()
          .notContain(call('forbiddenFn'))
          .check(),
      ).toThrow(ArchRuleError)
    } finally {
      spy.mockRestore()
    }
    const stderr = lines.join('')
    expect(stderr).toMatch(/declares no id/)
    expect(stderr).not.toMatch(/\.rule\(\{ id: '[a-z]/) // no borrowed id prescribed
  })

  it('(d3) …and eess-ts reports a directive that suppressed nothing (bug 0255)', () => {
    // The id-scoped half. Review measured that the ts copy had NO test for it:
    // deleting the whole reporting block, or the `spent` tracking that decides
    // which directives did work, left the entire packages/ts suite green. The
    // parity fixture (`engine/applyfilters-parity`) is the structural guard;
    // this names the property in the dialect's own suite so a reader of this
    // file can see it is covered.
    //
    // `excluded-far.ts` carries a directive that is not immediately above the
    // finding, so it can never reach it — the TypeScript shape of the same
    // fault a markdown table cell produces.
    const lines: string[] = []
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk))
      return true
    })
    try {
      expect(() =>
        functions(project(tsconfigPath))
          .that()
          .resideInFile('**/excluded-far.ts')
          .should()
          .notContain(call('forbiddenFn'))
          .rule({ id: 'demo/no-forbidden' })
          .check(),
      ).toThrow(ArchRuleError)
    } finally {
      spy.mockRestore()
    }
    const stderr = lines.join('')
    expect(stderr).toMatch(/suppressed nothing/)
    expect(stderr).toMatch(/demo\/no-forbidden/)
  })

  it('(d4) …and a WORKING directive is not falsely reported (the spent-tracking guard)', () => {
    // The mutation review proved nothing in packages/ts could catch: deleting
    // the `spent` bookkeeping makes every directive that DOES suppress also get
    // reported as having suppressed nothing. A positive assertion on the
    // message cannot see that — the mutation adds output — so this asserts the
    // absence, on the fixture whose directive works.
    const lines: string[] = []
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk))
      return true
    })
    try {
      functions(project(tsconfigPath))
        .that()
        .resideInFile('**/excluded-single.ts')
        .should()
        .notContain(call('forbiddenFn'))
        .rule({ id: 'test/no-forbidden-call' })
        .check() // passes: the directive suppresses the only finding
    } finally {
      spy.mockRestore()
    }
    expect(lines.join('')).not.toMatch(/suppressed nothing/)
  })

  it('the same regression holds through .satisfy(<non-stamping condition>)', () => {
    // .satisfy() is the generic path the rules-family presets use. Passing a
    // body-analysis (non-stamping) condition through it must be excludable too.
    const passing = functions(project(tsconfigPath))
      .that()
      .resideInFile('**/excluded-single.ts')
      .should()
      .satisfy(functionNotContain(call('forbiddenFn')))
      .rule({ id: RULE_ID })
    expect(() => passing.check()).not.toThrow()

    const throwing = functions(project(tsconfigPath))
      .that()
      .resideInFile('**/violating-plain.ts')
      .should()
      .satisfy(functionNotContain(call('forbiddenFn')))
      .rule({ id: RULE_ID })
    expect(() => throwing.check()).toThrow(ArchRuleError)
  })

  describe('block form (eess-exclude-start / -end)', () => {
    it('passes when a matching block fences all the violations', () => {
      expect(() => forbiddenCallRule('excluded-block.ts', RULE_ID).check()).not.toThrow()
    })

    it('is id-scoped too — throws for a different id, one violation per fenced call', () => {
      let caught: ArchRuleError | undefined
      try {
        forbiddenCallRule('excluded-block.ts', OTHER_ID).check()
      } catch (err) {
        caught = err as ArchRuleError
      }
      expect(caught).toBeInstanceOf(ArchRuleError)
      expect(caught!.violations).toHaveLength(2)
    })
  })

  describe('comment-suppression disclosure (plan 0147 Phase 4)', () => {
    beforeEach(() => {
      resetCommentSuppression()
    })

    it('records a real suppression when applyFilters drops a comment-excluded violation', () => {
      expect(() => forbiddenCallRule('excluded-single.ts', RULE_ID).check()).not.toThrow()
      const suppressions = commentSuppressions()
      expect(suppressions.some((s) => s.ruleId === RULE_ID)).toBe(true)
      expect(commentSuppressionNotice()).toContain(RULE_ID)
    })

    it('does not record anything when the exclusion comment does not match (id-scoped miss)', () => {
      resetCommentSuppression()
      expect(() => forbiddenCallRule('excluded-single.ts', OTHER_ID).check()).toThrow(ArchRuleError)
      expect(commentSuppressions()).toEqual([])
    })
  })
})

/**
 * The exclusion scan re-reads every file that produced a violation, to find the
 * `// eess-exclude` directives in it. THREE different failures can stop that
 * read, and they do not deserve the same treatment — which is why the code
 * splits them instead of wrapping all three in one silent catch.
 *
 * The split is the point: two of the three are expected shapes that carry no
 * information, and the third is a waiver silently ceasing to apply. Collapsing
 * them makes the third invisible; reporting all three makes the first two into
 * a warning storm on every in-memory project.
 */
describe('a file whose exclusion comments could not be read', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function violationIn(file: string): ArchViolation {
    return { rule: 'r', element: 'E', file, line: 1, message: 'm' }
  }

  it('stays silent for a path that is not on disk', () => {
    // An in-memory ts-morph project, or a test fixture's synthetic path. There
    // is no file, so there are no exclusion comments to miss. Measured: without
    // the guard this warns once per file for every in-memory project.
    const warn = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    applyFilters([violationIn('/src/does/not/exist.ts')], { metadata: { id: 'test-rule' } })
    expect(warn).not.toHaveBeenCalled()
  })

  it('stays silent for a configuration finding, which carries no file at all', () => {
    const warn = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    applyFilters([violationIn('')], { metadata: { id: 'test-rule' } })
    expect(warn).not.toHaveBeenCalled()
  })

  it('reports a path that IS on disk and still could not be read', () => {
    // A directory reads as EISDIR — the same shape as a permission or I/O
    // failure, and unlike `chmod 000` it behaves identically as root, in a
    // container, and on every CI runner.
    //
    // This case is deliberately NOT silent: every `// eess-exclude` in that
    // file has just stopped applying, so a violation the author believes is
    // waived fires again. Without this line they are told only that eess
    // reported something new — a cause they cannot act on (ADR-009 rule 2).
    const warn = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    applyFilters([violationIn(process.cwd())], { metadata: { id: 'test-rule' } })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('could not read'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(process.cwd()))
  })
})

/**
 * Bug 0242's headline claim, asserted on the mechanism rather than on a proxy.
 *
 * Every other test for that fix reads a violation's fields. This one commits the
 * `// eess-exclude` an author would actually write and asks the only question
 * that matters: does it still suppress when the filesystem hands the detector
 * its files in the other order?
 *
 * Before the fix a duplicate was reported at whichever member the walk reached
 * first, so this directive suppressed on one machine and not the other — a green
 * build going red with no change on either side. Added after testing review
 * observed that the record's headline was the one thing nothing tested.
 */
describe('a committed duplicate waiver survives a reversed file walk (bug 0242)', () => {
  const DUP_ID = 'smells/duplicate-waiver'

  const body = (name: string): string =>
    `export function ${name}(items: string[]): number {\n` +
    `  let sum = 0\n` +
    `  for (const each of items) {\n` +
    `    sum = sum + each.length\n` +
    `  }\n` +
    `  return sum\n` +
    `}\n`

  /** A two-file duplicate; `waiveIn` names the file that carries the directive. */
  const build = (waiveIn: 'a' | 'b' | 'none'): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0242-waiver-'))
    created.push(dir)
    const directive = `// eess-exclude ${DUP_ID}: duplicate accepted for this test\n`
    fs.writeFileSync(path.join(dir, 'a.ts'), (waiveIn === 'a' ? directive : '') + body('alphaFn'))
    fs.writeFileSync(path.join(dir, 'b.ts'), (waiveIn === 'b' ? directive : '') + body('bravoFn'))
    fs.writeFileSync(
      path.join(dir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: { strict: true, target: 'ES2022', module: 'ESNext' },
        include: ['*.ts'],
      }),
    )
    return path.join(dir, 'tsconfig.json')
  }

  const run = (tsconfig: string, reverse: boolean): void => {
    resetCommentSuppression()
    const base = project(tsconfig)
    const walked = reverse
      ? { ...base, getSourceFiles: () => [...base.getSourceFiles()].reverse() }
      : base
    smells.duplicateBodies(walked).minDistinctVocabulary(0).minLines(2).rule({ id: DUP_ID }).check()
  }

  /** Which file's directive did the suppressing, by name — not merely "no throw". */
  const silencedIn = (): string[] =>
    commentSuppressions()
      .filter((entry) => entry.ruleId === DUP_ID)
      .map((entry) => entry.file.split('/').pop() ?? '')
      .sort()

  it('the waiver on the anchor file suppresses in BOTH walk directions', () => {
    const tsconfig = build('a')
    expect(() => {
      run(tsconfig, false)
    }).not.toThrow()
    // WHICH directive did the suppressing, not merely that nothing threw.
    // `not.toThrow()` cannot tell "the waiver silenced the one intended finding"
    // from "the waiver silenced everything" — bug 0233's open class, and this
    // file already imports the channel that answers it.
    expect(silencedIn()).toEqual(['a.ts'])

    // The half that was broken: reversed, the finding used to be reported at
    // `b.ts`, so this directive stopped applying and the build went red.
    expect(() => {
      run(tsconfig, true)
    }).not.toThrow()
    expect(silencedIn(), 'the reversed walk suppressed via a different file').toEqual(['a.ts'])
  })

  it('CONTROL — with no waiver at all the rule reds in both directions', () => {
    // Without this, a rule that found nothing would satisfy the test above.
    const tsconfig = build('none')
    expect(() => {
      run(tsconfig, false)
    }).toThrow(ArchRuleError)
    expect(() => {
      run(tsconfig, true)
    }).toThrow(ArchRuleError)
  })

  it('CONTROL — a waiver on the NON-anchor file suppresses in neither direction', () => {
    // The converse, and the reason the anchor has to be deterministic at all: a
    // directive is bound to one location, so exactly one of the two files can
    // carry it. If `b.ts` also worked, the anchor would not be deciding anything.
    const tsconfig = build('b')
    expect(() => {
      run(tsconfig, false)
    }).toThrow(ArchRuleError)
    expect(() => {
      run(tsconfig, true)
    }).toThrow(ArchRuleError)
  })
})
