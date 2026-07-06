import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ArchRuleError } from '@nielspeter/eess'
import { corpus } from '@nielspeter/eess-md'
import { project } from '@nielspeter/eess-ts'
import { adrCitationsResolve } from '../src/md-ts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/citations')
const proj = () => project(join(root, 'tsconfig.json'))
const c = (roots: string[]) => corpus({ roots, cwd: root })

describe('adrCitationsResolve() — MD↔TS (AST-grounded)', () => {
  it('passes when a cited it() actually exists in the project', () => {
    expect(() => adrCitationsResolve(c(['docs/adr/0001-good.md']), proj())).not.toThrow()
  })

  it('fails when a cited it() does not exist', () => {
    let err: unknown
    try {
      adrCitationsResolve(c(['docs/adr/0002-bad.md']), proj())
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(ArchRuleError)
    const messages = (err as ArchRuleError).violations.map((v) => v.message).join('\n')
    expect(messages).toMatch(/it\('missing'\).*no matching test/)
  })
})
