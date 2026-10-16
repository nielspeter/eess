// Plan 0413: one parse down one path, then nothing. The parent asserts this process exits on its
// own, which it cannot while a worker is left running. Paths: success, failure, exit, abort, hook.
import { cpSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync, existsSync } from 'node:fs'
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
function scratch(modules) {
  const dir = mkdtempSync(join(tmpdir(), 'eess-mermaid-settle-'))
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

const path = process.argv[2]
const signal = new AbortController()
const run = { signal: signal.signal, budgetMs: 60_000 }
let parser = mermaidParser()
let texts = ['flowchart TD\n  A --> B']
if (path === 'failure') parser = createMermaidParser({ workerUrl: scratch({ mermaid: 'real' }) })
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
      mermaid: 'export default { parse: () => new Promise((r) => setTimeout(r, 60_000)) }',
    }),
  })
  texts = ['flowchart TD']
  setTimeout(() => signal.abort(), 500)
}
try {
  const verdicts = await parser.parse(texts, run)
  console.log(`SETTLED resolved ${JSON.stringify(verdicts)}`)
} catch (error) {
  console.log(`SETTLED rejected ${error.message} | ${error.remedy}`)
}
