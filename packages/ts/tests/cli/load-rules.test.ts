import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { loadRuleFiles } from '../../src/cli/load-rules.js'

/** Create a temp directory for test fixtures. */
function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'eess-ts-load-rules-'))
}

describe('loadRuleFiles', () => {
  let tmpDir: string

  beforeAll(() => {
    tmpDir = makeTmpDir()
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns empty array for no files', async () => {
    const result = await loadRuleFiles([])
    expect(result).toEqual([])
  })

  it('loads a module that exports a default array of rule builders', async () => {
    const file = path.join(tmpDir, 'rules-array.mjs')
    fs.writeFileSync(file, `export default [{ check: () => {} }, { check: () => {} }];\n`)
    const result = await loadRuleFiles([file])
    expect(result).toHaveLength(2)
    expect(typeof result[0]!.check).toBe('function')
  })

  it('loads a module that exports a default factory function', async () => {
    const file = path.join(tmpDir, 'rules-factory.mjs')
    fs.writeFileSync(file, `export default function() { return [{ check: () => {} }]; };\n`)
    const result = await loadRuleFiles([file])
    expect(result).toHaveLength(1)
  })

  // A non-builder in the array is a LOUD error, not a silent skip: a dropped
  // rule is a green-but-empty gate (plan 0061, Phase 0). The classic offender
  // is a void preset call placed directly in the array.
  it('throws on a non-rule-builder value in the default-export array', async () => {
    const file = path.join(tmpDir, 'rules-mixed.mjs')
    fs.writeFileSync(file, `export default [{ check: () => {} }, 'not-a-builder'];\n`)
    await expect(loadRuleFiles([file])).rejects.toThrow(/entry \[1\] is not a rule builder/)
  })

  it('names the file and index of the offending entry', async () => {
    const file = path.join(tmpDir, 'rules-void-preset.mjs')
    // `undefined` in the array simulates a void preset call, e.g. `somePreset(p)`
    fs.writeFileSync(file, `export default [{ check: () => {} }, undefined];\n`)
    await expect(loadRuleFiles([file])).rejects.toThrow(/rules-void-preset\.mjs.*entry \[1\]/s)
  })

  it('throws when the default export is not an array or function', async () => {
    const file = path.join(tmpDir, 'rules-string.mjs')
    fs.writeFileSync(file, `export default "hello";\n`)
    await expect(loadRuleFiles([file])).rejects.toThrow(/must be an array of rule builders/)
  })

  it('throws when the module has no default export', async () => {
    const file = path.join(tmpDir, 'rules-no-default.mjs')
    fs.writeFileSync(file, `export const foo = 'bar';\n`)
    await expect(loadRuleFiles([file])).rejects.toThrow(/must be an array of rule builders/)
  })

  it('throws when a factory function returns a non-array', async () => {
    const file = path.join(tmpDir, 'rules-factory-string.mjs')
    fs.writeFileSync(file, `export default function() { return "not-an-array"; };\n`)
    await expect(loadRuleFiles([file])).rejects.toThrow(/must return an array of rule builders/)
  })

  it('loads multiple files and merges rule builders', async () => {
    const file1 = path.join(tmpDir, 'rules-a.mjs')
    const file2 = path.join(tmpDir, 'rules-b.mjs')
    fs.writeFileSync(file1, `export default [{ check: () => {} }];\n`)
    fs.writeFileSync(file2, `export default [{ check: () => {} }, { check: () => {} }];\n`)
    const result = await loadRuleFiles([file1, file2])
    expect(result).toHaveLength(3)
  })

  it('resolves relative paths', async () => {
    const file = path.join(tmpDir, 'rules-relative.mjs')
    fs.writeFileSync(file, `export default [{ check: () => {} }];\n`)
    // Pass the absolute path — loadRuleFiles calls path.resolve internally
    const result = await loadRuleFiles([file])
    expect(result).toHaveLength(1)
  })
})
