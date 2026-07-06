import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ArchRuleError } from '@nielspeter/eess'
import { project } from '@nielspeter/eess-ts'
import { diagram } from '@nielspeter/eess-mermaid'
import { diagramMatchesCode } from '../src/mermaid-ts.js'

const calc = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/calc')
const tsProject = () => project(join(calc, 'tsconfig.json'))
const mmd = (name: string) => diagram(readFileSync(join(calc, name), 'utf8'))

describe('diagramMatchesCode() — Mermaid↔TS', () => {
  it('stage 6: passes when the diagram and code agree', () => {
    expect(() => diagramMatchesCode(mmd('complete.mmd'), tsProject())).not.toThrow()
  })

  it('stage 7: fails when code has a class missing from the diagram', () => {
    // ModuloOperation exists in src/ but not in drift.mmd — the payoff moment
    let err: unknown
    try {
      diagramMatchesCode(mmd('drift.mmd'), tsProject())
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(ArchRuleError)
    const messages = (err as ArchRuleError).violations.map((v) => v.message).join('\n')
    expect(messages).toMatch(/TS class "ModuloOperation" has no matching diagram class/)
  })

  it('left-to-right only: ignores extra code classes', () => {
    // drift.mmd is missing ModuloOperation, but left-to-right only checks
    // that every DIAGRAM class exists in code — which it does
    expect(() =>
      diagramMatchesCode(mmd('drift.mmd'), tsProject(), { completeness: 'left-to-right' }),
    ).not.toThrow()
  })
})
