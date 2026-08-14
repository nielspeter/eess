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

  it("completeness: 'both' passes when the embedded diagram and code fully agree", () => {
    expect(() =>
      embeddedDiagramsMatchCode(c(['docs/embedded-complete.md']), proj(), {
        completeness: 'both',
      }),
    ).not.toThrow()
  })

  it("completeness: 'both' fails when code has a class missing from the embedded diagram", () => {
    // ModuloOperation exists in src/ but not in embedded-good.md — plan 0096
    // makes this the load-bearing check that closes an emptied-diagram hole:
    // left-to-right alone only checks every DIAGRAM class exists in code,
    // which passes trivially even for an empty diagram (see the test below).
    let err: unknown
    try {
      embeddedDiagramsMatchCode(c(['docs/embedded-good.md']), proj(), { completeness: 'both' })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(ArchRuleError)
    const messages = (err as ArchRuleError).violations.map((v) => v.message).join('\n')
    expect(messages).toMatch(/TS class "ModuloOperation" has no matching diagram class/)
  })

  it("left-to-right only: ignores extra code classes embedded-good.md doesn't name", () => {
    // The default. embedded-good.md is missing ModuloOperation, but
    // left-to-right only checks that every DIAGRAM class exists in code.
    expect(() =>
      embeddedDiagramsMatchCode(c(['docs/embedded-good.md']), proj(), {
        completeness: 'left-to-right',
      }),
    ).not.toThrow()
  })
})
