import { describe, it, expect } from 'vitest'
import { Project, SyntaxKind, type Node } from 'ts-morph'

/**
 * Bug 0299 — `hasExternalReference` treats a throwing `findReferencesAsNodes` as
 * "referenced", and its comment names a trigger: "shorthand property assignments in
 * re-exports". This is the committed reproduction attempt, calling the real language
 * service with no mocking.
 *
 * It is GREEN by design: nothing here throws today. It turns red the day a shape
 * does, which is the trigger the record could not find. The CommonJS files, loaded
 * under `allowJs`, are what actually produce `ShorthandPropertyAssignment` nodes.
 */
const SHAPES: Readonly<Record<string, string>> = {
  '/src/shorthand.ts': 'const a = 1\nexport const o = { a }\nexport { a }\n',
  '/src/export-eq.ts': 'const v = 1\nexport = v\n',
  '/src/default-obj.ts': 'const b = 2\nexport default { b }\n',
  '/src/ns-reexport.ts': "export * as ns from './shorthand'\n",
  '/src/star.ts': "export * from './shorthand'\n",
  '/src/rename.ts': "import { a } from './shorthand'\nexport { a as renamed }\n",
  '/src/type-only.ts': "export type { Foo } from './types'\n",
  '/src/types.ts': 'export interface Foo {\n  x: number\n}\nexport type Bar = Foo\n',
  '/src/merge.ts': 'export function m() {}\nexport namespace m {\n  export const y = 1\n}\n',
  '/src/enum.ts': 'export enum E {\n  A,\n  B,\n}\nexport const enum CE {\n  X,\n}\n',
  '/src/overload.ts':
    'export function f(a: string): void\nexport function f(a: number): void\nexport function f(a: unknown) {}\n',
  '/src/import-eq.ts': "import fs = require('fs')\nexport import F = fs\n",
  '/src/ambient.ts':
    "declare module 'thing' {\n  export const t: number\n}\nexport declare const d: number\n",
  '/src/destructure.ts': 'const obj = { p: 1, q: 2 }\nexport const { p, q } = obj\n',
  '/src/array-destructure.ts': 'const arr = [1, 2]\nexport const [first, second] = arr\n',
  '/src/class.ts': 'export class C {}\nexport abstract class D {}\n',
  '/src/default-reexport.ts': "export { default as Def } from './default-obj'\n",
  '/src/missing.ts': "export { gone } from './does-not-exist'\n",
  '/src/cjs.js': 'const a = 1\nconst b = 2\nmodule.exports = { a, b }\n',
  '/src/cjs-reexport.js': "const { a } = require('./cjs')\nmodule.exports = { a }\n",
}

describe('bug 0299: a reference lookup that throws counts as a use', () => {
  it('no probed export shape makes findReferencesAsNodes throw', () => {
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: { strict: true, esModuleInterop: true, allowJs: true },
    })
    for (const [path, text] of Object.entries(SHAPES)) project.createSourceFile(path, text)
    const service = project.getLanguageService()

    const looked: string[] = []
    const threw: string[] = []
    const lookup = (label: string, node: Node): void => {
      looked.push(label)
      try {
        service.findReferencesAsNodes(node)
      } catch (err) {
        threw.push(`${label}: ${String(err)}`)
      }
    }

    for (const sf of project.getSourceFiles()) {
      for (const [name, declarations] of sf.getExportedDeclarations()) {
        const [first] = declarations
        if (first !== undefined) lookup(`${sf.getBaseName()} export ${name}`, first)
      }
      for (const shorthand of sf.getDescendantsOfKind(SyntaxKind.ShorthandPropertyAssignment)) {
        lookup(`${sf.getBaseName()} shorthand ${shorthand.getName()}`, shorthand)
      }
    }

    expect(threw).toEqual([])
    // Non-vacuity: the named trigger's node kind was reached, and exports were looked up.
    expect(looked.some((l) => l.includes(' shorthand '))).toBe(true)
    expect(looked.some((l) => l.includes(' export '))).toBe(true)
  })
})
