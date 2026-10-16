import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { mermaidParser } from '../src/index.js'
import {
  createMermaidParser,
  type MermaidVerdict,
} from '../src/mermaid-js/create-mermaid-parser.js'

// Plan 0413: Mermaid's own parser, alone — no eess-md. Each test that needs a stub `mermaid`, none,
// or the real one runs a copy of the worker in a scratch directory whose `node_modules` holds it.

const WORKER = fileURLToPath(new URL('../src/mermaid-js/mermaid-worker.mjs', import.meta.url))
const require = createRequire(import.meta.url)
const scratchDirs: string[] = []
afterAll(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true })
})

function realPackage(name: string): string {
  for (const dir of require.resolve.paths(name) ?? []) {
    if (existsSync(join(dir, name, 'package.json'))) return join(dir, name)
  }
  throw new Error(`${name} is not installed for the tests`)
}

type Module = 'real' | { readonly version: string; readonly source: string; readonly raw?: string }

/** A copy of the worker in a scratch directory, with these packages in its `node_modules`. */
function scratchWorker(modules: Readonly<Record<string, Module>>): URL {
  const dir = mkdtempSync(join(tmpdir(), 'eess-mermaid-worker-'))
  scratchDirs.push(dir)
  copyFileSync(WORKER, join(dir, 'mermaid-worker.mjs'))
  for (const [name, module] of Object.entries(modules)) {
    mkdirSync(join(dir, 'node_modules'), { recursive: true })
    const target = join(dir, 'node_modules', name)
    if (module === 'real') {
      symlinkSync(realPackage(name), target)
      continue
    }
    mkdirSync(target)
    // An import-only `exports` map: no `require` condition, no `./package.json` entry.
    const pkg = {
      name,
      version: module.version,
      type: 'module',
      exports: { '.': { import: './index.mjs' } },
    }
    writeFileSync(join(target, 'package.json'), module.raw ?? JSON.stringify(pkg))
    writeFileSync(join(target, 'index.mjs'), module.source)
  }
  return pathToFileURL(join(dir, 'mermaid-worker.mjs'))
}

const STUB_JSDOM: Module = {
  version: '29.1.1',
  source: 'export class JSDOM { constructor() { this.window = {} } }',
}
const stubMermaid = (parse: string, version = '11.17.2', prelude = ''): Module => ({
  version,
  source: `${prelude}\nexport default { parse: ${parse} }`,
})
const NEVER_THROWS = stubMermaid('async () => ({ diagramType: "flowchart" })')

const run = (budgetMs = 60_000, signal = new AbortController().signal) => ({ signal, budgetMs })

/** As eess-md calls a parser: its own canaries first, then the blocks. */
const withCanaries = (
  parser: { canaries: readonly { text: string }[] },
  texts: readonly string[],
) => [...parser.canaries.map((c) => c.text), ...texts]

/** The parse's rejection, by shape: what eess-md reads. */
async function rejection(
  promise: Promise<unknown>,
): Promise<{ message: string; remedy: string; blockIndex: number | null }> {
  try {
    await promise
  } catch (error) {
    if (!(error instanceof Error)) throw new Error('rejected with a non-error', { cause: error })
    const remedy: unknown = 'remedy' in error ? error.remedy : undefined
    const blockIndex: unknown = 'blockIndex' in error ? error.blockIndex : undefined
    if (typeof remedy !== 'string') throw new Error(`no remedy: ${error.message}`, { cause: error })
    if (blockIndex !== null && typeof blockIndex !== 'number')
      throw new Error('no blockIndex', { cause: error })
    return { message: error.message, remedy, blockIndex }
  }
  throw new Error('the parse resolved')
}

const P = (lines: readonly string[]): string => lines.join('\n')
const GLOBALS = ['window', 'document', 'DOMParser', 'Element', 'HTMLElement']

describe('mermaidParser(), the real mermaid in a worker', () => {
  it('leaves the host globals as they were after a parse', async () => {
    const before = GLOBALS.filter((key) => key in globalThis)
    await mermaidParser().parse([P(['flowchart TD', '  A["a label"] --> B'])], run())
    expect(GLOBALS.filter((key) => key in globalThis)).toEqual(before)
  }, 30_000)

  it('names itself with the installed mermaid', () => {
    const parser = mermaidParser()
    expect(parser.name).toBe('mermaid')
    expect(parser.version).toBe('11.17.2')
    expect(parser.canaries.map((c) => c.expect)).toEqual(['invalid', 'invalid', 'unrecognised'])
  })

  it('reads a valid block of each kind spike 0411 measured as valid', async () => {
    const valid = [
      P(['flowchart TD', '  A["a label"] --> B']),
      P(['classDiagram', '  class A']),
      P(['stateDiagram-v2', '  [*] --> A']),
      P(['mindmap', '  root((r))', '    a']),
      P(['sequenceDiagram', '  A->>B: hi']),
      P(['erDiagram', '  A ||--o{ B : x']),
    ]
    const verdicts = await mermaidParser().parse(valid, run())
    expect(verdicts).toEqual(valid.map(() => ({ outcome: 'valid' })))
  }, 30_000)

  it('answers each of its own canaries as it declares', async () => {
    const parser = mermaidParser()
    const verdicts = await parser.parse(
      parser.canaries.map((c) => c.text),
      run(),
    )
    expect(verdicts.map((v) => v.outcome)).toEqual(parser.canaries.map((c) => c.expect))
  }, 30_000)

  // The outcome table: each row, one block, then the same block fixed as its remedy says.
  const rows: readonly {
    readonly name: string
    readonly broken: string
    readonly want: Partial<MermaidVerdict> & { outcome: string }
    readonly remedy: RegExp
    readonly fixed: string
  }[] = [
    {
      name: 'unclosed frontmatter',
      broken: P(['---', 'title: x', 'flowchart TD', '  A --> B']),
      want: { outcome: 'invalid', line: 1 },
      remedy: /Close the frontmatter/,
      fixed: P(['---', 'title: x', '---', 'flowchart TD', '  A --> B']),
    },
    {
      name: 'closed frontmatter with nothing after it',
      broken: P(['---', 'title: x', '---']),
      want: { outcome: 'invalid', line: 1 },
      remedy: /followed by a newline and the diagram/,
      fixed: P(['---', 'title: x', '---', 'flowchart TD', '  A --> B']),
    },
    {
      name: 'closed frontmatter and a newline, with no diagram after it',
      broken: P(['---', 'title: x', '---', '']),
      want: { outcome: 'unrecognised' },
      remedy: /declares no diagram after its directives, comments or frontmatter/,
      fixed: P(['---', 'title: x', '---', 'flowchart TD', '  A --> B']),
    },
    {
      name: 'an unclosed directive',
      broken: P(['%%{init: {', 'flowchart TD', '  A --> B']),
      want: { outcome: 'unrecognised' },
      remedy: /never closed with `}%%`/,
      fixed: P(['%%{init: {}}%%', 'flowchart TD', '  A --> B']),
    },
    {
      name: 'a jison syntax error',
      broken: P(['flowchart TD', '  A --> B', '  C --> --> D']),
      want: { outcome: 'invalid', line: 3 },
      remedy: /Fix the syntax at this line/,
      fixed: P(['flowchart TD', '  A --> B', '  C --> D']),
    },
    {
      name: 'a Langium syntax error',
      broken: P(['packet-beta', '0-10: "a"', '1x-2: "b"']),
      want: { outcome: 'invalid', line: 3 },
      remedy: /Fix the syntax at this line/,
      fixed: P(['packet-beta', '0-10: "a"', '11-20: "b"']),
    },
    {
      name: 'a misspelt kind',
      broken: P(['flowchrt TD', '  A --> B']),
      want: { outcome: 'unrecognised' },
      remedy: /Check the spelling of the diagram kind/,
      fixed: P(['flowchart TD', '  A --> B']),
    },
    {
      name: 'a kind not in core mermaid',
      broken: P(['zenuml', '  A->B: hi']),
      want: { outcome: 'unrecognised' },
      remedy: /needs a newer `mermaid` or a plugin/,
      fixed: P(['sequenceDiagram', '  A->>B: hi']),
    },
    {
      name: 'an empty block',
      broken: '',
      want: { outcome: 'unrecognised' },
      remedy: /The block is empty/,
      fixed: P(['flowchart TD', '  A --> B']),
    },
    {
      name: 'no kind after a preamble',
      broken: P(['%% only a comment', '%%{init: {}}%%']),
      want: { outcome: 'unrecognised' },
      remedy: /declares no diagram after its directives, comments or frontmatter/,
      fixed: P(['%% only a comment', '%%{init: {}}%%', 'flowchart TD', '  A --> B']),
    },
  ]

  it('reads each row of the outcome table, and each fixed block as valid', async () => {
    const texts = [...rows.map((r) => r.broken), ...rows.map((r) => r.fixed)]
    const verdicts = await mermaidParser().parse(texts, run())
    for (const [i, row] of rows.entries()) {
      const verdict = verdicts[i]
      expect(verdict, row.name).toMatchObject(row.want)
      expect(verdict !== undefined && 'remedy' in verdict ? verdict.remedy : '', row.name).toMatch(
        row.remedy,
      )
      expect(verdicts[rows.length + i], `${row.name}, fixed`).toEqual({ outcome: 'valid' })
    }
  }, 30_000)

  // The walk reads no kind here: it splits lines on `\r?\n`, Mermaid on `\r\n?` (bug 0434).
  it('lets Mermaid accepting a block win over the preamble walk', async () => {
    const verdicts = await mermaidParser().parse(['%% c\rflowchart TD\r  A --> B'], run())
    expect(verdicts).toEqual([{ outcome: 'valid' }])
  }, 30_000)

  // Mermaid found a diagram to parse, so its placed syntax error outranks the walk, which reads no
  // kind here (bug 0434).
  it('reads a syntax error Mermaid places as invalid even where the walk reads no kind', async () => {
    const verdicts = await mermaidParser().parse(
      ['%% c\rflowchart TD\r  A --> B\r  C --> --> D'],
      run(),
    )
    expect(verdicts).toEqual([expect.objectContaining({ outcome: 'invalid', line: 4 })])
  }, 30_000)

  it('reads frontmatter Mermaid cannot read as YAML as invalid, on the YAML line', async () => {
    const verdicts = await mermaidParser().parse(
      [
        P(['---', 'title: [x', '---', 'flowchart TD', '  A --> B']),
        P(['---', 'a: 1', '  b: 2', '---', 'flowchart TD', '  A --> B']),
      ],
      run(),
    )
    for (const verdict of verdicts) {
      expect(verdict).toMatchObject({
        outcome: 'invalid',
        line: 3,
        remedy: "Fix the frontmatter's YAML at this line; Mermaid's message is above.",
      })
    }
  }, 30_000)

  // A node's `@{ … }` data is YAML too, counted on a snippet of Mermaid's own (PR review, N1).
  it('claims no frontmatter line for YAML that is not the frontmatter', async () => {
    const verdicts = await mermaidParser().parse(
      [
        P([
          'flowchart TD',
          '  A --> B',
          '  B --> C',
          '  C --> D',
          '  D --> E',
          '  E --> F',
          '  G@{ shape: [ }',
        ]),
        P(['', '---', 'title: [x', '---', 'flowchart TD', '  A --> B']),
      ],
      run(),
    )
    for (const verdict of verdicts) {
      expect(verdict).toMatchObject({ outcome: 'invalid', line: null })
      expect(verdict !== undefined && 'remedy' in verdict ? verdict.remedy : '').toContain(
        "its frontmatter or a node's `@{ … }` data",
      )
    }
  }, 30_000)

  // Mermaid reads frontmatter after a blank line or a comment; the line map does not (bug 0435).
  it('claims no line where Mermaid read frontmatter the line map does not', async () => {
    const verdicts = await mermaidParser().parse(
      [
        P(['', '---', 'title: x', '---', 'flowchart TD', '  A --> B', '  C --> --> D']),
        P(['%% c', '---', 'title: x', '---', 'flowchart TD', '  C --> --> D']),
      ],
      run(),
    )
    for (const verdict of verdicts) {
      expect(verdict).toMatchObject({ outcome: 'invalid', line: null })
      expect(verdict !== undefined && 'message' in verdict ? verdict.message : '').toContain(
        "Mermaid read frontmatter here that eess-mermaid's line map does not",
      )
    }
  }, 30_000)

  it('answers for a block of several hundred kilobytes without overflowing', async () => {
    // One long run before a comment: the line map once spread a run that size into `push`.
    // A sequence diagram, since Mermaid caps a flowchart at 500 edges.
    const messages = Array.from({ length: 25_000 }, (_, i) => `  A->>B: message ${String(i)}`)
    const text = P(['sequenceDiagram', ...messages, '  %% c', '  A->>'])
    expect(text.length).toBeGreaterThan(300_000)
    const verdicts = await mermaidParser().parse([text], run())
    expect(verdicts).toEqual([
      expect.objectContaining({ outcome: 'invalid', line: messages.length + 3 }),
    ])
  }, 30_000)

  const lines: readonly (readonly [string, number])[] = [
    [P(['flowchart TD', '  A --> B', '  %% c', '  %% c', '  C --> --> D', '  E --> F']), 5],
    [P(['flowchart TD', '  A --> B', '%%', '  C --> --> D', '  E --> F']), 4],
    [P(['flowchart TD', '  A --> B', '      %%x', '  C --> --> D', '  E --> F']), 4],
    [
      P([
        'flowchart TD',
        '  A --> B',
        '%%{init: {"theme":"dark"}}%%',
        '  C --> --> D',
        '  E --> F',
      ]),
      4,
    ],
    [P(['%%{init: {', '"theme":"dark"', '}}%%', 'flowchart TD', '  C --> --> D', '  E --> F']), 5],
    [
      P([
        'flowchart TD',
        '  A --> B',
        '%%{init: {',
        '"theme":"dark"',
        '}}%%',
        '  C --> --> D',
        '  E --> F',
      ]),
      6,
    ],
    [P(['---', 'title: x', '---', '', '', 'flowchart TD', '  C --> --> D', '  E --> F']), 7],
    [P(['%% a', '', 'flowchart TD', '  C --> --> D', '  E --> F']), 4],
    [P(['flowchart TD', '  A --> --> B', '  %% end']), 2],
    [P(['flowchart TD', '  A --> B', '  %% c', '  C --> D ]]] x', '  E --> F']), 4],
    ['flowchart TD\r\n  A --> B\r\n  %% c\r\n  C --> --> D\r\n  E --> F', 4],
    [P(['packet-beta', '0-10: "a"', '%% c', '%% c', '11-x: "b"']), 5],
    [P(['packet-beta', '0-10: "a"', '1x-2: "b"', '12-20: "c"', '2y-30: "d"']), 3],
    [P(['flowchart TD', '  A --> B', '', '  %% c', '', '  C --> --> D', '  E --> F']), 6],
    [P(['flowchart TD', '  A --> B', '', '', '  C --> --> D', '  E --> F']), 5],
    [P(['---', 'title: x', '---', '%% c', 'flowchart TD', '  C --> --> D', '  E --> F']), 6],
    [P(['flowchart TD', '  %% c', '  C --> --> D']), 3],
  ]

  it('puts the error of each of spike 0428 mapped blocks on its true body line', async () => {
    const verdicts = await mermaidParser().parse(
      lines.map(([text]) => text),
      run(),
    )
    for (const [i, [text, line]] of lines.entries()) {
      expect(verdicts[i], JSON.stringify(text)).toMatchObject({ outcome: 'invalid', line })
    }
  }, 30_000)

  // Two of Mermaid's lexers lose lines after a trailing comment (spike 0428 Q2, PR #219's review).
  const trailing: readonly (readonly [string, number])[] = [
    [P(['flowchart TD', '  A --> B %% t', '  C --> --> D', '  E --> F']), 2],
    [P(['flowchart TD', '  A --> B %% t', '  B --> C %% u', '  C --> --> D']), 2],
    [P(['flowchart TD %% t', '  A --> B', '  C --> --> D']), 1],
    [P(['erDiagram', '  A ||--o{ B : x %% t', '  C ||--o{ : y']), 2],
  ]

  it('claims no line for a block with a trailing comment, and quotes Mermaid', async () => {
    const verdicts = await mermaidParser().parse(
      trailing.map(([text]) => text),
      run(),
    )
    for (const [i, [text, reported]] of trailing.entries()) {
      expect(verdicts[i], JSON.stringify(text)).toMatchObject({ outcome: 'invalid', line: null })
      const verdict = verdicts[i]
      expect(verdict !== undefined && 'message' in verdict ? verdict.message : '').toContain(
        `unreliable in a block with a trailing \`%%\` comment; it reported line ${String(reported)}`,
      )
    }
  }, 30_000)
})

// A stub that answers the line canary's own blocks as mermaid 11.17.2 does, so a test can reach
// the classification of the texts after them. `body` decides every other text.
const CANARY_AWARE = `
const fail = (message, extra) => { throw Object.assign(new Error(message), extra) }
function lineCanary(text) {
  if (text.startsWith('---\\ntitle: x')) fail('canary 1', { hash: { loc: { first_line: 7 }, line: 6 } })
  if (text.includes(']]]')) fail('canary 2', { hash: { line: 2 } })
  if (text.startsWith('packet-beta') && text.includes('11-x')) fail('canary 3', { result: { lexerErrors: [{ line: 3 }], parserErrors: [] } })
}`
const answering = (body: string, version = '11.17.2', prelude = ''): Module =>
  stubMermaid(
    `async (text) => { lineCanary(text); ${body} }`,
    version,
    `${CANARY_AWARE}\n${prelude}`,
  )

describe('mermaidParser() against a stub mermaid', () => {
  it('reads a failure with no line as invalid with line null, for each shape', async () => {
    const parser = createMermaidParser({
      workerUrl: scratchWorker({
        mermaid: answering(`
          if (text.includes('NO-LOC')) fail('jison, no line', { hash: {} })
          if (text.includes('NO-LANGIUM-LINE')) fail('langium, no line', { result: { lexerErrors: [{}], parserErrors: [{ token: {} }] } })
          fail('jison, past the end', { hash: { loc: { first_line: 99 } } })`),
        jsdom: STUB_JSDOM,
      }),
    })
    const verdicts = await parser.parse(
      ['flowchart TD\n  NO-LOC', 'packet-beta\n  NO-LANGIUM-LINE', 'flowchart TD\n  A -->'],
      run(),
    )
    expect(verdicts).toEqual([
      expect.objectContaining({ outcome: 'invalid', line: null, message: 'jison, no line' }),
      expect.objectContaining({ outcome: 'invalid', line: null, message: 'langium, no line' }),
      expect.objectContaining({ outcome: 'invalid', line: null, message: 'jison, past the end' }),
    ])
  }, 30_000)

  it('reports a throw it does not recognise for a declared block as the instrument', async () => {
    const parser = createMermaidParser({
      workerUrl: scratchWorker({
        mermaid: answering(`fail('DOMPurify.addHook is not a function')`),
        jsdom: STUB_JSDOM,
      }),
    })
    const failure = await rejection(parser.parse(['flowchart TD\n  A --> B'], run()))
    expect(failure).toMatchObject({
      blockIndex: 0,
      remedy: 'If this block is wrong, fix it; otherwise report it to eess.',
    })
    expect(failure.message).toContain('DOMPurify.addHook is not a function')
  }, 30_000)

  it('reports a parse that resolves without a result as the instrument', async () => {
    const parser = createMermaidParser({
      workerUrl: scratchWorker({ mermaid: stubMermaid('async () => false'), jsdom: STUB_JSDOM }),
    })
    const failure = await rejection(parser.parse(['flowchart TD\n  A --> B'], run()))
    expect(failure.message).toContain('resolved without a result')
  }, 30_000)

  it('leaves a mermaid that stopped throwing to the canaries: every block is valid', async () => {
    const parser = createMermaidParser({
      workerUrl: scratchWorker({ mermaid: NEVER_THROWS, jsdom: STUB_JSDOM }),
    })
    const verdicts = await parser.parse([...parser.canaries.map((c) => c.text), 'x'], run())
    expect(verdicts.every((v) => v.outcome === 'valid')).toBe(true)
  }, 30_000)

  it('reports a line-canary block Mermaid accepts as the instrument', async () => {
    const parser = createMermaidParser({
      workerUrl: scratchWorker({
        // Accepts line-canary block 1; rejects everything else, its own canaries included.
        mermaid: stubMermaid(
          `async (text) => { if (text.startsWith('---')) return {}; lineCanary(text); fail('no line', { hash: {} }) }`,
          '11.17.2',
          CANARY_AWARE,
        ),
        jsdom: STUB_JSDOM,
      }),
    })
    const failure = await rejection(parser.parse(withCanaries(parser, ['flowchart TD']), run()))
    expect(failure.message).toContain('mermaid 11.17.2 accepted line-canary block 1')
    expect(failure.remedy).toBe('Install `mermaid@11.17.2`, and report the version to eess.')
  }, 30_000)

  it('reports a line-canary block rejected with no syntax error as the instrument, quoting Mermaid', async () => {
    const parser = createMermaidParser({
      workerUrl: scratchWorker({
        mermaid: stubMermaid(
          `async (text) => { if (text.startsWith('---')) fail('DOMPurify.sanitize is not a function'); lineCanary(text); return {} }`,
          '11.17.2',
          CANARY_AWARE,
        ),
        jsdom: STUB_JSDOM,
      }),
    })
    const failure = await rejection(parser.parse(['flowchart TD'], run()))
    expect(failure.message).toContain(
      'rejected line-canary block 1 with something that is not a syntax error: DOMPurify.sanitize is not a function',
    )
  }, 30_000)

  it('prefers the parse error location over the lexer line when they disagree', async () => {
    const parser = createMermaidParser({
      workerUrl: scratchWorker({
        mermaid: answering(`fail('both', { hash: { loc: { first_line: 4 }, line: 9 } })`),
        jsdom: STUB_JSDOM,
      }),
    })
    const verdicts = await parser.parse([P(['flowchart TD', 'a', 'b', 'c', 'd', 'e'])], run())
    expect(verdicts).toEqual([expect.objectContaining({ outcome: 'invalid', line: 4 })])
  }, 30_000)

  it('reds the line canary when the map disagrees with mermaid, naming both versions', async () => {
    const parser = createMermaidParser({
      workerUrl: scratchWorker({
        mermaid: stubMermaid(
          `async (text) => { if (text.startsWith('---')) fail('moved', { hash: { loc: { first_line: 8 } } }); lineCanary(text); return {} }`,
          '11.20.0',
          CANARY_AWARE,
        ),
        jsdom: STUB_JSDOM,
      }),
    })
    const failure = await rejection(parser.parse(['flowchart TD\n  A --> B'], run()))
    expect(failure).toMatchObject({
      blockIndex: null,
      remedy: 'Install `mermaid@11.17.2`, and report the version to eess.',
    })
    expect(failure.message).toContain(
      'line map, written for mermaid 11.17.2, disagrees with mermaid 11.20.0',
    )
  }, 30_000)
})

describe('the version mermaidParser() names', () => {
  it('reads an import-only exports map without loading mermaid', () => {
    const url = scratchWorker({ mermaid: stubMermaid('async () => ({})', '11.5.0') })
    expect(createMermaidParser({ workerUrl: url }).version).toBe('11.5.0')
  })

  it('reports an unreadable package.json as the instrument, naming the file', async () => {
    const url = scratchWorker({ mermaid: { version: '', source: '', raw: '{ not json' } })
    const parser = createMermaidParser({ workerUrl: url })
    expect(parser.version).toBe('unreadable')
    const failure = await rejection(parser.parse(['flowchart TD'], run()))
    expect(failure.message).toContain(join('node_modules', 'mermaid', 'package.json'))
    expect(failure.remedy).toBe('Reinstall `mermaid`.')
    // Cleared: a stub with a valid package.json.
    const cleared = createMermaidParser({
      workerUrl: scratchWorker({ mermaid: NEVER_THROWS, jsdom: STUB_JSDOM }),
    })
    await expect(
      cleared.parse(withCanaries(cleared, ['flowchart TD']), run()),
    ).resolves.toHaveLength(4)
  }, 30_000)

  it('reports a mermaid outside major 11 as the instrument, and a major 11 prerelease clears it', async () => {
    for (const version of ['12.0.0-rc.1', '10.9.0']) {
      const parser = createMermaidParser({
        workerUrl: scratchWorker({
          mermaid: stubMermaid('async () => ({})', version),
          jsdom: STUB_JSDOM,
        }),
      })
      const failure = await rejection(parser.parse(['flowchart TD'], run()))
      expect(failure.message).toContain(`mermaid ${version} is installed`)
      expect(failure.remedy).toBe('eess-mermaid reads mermaid 11; install `mermaid@11`.')
    }
    const cleared = createMermaidParser({
      workerUrl: scratchWorker({
        mermaid: stubMermaid('async () => ({})', '11.0.0-alpha.1'),
        jsdom: STUB_JSDOM,
      }),
    })
    await expect(
      cleared.parse(withCanaries(cleared, ['flowchart TD']), run()),
    ).resolves.toHaveLength(4)
  }, 30_000)
})

describe('the worker failing', () => {
  it('reports a missing mermaid before it starts, and a missing jsdom from the worker', async () => {
    const none = createMermaidParser({ workerUrl: scratchWorker({}) })
    expect(none.version).toBe('not installed')
    const missing = await rejection(none.parse(['flowchart TD'], run()))
    expect(missing.remedy).toBe('Install both peers: `npm i -D mermaid@11 jsdom`.')

    const url = scratchWorker({ mermaid: 'real' })
    const noDom = await rejection(
      createMermaidParser({ workerUrl: url }).parse(['flowchart TD'], run()),
    )
    expect(noDom.message).toContain('could not load jsdom')
    expect(noDom.remedy).toBe('Install both peers: `npm i -D mermaid@11 jsdom`.')

    // Cleared: the same worker copy with jsdom linked in.
    symlinkSync(
      realPackage('jsdom'),
      join(fileURLToPath(new URL('.', url)), 'node_modules', 'jsdom'),
    )
    await expect(
      createMermaidParser({ workerUrl: url }).parse(['flowchart TD\n  A --> B'], run()),
    ).resolves.toEqual([{ outcome: 'valid' }])
  }, 30_000)

  it('names a missing dependency of the peers', async () => {
    const url = scratchWorker({
      mermaid: NEVER_THROWS,
      jsdom: {
        version: '29.1.1',
        source:
          "import 'eess-absent-dependency'\nexport class JSDOM { constructor() { this.window = {} } }",
      },
    })
    const failure = await rejection(createMermaidParser({ workerUrl: url }).parse(['x'], run()))
    expect(failure.remedy).toBe(
      '`eess-absent-dependency`, a dependency of mermaid or jsdom, is missing; reinstall them.',
    )
    // Cleared: the dependency installed.
    const dep = join(fileURLToPath(new URL('.', url)), 'node_modules', 'eess-absent-dependency')
    mkdirSync(dep)
    writeFileSync(
      join(dep, 'package.json'),
      JSON.stringify({ name: 'eess-absent-dependency', type: 'module', exports: './index.mjs' }),
    )
    writeFileSync(join(dep, 'index.mjs'), 'export {}')
    const cleared = createMermaidParser({ workerUrl: url })
    await expect(cleared.parse(withCanaries(cleared, ['x']), run())).resolves.toHaveLength(4)
  }, 30_000)

  it('names the block in flight when the worker exits without a result', async () => {
    const url = scratchWorker({
      mermaid: answering(`if (text.includes('EXIT')) process.exit(7); return {}`),
      jsdom: STUB_JSDOM,
    })
    const failure = await rejection(
      createMermaidParser({ workerUrl: url }).parse(
        ['flowchart TD', 'flowchart TD\n  EXIT'],
        run(),
      ),
    )
    expect(failure).toMatchObject({
      blockIndex: 1,
      remedy:
        'Leave that document out of the corpus by its `ignore` glob, and report the block to eess.',
    })
    expect(failure.message).toContain('exited (code 7) without a result, while parsing text 2')
    // Cleared: the same run without that block.
    await expect(
      createMermaidParser({ workerUrl: url }).parse(['flowchart TD'], run()),
    ).resolves.toHaveLength(1)
  }, 30_000)

  it('names the block in flight and the budget when a parse runs past it', async () => {
    const url = scratchWorker({
      mermaid: answering(
        `if (text.includes('SLOW')) await new Promise((r) => setTimeout(r, 1500)); return {}`,
      ),
      jsdom: STUB_JSDOM,
    })
    const parser = createMermaidParser({ workerUrl: url })
    const abort = new AbortController()
    const pending = parser.parse(['flowchart TD', 'flowchart TD\n  SLOW'], run(400, abort.signal))
    setTimeout(() => abort.abort(), 400)
    const failure = await rejection(pending)
    expect(failure).toMatchObject({ blockIndex: 1 })
    expect(failure.message).toContain('still parsing text 2 when the budget of 400 ms ran out')
    expect(failure.remedy).toContain('Raise `budget.perBlockMs`')
    // Cleared: the same run with a larger budget.
    await expect(
      parser.parse(['flowchart TD', 'flowchart TD\n  SLOW'], run(20_000)),
    ).resolves.toHaveLength(2)
  }, 30_000)

  it('honours a signal that is already aborted', async () => {
    const url = scratchWorker({ mermaid: NEVER_THROWS, jsdom: STUB_JSDOM })
    const failure = await rejection(
      createMermaidParser({ workerUrl: url }).parse(
        ['flowchart TD'],
        run(60_000, AbortSignal.abort()),
      ),
    )
    expect(failure).toMatchObject({ blockIndex: null, remedy: 'Raise `budget.startUpMs`.' })
  }, 30_000)

  it('names start-up when the budget runs out before the first block', async () => {
    const url = scratchWorker({
      mermaid: stubMermaid(
        'async () => ({})',
        '11.17.2',
        'await new Promise((r) => setTimeout(r, 60_000))',
      ),
      jsdom: STUB_JSDOM,
    })
    const abort = new AbortController()
    const pending = createMermaidParser({ workerUrl: url }).parse(
      ['flowchart TD'],
      run(300, abort.signal),
    )
    setTimeout(() => abort.abort(), 300)
    const failure = await rejection(pending)
    expect(failure).toMatchObject({ blockIndex: null, remedy: 'Raise `budget.startUpMs`.' })
  }, 30_000)
})
