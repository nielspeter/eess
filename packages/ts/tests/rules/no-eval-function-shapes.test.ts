import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { functionNoEval } from '../../src/rules/security.js'
import { collectFunctions } from '../../src/models/arch-function.js'

/**
 * Bug 0224 — the `recommended` floor missed two ordinary function shapes.
 *
 * `check:baseline` runs `recommended` over every package's source and calls
 * itself "the universal safety floor every consumer gets, applied to us". It was
 * green with `eval` sitting in the kernel, because the shape mattered:
 *
 *   function a() { return eval("1") }          red
 *   const a = () => { return eval("1") }       red
 *   const a = () => eval("1")                  GREEN
 *   const a = function () { return eval("1") } GREEN
 *   class A { m() { return eval("1") } }       red
 *
 * The non-vacuity harness stayed green throughout, because its fixture plants a
 * function declaration — proving the rule CAN fire, never that it fires on
 * everything it claims to cover. Hence a table, not a case: this is the matrix a
 * body-analysis rule owes, and every row is a shape TypeScript writes daily.
 */
const SHAPES = [
  { name: 'function declaration', src: 'export function a() { return eval("1") }' },
  { name: 'arrow, block body', src: 'export const a = () => { return eval("1") }' },
  { name: 'arrow, concise body', src: 'export const a = () => eval("1")' },
  { name: 'function expression', src: 'export const a = function () { return eval("1") }' },
  { name: 'class method', src: 'export class A { m() { return eval("1") } }' },
]

describe('functionNoEval sees every function shape', () => {
  for (const { name, src } of SHAPES) {
    it(`flags eval in a ${name}`, () => {
      const project = new Project({ useInMemoryFileSystem: true })
      const sf = project.createSourceFile('probe.ts', src)
      const fns = collectFunctions(sf, { includeMethods: true })
      const violations = functionNoEval().evaluate(fns, { rule: 'test rule' })
      expect(violations.length).toBeGreaterThan(0)
    })
  }

  it('does not flag a function that never calls eval', () => {
    const project = new Project({ useInMemoryFileSystem: true })
    const sf = project.createSourceFile('clean.ts', 'export const a = () => JSON.parse("1")')
    const fns = collectFunctions(sf, { includeMethods: true })
    expect(functionNoEval().evaluate(fns, { rule: 'test rule' })).toHaveLength(0)
  })
})
