import { describe, it, expect } from 'vitest'
import { Project, ScriptTarget, ModuleKind } from 'ts-morph'
import type { CompilerOptions } from 'ts-morph'
import type { ArchProject } from '../../src/core/project.js'
import { tsconfig } from '../../src/tsconfig/tsconfig-builder.js'
import { STRICT_FAMILY_SIZE } from '../../src/tsconfig/strict-family.js'

/** In-memory ArchProject with the given compiler options. */
function mk(opts: CompilerOptions): ArchProject {
  const p = new Project({ useInMemoryFileSystem: true, compilerOptions: opts })
  return {
    tsConfigPath: '/mem/tsconfig.json',
    _project: p,
    getSourceFiles: () => p.getSourceFiles(),
  }
}

const flags = (b: ReturnType<typeof tsconfig>): string[] => b.violations().map((v) => v.element)

describe('tsconfig().requires — direct flags', () => {
  it('passes when the required flag matches', () => {
    expect(
      tsconfig(mk({ strict: true }))
        .requires({ strict: true })
        .violations(),
    ).toHaveLength(0)
  })

  it('flags a mismatch with expected/actual in the message, keyed by flag name', () => {
    const v = tsconfig(mk({ strict: false }))
      .requires({ strict: true })
      .violations()
    expect(v).toHaveLength(1)
    expect(v[0]?.element).toBe('strict')
    expect(v[0]?.message).toContain('required true')
    expect(v[0]?.message).toContain('actual false')
  })

  it('reports one violation per mismatched flag', () => {
    const v = tsconfig(mk({ strict: false, noEmit: false }))
      .requires({ strict: true, noEmit: true })
      .violations()
    expect(v.map((x) => x.element).sort()).toEqual(['noEmit', 'strict'])
  })
})

describe('tsconfig().requires — strict-family resolution', () => {
  it('treats strict: true as enabling each sub-flag', () => {
    expect(
      tsconfig(mk({ strict: true }))
        .requires({ strictNullChecks: true, noImplicitAny: true })
        .violations(),
    ).toHaveLength(0)
  })

  it('an explicit sub-flag override under strict yields the remove-override suggestion', () => {
    const v = tsconfig(mk({ strict: true, strictNullChecks: false }))
      .requires({ strictNullChecks: true })
      .violations()
    expect(v).toHaveLength(1)
    expect(v[0]?.suggestion).toContain('Remove the explicit')
  })

  it('the strict family has the expected size (drift guard)', () => {
    expect(STRICT_FAMILY_SIZE).toBe(9)
  })
})

describe('tsconfig().requires — enum rendering', () => {
  it('renders target/module by name, not raw number', () => {
    const v = tsconfig(mk({ target: ScriptTarget.ES2020 }))
      .requires({ target: ScriptTarget.ES2022, module: ModuleKind.Node16 })
      .violations()
    const target = v.find((x) => x.element === 'target')
    expect(target?.message).toContain('ES2022')
    expect(target?.message).toContain('ES2020')
    expect(target?.message).not.toMatch(/\b9\b/)
  })
})

describe('tsconfig().requires — set-valued options and excluding', () => {
  it('compares lib order-insensitively', () => {
    expect(
      tsconfig(mk({ lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'] }))
        .requires({ lib: ['lib.dom.d.ts', 'lib.es2022.d.ts'] })
        .violations(),
    ).toHaveLength(0)
  })

  it('.excluding(flag) filters a violation by its flag name', () => {
    const b = tsconfig(mk({ strict: false, noEmit: false }))
      .requires({ strict: true, noEmit: true })
      .excluding('strict')
    expect(flags(b)).toEqual(['noEmit'])
  })
})
