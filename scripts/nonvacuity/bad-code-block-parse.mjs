#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — plan 0412: a code block parses with the parser the caller names.
 * Fixture tier (bug 0127): each scenario drives `parseCodeBlocks` + `codeBlocks().should().parse()`
 * over a hand-built corpus under bad-code-block-parse/, with a stub parser in this file.
 *
 *   invalid-verdict     broken/broken.md has a block the stub calls invalid on body line 3 →
 *                       a finding at the block's Markdown line, 6.
 *   malformed-verdict   the parser answers { outcome: 'ok' } → the instrument, never valid.
 *   zero-blocks         other/ holds files with no `mermaid` block, no .expectEmpty() →
 *                       the zero-examined finding.
 *   no-markdown         a root that loads no Markdown, with .expectEmpty() declared → still a
 *                       finding.
 *   no-identity         a parser with no name → ArchConfigError from parseCodeBlocks.
 *   no-canaries         a parser with no canaries → ArchConfigError from parseCodeBlocks.
 *   canary-valid        the parser answers its own canary valid → the instrument.
 *   parser-hangs        the parser never resolves → the instrument, naming the budget.
 *   parser-throws       the parser throws → the instrument, with its message.
 *   dropped-block       the parser returns one verdict too few → the instrument.
 *   capitalised-tag     capitalised/ holds only a `Mermaid` block, broken on body line 2 → it is
 *                       read in any letter case (ADR-019), so a finding at Markdown line 5.
 *   unrecognised-verdict unknown/unknown.md has a block the stub cannot classify → a finding
 *                       with the parser's remedy, never worded as a syntax error.
 *   forged-facts        a hand-built fact object passed to codeBlocks() → ArchConfigError.
 *   canary-may-pass     a canary declared `expect: 'valid'` → ArchConfigError from parseCodeBlocks.
 *   sync-overrun        a synchronous parser runs past a 5 ms budget → the instrument, after it returns.
 *   cannot-be-excluded  the parser throws and the rule excludes every element with a match-all
 *                       pattern →
 *                       the instrument is still reported.
 *
 * Each finding is matched on its message (and file, where it has one), not on a rule id alone:
 * every instrument finding shares one id, so an id match would let any one of them answer for
 * the others (bug 0110's class).
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = the named finding was reported — OK
 *   0 = not reported (the check is vacuous — the harness treats this as fail)
 *   2 = unexpected error, or an unknown scenario — the harness treats this as fail
 */
import { corpus, codeBlocks, parseCodeBlocks, isArchConfigError } from '@nielspeter/eess-md'

const ROOT = 'scripts/nonvacuity/bad-code-block-parse'
const INSTRUMENT = 'eess-md: code-block parser'

function judge(text) {
  const lines = text.split('\n')
  const broken = lines.findIndex((l) => l.includes('BROKEN') || l.startsWith('%%canary'))
  if (broken !== -1) {
    return { outcome: 'invalid', message: 'unexpected token', line: broken + 1, remedy: 'fix it' }
  }
  if (text.startsWith('UNKNOWN')) {
    return { outcome: 'unrecognised', message: 'no such kind', remedy: 'name a diagram kind' }
  }
  return { outcome: 'valid' }
}

const stub = (overrides = {}) => ({
  name: 'stub',
  version: '1.0.0',
  canaries: [
    { text: '%%canary', expect: 'invalid' },
    { text: 'UNKNOWN canary', expect: 'unrecognised' },
  ],
  parse: (texts) => texts.map(judge),
  ...overrides,
})

const instrument = (says) => (violations) =>
  violations.some((v) => v.ruleId === INSTRUMENT && v.message.includes(says))

const SCENARIOS = {
  'invalid-verdict': {
    dir: 'broken',
    found: (vs) =>
      vs.some(
        (v) =>
          v.message.includes('does not parse with stub 1.0.0') &&
          v.file.endsWith('broken/broken.md') &&
          v.line === 6,
      ),
  },
  'malformed-verdict': {
    dir: 'valid',
    parser: { parse: (texts) => texts.map((t, i) => (i === 1 ? { outcome: 'ok' } : judge(t))) },
    found: instrument('is not a verdict'),
  },
  'zero-blocks': {
    dir: 'other',
    found: (vs) => vs.some((v) => v.message.includes('examined zero units')),
  },
  'no-markdown': {
    dir: 'nothing-is-here',
    expectEmpty: true,
    found: (vs) => vs.some((v) => v.message.includes('source loaded zero units')),
  },
  'no-identity': { dir: 'valid', parser: { name: '' }, throws: 'the parser has no name' },
  'no-canaries': { dir: 'valid', parser: { canaries: [] }, throws: 'declares no canaries' },
  'canary-valid': {
    dir: 'valid',
    parser: { parse: (texts) => texts.map(() => ({ outcome: 'valid' })) },
    found: instrument('canary 1 was answered wrongly'),
  },
  'parser-hangs': {
    dir: 'valid',
    parser: { parse: () => new Promise(() => {}) },
    budget: { startUpMs: 50, perBlockMs: 0 },
    found: instrument('ran past its budget'),
  },
  'parser-throws': {
    dir: 'valid',
    parser: {
      parse: () => {
        throw new Error('DOMPurify.addHook is not a function')
      },
    },
    found: instrument('DOMPurify.addHook is not a function'),
  },
  'dropped-block': {
    dir: 'valid',
    parser: { parse: (texts) => texts.slice(1).map(judge) },
    found: instrument('3 texts, 2 verdicts'),
  },
  'capitalised-tag': {
    dir: 'capitalised',
    found: (vs) =>
      vs.some(
        (v) =>
          v.message.includes('does not parse with stub 1.0.0') &&
          v.file.endsWith('capitalised/capitalised.md') &&
          v.line === 5,
      ),
  },
  'unrecognised-verdict': {
    dir: 'unknown',
    found: (vs) =>
      vs.some(
        (v) =>
          v.message.includes('does not recognise this `mermaid` block: no such kind') &&
          v.suggestion === 'name a diagram kind' &&
          !/syntax/i.test(v.message),
      ),
  },
  'forged-facts': { dir: 'valid', forge: true, throws: 'takes the object' },
  'sync-overrun': {
    dir: 'valid',
    parser: {
      parse: (texts) => {
        const until = Date.now() + 30
        while (Date.now() < until) {
          // a synchronous parser cannot be interrupted
        }
        return texts.map(judge)
      },
    },
    budget: { startUpMs: 5, perBlockMs: 0 },
    found: instrument('past its budget'),
  },
  'cannot-be-excluded': {
    dir: 'valid',
    parser: {
      parse: () => {
        throw new Error('excluded or not')
      },
    },
    excludeAll: true,
    found: instrument('excluded or not'),
  },
  'canary-may-pass': {
    dir: 'valid',
    parser: { canaries: [{ text: 'BROKEN', expect: 'valid' }] },
    throws: 'is not a block the parser must reject',
  },
}

const name = process.argv[2]
const scenario = SCENARIOS[name]
if (scenario === undefined) {
  console.error(
    `bad-code-block-parse: unknown scenario "${name}" — expected one of ${Object.keys(SCENARIOS).join(', ')}`,
  )
  process.exit(2)
}

let violations
try {
  const c = corpus({ roots: [`${ROOT}/${scenario.dir}/**`] })
  const parsed = await parseCodeBlocks(c, {
    language: 'mermaid',
    parser: stub(scenario.parser),
    ...(scenario.budget !== undefined && { budget: scenario.budget }),
  })
  const facts = scenario.forge === true ? { ...parsed } : parsed
  let rule = codeBlocks(facts).should().parse().rule({ id: 'nonvacuity/code-block-parse' })
  if (scenario.expectEmpty === true) rule = rule.expectEmpty()
  if (scenario.excludeAll === true) rule = rule.excluding(/.*/)
  violations = rule.violations()
} catch (err) {
  if (scenario.throws !== undefined && isArchConfigError(err) && String(err.message).includes(scenario.throws)) {
    console.error(`bad-code-block-parse: ${name}: reported — it threw "${scenario.throws}"`)
    process.exit(1)
  }
  console.error(`bad-code-block-parse: ${name}: unexpected error — ${String(err)}`)
  process.exit(2)
}

if (scenario.throws === undefined && scenario.found(violations)) {
  console.error(`bad-code-block-parse: ${name}: reported as expected`)
  for (const v of violations) console.error(`  x ${v.message.split('\n')[0]}`)
  process.exit(1)
}

console.error(
  `bad-code-block-parse: ${name}: NOT reported — the check is vacuous ` +
    `(${String(violations.length)} finding(s): ${violations.map((v) => v.message.split('\n')[0]).join(' | ')})`,
)
process.exit(0)
