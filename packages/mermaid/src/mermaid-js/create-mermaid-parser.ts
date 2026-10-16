import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import { diagramPreamble } from '../parser/diagram-kind.js'
import { hasTrailingComment, mermaidLineMap } from '../parser/mermaid-line-map.js'

/**
 * Plan 0413: Mermaid's own parser, in a worker, in the shape of eess-md's code-block parser port
 * (plan 0412). eess-mermaid matches that port by shape and imports nothing from eess-md.
 *
 * Internal: `mermaidParser()` is this with the worker beside it. Tests pass a copy of the worker in a
 * scratch directory whose `node_modules` holds a stub `mermaid`, nothing, or the real packages. The
 * package's `exports` has no deep path, so no rule file can name a module for it to run.
 *
 * The three types below mirror eess-md's `CodeBlockVerdict`, `CodeBlockCanary` and `CodeBlockParser`
 * (`packages/md/src/model/code-block-parse.ts`): a change to the port changes both packages' API.
 * eess-crossvalidate's port test assigns one to the other, so a drift fails its typecheck.
 */

/** What Mermaid says about one block, in eess-md's `CodeBlockVerdict` shape. */
export type MermaidVerdict =
  | { readonly outcome: 'valid' }
  | {
      readonly outcome: 'invalid'
      readonly message: string
      /** 1-based, from the block's first body line; `null` when Mermaid's line cannot be trusted. */
      readonly line: number | null
      readonly remedy: string
    }
  | { readonly outcome: 'unrecognised'; readonly message: string; readonly remedy: string }

/** A block Mermaid must reject, in eess-md's `CodeBlockCanary` shape. */
export interface MermaidCanary {
  readonly text: string
  readonly expect: 'invalid' | 'unrecognised'
}

/** eess-md's `CodeBlockParser` shape, filled by Mermaid. */
export interface MermaidParser {
  readonly name: string
  /** The installed `mermaid`'s version, `'not installed'`, or `'unreadable'`. */
  readonly version: string
  readonly canaries: readonly MermaidCanary[]
  parse(
    texts: readonly string[],
    options: { readonly signal: AbortSignal; readonly budgetMs: number },
  ): Promise<readonly MermaidVerdict[]>
}

/**
 * Why the parser could not answer for the batch. eess-md reads `remedy` and `blockIndex` by shape
 * (an index into `texts`, or `null`) and reports the instrument, naming the block when there is one.
 */
class MermaidParserFailure extends Error {
  constructor(
    message: string,
    readonly remedy: string,
    readonly blockIndex: number | null,
  ) {
    super(message)
    this.name = 'MermaidParserFailure'
  }
}

/** The version the line map's regexes were read from; the line canary checks they still hold. */
const LINE_MAP_MERMAID = '11.17.2'

const INSTALL = 'Install both peers: `npm i -D mermaid@11 jsdom`.'

/**
 * One known-broken block per error shape. eess-md runs them before the corpus's blocks, so a
 * `mermaid` that stopped throwing (a new major, a changed error shape, `suppressErrors`) is caught.
 */
const CANARIES: readonly MermaidCanary[] = Object.freeze([
  Object.freeze({ text: 'sequenceDiagram\n  A->>B: hi\n  A->>', expect: 'invalid' }),
  Object.freeze({ text: 'packet-beta\n0-10: "a"\n1x-2: "b"', expect: 'invalid' }),
  Object.freeze({ text: 'flowchrt TD\n  A --> B', expect: 'unrecognised' }),
])

/**
 * The line canary: blocks whose true error line is known. Between them they hold frontmatter
 * followed by a blank line, a one-line and a three-line directive, a bare `%%` line (which Mermaid
 * keeps), a blank line before a mid-body comment, two mid-body comments, a blank line left at the
 * front once a leading comment goes, `\r\n` line ends, and one error of each line shape: a jison
 * parse error, a jison lexical error, a Langium error. Not held: a Langium block with errors on
 * several lines (which one is reported is the line map's "smallest line" rule, pinned only by the
 * unit tests). Parsed privately, before eess-md's texts.
 */
const LINE_CANARIES: readonly { readonly text: string; readonly line: number }[] = Object.freeze([
  {
    text: [
      '---',
      'title: x',
      '---',
      '',
      'flowchart TD',
      '  A --> B',
      '%%{init: {"theme":"dark"}}%%',
      '  B --> C',
      '%%',
      '',
      '  %% c',
      '  %% d',
      '%%{init: {',
      '"theme":"dark"',
      '}}%%',
      '  C --> --> D',
      '  E --> F',
    ].join('\n'),
    line: 16,
  },
  // A comment and a blank line before the kind: only Mermaid's final `trimStart` drops the blank.
  {
    text: '%% a\r\n\r\nflowchart TD\r\n  A --> B\r\n  %% c\r\n  C --> D ]]] x\r\n  E --> F',
    line: 6,
  },
  { text: 'packet-beta\n0-10: "a"\n%% c\n%% c\n11-x: "b"', line: 5 },
])

type Shape = 'ok' | 'jison' | 'langium' | 'unknown-diagram' | 'yaml' | 'other' | 'non-result'

interface Fact {
  readonly shape: Shape
  readonly locFirstLine: number | null
  readonly hashLine: number | null
  readonly langiumLines: readonly number[]
  /** js-yaml's 0-based line in the frontmatter's YAML, for `yaml`. */
  readonly yamlLine: number | null
  readonly message: string
}

const SHAPES: readonly string[] = [
  'ok',
  'jison',
  'langium',
  'unknown-diagram',
  'yaml',
  'other',
  'non-result',
]

function isShape(value: unknown): value is Shape {
  return typeof value === 'string' && SHAPES.includes(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function lineOrNull(value: unknown): number | null | undefined {
  if (value === null) return null
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** The worker is code eess-mermaid runs but cannot type: every message is narrowed (ADR-005). */
function readFact(value: unknown): Fact | null {
  if (!isRecord(value)) return null
  const { shape, message } = value
  const locFirstLine = lineOrNull(value.locFirstLine)
  const hashLine = lineOrNull(value.hashLine)
  const yamlLine = lineOrNull(value.yamlLine)
  const lines: unknown = value.langiumLines
  if (!isShape(shape) || typeof message !== 'string') return null
  if (locFirstLine === undefined || hashLine === undefined || yamlLine === undefined) return null
  if (!Array.isArray(lines)) return null
  const langiumLines: number[] = []
  for (const line of lines) {
    if (typeof line !== 'number') return null
    langiumLines.push(line)
  }
  return { shape, locFirstLine, hashLine, langiumLines, yamlLine, message }
}

function readFacts(value: unknown, count: number): Fact[] | null {
  if (!Array.isArray(value) || value.length !== count) return null
  const facts: Fact[] = []
  for (const item of value) {
    const fact = readFact(item)
    if (fact === null) return null
    facts.push(fact)
  }
  return facts
}

/** Mermaid's own line for an error, by shape; never read from the message. */
function mermaidLine(fact: Fact): number | null {
  if (fact.shape === 'jison') {
    if (fact.locFirstLine !== null) return fact.locFirstLine
    // A lexical error carries no `hash.loc`, and its `hash.line` counts from 0 (spike 0425).
    return fact.hashLine === null ? null : fact.hashLine + 1
  }
  if (fact.shape === 'langium' && fact.langiumLines.length > 0) {
    return Math.min(...fact.langiumLines)
  }
  return null
}

/** The block line of a syntax error, and Mermaid's own, before the trailing-comment rule. */
function blockLine(text: string, fact: Fact): { line: number | null; reported: number | null } {
  const reported = mermaidLine(fact)
  return { line: reported === null ? null : mermaidLineMap(text)(reported), reported }
}

const SUPPRESSED = (index: number | null): MermaidParserFailure =>
  new MermaidParserFailure(
    '`mermaid.parse` resolved without a result; is `suppressErrors` set?',
    "Check that nothing sets Mermaid's `suppressErrors`: eess-mermaid needs `mermaid.parse` to throw on a broken block.",
    index,
  )

/**
 * The outcome table (plan 0413): Mermaid's acceptance always wins, and so does a syntax error it can
 * place, since Mermaid found a diagram to parse. Any other failure is read with the block's preamble.
 * A throw eess-mermaid cannot place is the instrument, never the author's error.
 */
function verdictFor(text: string, fact: Fact, index: number): MermaidVerdict {
  const message = fact.message
  switch (fact.shape) {
    case 'ok':
      return { outcome: 'valid' }
    case 'non-result':
      throw SUPPRESSED(index)
    case 'jison':
    case 'langium':
      return syntaxError(text, fact)
    case 'yaml':
      // Mermaid reads frontmatter only at the block's first line, so its YAML starts on line 2.
      return {
        outcome: 'invalid',
        message,
        line: fact.yamlLine === null ? null : fact.yamlLine + 2,
        remedy: "Fix the frontmatter's YAML at this line; Mermaid's message is above.",
      }
    case 'unknown-diagram':
    case 'other':
      break
  }
  switch (diagramPreamble(text).reason) {
    case 'unclosed-frontmatter':
      return {
        outcome: 'invalid',
        message,
        line: 1,
        remedy:
          'Close the frontmatter with an un-indented `---` line, followed by a newline and the diagram.',
      }
    case 'unclosed-directive':
      return {
        outcome: 'unrecognised',
        message,
        remedy: 'A `%%{` directive is never closed with `}%%`: close it.',
      }
    case 'empty':
      return {
        outcome: 'unrecognised',
        message,
        remedy: 'The block is empty: write the diagram, or remove the block.',
      }
    case 'no-kind-after-preamble':
      return {
        outcome: 'unrecognised',
        message,
        remedy:
          'The block declares no diagram after its directives, comments or frontmatter: add the diagram.',
      }
    case 'declared':
      break
  }
  if (fact.shape === 'unknown-diagram') {
    return {
      outcome: 'unrecognised',
      message,
      remedy:
        'Check the spelling of the diagram kind, or this kind needs a newer `mermaid` or a plugin.',
    }
  }
  throw new MermaidParserFailure(
    `Mermaid threw something eess-mermaid does not recognise as a syntax error: ${message}`,
    'If this block is wrong, fix it; otherwise report it to eess.',
    index,
  )
}

function syntaxError(text: string, fact: Fact): MermaidVerdict {
  const { line, reported } = blockLine(text, fact)
  const remedy = "Fix the syntax at this line; Mermaid's message is above."
  if (hasTrailingComment(text)) {
    return {
      outcome: 'invalid',
      message:
        `${fact.message}\nMermaid's line count is unreliable in a block with a trailing \`%%\` comment; ` +
        `it reported ${reported === null ? 'no line' : `line ${String(reported)}`}.`,
      line: null,
      remedy,
    }
  }
  return { outcome: 'invalid', message: fact.message, line, remedy }
}

/**
 * The line canary: each block's syntax error must be on its known line. A block Mermaid accepts, or
 * rejects with anything but a syntax error, checks nothing, so it is the instrument too. The one
 * exception: when Mermaid also accepted one of this parser's own canaries, it has stopped throwing
 * altogether, and eess-md's canaries report that under their own cause.
 */
function checkLineCanaries(facts: readonly Fact[], loaded: string, stoppedThrowing: boolean): void {
  for (const [i, canary] of LINE_CANARIES.entries()) {
    const fact = facts[i]
    if (fact === undefined) continue
    const which = `line-canary block ${String(i + 1)}`
    if (fact.shape === 'non-result') throw SUPPRESSED(null)
    if (fact.shape === 'ok') {
      if (stoppedThrowing) continue
      throw new MermaidParserFailure(
        `mermaid ${loaded} accepted ${which}, which must fail on line ${String(canary.line)}, so ` +
          "eess-mermaid's line map cannot be checked against it",
        `Install \`mermaid@${LINE_MAP_MERMAID}\`, and report the version to eess.`,
        null,
      )
    }
    if (fact.shape !== 'jison' && fact.shape !== 'langium') {
      throw new MermaidParserFailure(
        `mermaid ${loaded} rejected ${which} with something that is not a syntax error: ${fact.message}`,
        "Check that `mermaid` and `jsdom` load cleanly; if they do, report it to eess with Mermaid's message.",
        null,
      )
    }
    if (blockLine(canary.text, fact).line === canary.line) continue
    throw new MermaidParserFailure(
      `eess-mermaid's line map, written for mermaid ${LINE_MAP_MERMAID}, disagrees with mermaid ` +
        `${loaded}: ${which} should fail on line ${String(canary.line)}`,
      `Install \`mermaid@${LINE_MAP_MERMAID}\`, and report the version to eess.`,
      null,
    )
  }
}

const CANARY_TEXTS: ReadonlySet<string> = new Set(CANARIES.map((c) => c.text))

/** "Major 11", prereleases included: `11.0.0-alpha.1` is in, `12.0.0-rc.1` is out. */
function inMermaidRange(version: string): boolean {
  return /^11\.\d+\.\d+(?:[-+].*)?$/.test(version)
}

/**
 * The installed `mermaid`'s version, read without loading it and without its `exports`: the first
 * `<dir>/mermaid/package.json` among the directories Node would search from the worker.
 */
function declaredMermaid(workerUrl: URL): {
  version: string
  file: string | null
  reason?: string
} {
  for (const dir of createRequire(workerUrl).resolve.paths('mermaid') ?? []) {
    const file = join(dir, 'mermaid', 'package.json')
    if (!existsSync(file)) continue
    let pkg: unknown
    try {
      pkg = JSON.parse(readFileSync(file, 'utf8'))
    } catch (error) {
      // Not JSON: an installed mermaid is never reported as missing (ADR-009 rule 2).
      return {
        version: 'unreadable',
        file,
        reason: error instanceof Error ? error.message : String(error),
      }
    }
    const version = isRecord(pkg) ? pkg.version : undefined
    return typeof version === 'string' && version !== ''
      ? { version, file }
      : { version: 'unreadable', file }
  }
  return { version: 'not installed', file: null }
}

function before(declared: {
  version: string
  file: string | null
  reason?: string
}): MermaidParserFailure | null {
  if (declared.version === 'not installed') {
    return new MermaidParserFailure(
      'mermaid is not installed where eess-mermaid can resolve it.',
      INSTALL,
      null,
    )
  }
  if (declared.version === 'unreadable') {
    return new MermaidParserFailure(
      `mermaid's package.json at ${declared.file ?? 'an unknown path'} has no readable version` +
        `${declared.reason === undefined ? '' : ` (${declared.reason})`}.`,
      'Reinstall `mermaid`.',
      null,
    )
  }
  if (!inMermaidRange(declared.version)) {
    return new MermaidParserFailure(
      `mermaid ${declared.version} is installed.`,
      'eess-mermaid reads mermaid 11; install `mermaid@11`.',
      null,
    )
  }
  return null
}

function loadFailure(message: Record<string, unknown>): MermaidParserFailure {
  const said = typeof message.message === 'string' ? message.message : 'no message'
  const missing = typeof message.missing === 'string' ? message.missing : ''
  if (missing === 'mermaid' || missing === 'jsdom') {
    return new MermaidParserFailure(
      `the Mermaid worker could not load ${missing}: ${said}`,
      INSTALL,
      null,
    )
  }
  if (missing !== '') {
    return new MermaidParserFailure(
      `the Mermaid worker could not load: ${said}`,
      `\`${missing}\`, a dependency of mermaid or jsdom, is missing; reinstall them.`,
      null,
    )
  }
  return new MermaidParserFailure(
    `the Mermaid worker could not load: ${said}`,
    `${INSTALL} Node said: ${said}`,
    null,
  )
}

/** The parser, run from `workerUrl`. Never throws: a missing peer is reported by `parse`. */
export function createMermaidParser(options: {
  /** The worker module to run: `mermaid-worker.mjs`, or a copy of it. */
  readonly workerUrl: URL
}): MermaidParser {
  const { workerUrl } = options
  const declared = declaredMermaid(workerUrl)
  return Object.freeze({
    name: 'mermaid',
    version: declared.version,
    canaries: CANARIES,
    parse: (
      texts: readonly string[],
      run: { readonly signal: AbortSignal; readonly budgetMs: number },
    ) => parseInWorker(workerUrl, declared, texts, run),
  })
}

function parseInWorker(
  workerUrl: URL,
  declared: { version: string; file: string | null; reason?: string },
  texts: readonly string[],
  run: { readonly signal: AbortSignal; readonly budgetMs: number },
): Promise<readonly MermaidVerdict[]> {
  const refused = before(declared)
  if (refused !== null) return Promise.reject(refused)
  const { signal, budgetMs } = run
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerUrl, {
      workerData: { texts: [...texts], privateTexts: LINE_CANARIES.map((c) => c.text) },
    })
    let inFlight: number | null = null
    let loaded = false
    let settled = false
    // The worker is terminated on every path: success, failure, exit and abort.
    const finish = (settle: () => void): void => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', onAbort)
      void worker.terminate()
      settle()
    }
    const fail = (failure: MermaidParserFailure): void => finish(() => reject(failure))
    const onAbort = (): void => {
      fail(
        inFlight === null
          ? new MermaidParserFailure(
              `the Mermaid worker did not start parsing within the budget of ${String(budgetMs)} ms`,
              'Raise `budget.startUpMs`.',
              null,
            )
          : new MermaidParserFailure(
              `Mermaid was still parsing text ${String(inFlight + 1)} when the budget of ` +
                `${String(budgetMs)} ms ran out`,
              'Raise `budget.perBlockMs`, or leave that document out of the corpus by its `ignore` glob.',
              inFlight,
            ),
      )
    }
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })

    worker.on('message', (message: unknown) => {
      if (!isRecord(message)) return
      if (message.type === 'progress') {
        if (typeof message.index === 'number') inFlight = message.index
      } else if (message.type === 'load-error') {
        fail(loadFailure(message))
      } else if (message.type === 'loaded') {
        loaded = true
        const version = typeof message.version === 'string' ? message.version : 'unreadable'
        if (version !== declared.version) {
          fail(
            new MermaidParserFailure(
              `the Mermaid worker loaded mermaid ${version}, but mermaid ${declared.version} is ` +
                `installed at ${declared.file ?? 'an unknown path'}`,
              'Reinstall `mermaid`, and check for a loader hook that redirects it.',
              null,
            ),
          )
        }
      } else if (message.type === 'verdicts') {
        const facts = readFacts(message.results, texts.length)
        const lineFacts = readFacts(message.privateResults, LINE_CANARIES.length)
        if (!loaded || facts === null || lineFacts === null) {
          fail(
            new MermaidParserFailure(
              'the Mermaid worker posted verdicts eess-mermaid cannot read',
              'Report it to eess, with the versions of mermaid and jsdom.',
              null,
            ),
          )
          return
        }
        // Every error settles the parse: a throw from a message listener would be uncaught in the
        // caller's process, with no finding to report.
        try {
          const verdicts = facts.map((fact, i) => verdictFor(texts[i] ?? '', fact, i))
          const stoppedThrowing = facts.some(
            (fact, i) => fact.shape === 'ok' && CANARY_TEXTS.has(texts[i] ?? ''),
          )
          checkLineCanaries(lineFacts, declared.version, stoppedThrowing)
          finish(() => resolve(Object.freeze(verdicts)))
        } catch (error) {
          fail(
            error instanceof MermaidParserFailure
              ? error
              : new MermaidParserFailure(
                  `eess-mermaid could not classify Mermaid's answer: ${error instanceof Error ? error.message : String(error)}`,
                  'Report it to eess, with the block.',
                  null,
                ),
          )
        }
      }
    })
    worker.on('error', (error: Error) => {
      fail(exitFailure(`the Mermaid worker threw: ${error.message}`, inFlight))
    })
    worker.on('exit', (code: number) => {
      fail(
        exitFailure(`the Mermaid worker exited (code ${String(code)}) without a result`, inFlight),
      )
    })
  })
}

function exitFailure(what: string, inFlight: number | null): MermaidParserFailure {
  return new MermaidParserFailure(
    inFlight === null ? what : `${what}, while parsing text ${String(inFlight + 1)}`,
    'Leave that document out of the corpus by its `ignore` glob, and report the block to eess.',
    inFlight,
  )
}
