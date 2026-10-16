// Plan 0413: mermaidParser() from a rule file the eess-ts CLI loads. It reports which DOM globals
// the host had before and after the parse; the worker must leave them as they were.
import { codeBlocks, corpus, parseCodeBlocks } from '@nielspeter/eess-md'
import { mermaidParser } from '@nielspeter/eess-mermaid'

const GLOBALS = ['window', 'document', 'DOMParser', 'Element', 'HTMLElement']
const before = GLOBALS.filter((key) => key in globalThis)
const parsed = await parseCodeBlocks(corpus({ roots: ['docs/**'], cwd: import.meta.dirname }), {
  language: 'mermaid',
  parser: mermaidParser(),
})
const after = GLOBALS.filter((key) => key in globalThis)
console.error(`MERMAID-PARSER-CLI ${JSON.stringify({ summary: parsed.summary(), before, after })}`)

export default [codeBlocks(parsed).should().parse().rule({ id: 'fixture/mermaid-parses' })]
