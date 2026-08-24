import { describe, it, expect } from 'vitest'
import { Project } from 'ts-morph'
import type { FunctionDeclaration, ClassDeclaration } from 'ts-morph'
import path from 'node:path'
import { cyclomaticComplexity, linesOfCode, methodCount } from '../../src/helpers/complexity.js'

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures/metrics')
const project = new Project({ tsConfigFilePath: path.join(fixturesDir, 'tsconfig.json') })

function findClass(name: string) {
  const cls = project
    .getSourceFiles()
    .flatMap((sf) => sf.getClasses())
    .find((c) => c.getName() === name)
  if (!cls) throw new Error(`Fixture class not found: ${name}`)
  return cls
}

function findMethod(className: string, methodName: string) {
  const cls = findClass(className)
  const method = cls.getMethods().find((m) => m.getName() === methodName)
  if (!method) throw new Error(`Fixture method not found: ${className}.${methodName}`)
  return method
}

function findFunction(name: string) {
  const fn = project
    .getSourceFiles()
    .flatMap((sf) => sf.getFunctions())
    .find((f) => f.getName() === name)
  if (!fn) throw new Error(`Fixture function not found: ${name}`)
  return fn
}

describe('cyclomaticComplexity', () => {
  it('returns 1 for undefined body', () => {
    expect(cyclomaticComplexity(undefined)).toBe(1)
  })

  it('returns 1 for a simple method with no decision points', () => {
    const method = findMethod('ComplexService', 'simple')
    expect(cyclomaticComplexity(method.getBody())).toBe(1)
  })

  it('counts if statements', () => {
    // processItems: if + for + if + || + ?? = 5
    const fn = findFunction('processItems')
    const cc = cyclomaticComplexity(fn.getBody())
    expect(cc).toBeGreaterThanOrEqual(5)
  })

  it('counts for-of loops', () => {
    // complex method: if + for + if + && + ternary = 6
    const method = findMethod('ComplexService', 'complex')
    const cc = cyclomaticComplexity(method.getBody())
    expect(cc).toBe(6)
  })

  it('counts logical AND/OR operators', () => {
    // complex: the && adds 1
    const method = findMethod('ComplexService', 'complex')
    const cc = cyclomaticComplexity(method.getBody())
    expect(cc).toBeGreaterThan(4) // would be 4 without the && and ternary
  })

  it('counts ternary expressions', () => {
    // complex has a ternary: item.length > 10 ? 2 : 1
    const method = findMethod('ComplexService', 'complex')
    const cc = cyclomaticComplexity(method.getBody())
    expect(cc).toBe(6) // 1 + if + for + if + && + ternary
  })

  it('counts nullish coalescing', () => {
    // processItems uses ?? twice
    const fn = findFunction('processItems')
    const cc = cyclomaticComplexity(fn.getBody())
    expect(cc).toBeGreaterThanOrEqual(5)
  })

  it('counts constructor decision points', () => {
    // ConfigService constructor: if + else-if + else-if + ?? = 4
    const cls = findClass('ConfigService')
    const ctors = cls.getConstructors()
    expect(ctors.length).toBeGreaterThan(0)
    const cc = cyclomaticComplexity(ctors[0]!.getBody())
    expect(cc).toBe(5) // 1 + ?? + if + else-if + else-if
  })

  it('counts getter decision points', () => {
    // ConfigService getter: if + && = 3
    const cls = findClass('ConfigService')
    const getter = cls.getGetAccessors().find((g) => g.getName() === 'value')
    expect(getter).toBeDefined()
    const cc = cyclomaticComplexity(getter!.getBody())
    expect(cc).toBe(3) // 1 + if + &&
  })

  it('returns 1 for simple function', () => {
    const fn = findFunction('identity')
    expect(cyclomaticComplexity(fn.getBody())).toBe(1)
  })
})

describe('linesOfCode', () => {
  it('counts code lines for a class', () => {
    const cls = findClass('ComplexService')
    expect(linesOfCode(cls)).toBeGreaterThan(10)
  })

  it('counts code lines for a method', () => {
    const method = findMethod('ComplexService', 'simple')
    expect(linesOfCode(method)).toBeGreaterThanOrEqual(3) // signature + body + closing
  })

  it('counts code lines for a function', () => {
    const fn = findFunction('processItems')
    expect(linesOfCode(fn)).toBeGreaterThan(5)
  })

  // [Bug 0170](../../../../work/bugs/fixed/0170-linesofcode-counts-comments-so-documentation-reads-as-size.md):
  // this returned `end - start + 1`, so a documented class failed
  // `maxClassLines` on the JSDoc that `eess/jsdoc-on-public-methods` requires of
  // it — one rule breaking another. Measured on this repo, six of nine class
  // findings and two of four method findings were comment lines alone.
  //
  // Pinned to EXACT numbers. The three cases above are the reason: they were
  // titled "counts span lines" and asserted `toBeGreaterThan(10)`, which a code
  // -line implementation satisfies just as well — so the contract they claimed
  // to hold was never actually held, and two bugs cited them as if it were.
  describe('excludes what is not code (bug 0170)', () => {
    const tsm = new Project({ useInMemoryFileSystem: true })
    const fnIn = (name: string, src: string): FunctionDeclaration => {
      const sf = tsm.createSourceFile(`/src/${name}.ts`, src)
      const [fn] = sf.getFunctions()
      if (!fn) throw new Error(`no function in ${name}`)
      return fn
    }

    it('counts neither comment lines nor blank lines', () => {
      // 8 lines of span; 4 of them carry code:
      //   1 `export function documented() {`
      //   3 `const x = 1`
      //   7 `return x` (a trailing comment does not make the line stop counting)
      //   8 `}`
      const fn = fnIn(
        'documented',
        'export function documented() {\n' + // 1
          '  // a leading comment\n' + //        2
          '  const x = 1\n' + //                 3
          '\n' + //                              4
          '  /* a block\n' + //                  5
          '     comment */\n' + //               6
          '  return x // trailing\n' + //        7
          '}\n', //                              8
      )
      expect(fn.getEndLineNumber() - fn.getStartLineNumber() + 1).toBe(8)
      expect(linesOfCode(fn)).toBe(4)
    })

    it('does not count a JSDoc block above the declaration', () => {
      const fn = fnIn(
        'jsdoc',
        '/**\n * Documented.\n * @returns nothing useful\n */\n' +
          'export function jsdoc() {\n  return 1\n}\n',
      )
      // Signature, body, closing brace — the four JSDoc lines are not code.
      expect(linesOfCode(fn)).toBe(3)
    })

    it('does not count a JSDoc block INSIDE the element', () => {
      // The case that actually exercises the JSDoc skip. A doc block ABOVE a
      // declaration sits outside `[getStart(), getEnd()]` and is excluded by
      // the range alone, so a test using one cannot tell whether the skip
      // works — measured: removing the skip leaves such a test green. A doc
      // block on a METHOD sits inside its class's range, which is exactly the
      // shape `eess/jsdoc-on-public-methods` requires of every public method
      // and the collision bug 0170 is about.
      const tsm = new Project({ useInMemoryFileSystem: true })
      const sf = tsm.createSourceFile(
        '/src/documented-class.ts',
        'export class Documented {\n' + //  1  code
          '  /**\n' + //                     2  JSDoc
          '   * Does a thing.\n' + //        3  JSDoc
          '   * @returns nothing\n' + //     4  JSDoc
          '   */\n' + //                     5  JSDoc
          '  act(): void {\n' + //           6  code
          '    return\n' + //                7  code
          '  }\n' + //                       8  code
          '}\n', //                          9  code
      )
      const [cls] = sf.getClasses()
      if (!cls) throw new Error('no class')

      expect(cls.getEndLineNumber() - cls.getStartLineNumber() + 1).toBe(9)
      expect(linesOfCode(cls)).toBe(5)
    })

    // [Bug 0173](../../../../work/bugs/fixed/0173-the-line-index-cache-serves-a-stale-measurement.md):
    // `linesOfCode` caches per source file, and a `SourceFile`'s object identity
    // SURVIVES an edit — `module-edges.ts` and `descendant-cache.ts` both record
    // that, measured, and the first cut of the cache asserted the opposite.
    //
    // The failure is not "returns the old number". Positions come from the AST
    // and are fresh while the line table is stale, so the two are read against
    // each other and the result corresponds to nothing at all.
    it('re-measures after a node is added to the file', () => {
      const tsm = new Project({ useInMemoryFileSystem: true })
      const sf = tsm.createSourceFile(
        '/src/grow.ts',
        'export class Grow {\n  a(): void {\n    return\n  }\n}\n',
      )
      const cls = (): ClassDeclaration => {
        const [c] = sf.getClasses()
        if (!c) throw new Error('no class')
        return c
      }
      expect(linesOfCode(cls())).toBe(5)

      cls().addMethod({ name: 'b', statements: ['const x = 1', 'const y = 2', 'return'] })

      // Ground truth from a project that never saw the earlier text.
      const fresh = new Project({ useInMemoryFileSystem: true })
      const truth = linesOfCode(
        fresh.createSourceFile('/src/truth.ts', sf.getFullText()).getClassOrThrow('Grow'),
      )
      expect(linesOfCode(cls())).toBe(truth)
    })

    it('re-measures when the same path is overwritten — the fixture pattern', () => {
      // `createSourceFile(path, text, { overwrite: true })` is how this repo's
      // own guidance says to write fixture-based tests, and it returns the SAME
      // wrapper. Every case after the first read the first case's file.
      const tsm = new Project({ useInMemoryFileSystem: true })
      const texts = [
        'export class Case {\n  a(): void {\n    return\n  }\n}\n',
        'export class Case {\n  a(): void {\n    const x = 1\n    const y = 2\n    const z = 3\n    return\n  }\n}\n',
      ]
      const measured = texts.map((text) => {
        const sf = tsm.createSourceFile('/src/case.ts', text, { overwrite: true })
        return linesOfCode(sf.getClassOrThrow('Case'))
      })
      const truth = texts.map((text) => {
        const fresh = new Project({ useInMemoryFileSystem: true })
        return linesOfCode(fresh.createSourceFile('/t.ts', text).getClassOrThrow('Case'))
      })
      expect(measured).toEqual(truth)
    })

    it('never reports more lines than the node spans, across the real corpus', () => {
      // The invariant that caught the first attempt at this fix: `getChildren()`
      // returns the JSDoc node while `getStartLineNumber()` excludes it, so
      // counting it made an element measure LARGER than itself.
      let checked = 0
      for (const cls of project.getSourceFiles().flatMap((sf) => sf.getClasses())) {
        for (const member of [...cls.getMethods(), cls, ...cls.getGetAccessors()]) {
          const span = member.getEndLineNumber() - member.getStartLineNumber() + 1
          expect(linesOfCode(member)).toBeLessThanOrEqual(span)
          checked++
        }
      }
      // Non-vacuity: the loop must actually have examined something.
      expect(checked).toBeGreaterThan(0)
    })
  })
})

describe('methodCount', () => {
  it('counts methods on a class', () => {
    const cls = findClass('LargeService')
    expect(methodCount(cls)).toBe(12)
  })

  it('counts methods on a small class', () => {
    const cls = findClass('SmallService')
    expect(methodCount(cls)).toBe(2)
  })
})
