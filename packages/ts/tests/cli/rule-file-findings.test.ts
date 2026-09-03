/**
 * The finding a rule file gets when it could not be evaluated at all
 * (bug 0025).
 *
 * The behavioural half — that a throwing file no longer silences the run — is in
 * `check.test.ts`. This pins the finding's own shape, which sabotage found the
 * behavioural tests cannot see: they assert the file name reaches the output, and
 * it does so through the `Fix:` line, so emptying `file` and `line` left them
 * green while breaking the annotation surface underneath.
 */
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import {
  attributeToRuleFile,
  failureOrViolations,
  ruleFileFailure,
} from '../../src/cli/rule-file-findings.js'
import { ArchConfigError, ArchRuleError } from '@nielspeter/eess'
// The CONDITION, not the same-named predicate the entry point also exports —
// only the condition validates its arguments and throws. Imported from its own
// module so the two cannot be confused; the first version of this test used the
// predicate, which never throws, and the test failed for that reason alone.
import { havePropertyNamed } from '../../src/conditions/members.js'
import { formatViolationsGitHub } from '@nielspeter/eess'
import { formatViolations } from '@nielspeter/eess'
import { severityFor } from '@nielspeter/eess/internal'

describe('ruleFileFailure', () => {
  const failure = ruleFileFailure('rules/arch.rules.ts', new RangeError('malformed rule'), 2)

  it('is located AT the rule file, which is the only locator it has', () => {
    // Not `file: ''`. A configuration finding from a builder has nowhere to point
    // — this one does, and the rule file is the thing the reader must open. The
    // attribution exists in the CLI's per-file loop and would otherwise be
    // discarded (the gap bug 0026 describes for the builder-raised findings).
    expect(failure.file).toBe('rules/arch.rules.ts')
    // And it renders as a location, not as a bare paragraph.
    expect(formatViolations([failure], undefined, { codeFrames: false })).toContain(
      'rules/arch.rules.ts',
    )
  })

  it('names the path ONCE, so a file outside the cwd stays readable', () => {
    // Measured on the real CLI: with the path in `rule`, `element`, the location
    // line and the remedy, one finding printed it four times — and the location
    // line runs it through `path.relative(cwd, …)`, so a rule file outside the
    // cwd rendered as `../../../../../../private/tmp/…`. The location line is
    // the one place it belongs.
    const outside = ruleFileFailure('/somewhere/else/deep/arch.rules.ts', new Error('boom'), 1)
    expect(outside.rule).not.toContain('/somewhere/else')
    expect(outside.element).not.toContain('/somewhere/else')
    expect(outside.suggestion).not.toContain('/somewhere/else')
    expect(outside.element).toBe('arch.rules.ts')
    // Still recoverable from the finding, in the field built for it.
    expect(outside.file).toBe('/somewhere/else/deep/arch.rules.ts')
  })

  it('does not run the error text into the sentence after it', () => {
    // "…(reading 'config') The other rule files…" — measured on the real CLI,
    // which is the only place the two strings meet.
    const unpunctuated = ruleFileFailure('a.ts', new Error("reading 'config'"), 2)
    expect(unpunctuated.message).toContain("reading 'config'. The other rule files")
    // An error that already ends in punctuation must not get a second period.
    const punctuated = ruleFileFailure('a.ts', new Error('got 1 side.'), 2)
    expect(punctuated.message).toContain('got 1 side. The other rule files')
    expect(punctuated.message).not.toContain('..')
  })

  it('uses line 1, because line 0 is not a valid annotation', () => {
    // `::error file=x,line=0` is dropped or misplaced by GitHub — the defect
    // fixed in v0.22.0 — and only `file: ''` takes the run-level branch that
    // avoids needing a line at all. With a file set, the line must be real.
    // Same choice `tsconfig()` makes for a fault that belongs to a file rather
    // than to a position in it.
    expect(failure.line).toBeGreaterThanOrEqual(1)
    const annotation = formatViolationsGitHub([failure])
    expect(annotation).toContain('file=rules/arch.rules.ts')
    expect(annotation).not.toContain('line=0')
    expect(annotation).toMatch(/line=[1-9]/)
  })

  it('is a configuration finding: error severity whatever the rule asked for', () => {
    // A rule file that could not run enforced nothing. That is not a violation
    // to grade, and not one to accept into a baseline.
    expect(failure.bypassFilters).toBe(true)
    expect(severityFor(failure, 'warn')).toBe('error')
  })

  it('carries the error text as evidence, and a remedy that does not assert a cause', () => {
    expect(failure.message).toContain('malformed rule')
    expect(failure.message).toContain('enforced nothing')
    // Conditional, because this fires for any error a rule file can raise — a
    // syntax error, a missing dependency, a misconfigured builder. Naming one
    // cause for all of them is the ADR-009 rule 2 defect.
    expect(failure.suggestion).toContain('this rule file')
    expect(failure.suggestion).toContain('If it names a builder method')
    // It must not claim to know which of those happened.
    expect(failure.message).not.toMatch(/syntax error|missing dependency|imports a test runner/)
  })

  it('mentions the other files only when there ARE other files', () => {
    // A one-file run saying "the other rule files were still checked" is a claim
    // about files that do not exist.
    const alone = ruleFileFailure('only.rules.ts', new Error('boom'), 1)
    expect(alone.message).not.toContain('other rule files')
    expect(failure.message).toContain('other rule files')
  })

  it('renders a non-Error throw without saying [object Object]', () => {
    // `throw 'a string'` and `throw {code: 1}` are both legal.
    expect(ruleFileFailure('r.ts', 'a bare string', 1).message).toContain('a bare string')
    expect(ruleFileFailure('r.ts', { code: 1 }, 1).message).not.toContain('undefined')
  })

  it('keeps the path as given, so it stays copyable', () => {
    // Not absolutized against the running cwd: the reported path is the one the
    // user typed on the command line, which is what they can paste back.
    const relative = ruleFileFailure('nested/dir/x.rules.ts', new Error('e'), 1)
    expect(relative.file).toBe('nested/dir/x.rules.ts')
    expect(path.isAbsolute(relative.file)).toBe(false)
  })
})

describe('attributeToRuleFile', () => {
  const configFinding = {
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
    // Everything else is untouched — the identity, the remedy, the flag.
    expect(stamped?.rule).toBe('my/rule-id')
    expect(stamped?.suggestion).toBe(configFinding.suggestion)
    expect(stamped?.bypassFilters).toBe(true)
  })

  it('leaves a violation that already has a location alone', () => {
    // Ordinary violations point at the code they found, not at the rule file
    // that declared the rule. Overwriting that would be the whole feature
    // backwards.
    const located = {
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
    // The reported symptom: two rule files each holding the same vacuous rule
    // rendered as two identical paragraphs, with nothing saying which to open.
    const a = attributeToRuleFile([configFinding], 'a.rules.ts')
    const b = attributeToRuleFile([configFinding], 'b.rules.ts')
    const rendered = formatViolations([...a, ...b], undefined, { codeFrames: false })
    expect(rendered).toContain('a.rules.ts')
    expect(rendered).toContain('b.rules.ts')
  })

  it('produces a file-level GitHub annotation with a usable line', () => {
    // Before: `file: ''` took the run-level branch, so 40 vacuous rules across 6
    // files all landed on the workflow summary with no way to tell them apart.
    const stamped = attributeToRuleFile([configFinding], 'rules/arch.rules.ts')
    const annotation = formatViolationsGitHub(stamped)
    expect(annotation).toContain('file=rules/arch.rules.ts')
    expect(annotation).not.toContain('line=0')
    expect(annotation).toMatch(/line=[1-9]/)
  })

  it('does not resurrect the double-printed remedy', () => {
    // A configuration finding whose `suggestion` IS its `message` used to rely on
    // `file === ''` to be rendered once. Stamping a file changes which branch it
    // takes, so the count is asserted here too — this is the third time in this
    // release that the remedy could have started printing twice.
    const selfRemedy = { ...configFinding, suggestion: configFinding.message }
    const out = formatViolations(attributeToRuleFile([selfRemedy], 'a.rules.ts'), undefined, {
      codeFrames: false,
    })
    expect(out.split(selfRemedy.message).length - 1).toBe(1)
  })
})

/**
 * Bug 0241 — a misconfigured rule file and a crashed one are different failures.
 *
 * `ArchConfigError` shipped with 17 throw sites and no reader: every one of them
 * landed in `ruleFileFailure`, the same branch an unhandled crash takes. That
 * function is deliberately vague, and its own comment says why — it fires for
 * any error a rule file can raise, so naming one cause would be ADR-009 rule 2's
 * defect.
 *
 * A config error is the opposite case. It knows what was misconfigured, because
 * the thrower named it: `havePropertyNamed`, `requireGraphQL`, `workspace`. So
 * for that error, and only for it, a specific remedy is the honest one — and the
 * distinction is the whole point of the type. "Your rule file is wrong, fix the
 * call" and "eess crashed" ask an agent for opposite next actions, and until
 * this they rendered identically.
 */
describe('a misconfigured rule file is distinguishable from a crashed one', () => {
  const misconfigured = new ArchConfigError(
    'havePropertyNamed',
    'havePropertyNamed() requires at least one property name',
  )

  it('names what was misconfigured, not just the file', () => {
    const [v] = failureOrViolations('rules/arch.rules.ts', misconfigured, 1)
    // The subject is the element, because the thing to open is the CALL, not the
    // file as a whole. Asserted by value: `element` set to the basename — what
    // the generic path does — would satisfy a mere presence check.
    expect(v?.element).toBe('havePropertyNamed')
    expect(v?.message).toContain('havePropertyNamed')
  })

  it('says the fault is the configuration, so editing the code cannot clear it', () => {
    const [v] = failureOrViolations('rules/arch.rules.ts', misconfigured, 1)
    expect(v?.suggestion).toContain('havePropertyNamed')
    // ADR-009 rule 2: the remedy is specific BECAUSE this error knows its cause.
    // The generic path hedges with "if it names a builder method"; this must not.
    expect(v?.suggestion).not.toContain('If it names a builder method')
  })

  it('CONTROL — a plain Error still takes the generic path, which does not guess', () => {
    // The discrimination, asserted in both directions. Without this, a change
    // that routed EVERY error down the specific branch would pass the two tests
    // above while naming a cause it cannot know — the exact defect
    // `ruleFileFailure`'s comment exists to prevent.
    const [v] = failureOrViolations('rules/arch.rules.ts', new RangeError('boom'), 1)
    expect(v?.element).toBe('arch.rules.ts')
    expect(v?.suggestion).toContain('If it names a builder method')
  })

  it('an ArchRuleError still hands back its own findings, untouched', () => {
    // The pre-existing branch, pinned so the new one cannot be inserted ahead of
    // it: a rule file that self-executes a failing check reports ITS findings,
    // not a finding about the file.
    const carried = ruleFileFailure('other.rules.ts', new Error('inner'), 1)
    const out = failureOrViolations('rules/arch.rules.ts', new ArchRuleError([carried]), 1)
    expect(out).toEqual([carried])
  })

  it('the remedy remediates: making the stated fix clears the finding', () => {
    // ADR-009 rule 2's behavioural corollary, and the reason this producer can
    // claim `behavioural` in the config-finding census rather than
    // `stated-only`. A remedy that merely SOUNDS right is a message nobody
    // verified; this applies the fix the finding names and asserts it clears.
    //
    // Driven through a real thrower rather than a hand-built error, so the
    // subject and the message are the ones a rule author would actually meet.
    let thrown: unknown
    try {
      havePropertyNamed()
      thrown = undefined
    } catch (error: unknown) {
      thrown = error
    }
    const [before] = failureOrViolations('rules/arch.rules.ts', thrown, 1)
    expect(before?.element).toBe('havePropertyNamed')

    // Now apply the remedy the finding states — pass the argument the call was
    // missing — and the error is not raised at all, so there is no finding.
    expect(() => havePropertyNamed('id')).not.toThrow()
  })

  it('surfaces the cause, which is the only thing separating two config faults', () => {
    // `schema-loader.ts` throws the same subject for "graphql is not installed"
    // and "graphql is installed but failed to load", and forwards the underlying
    // error as `cause` — its own comment records that discarding it "used to be
    // reported as not installed too". Nothing rendered `cause` before this.
    const withCause = new ArchConfigError('requireGraphQL', 'The "graphql" package is required.', {
      cause: new Error('Cannot find module graphql/index.js'),
    })
    const [v] = failureOrViolations('rules/arch.rules.ts', withCause, 1)
    expect(v?.message).toContain('Cannot find module graphql/index.js')
  })
})
