// eess-mermaid's Mermaid worker (plan 0413). It runs `mermaid.parse` under a `jsdom` window on its
// own thread, so the DOM globals Mermaid needs never reach the host's.
//
// Self-contained on purpose: it imports only Node built-ins, `mermaid` and `jsdom`, with no relative
// import, so a copy of this one file runs wherever those two resolve. It is plain JavaScript because
// no loader transforms a worker's own imports (ADR-015).
//
// It posts facts and decides nothing. An error loses its `hash` and `result` crossing `postMessage`,
// so each one is read here, where it was thrown, and only plain data is posted. Which outcome a fact
// is, and on which line, is the host's (`create-mermaid-parser.ts`). The messages:
//   { type: 'loaded', version }                     once, after `mermaid` and `jsdom` load
//   { type: 'load-error', code, missing, message }  when they do not
//   { type: 'progress', index }                     before each of `workerData.texts`
//   { type: 'verdicts', results, privateResults }   one fact per text, at the end
// `workerData.privateTexts` are parsed first and post no `progress`, so the indexes stay the caller's.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parentPort, workerData } from 'node:worker_threads'

/** The version of the `mermaid` this worker imports: up from its resolved entry to its package.json. */
function loadedVersion() {
  let dir = dirname(fileURLToPath(import.meta.resolve('mermaid')))
  for (;;) {
    const file = join(dir, 'package.json')
    if (existsSync(file)) {
      const pkg = JSON.parse(readFileSync(file, 'utf8'))
      if (pkg?.name === 'mermaid')
        return typeof pkg.version === 'string' ? pkg.version : 'unreadable'
    }
    const up = dirname(dir)
    if (up === dir) return 'unreadable'
    dir = up
  }
}

const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null)

/** One error, read by property, never by class name or message. */
function errorFact(error) {
  const message = String(error?.message ?? error)
  const fact = { shape: 'other', locFirstLine: null, hashLine: null, langiumLines: [], message }
  if (typeof error?.hash === 'object' && error.hash !== null) {
    return {
      ...fact,
      shape: 'jison',
      locFirstLine: finite(error.hash.loc?.first_line),
      hashLine: finite(error.hash.line),
    }
  }
  const result = error?.result
  if (Array.isArray(result?.lexerErrors) && Array.isArray(result?.parserErrors)) {
    const lines = [
      ...result.lexerErrors.map((e) => finite(e?.line)),
      ...result.parserErrors.map((e) => finite(e?.token?.startLine)),
    ].filter((line) => line !== null)
    return { ...fact, shape: 'langium', langiumLines: lines }
  }
  if (error?.name === 'UnknownDiagramError') return { ...fact, shape: 'unknown-diagram' }
  return fact
}

async function parseOne(mermaid, text) {
  try {
    const result = await mermaid.parse(text)
    if (typeof result !== 'object' || result === null) {
      return {
        shape: 'non-result',
        locFirstLine: null,
        hashLine: null,
        langiumLines: [],
        message: String(result),
      }
    }
    return { shape: 'ok', locFirstLine: null, hashLine: null, langiumLines: [], message: '' }
  } catch (error) {
    return errorFact(error)
  }
}

async function main() {
  let mermaid
  let version
  try {
    const { JSDOM } = await import('jsdom')
    const dom = new JSDOM('<!doctype html><html><body></body></html>')
    for (const key of ['window', 'document', 'DOMParser', 'Element', 'HTMLElement', 'Node']) {
      if (!(key in globalThis)) globalThis[key] = key === 'window' ? dom.window : dom.window[key]
    }
    mermaid = (await import('mermaid')).default
    version = loadedVersion()
  } catch (error) {
    const message = String(error?.message ?? error)
    parentPort.postMessage({
      type: 'load-error',
      code: typeof error?.code === 'string' ? error.code : '',
      missing: /Cannot find package '([^']+)'/.exec(message)?.[1] ?? '',
      message,
    })
    return
  }
  parentPort.postMessage({ type: 'loaded', version })
  const privateResults = []
  for (const text of workerData.privateTexts) privateResults.push(await parseOne(mermaid, text))
  const results = []
  for (const [index, text] of workerData.texts.entries()) {
    parentPort.postMessage({ type: 'progress', index })
    results.push(await parseOne(mermaid, text))
  }
  parentPort.postMessage({ type: 'verdicts', results, privateResults })
}

await main()
