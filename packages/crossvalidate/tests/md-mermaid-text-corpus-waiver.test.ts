import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { corpusFromText } from '@nielspeter/eess-md'
import { project } from '@nielspeter/eess-ts'
import { embeddedDiagramsMatchCode } from '../src/md-mermaid.js'

// Plan 0632, Phase 2 (ADR-024 clauses 1 and 5): a kernel correspondence over a text corpus's
// document honours a waiver in that document. `embeddedDiagramsMatchCode` reports each class through
// `correspondence()` against the document's absolute `file`, which the kernel looks up in the texts
// `corpusFromText` registered; before ADR-024 the kernel read the disk there and found nothing.

const calc = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/calc')
const proj = () => project(join(calc, 'tsconfig.json'))

const diagram = (above: string): string =>
  `# Architecture\n\n${above}\n\`\`\`mermaid\nclassDiagram\nclass Calculator\nclass GhostClass\n\`\`\`\n`

const run = (above: string) =>
  embeddedDiagramsMatchCode(corpusFromText({ 'docs/arch.md': diagram(above) }), proj(), {
    report: 'return',
  })

describe('a correspondence over a text corpus honours a waiver (ADR-024)', () => {
  it('CONTROL: without a directive, the class missing from code is reported, and the rule examined it', () => {
    const r = run('Plain text.')
    expect(r.map((v) => v.message)).toEqual([expect.stringMatching(/GhostClass/)])
    expect(r.examined).toBeGreaterThan(0)
  })

  it('with the directive in the registered text, the finding is waived', () => {
    const r = run('<!-- eess-exclude crossval/embedded-diagram: the class lands in a later step -->')
    expect(r.map((v) => v.message)).toEqual([])
    expect(r.examined).toBeGreaterThan(0)
  })
})
