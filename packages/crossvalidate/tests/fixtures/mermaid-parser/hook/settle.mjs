// Plan 0413: one parse down one path, then nothing. The parent asserts this process exits on its
// own. On success, failure and abort the stub keeps a timer alive in the worker, so the process can
// exit only if the host terminates the worker. On exit the worker is gone already: that path proves
// only that nothing else keeps the host alive. "real" uses the installed mermaid (and the hook).
import {
  cpSync,
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
import { pathToFileURL } from 'node:url'
import { mermaidParser } from '@nielspeter/eess-mermaid'

const DIST = new URL('../../../../../mermaid/dist/mermaid-js/', import.meta.url)
const { createMermaidParser } = await import(new URL('create-mermaid-parser.js', DIST).href)
const require = createRequire(import.meta.url)
const real = (name) => {
  for (const dir of require.resolve.paths(name) ?? [])
    if (existsSync(join(dir, name))) return join(dir, name)
  throw new Error(`no ${name}`)
}

/** The built worker, copied into a scratch directory with these packages. */
const scratchDirs = []
function scratch(modules) {
  const dir = mkdtempSync(join(tmpdir(), 'eess-mermaid-settle-'))
  scratchDirs.push(dir)
  cpSync(new URL('mermaid-worker.mjs', DIST), join(dir, 'mermaid-worker.mjs'))
  mkdirSync(join(dir, 'node_modules'))
  for (const [name, source] of Object.entries(modules)) {
    if (source === 'real') {
      symlinkSync(real(name), join(dir, 'node_modules', name))
      continue
    }
    mkdirSync(join(dir, 'node_modules', name))
    writeFileSync(
      join(dir, 'node_modules', name, 'package.json'),
      JSON.stringify({ name, version: '11.17.2', type: 'module', exports: './index.mjs' }),
    )
    writeFileSync(join(dir, 'node_modules', name, 'index.mjs'), source)
  }
  return pathToFileURL(join(dir, 'mermaid-worker.mjs'))
}

// A timer that outlives the answer: only terminating the worker ends it.
const KEEP = 'setInterval(() => {}, 1 << 30)'
const LINE_CANARY = `(t) => {
  const fail = (m, e) => { throw Object.assign(new Error(m), e) }
  if (t.startsWith('---\\ntitle: x')) fail('c1', { hash: { loc: { first_line: 7 } } })
  if (t.includes(']]]')) fail('c2', { hash: { line: 2 } })
  if (t.includes('11-x')) fail('c3', { result: { lexerErrors: [{ line: 3 }], parserErrors: [] } })
}`

const path = process.argv[2]
const signal = new AbortController()
const run = { signal: signal.signal, budgetMs: 60_000 }
let parser = mermaidParser()
let texts = ['flowchart TD\n  A --> B']
if (path === 'success') {
  parser = createMermaidParser({
    workerUrl: scratch({
      jsdom: 'real',
      mermaid: `${KEEP}\nconst lineCanary = ${LINE_CANARY}\nexport default { parse: async (t) => { lineCanary(t); return {} } }`,
    }),
  })
  texts = [...parser.canaries.map((c) => c.text), 'flowchart TD']
}
if (path === 'failure') {
  parser = createMermaidParser({
    workerUrl: scratch({
      mermaid: 'real',
      jsdom: `${KEEP}\nthrow new Error("Cannot find package 'jsdom-dependency' imported from jsdom")`,
    }),
  })
}
if (path === 'exit') {
  parser = createMermaidParser({
    workerUrl: scratch({
      jsdom: 'real',
      mermaid: 'export default { parse: async () => process.exit(7) }',
    }),
  })
}
if (path === 'abort') {
  parser = createMermaidParser({
    workerUrl: scratch({
      jsdom: 'real',
      mermaid: `${KEEP}\nexport default { parse: () => new Promise(() => {}) }`,
    }),
  })
  texts = ['flowchart TD']
  setTimeout(() => signal.abort(), 500)
}
try {
  const verdicts = await parser.parse(texts, run)
  console.log(`SETTLED resolved ${JSON.stringify(verdicts.slice(-1))}`)
} catch (error) {
  console.log(`SETTLED rejected ${error.message} | ${error.remedy}`)
} finally {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true })
}
