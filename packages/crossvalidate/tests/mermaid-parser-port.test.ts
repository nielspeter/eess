import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import {
  codeBlocks,
  corpus,
  parseCodeBlocks,
  type CodeBlockBudget,
  type CodeBlockParser,
  type CorpusOptions,
} from '@nielspeter/eess-md'
import { mermaidParser } from '@nielspeter/eess-mermaid'

// Plan 0413: eess-mermaid's `mermaidParser()` fills eess-md's code-block parser port (plan 0412).
// eess-mermaid matches the port by shape and imports nothing of eess-md, so the test that needs both
// lives here. `@nielspeter/eess-mermaid` resolves to `dist/`: these run the built, copied worker.

const FIXTURES = fileURLToPath(new URL('./fixtures/mermaid-parser/', import.meta.url))
const REPO = fileURLToPath(new URL('../../../', import.meta.url))
const scratchDirs: string[] = []
afterAll(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true })
})

/** A corpus of one Markdown file holding these blocks, each after a heading. */
function markdown(blocks: readonly string[]): { cwd: string; fenceLines: number[] } {
  const cwd = mkdtempSync(join(tmpdir(), 'eess-mermaid-port-'))
  scratchDirs.push(cwd)
  mkdirSync(join(cwd, 'docs'))
  const lines = ['# Blocks', '']
  const fenceLines: number[] = []
  for (const [i, block] of blocks.entries()) {
    lines.push(`## ${String(i + 1)}`, '')
    fenceLines.push(lines.length + 1)
    lines.push('```mermaid', ...block.split('\n'), '```', '')
  }
  writeFileSync(join(cwd, 'docs', 'blocks.md'), lines.join('\n'))
  return { cwd, fenceLines }
}

const P = (lines: readonly string[]): string => lines.join('\n')

describe("mermaidParser() fills eess-md's parser port", () => {
  // Its remedies tell the author to change eess-md options by name; these fail the typecheck if
  // eess-md renames them.
  it('names eess-md options in its remedies that eess-md has', () => {
    const budget: Required<CodeBlockBudget> = { startUpMs: 1, perBlockMs: 1 }
    const options: Pick<CorpusOptions, 'ignore'> = { ignore: [] }
    expect(Object.keys(budget)).toEqual(['startUpMs', 'perBlockMs'])
    expect(options.ignore).toEqual([])
  })

  it('is a CodeBlockParser by type, and runs the two-line example', async () => {
    const parser: CodeBlockParser = mermaidParser()
    const { cwd } = markdown([
      P(['flowchart TD', '  A["a label"] --> B']),
      P(['erDiagram', '  A ||--o{ B : x']),
    ])
    const parsed = await parseCodeBlocks(corpus({ roots: ['docs/**'], cwd }), {
      language: 'mermaid',
      parser,
    })
    expect(parsed.summary()).toBe('2 mermaid blocks parsed with mermaid 11.17.2')
    expect(codeBlocks(parsed).should().parse().rule({ id: 'port' }).violations()).toHaveLength(0)
  }, 30_000)

  // Spike 0428's mapped blocks: [block, the true body line of its error].
  const mapped: readonly (readonly [string, number])[] = [
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

  it('reports each of spike 0428 mapped blocks on its exact Markdown line', async () => {
    const { cwd, fenceLines } = markdown(mapped.map(([text]) => text))
    const parsed = await parseCodeBlocks(corpus({ roots: ['docs/**'], cwd }), {
      language: 'mermaid',
      parser: mermaidParser(),
    })
    const found = codeBlocks(parsed).should().parse().rule({ id: 'port' }).violations()
    expect(found.map((v) => v.line)).toEqual(
      mapped.map(([, line], i) => (fenceLines[i] ?? Number.NaN) + line),
    )
  }, 30_000)

  it('names the block, not a line, for a block with a trailing comment', async () => {
    const trailing = [
      P(['flowchart TD', '  A --> B %% t', '  C --> --> D', '  E --> F']),
      P(['flowchart TD', '  A --> B %% t', '  B --> C %% u', '  C --> --> D']),
      P(['flowchart TD %% t', '  A --> B', '  C --> --> D']),
      P(['erDiagram', '  A ||--o{ B : x %% t', '  C ||--o{ : y']),
    ]
    const { cwd, fenceLines } = markdown(trailing)
    const parsed = await parseCodeBlocks(corpus({ roots: ['docs/**'], cwd }), {
      language: 'mermaid',
      parser: mermaidParser(),
    })
    const found = codeBlocks(parsed).should().parse().rule({ id: 'port' }).violations()
    expect(found.map((v) => v.line)).toEqual(fenceLines)
    for (const v of found) {
      expect(v.message).toContain('unreliable in a block with a trailing `%%` comment')
    }
  }, 30_000)
})

describe('mermaidParser() in other hosts', () => {
  it('leaves the host globals as they were under the eess-ts CLI loader', () => {
    const cli = join(REPO, 'packages/ts/dist/cli/bin.js')
    const result = spawnSync(process.execPath, [cli, 'check', 'parse.rules.ts'], {
      cwd: join(FIXTURES, 'cli'),
      encoding: 'utf8',
      timeout: 60_000,
    })
    const line = result.stderr.split('\n').find((l) => l.startsWith('MERMAID-PARSER-CLI '))
    expect(line, result.stderr).toBeDefined()
    expect(JSON.parse(line?.slice('MERMAID-PARSER-CLI '.length) ?? '{}')).toEqual({
      summary: '1 mermaid block parsed with mermaid 11.17.2',
      before: [],
      after: [],
    })
    expect(result.status, result.stderr).toBe(0)
  }, 60_000)

  const settle = (path: string, extra: readonly string[] = []) =>
    spawnSync(process.execPath, [...extra, join(FIXTURES, 'hook', 'settle.mjs'), path], {
      encoding: 'utf8',
      timeout: 30_000,
    })

  // Each path settles, then the script does nothing. On success, failure and abort the worker keeps
  // a timer alive, so the script exits only if the host terminated it. On exit the worker is already
  // gone: that row proves nothing else keeps the host alive.
  for (const [path, says] of [
    ['success', 'SETTLED resolved [{"outcome":"valid"}]'],
    ['failure', 'SETTLED rejected the Mermaid worker could not load: Cannot find package'],
    ['exit', 'SETTLED rejected the Mermaid worker exited (code 7) without a result'],
    ['abort', 'SETTLED rejected the Mermaid worker did not start parsing'],
  ] as const) {
    it(`settles after ${path}, and the host process exits`, () => {
      const result = settle(path)
      expect(result.signal, `${path} did not exit on its own`).toBeNull()
      expect(result.status, result.stderr).toBe(0)
      expect(result.stdout).toContain(says)
    }, 40_000)
  }

  it('reports the version a resolve hook loads when it is not the installed one', () => {
    const result = settle('real', ['--import', join(FIXTURES, 'hook', 'register.mjs')])
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain(
      'SETTLED rejected the Mermaid worker loaded mermaid 11.99.0, but mermaid 11.17.2 is installed',
    )
    expect(result.stdout).toContain('check for a loader hook that redirects it')
    // Cleared: the same run without the hook.
    expect(settle('real').stdout).toContain('SETTLED resolved')
  }, 60_000)
})
