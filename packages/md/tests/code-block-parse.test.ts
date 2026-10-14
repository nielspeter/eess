import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { dedupeConfigFindings } from '@nielspeter/eess/internal'
import {
  corpus,
  codeBlocks,
  parseCodeBlocks,
  isArchConfigError,
  type CodeBlockParser,
  type CodeBlockVerdict,
  type ParsedCodeBlocks,
  DEFAULT_CODE_BLOCK_BUDGET,
} from '../src/index.js'

// Plan 0412: a code block parses with the parser the caller names.
const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/code-block-parse')
const at = (dir: string) => corpus({ roots: [`${dir}/**`], cwd: root })

const INSTRUMENT = 'eess-md: code-block parser'

/** A stub verdict per text: `BROKEN` on body line N is invalid at N; `UNKNOWN` is unrecognised. */
function judge(text: string): CodeBlockVerdict {
  if (text.startsWith('%%canary-unrecognised')) {
    return { outcome: 'unrecognised', message: 'not a diagram', remedy: 'declare a kind' }
  }
  const lines = text.split('\n')
  const broken = lines.findIndex((l) => l.includes('BROKEN') || l.startsWith('%%canary-invalid'))
  if (broken !== -1) {
    return { outcome: 'invalid', message: 'unexpected token', line: broken + 1, remedy: 'fix it' }
  }
  if (text.startsWith('UNKNOWN')) {
    return { outcome: 'unrecognised', message: 'no such kind', remedy: 'name a diagram kind' }
  }
  return { outcome: 'valid' }
}

function stub(overrides: Partial<CodeBlockParser> = {}): CodeBlockParser {
  return {
    name: 'stub',
    version: '1.0.0',
    canaries: [
      { text: '%%canary-invalid', expect: 'invalid' },
      { text: '%%canary-unrecognised', expect: 'unrecognised' },
    ],
    parse: (texts) => texts.map(judge),
    ...overrides,
  }
}

const rule = (parsed: ParsedCodeBlocks, id = 'test/parse') =>
  codeBlocks(parsed).should().parse().rule({ id })

describe('parseCodeBlocks + codeBlocks().should().parse() (plan 0412)', () => {
  it('passes a corpus whose every block is valid, examining each block of the language', async () => {
    const parsed = await parseCodeBlocks(at('valid'), { language: 'mermaid', parser: stub() })
    const r = rule(parsed).violations()
    expect(r).toHaveLength(0)
    expect(r.examined).toBe(2)
  })

  it('reports an invalid verdict at the block line plus the verdict line, nested blocks included', async () => {
    const parsed = await parseCodeBlocks(at('broken'), { language: 'mermaid', parser: stub() })
    const r = rule(parsed).violations()
    const invalid = r.find((v) => v.message.includes('unexpected token'))
    // The fence opens on line 3; BROKEN is body line 3, so Markdown line 6.
    expect(invalid?.line).toBe(6)
    expect(invalid?.file.endsWith('broken/c.md')).toBe(true)
    expect(invalid?.suggestion).toBe('fix it')
  })

  it('reports an unrecognised verdict with the parser remedy and never as a syntax error', async () => {
    const parsed = await parseCodeBlocks(at('broken'), { language: 'mermaid', parser: stub() })
    const r = rule(parsed).violations()
    const unrecognised = r.find((v) => v.message.includes('no such kind'))
    expect(unrecognised?.line).toBe(11)
    expect(unrecognised?.suggestion).toBe('name a diagram kind')
    expect(unrecognised?.message).not.toMatch(/syntax/i)
  })

  it('reports an invalid verdict with no inner line at the block line, saying the line is unknown', async () => {
    const parser = stub({
      parse: (texts) =>
        texts.map((t): CodeBlockVerdict => {
          const v = judge(t)
          return v.outcome === 'invalid' && !t.startsWith('%%') ? { ...v, line: null } : v
        }),
    })
    const r = rule(
      await parseCodeBlocks(at('broken'), { language: 'mermaid', parser }),
    ).violations()
    const invalid = r.find((v) => v.message.includes('unexpected token'))
    expect(invalid?.line).toBe(3)
    expect(invalid?.message).toMatch(/line inside the block is unknown/)
  })

  it('reports an invalid verdict whose line is outside the block at the block line, naming the value', async () => {
    for (const bad of [0, 99]) {
      const parser = stub({
        parse: (texts) =>
          texts.map((t): CodeBlockVerdict => {
            const v = judge(t)
            return v.outcome === 'invalid' && !t.startsWith('%%') ? { ...v, line: bad } : v
          }),
      })
      const r = rule(
        await parseCodeBlocks(at('broken'), { language: 'mermaid', parser }),
      ).violations()
      const invalid = r.find((v) => v.message.includes('unexpected token'))
      expect(invalid?.line).toBe(3)
      expect(invalid?.message).toContain(`the parser gave line ${String(bad)} for a 3-line block`)
    }
  })

  describe('the instrument: one finding per rule, with the pinned shape', () => {
    const cases: [string, Partial<CodeBlockParser>, RegExp][] = [
      [
        'a canary answered valid',
        { parse: (texts) => texts.map((): CodeBlockVerdict => ({ outcome: 'valid' })) },
        /canary 1 .*expected "invalid".*"valid"/,
      ],
      [
        'a parser that throws a bare error',
        {
          parse: () => {
            throw new Error('DOMPurify.addHook is not a function')
          },
        },
        /DOMPurify\.addHook is not a function/,
      ],
      [
        'a parser that returns too few verdicts',
        { parse: (texts) => texts.slice(1).map(judge) },
        /4 texts, 3 verdicts/,
      ],
      [
        'a verdict of undefined',
        { parse: (texts) => texts.map((t, i) => (i === 3 ? undefined : judge(t))) },
        /text 4 .*not a verdict/,
      ],
      [
        "a verdict { outcome: 'ok' }",
        { parse: (texts) => texts.map((t, i) => (i === 2 ? { outcome: 'ok' } : judge(t))) },
        /text 3 .*not a verdict/,
      ],
      [
        'an invalid verdict with an empty remedy',
        {
          parse: (texts) =>
            texts.map((t): CodeBlockVerdict => {
              const v = judge(t)
              return v.outcome === 'invalid' ? { ...v, remedy: '' } : v
            }),
        },
        /empty remedy/,
      ],
    ]
    for (const [name, overrides, says] of cases) {
      it(`reports ${name} as the instrument, once, never as a pass`, async () => {
        // A loose stub on purpose: the malformed cases return what no typed parser would.
        const parser: CodeBlockParser = stub(overrides)
        const parsed = await parseCodeBlocks(at('valid'), { language: 'mermaid', parser })
        const r = rule(parsed).violations()
        const instrument = r.filter((v) => v.ruleId === INSTRUMENT)
        expect(instrument).toHaveLength(1)
        expect(instrument[0]).toMatchObject({
          rule: INSTRUMENT,
          ruleId: INSTRUMENT,
          element: 'stub@1.0.0',
          file: '',
          bypassFilters: true,
        })
        expect(instrument[0]?.message).toMatch(says)
        expect(instrument[0]?.suggestion).toBeTruthy()
      })
    }

    it('collapses two rules over one failed fact object to one finding after dedupeConfigFindings', async () => {
      const parser = stub({
        parse: () => {
          throw new Error('boom')
        },
      })
      const parsed = await parseCodeBlocks(at('valid'), { language: 'mermaid', parser })
      const all = [...rule(parsed, 'a').violations(), ...rule(parsed, 'b').violations()]
      expect(all.filter((v) => v.ruleId === INSTRUMENT)).toHaveLength(2)
      expect(dedupeConfigFindings(all).filter((v) => v.ruleId === INSTRUMENT)).toHaveLength(1)
    })

    it('uses a structured failure remedy as the fix and maps its block index to a file and line', async () => {
      const parser = stub({
        parse: () => {
          throw Object.assign(new Error('worker exited'), {
            remedy: 'install the peer: npm i -D mermaid',
            blockIndex: 3,
          })
        },
      })
      const parsed = await parseCodeBlocks(at('valid'), { language: 'mermaid', parser })
      const instrument = rule(parsed)
        .violations()
        .filter((v) => v.ruleId === INSTRUMENT)
      expect(instrument[0]?.suggestion).toBe('install the peer: npm i -D mermaid')
      // Texts are the two canaries, then the blocks: index 3 is the second block, a.md:10.
      expect(instrument[0]?.message).toMatch(/valid\/a\.md:10/)
    })
  })

  describe('the budget', () => {
    it('aborts the signal of a parser that never resolves, and reports the budget it ran out of', async () => {
      let aborted = false
      const parser = stub({
        parse: (_texts, { signal }) =>
          new Promise<readonly CodeBlockVerdict[]>(() => {
            signal.addEventListener('abort', () => {
              aborted = true
            })
          }),
      })
      const parsed = await parseCodeBlocks(at('valid'), {
        language: 'mermaid',
        parser,
        budget: { startUpMs: 40, perBlockMs: 0 },
      })
      expect(aborted).toBe(true)
      const instrument = rule(parsed)
        .violations()
        .filter((v) => v.ruleId === INSTRUMENT)
      expect(instrument).toHaveLength(1)
      expect(instrument[0]?.message).toMatch(/40 ms/)
      expect(instrument[0]?.message).toMatch(/caller/)
    })

    it('names the block a parser reports when it stops on the abort', async () => {
      const parser = stub({
        parse: (_texts, { signal }) =>
          new Promise<readonly CodeBlockVerdict[]>((_resolve, reject) => {
            signal.addEventListener('abort', () => {
              reject(
                Object.assign(new Error('stopped'), { remedy: 'split the block', blockIndex: 2 }),
              )
            })
          }),
      })
      const parsed = await parseCodeBlocks(at('valid'), {
        language: 'mermaid',
        parser,
        budget: { startUpMs: 40, perBlockMs: 0 },
      })
      const instrument = rule(parsed)
        .violations()
        .filter((v) => v.ruleId === INSTRUMENT)
      expect(instrument[0]?.message).toMatch(/valid\/a\.md:3/)
    })

    it('reports a synchronous parser that overruns, after it returns', async () => {
      const parser = stub({
        parse: (texts) => {
          const until = Date.now() + 30
          while (Date.now() < until) {
            // a synchronous parser cannot be interrupted
          }
          return texts.map(judge)
        },
      })
      const parsed = await parseCodeBlocks(at('valid'), {
        language: 'mermaid',
        parser,
        budget: { startUpMs: 5, perBlockMs: 0 },
      })
      const instrument = rule(parsed)
        .violations()
        .filter((v) => v.ruleId === INSTRUMENT)
      expect(instrument).toHaveLength(1)
      expect(instrument[0]?.message).toMatch(/budget/)
    })

    it('defaults to ten seconds of start-up and a quarter second a block, as frozen in the plan', () => {
      expect(DEFAULT_CODE_BLOCK_BUDGET).toEqual({ startUpMs: 10_000, perBlockMs: 250 })
    })
  })

  describe('configuration errors throw before anything is selected', () => {
    const bad: [string, Partial<CodeBlockParser>][] = [
      ['no name', { name: '' }],
      ['no version', { version: '' }],
      ['no canaries', { canaries: [] }],
    ]
    for (const [name, overrides] of bad) {
      it(`throws for a parser with ${name}, even over a corpus with no block of the language`, async () => {
        await expect(
          parseCodeBlocks(at('other-lang'), { language: 'mermaid', parser: stub(overrides) }),
        ).rejects.toSatisfy(isArchConfigError)
      })
    }

    it('throws for a fact object parseCodeBlocks did not build', () => {
      const forged: ParsedCodeBlocks = {
        language: 'mermaid',
        parser: { name: 'stub', version: '1.0.0' },
        blocks: [],
        failure: null,
        nearMisses: [],
        documentsLoaded: 1,
        summary: () => '',
      }
      expect(() => codeBlocks(forged)).toThrow(/parseCodeBlocks/)
    })
  })

  describe('empty, in order', () => {
    it('reports no Markdown loaded even with expectEmpty declared', async () => {
      const parsed = await parseCodeBlocks(at('nothing-here'), {
        language: 'mermaid',
        parser: stub(),
      })
      const r = rule(parsed).expectEmpty().violations()
      expect(r.length).toBeGreaterThan(0)
    })

    it('reports files with no block of the language without expectEmpty, and passes with it', async () => {
      const parsed = await parseCodeBlocks(at('other-lang'), {
        language: 'mermaid',
        parser: stub(),
      })
      expect(rule(parsed).violations().length).toBeGreaterThan(0)
      expect(rule(parsed).expectEmpty().violations()).toHaveLength(0)
    })

    it('names a near-miss tag when it is why nothing was examined', async () => {
      const parsed = await parseCodeBlocks(at('near-miss'), {
        language: 'mermaid',
        parser: stub(),
      })
      const r = rule(parsed).violations()
      expect(r.map((v) => v.message).join('\n')).toMatch(/`Mermaid`.*near-miss\/only\.md:3/s)
    })

    it('discloses a near-miss tag in the summary of a green run', async () => {
      const parsed = await parseCodeBlocks(at('valid'), { language: 'mermaid', parser: stub() })
      expect(rule(parsed).violations()).toHaveLength(0)
      expect(parsed.summary()).toMatch(/2 mermaid blocks parsed with stub 1\.0\.0/)
      expect(parsed.summary()).toMatch(/`Mermaid`.*valid\/b\.md:3/)
    })
  })

  it('narrows with a predicate and never widens past the parsed set', async () => {
    const parsed = await parseCodeBlocks(at('broken'), { language: 'mermaid', parser: stub() })
    const all = codeBlocks(parsed).should().parse().violations()
    const none = codeBlocks(parsed)
      .that()
      .resideInFile('**/nowhere.md')
      .should()
      .parse()
      .expectEmpty()
      .violations()
    expect(all.length).toBe(2)
    expect(none).toHaveLength(0)
    expect(none.examined).toBe(0)
  })
})
