import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ArchRuleError } from '@nielspeter/eess'
import { corpus } from '@nielspeter/eess-md'
import { project } from '@nielspeter/eess-ts'
import { embeddedDiagramsMatchCode } from '../src/md-mermaid.js'

const calc = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/calc')
const proj = () => project(join(calc, 'tsconfig.json'))
const c = (roots: string[]) => corpus({ roots, cwd: calc })

describe('embeddedDiagramsMatchCode() — embedded ```mermaid in markdown', () => {
  it('passes when every class in an embedded diagram exists in code', () => {
    expect(() => embeddedDiagramsMatchCode(c(['docs/embedded-good.md']), proj())).not.toThrow()
  })

  it('fails when an embedded diagram names a class missing from code, pointing at the md file', () => {
    let err: unknown
    try {
      embeddedDiagramsMatchCode(c(['docs/embedded-bad.md']), proj())
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(ArchRuleError)
    const v = (err as ArchRuleError).violations
    expect(v.some((x) => x.message.includes('GhostClass'))).toBe(true)
    // violation points at the markdown file, not the parsed diagram
    expect(v.some((x) => x.file.endsWith('embedded-bad.md'))).toBe(true)
  })
})
