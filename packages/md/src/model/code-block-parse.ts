import { ArchConfigError } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import type { MdCodeBlock, MdDocument } from './document.js'

/**
 * Plan 0412: a code block parses with the parser the caller names.
 *
 * eess-md owns the loop and the evidence; the caller names the parser. eess-md never loads one
 * itself, because the one with a consumer (Mermaid's) needs a DOM and a worker, and owning a grammar
 * per language would put a second authority beside the real one.
 */

/** What a parser says about one block. Never inferred: a parser that cannot tell says so. */
export type CodeBlockVerdict =
  | { readonly outcome: 'valid' }
  | {
      readonly outcome: 'invalid'
      readonly message: string
      /** 1-based, counted from the block's first body line; `null` when the parser cannot tell. */
      readonly line: number | null
      readonly remedy: string
    }
  | { readonly outcome: 'unrecognised'; readonly message: string; readonly remedy: string }

/** A block the parser must reject, with the outcome it must give. */
export interface CodeBlockCanary {
  readonly text: string
  readonly expect: 'invalid' | 'unrecognised'
}

/** A parser, named. eess-md never loads one itself. */
export interface CodeBlockParser {
  readonly name: string
  readonly version: string
  /** At least one. eess-md parses them in the same batch and checks their verdicts. */
  readonly canaries: readonly CodeBlockCanary[]
  /**
   * One `CodeBlockVerdict` per text, in order. May be synchronous. Must stop when `signal` aborts.
   *
   * Typed `unknown` on purpose: a parser is code eess-md does not own (a JavaScript parser, a
   * worker's message), so eess-md checks the shape of every verdict it is handed and reports one
   * that is not a verdict as the instrument. It never reads one as `valid`.
   *
   * A parser that knows why it failed rejects with an error carrying `remedy: string` and
   * `blockIndex: number | null` (an index into `texts`). eess-md reads both by shape.
   */
  parse(
    texts: readonly string[],
    options: { readonly signal: AbortSignal; readonly budgetMs: number },
  ): readonly unknown[] | Promise<readonly unknown[]>
}

/** The time a parse may take: a start-up allowance plus an allowance per text. */
export interface CodeBlockBudget {
  readonly startUpMs?: number
  readonly perBlockMs?: number
}

/**
 * The defaults, decided when plan 0412 was frozen: about 25× a worker's measured cold start and 16×
 * its measured cost per block. A budget is a hang detector, not a performance gate.
 */
export const DEFAULT_CODE_BLOCK_BUDGET = { startUpMs: 10_000, perBlockMs: 250 } as const

export interface ParseCodeBlocksOptions {
  /** The info-string language, matched exactly: `mermaid` does not read a `Mermaid` block. */
  readonly language: string
  readonly parser: CodeBlockParser
  readonly budget?: CodeBlockBudget
}

/** One block of the language, with the verdict its parser gave. `null` only beside a `failure`. */
export interface ParsedCodeBlock {
  readonly doc: MdDocument
  readonly block: MdCodeBlock
  readonly verdict: CodeBlockVerdict | null
}

/** Why the parser could not answer for the batch: the instrument, not any block. */
export interface CodeBlockInstrumentFailure {
  readonly cause: string
  readonly remedy: string
}

/** A block whose tag equals the language only when case-folded. Disclosed, never read. */
export interface NearMissTag {
  readonly tag: string
  readonly file: string
  readonly line: number
}

/** The facts a rule reads. Built only by `parseCodeBlocks`; `codeBlocks()` refuses any other. */
export interface ParsedCodeBlocks {
  readonly language: string
  readonly parser: { readonly name: string; readonly version: string }
  readonly blocks: readonly ParsedCodeBlock[]
  readonly failure: CodeBlockInstrumentFailure | null
  readonly nearMisses: readonly NearMissTag[]
  readonly documentsLoaded: number
  /** "N mermaid blocks parsed with mermaid 11.17.2", plus any near-miss tags left unread. */
  summary(): string
}

const REGISTERED = new WeakSet<object>()

/** Did `parseCodeBlocks` build this object? A hand-built one would skip every guard. */
export function isParsedCodeBlocks(value: object): boolean {
  return REGISTERED.has(value)
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function verdictProblem(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('outcome' in value)) {
    return 'is not a verdict'
  }
  const { outcome } = value
  if (outcome === 'valid') return undefined
  if (outcome !== 'invalid' && outcome !== 'unrecognised') {
    return `is not a verdict (outcome ${JSON.stringify(outcome) ?? 'undefined'})`
  }
  if (!('message' in value) || !nonEmpty(value.message)) return `has an empty message`
  if (!('remedy' in value) || !nonEmpty(value.remedy)) return `has an empty remedy`
  if (outcome === 'invalid') {
    const line = 'line' in value ? value.line : undefined
    if (line !== null && !(typeof line === 'number' && Number.isInteger(line))) {
      return 'has a line that is neither a whole number nor null'
    }
  }
  return undefined
}

/** Narrow a value `verdictProblem` accepted. No assertion: each field is read by shape. */
function toVerdict(value: unknown): CodeBlockVerdict | undefined {
  if (verdictProblem(value) !== undefined) return undefined
  if (typeof value !== 'object' || value === null || !('outcome' in value)) return undefined
  if (value.outcome === 'valid') return { outcome: 'valid' }
  const message = 'message' in value && typeof value.message === 'string' ? value.message : ''
  const remedy = 'remedy' in value && typeof value.remedy === 'string' ? value.remedy : ''
  if (value.outcome === 'unrecognised') return { outcome: 'unrecognised', message, remedy }
  const line = 'line' in value && typeof value.line === 'number' ? value.line : null
  return { outcome: 'invalid', message, line, remedy }
}

interface Located {
  readonly doc: MdDocument
  readonly block: MdCodeBlock
}

/** A thrown value's `remedy` and `blockIndex`, read by shape (plan 0413 imports nothing of ours). */
function structured(error: unknown): { remedy?: string; blockIndex?: number } {
  if (typeof error !== 'object' || error === null) return {}
  const remedy = 'remedy' in error && nonEmpty(error.remedy) ? error.remedy : undefined
  const index = 'blockIndex' in error ? error.blockIndex : undefined
  const blockIndex = typeof index === 'number' && Number.isInteger(index) ? index : undefined
  return {
    ...(remedy !== undefined && { remedy }),
    ...(blockIndex !== undefined && { blockIndex }),
  }
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

const ENVIRONMENT_REMEDY =
  "Fix the parser's environment or the parser itself: this failure is not a verdict about any block, " +
  'and no block was judged.'

/**
 * Parse every block of one language in the corpus, in one batch, with the parser the caller names.
 * The only async call: the rule built from what it returns is synchronous.
 *
 * Throws `ArchConfigError` for a parser with no name, no version or no canaries, before anything is
 * selected. Every other failure of the parser is recorded on the result and reported by each rule
 * over it as the instrument.
 */
export async function parseCodeBlocks(
  corpus: Corpus,
  options: ParseCodeBlocksOptions,
): Promise<ParsedCodeBlocks> {
  const { language, parser } = options
  if (!nonEmpty(parser.name) || !nonEmpty(parser.version)) {
    throw new ArchConfigError(
      'parseCodeBlocks',
      `parseCodeBlocks: the parser has no ${nonEmpty(parser.name) ? 'version' : 'name'}. ` +
        'A parser names itself, so a finding can say what judged the block.',
    )
  }
  if (parser.canaries.length === 0) {
    throw new ArchConfigError(
      'parseCodeBlocks',
      `parseCodeBlocks: the parser ${parser.name}@${parser.version} declares no canaries. ` +
        'A parser declares at least one block it must reject, so a parser that accepts everything ' +
        'is caught.',
    )
  }

  const documents = corpus.documents()
  const located: Located[] = []
  const nearMisses: NearMissTag[] = []
  const folded = language.toLowerCase()
  for (const doc of documents) {
    for (const block of doc.codeBlocks) {
      if (block.lang === language) located.push({ doc, block })
      else if (block.lang?.toLowerCase() === folded) {
        nearMisses.push({ tag: block.lang, file: doc.relPath, line: block.line })
      }
    }
  }

  const canaries = parser.canaries
  const texts = [...canaries.map((c) => c.text), ...located.map((l) => l.block.value)]
  const startUpMs = options.budget?.startUpMs ?? DEFAULT_CODE_BLOCK_BUDGET.startUpMs
  const perBlockMs = options.budget?.perBlockMs ?? DEFAULT_CODE_BLOCK_BUDGET.perBlockMs
  const budgetMs = startUpMs + perBlockMs * texts.length
  const budgetSource = options.budget === undefined ? 'the defaults' : "the caller's budget"
  const budgetText =
    `${String(budgetMs)} ms (${String(startUpMs)} ms start-up + ${String(perBlockMs)} ms × ` +
    `${String(texts.length)} texts, from ${budgetSource})`

  const where = (index: number | undefined): string => {
    if (index === undefined) return ''
    if (index < canaries.length) return ` while parsing canary ${String(index + 1)}`
    const l = located[index - canaries.length]
    return l === undefined ? '' : ` at the block at ${l.doc.relPath}:${String(l.block.line)}`
  }

  let failure: CodeBlockInstrumentFailure | null = null
  let verdicts: readonly CodeBlockVerdict[] | null = null
  // An instrument failure needs a parse; a corpus with no block of the language parses nothing.
  if (located.length > 0) {
    const outcome = await runParser(parser, texts, budgetMs)
    if (outcome.kind === 'threw') {
      const s = structured(outcome.error)
      failure = {
        cause: `the parser threw${where(s.blockIndex)}: ${messageOf(outcome.error)}`,
        remedy: s.remedy ?? ENVIRONMENT_REMEDY,
      }
    } else if (outcome.kind === 'timeout') {
      const s = structured(outcome.error)
      failure = {
        cause: `the parse ran past its budget of ${budgetText}${where(s.blockIndex)}`,
        remedy:
          s.remedy ??
          'Find the block that hangs the parser, or raise the budget with ' +
            '`budget: { startUpMs, perBlockMs }` if the parser is merely slow.',
      }
    } else {
      failure = checkVerdicts(outcome.values, {
        textCount: texts.length,
        canaries,
        budgetMs,
        budgetText,
        elapsedMs: outcome.elapsedMs,
      })
      if (failure === null) {
        const read: CodeBlockVerdict[] = []
        for (const value of outcome.values) {
          const v = toVerdict(value)
          if (v !== undefined) read.push(v)
        }
        verdicts = read.slice(canaries.length)
      }
    }
  }

  const blocks: ParsedCodeBlock[] = located.map((l, i) => ({
    doc: l.doc,
    block: l.block,
    verdict: verdicts?.[i] ?? null,
  }))
  const identity = { name: parser.name, version: parser.version }
  const parsed: ParsedCodeBlocks = {
    language,
    parser: identity,
    blocks,
    failure,
    nearMisses,
    documentsLoaded: documents.length,
    summary: () => {
      const n = blocks.length
      const head = `${String(n)} ${language} block${n === 1 ? '' : 's'} parsed with ${identity.name} ${identity.version}`
      if (nearMisses.length === 0) return head
      return `${head}; not read, tagged ${describeNearMisses(nearMisses)}`
    },
  }
  REGISTERED.add(parsed)
  return parsed
}

/** `Mermaid` at docs/a.md:3, … */
export function describeNearMisses(nearMisses: readonly NearMissTag[]): string {
  return nearMisses.map((n) => `\`${n.tag}\` at ${n.file}:${String(n.line)}`).join(', ')
}

function checkVerdicts(
  values: readonly unknown[],
  run: {
    readonly textCount: number
    readonly canaries: readonly CodeBlockCanary[]
    readonly budgetMs: number
    readonly budgetText: string
    readonly elapsedMs: number
  },
): CodeBlockInstrumentFailure | null {
  const { textCount, canaries, budgetMs, budgetText, elapsedMs } = run
  if (elapsedMs > budgetMs) {
    // A synchronous parser cannot be interrupted, so its overrun is found after it returns.
    return {
      cause: `the parse took ${String(Math.round(elapsedMs))} ms, past its budget of ${budgetText}`,
      remedy:
        'Find the block that slows the parser, or raise the budget with ' +
        '`budget: { startUpMs, perBlockMs }` if the parser is merely slow.',
    }
  }
  if (!Array.isArray(values) || values.length !== textCount) {
    const got = Array.isArray(values) ? String(values.length) : 'no array of'
    return {
      cause: `the parser returned the wrong number of verdicts: ${String(textCount)} texts, ${got} verdicts`,
      remedy: 'A parser returns exactly one verdict per text, in order.',
    }
  }
  for (const [i, value] of values.entries()) {
    const problem = verdictProblem(value)
    if (problem !== undefined) {
      return {
        cause: `the parser's answer for text ${String(i + 1)} ${problem}`,
        remedy:
          "Return { outcome: 'valid' }, { outcome: 'invalid', message, line, remedy } or " +
          "{ outcome: 'unrecognised', message, remedy } for every text, with a non-empty message " +
          'and remedy.',
      }
    }
  }
  for (const [i, canary] of canaries.entries()) {
    const got = toVerdict(values[i])
    if (got?.outcome !== canary.expect) {
      return {
        cause:
          `canary ${String(i + 1)} was answered wrongly: expected "${canary.expect}", got ` +
          `"${got?.outcome ?? 'nothing'}". A parser that accepts a block it must reject cannot be ` +
          'trusted to reject a broken one.',
        remedy:
          'Check that the parser is the real one, at a version whose errors its canaries were written ' +
          'for, and that it is not catching its own errors.',
      }
    }
  }
  return null
}

type RunOutcome =
  | { readonly kind: 'returned'; readonly values: readonly unknown[]; readonly elapsedMs: number }
  | { readonly kind: 'threw'; readonly error: unknown }
  | { readonly kind: 'timeout'; readonly error: unknown }

function isPromise(value: unknown): value is Promise<readonly unknown[]> {
  return value instanceof Promise
}

/**
 * Run the parser under its budget. On overrun the signal is aborted and the parser is given a short
 * grace to reject with a structured failure naming its block; after that it is no longer awaited.
 */
async function runParser(
  parser: CodeBlockParser,
  texts: readonly string[],
  budgetMs: number,
): Promise<RunOutcome> {
  const controller = new AbortController()
  const started = performance.now()
  let result: readonly unknown[] | Promise<readonly unknown[]>
  try {
    result = parser.parse(texts, { signal: controller.signal, budgetMs })
  } catch (error) {
    return { kind: 'threw', error }
  }
  if (!isPromise(result)) {
    return { kind: 'returned', values: result, elapsedMs: performance.now() - started }
  }

  // Settle the parser's promise into a value, so a rejection after we stop waiting is never unhandled.
  const settled: Promise<RunOutcome> = result.then(
    (values): RunOutcome => ({
      kind: 'returned',
      values,
      elapsedMs: performance.now() - started,
    }),
    (error: unknown): RunOutcome => ({ kind: 'threw', error }),
  )
  let timer: ReturnType<typeof setTimeout> | undefined
  const expired = new Promise<'expired'>((resolve) => {
    timer = setTimeout(() => resolve('expired'), budgetMs)
  })
  try {
    const first = await Promise.race([settled, expired])
    if (first !== 'expired') return first
  } finally {
    clearTimeout(timer)
  }

  controller.abort()
  const graceMs = Math.min(1000, budgetMs)
  let graceTimer: ReturnType<typeof setTimeout> | undefined
  const graceOver = new Promise<'over'>((resolve) => {
    graceTimer = setTimeout(() => resolve('over'), graceMs)
  })
  try {
    const late = await Promise.race([settled, graceOver])
    return {
      kind: 'timeout',
      error: late === 'over' || late.kind !== 'threw' ? undefined : late.error,
    }
  } finally {
    clearTimeout(graceTimer)
  }
}
