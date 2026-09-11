import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { isTypeScriptSpecifierMiss } from '../src/cli-config.js'

/**
 * Bug 0223's predicate, tested directly.
 *
 * A testing review ran a fifteen-row sabotage matrix over the fix and found
 * these three reverts staying green, because the only coverage was end-to-end
 * through the CLI and the CLI's OUTCOME is identical either way:
 *
 *  - the predicate dropping its source-on-disk conjunct — the clause both the
 *    doc comment and the bug record name as the load-bearing narrowness,
 *    "a genuinely missing module is still genuinely missing";
 *  - dropping `.tsx` from what a `.js` specifier may stand for;
 *  - dropping the `.jsx` / `.mjs` / `.cjs` rows entirely.
 *
 * A missing specifier fails whether or not a retry was attempted, so no
 * end-to-end assertion can see the difference. The predicate can.
 */

const tmpDirs: string[] = []

function dirWith(...files: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-spec-'))
  tmpDirs.push(dir)
  for (const f of files) fs.writeFileSync(path.join(dir, f), 'export const x = 1\n')
  return dir
}

/** The error Node raises, in the shape the predicate reads it. */
function moduleNotFound(url: string): Record<string, unknown> {
  return { code: 'ERR_MODULE_NOT_FOUND', url, message: `Cannot find module ${url}` }
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop()
    if (dir !== undefined) fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('isTypeScriptSpecifierMiss', () => {
  it('says no when the TypeScript source is not on disk', () => {
    // The conjunct that keeps a genuine typo a genuine typo. Without it the
    // loader registers a process-global hook and retries on behalf of a file
    // that does not exist.
    const dir = dirWith()
    const miss = moduleNotFound(pathToFileURL(path.join(dir, 'nothing.js')).href)
    expect(isTypeScriptSpecifierMiss(miss)).toBe(false)
  })

  it('says yes when it is', () => {
    const dir = dirWith('sibling.ts')
    const miss = moduleNotFound(pathToFileURL(path.join(dir, 'sibling.js')).href)
    expect(isTypeScriptSpecifierMiss(miss)).toBe(true)
  })

  it('accepts .tsx for a .js specifier', () => {
    // Dropping `.tsx` from the `.js` row reverts green end-to-end. A React
    // codebase whose shared rule helpers live in a .tsx is the population.
    const dir = dirWith('component-rules.tsx')
    const miss = moduleNotFound(pathToFileURL(path.join(dir, 'component-rules.js')).href)
    expect(isTypeScriptSpecifierMiss(miss)).toBe(true)
  })

  it('maps each emitted extension to the source TypeScript actually emits it from', () => {
    // `.mjs` comes from `.mts` and `.cjs` from `.cts`; that is TypeScript's own
    // table, not a guess. Asserted as a set so deleting a row fails here.
    const cases: [source: string, emitted: string][] = [
      ['a.ts', 'a.js'],
      ['b.tsx', 'b.jsx'],
      ['c.mts', 'c.mjs'],
      ['d.cts', 'd.cjs'],
    ]
    const dir = dirWith(...cases.map(([source]) => source))
    const resolved = cases.filter(([, emitted]) =>
      isTypeScriptSpecifierMiss(moduleNotFound(pathToFileURL(path.join(dir, emitted)).href)),
    )
    expect(resolved).toEqual(cases)
  })

  it('does not cross the streams — .mjs never resolves to a plain .ts', () => {
    // The inverse of the row above, so the mapping cannot pass by accepting
    // every source for every emitted extension.
    const dir = dirWith('only.ts')
    const miss = moduleNotFound(pathToFileURL(path.join(dir, 'only.mjs')).href)
    expect(isTypeScriptSpecifierMiss(miss)).toBe(false)
  })

  it('says no to anything that is not a module-resolution failure', () => {
    const dir = dirWith('sibling.ts')
    const url = pathToFileURL(path.join(dir, 'sibling.js')).href
    expect(isTypeScriptSpecifierMiss({ code: 'ERR_UNKNOWN', url })).toBe(false)
    expect(isTypeScriptSpecifierMiss(new SyntaxError('Unexpected token'))).toBe(false)
    expect(isTypeScriptSpecifierMiss(undefined)).toBe(false)
    expect(isTypeScriptSpecifierMiss({ code: 'ERR_MODULE_NOT_FOUND' })).toBe(false)
  })
})
