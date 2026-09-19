import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import { classes } from '../../src/builders/class-rule-builder.js'
import { functions } from '../../src/builders/function-rule-builder.js'
import { maxCyclomaticComplexity } from '../../src/rules/metrics.js'
import { maxFunctionComplexity } from '../../src/rules/metrics-function.js'
import type { ArchProject } from '../../src/core/project.js'

/**
 * Bug 0320 — a class metric names an accessor by its name alone, `Box.size`, and a function metric
 * names the same accessor `Box.get size` or `Box.set size`. And a static member and an instance
 * member of one name report the same element and message on both sides, so a report tells them
 * apart only by line. Their identities stay distinct — the second is suffixed by position, `#1` — so a
 * baseline keeps them apart; but no exclusion can name one twin without the other.
 */
function project(lines: readonly string[]): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile('/src/box.ts', [...lines, ''].join('\n'))
  return {
    tsConfigPath: '/tsconfig.json',
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

const BOX = [
  'declare const a: boolean, b: boolean, c: boolean', // 1
  'export class Box {', // 2
  '  static get size() { if (a) { if (b) { if (c) { return 1 } } } return 0 }', // 3
  '  get size() { if (a) { if (b) { if (c) { return 1 } } } return 2 }', // 4
  '  set size(v: number) { if (a) { if (b) { if (c) { return } } } }', // 5
  '  static make() { if (a) { if (b) { if (c) { return 1 } } } return 0 }', // 6
  '  make() { if (a) { if (b) { if (c) { return 1 } } } return 2 }', // 7
  '}', // 8
]

function classFindings() {
  return classes(project(BOX))
    .should()
    .satisfy(maxCyclomaticComplexity(1))
    .rule({ id: 'test/0320-class' })
    .violations()
}

function functionFindings() {
  return functions(project(BOX))
    .should()
    .satisfy(maxFunctionComplexity(1))
    .rule({ id: 'test/0320-function' })
    .violations()
}

const byLine = (findings: readonly { line?: number; element: string; message: string }[]) =>
  new Map(findings.map((v) => [v.line, `${v.element} · ${v.message}`]))

describe('bug 0320: accessor names and static members', () => {
  it('KNOWN GAP — a class metric names an accessor by its name alone, a function metric with get or set', () => {
    const cls = byLine(classFindings())
    const fns = byLine(functionFindings())

    expect([3, 4, 5].map((line) => cls.get(line)?.split(' ')[0])).toEqual([
      'Box.size',
      'Box.size',
      'Box.size',
    ])
    expect([3, 4, 5].map((line) => fns.get(line)?.split(' · ')[0])).toEqual([
      'Box.get size',
      'Box.get size',
      'Box.set size',
    ])
  })

  it('KNOWN GAP — a static member and an instance member of one name report the same element and message', () => {
    const complexity = 'has cyclomatic complexity 4 (max: 1)'
    const row = (v: { line?: number; element: string; message: string; identity?: string }) => [
      v.line,
      v.element,
      v.message,
      v.identity,
    ]

    // Lines 3 and 4, and 6 and 7, are a static member and its instance twin: one element, one message.
    // Control: the identity column differs, suffixed by position, so a baseline keeps the twins apart.
    const tail = ' — split into smaller methods'
    expect(classFindings().map(row)).toEqual([
      [6, 'Box.make', `Box.make ${complexity}${tail}`, '/src/box.ts::Box.make::complexity'],
      [7, 'Box.make', `Box.make ${complexity}${tail}`, '/src/box.ts::Box.make::complexity#1'],
      [3, 'Box.size', `Box.size ${complexity}${tail}`, '/src/box.ts::Box.size::complexity'],
      [4, 'Box.size', `Box.size ${complexity}${tail}`, '/src/box.ts::Box.size::complexity#1'],
      [5, 'Box.size', `Box.size ${complexity}${tail}`, '/src/box.ts::Box.size::complexity#2'],
    ])
    expect(functionFindings().map(row)).toEqual([
      [6, 'Box.make', `Box.make ${complexity}`, '/src/box.ts::Box.make::complexity'],
      [7, 'Box.make', `Box.make ${complexity}`, '/src/box.ts::Box.make::complexity#1'],
      [3, 'Box.get size', `Box.get size ${complexity}`, '/src/box.ts::Box.get size::complexity'],
      [4, 'Box.get size', `Box.get size ${complexity}`, '/src/box.ts::Box.get size::complexity#1'],
      [5, 'Box.set size', `Box.set size ${complexity}`, '/src/box.ts::Box.set size::complexity'],
    ])
  })

  it('KNOWN GAP — an exclusion naming one of two same-named members excludes both', () => {
    const kept = functions(project(BOX))
      .should()
      .satisfy(maxFunctionComplexity(1))
      .rule({ id: 'test/0320-excluding' })
      .excluding('Box.get size')
      .violations()

    // Written for one getter, it leaves neither: only the setter and the two methods remain.
    expect(kept.map((v) => [v.line, v.element])).toEqual([
      [6, 'Box.make'],
      [7, 'Box.make'],
      [5, 'Box.set size'],
    ])
  })
})
