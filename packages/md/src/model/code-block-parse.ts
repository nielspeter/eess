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
   * `texts` holds the canaries first, in declared order, then the blocks in document order.
   *
   * A parser that knows why it failed rejects with an error carrying `remedy: string` and
   * `blockIndex: number | null` (an index into `texts`). eess-md reads both by shape.
   *
   * `signal` is aborted only when the budget runs out. A parser that holds a resource (a worker,
   * a process) releases it itself once it has answered.
   */
  parse(
    texts: readonly string[],
    options: { readonly signal: AbortSignal; readonly budgetMs: number },
  ): readonly unknown[] | PromiseLike<readonly unknown[]>
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
export const DEFAULT_CODE_BLOCK_BUDGET: Readonly<Required<CodeBlockBudget>> = Object.freeze({
  startUpMs: 10_000,
  perBlockMs: 250,
})

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
  /**
   * "N mermaid blocks parsed with mermaid 11.17.2", plus any near-miss tags left unread. When the
   * parser failed, it says so and gives the cause: no block was checked.
   */
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

/**
 * Read one value a parser returned, ONCE. Each field is read a single time into a local, so a value
 * whose getters answer differently on a second read cannot pass one check and fail the next.
 */
function readVerdict(value: unknown): { verdict: CodeBlockVerdict } | { problem: string } {
  if (typeof value !== 'object' || value === null || !('outcome' in value)) {
    return { problem: 'is not a verdict' }
  }
  const outcome: unknown = value.outcome
  if (outcome === 'valid') return { verdict: { outcome: 'valid' } }
  if (outcome !== 'invalid' && outcome !== 'unrecognised') {
    return { problem: `is not a verdict (outcome ${JSON.stringify(outcome) ?? 'undefined'})` }
  }
  const message: unknown = 'message' in value ? value.message : undefined
  const remedy: unknown = 'remedy' in value ? value.remedy : undefined
  if (!nonEmpty(message)) return { problem: 'has an empty message' }
  if (!nonEmpty(remedy)) return { problem: 'has an empty remedy' }
  if (outcome === 'unrecognised') return { verdict: { outcome, message, remedy } }
  const line: unknown = 'line' in value ? value.line : undefined
  if (line === null) return { verdict: { outcome, message, line: null, remedy } }
  if (typeof line === 'number' && Number.isInteger(line)) {
    return { verdict: { outcome, message, line, remedy } }
  }
  return { problem: 'has a line that is neither a whole number nor null' }
}

/**
 * Copy an array with a plain index loop into a fresh plain array. Not `map`, `slice` or spread: on an
 * `Array` subclass those build the result through its own species constructor, which can hand back
 * an object that reports a length and yields nothing (review of PR #209).
 */
function plainCopy(value: unknown): unknown[] | null {
  if (!Array.isArray(value)) return null
  const source: readonly unknown[] = value
  const length = source.length
  const copy: unknown[] = []
  for (let i = 0; i < length; i++) copy.push(source[i])
  return copy
}

/** The parser's identity and canaries, read once and checked. Throws before anything is selected. */
function snapshotParser(parser: CodeBlockParser): {
  name: string
  version: string
  canaries: readonly CodeBlockCanary[]
} {
  const name: unknown = parser.name
  const version: unknown = parser.version
  if (!nonEmpty(name) || !nonEmpty(version)) {
    throw new ArchConfigError(
      'parseCodeBlocks',
      `parseCodeBlocks: the parser has no ${nonEmpty(name) ? 'version' : 'name'}. ` +
        'A parser names itself, so a finding can say what judged the block.',
    )
  }
  const declared: unknown = parser.canaries
  let list: readonly unknown[]
  try {
    list = plainCopy(declared) ?? []
  } catch (error) {
    throw new ArchConfigError(
      'parseCodeBlocks',
      `parseCodeBlocks: the canaries of ${name}@${version} could not be read: ${messageOf(error)}`,
    )
  }
  if (list.length === 0) {
    throw new ArchConfigError(
      'parseCodeBlocks',
      `parseCodeBlocks: the parser ${name}@${version} declares no canaries. A parser declares at ` +
        'least one block it must reject, so a parser that accepts everything is caught.',
    )
  }
  const canaries: CodeBlockCanary[] = []
  for (const [i, entry] of list.entries()) {
    const text: unknown =
      typeof entry === 'object' && entry !== null && 'text' in entry ? entry.text : undefined
    const expect: unknown =
      typeof entry === 'object' && entry !== null && 'expect' in entry ? entry.expect : undefined
    if (!nonEmpty(text) || (expect !== 'invalid' && expect !== 'unrecognised')) {
      throw new ArchConfigError(
        'parseCodeBlocks',
        `parseCodeBlocks: canary ${String(i + 1)} of ${name}@${version} is not a block the parser ` +
          `must reject: it needs a non-empty \`text\` and \`expect\` of "invalid" or "unrecognised" ` +
          `(got ${JSON.stringify(expect) ?? 'undefined'}). A canary the parser may accept catches nothing.`,
      )
    }
    canaries.push(Object.freeze({ text, expect }))
  }
  return { name, version, canaries: Object.freeze(canaries) }
}

/** A whole number of milliseconds a timer can hold, or a configuration error. */
function budgetPart(value: number | undefined, fallback: number, field: string): number {
  if (value === undefined) return fallback
  if (!Number.isInteger(value) || value < 0 || value > MAX_TIMER_MS) {
    throw new ArchConfigError(
      'parseCodeBlocks',
      `parseCodeBlocks: budget.${field} is ${JSON.stringify(value) ?? String(value)}; it must be a whole number of ` +
        `milliseconds from 0 to ${String(MAX_TIMER_MS)}.`,
    )
  }
  return value
}

/** The longest delay `setTimeout` honours; past it Node fires after 1 ms. */
const MAX_TIMER_MS = 2_147_483_647

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
  if (!nonEmpty(language)) {
    throw new ArchConfigError(
      'parseCodeBlocks',
      'parseCodeBlocks: `language` is empty. Name the info-string tag to check, e.g. "mermaid".',
    )
  }
  const { name, version, canaries } = snapshotParser(parser)
  const startUpMs = budgetPart(
    options.budget?.startUpMs,
    DEFAULT_CODE_BLOCK_BUDGET.startUpMs,
    'startUpMs',
  )
  const perBlockMs = budgetPart(
    options.budget?.perBlockMs,
    DEFAULT_CODE_BLOCK_BUDGET.perBlockMs,
    'perBlockMs',
  )

  const documents = corpus.documents()
  const located: Located[] = []
  const nearMisses: NearMissTag[] = []
  const folded = language.toLowerCase()
  for (const doc of documents) {
    for (const block of doc.codeBlocks) {
      if (block.lang === language) located.push({ doc, block })
      else if (block.lang?.toLowerCase() === folded) {
        nearMisses.push(Object.freeze({ tag: block.lang, file: doc.relPath, line: block.line }))
      }
    }
  }

  const texts = Object.freeze([
    ...canaries.map((c) => c.text),
    ...located.map((l) => l.block.value),
  ])
  const wanted = startUpMs + perBlockMs * texts.length
  const budgetMs = Math.min(wanted, MAX_TIMER_MS)
  const fromCaller =
    options.budget?.startUpMs !== undefined || options.budget?.perBlockMs !== undefined
  const budgetSource = fromCaller ? "the caller's budget" : 'the defaults'
  const budgetText =
    `${String(budgetMs)} ms (${String(startUpMs)} ms start-up + ${String(perBlockMs)} ms × ` +
    `${String(texts.length)} texts, from ${budgetSource}` +
    `${wanted > MAX_TIMER_MS ? `, capped from ${String(wanted)} ms at the longest a timer holds` : ''})`

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
      const read = readAll(outcome.values, {
        textCount: texts.length,
        canaries,
        budgetMs,
        budgetText,
        elapsedMs: outcome.elapsedMs,
      })
      if ('failure' in read) failure = read.failure
      else verdicts = read.verdicts.slice(canaries.length)
    }
  }

  const blocks: ParsedCodeBlock[] = located.map((l, i) =>
    Object.freeze({ doc: l.doc, block: l.block, verdict: verdicts?.[i] ?? null }),
  )
  // Every block has a verdict or there is a failure: `readAll` returns one verdict per text or a
  // failure, and the other two outcomes are failures. No block is left without either.
  const finalFailure = failure === null ? null : Object.freeze({ ...failure })
  const identity = Object.freeze({ name, version })
  const frozenNearMisses = Object.freeze(nearMisses)
  const parsed: ParsedCodeBlocks = Object.freeze({
    language,
    parser: identity,
    blocks: Object.freeze(blocks),
    failure: finalFailure,
    nearMisses: frozenNearMisses,
    documentsLoaded: documents.length,
    summary: () => summarise(language, identity, blocks, finalFailure, frozenNearMisses),
  })
  REGISTERED.add(parsed)
  return parsed
}

function summarise(
  language: string,
  identity: { readonly name: string; readonly version: string },
  blocks: readonly ParsedCodeBlock[],
  failure: CodeBlockInstrumentFailure | null,
  nearMisses: readonly NearMissTag[],
): string {
  const n = blocks.length
  const noun = `${language} block${n === 1 ? '' : 's'}`
  const by = `${identity.name} ${identity.version}`
  const head =
    failure === null
      ? `${String(n)} ${noun} parsed with ${by}`
      : `0 of ${String(n)} ${noun} checked: ${by} failed — ${failure.cause}`
  if (nearMisses.length === 0) return head
  return `${head}; not read, tagged ${describeNearMisses(nearMisses)}`
}

/** `Mermaid` at docs/a.md:3, … */
export function describeNearMisses(nearMisses: readonly NearMissTag[]): string {
  return nearMisses.map((n) => `\`${n.tag}\` at ${n.file}:${String(n.line)}`).join(', ')
}

function readAll(
  returned: unknown,
  run: {
    readonly textCount: number
    readonly canaries: readonly CodeBlockCanary[]
    readonly budgetMs: number
    readonly budgetText: string
    readonly elapsedMs: number
  },
): { failure: CodeBlockInstrumentFailure } | { verdicts: readonly CodeBlockVerdict[] } {
  const { textCount, canaries, budgetMs, budgetText, elapsedMs } = run
  if (elapsedMs > budgetMs) {
    // A synchronous parser cannot be interrupted, so its overrun is found after it returns.
    return {
      failure: {
        cause: `the parse took ${String(Math.round(elapsedMs))} ms, past its budget of ${budgetText}`,
        remedy:
          'Find the block that slows the parser, or raise the budget with ' +
          '`budget: { startUpMs, perBlockMs }` if the parser is merely slow.',
      },
    }
  }
  // Copied once: a value that changes between two reads is read as it was the first time.
  let values: readonly unknown[] | null
  try {
    values = plainCopy(returned)
  } catch (error) {
    return {
      failure: {
        cause: `reading the parser's answer threw: ${messageOf(error)}`,
        remedy: 'A parser returns a plain array of plain verdict objects.',
      },
    }
  }
  if (values?.length !== textCount) {
    const got = values === null ? 'no array of' : String(values.length)
    return {
      failure: {
        cause: `the parser returned the wrong number of verdicts: ${String(textCount)} texts, ${got} verdicts`,
        remedy: 'A parser returns exactly one verdict per text, in order.',
      },
    }
  }
  const verdicts: CodeBlockVerdict[] = []
  for (const [i, value] of values.entries()) {
    let read: ReturnType<typeof readVerdict>
    try {
      read = readVerdict(value)
    } catch (error) {
      read = { problem: `could not be read (${messageOf(error)})` }
    }
    if ('problem' in read) {
      return {
        failure: {
          cause: `the parser's answer for text ${String(i + 1)} ${read.problem}`,
          remedy:
            "Return { outcome: 'valid' }, { outcome: 'invalid', message, line, remedy } or " +
            "{ outcome: 'unrecognised', message, remedy } for every text, with a non-empty message " +
            'and remedy.',
        },
      }
    }
    verdicts.push(Object.freeze(read.verdict))
  }
  for (const [i, canary] of canaries.entries()) {
    const got = verdicts[i]
    if (got?.outcome !== canary.expect) {
      return {
        failure: {
          cause:
            `canary ${String(i + 1)} was answered wrongly: expected "${canary.expect}", got ` +
            `"${got?.outcome ?? 'nothing'}"; a parser that accepts a block it must reject cannot be ` +
            'trusted to reject a broken one',
          remedy:
            'Check that the parser is the real one, at a version whose errors its canaries were ' +
            'written for, and that it is not catching its own errors.',
        },
      }
    }
  }
  return { verdicts }
}

type RunOutcome =
  | { readonly kind: 'returned'; readonly values: unknown; readonly elapsedMs: number }
  | { readonly kind: 'threw'; readonly error: unknown }
  | { readonly kind: 'timeout'; readonly error: unknown }

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
  let result: unknown
  try {
    result = parser.parse(texts, { signal: controller.signal, budgetMs })
  } catch (error) {
    return { kind: 'threw', error }
  }
  if (Array.isArray(result)) {
    return { kind: 'returned', values: result, elapsedMs: performance.now() - started }
  }

  // Anything else is awaited, so a thenable that is not a native Promise is still a promise here. A
  // value that is neither resolves to itself and is reported as "no array of verdicts". The parser's
  // promise is settled into a value, so a rejection after we stop waiting is never unhandled.
  const settled: Promise<RunOutcome> = Promise.resolve(result).then(
    (values: unknown): RunOutcome => ({
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
