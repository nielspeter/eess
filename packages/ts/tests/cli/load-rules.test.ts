import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { loadRuleFiles } from '../../src/cli/load-rules.js'

/** Create a temp directory for test fixtures. */
function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ts-archunit-load-rules-'))
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
    fs.writeFileSync(file, `export default [{ violations: () => [] }, { violations: () => [] }];\n`)
    const result = await loadRuleFiles([file])
    expect(result).toHaveLength(2)
    expect(typeof result[0]!.violations).toBe('function')
  })

  it('loads a module that exports a default factory function', async () => {
    const file = path.join(tmpDir, 'rules-factory.mjs')
    fs.writeFileSync(file, `export default function() { return [{ violations: () => [] }]; };\n`)
    const result = await loadRuleFiles([file])
    expect(result).toHaveLength(1)
  })

  // **eess diverges from ts-archunit here, deliberately.** Upstream skips a
  // non-builder and returns `[]` for a malformed default export; eess throws.
  // A silently-dropped rule is a green-but-empty gate (plan 0061 Phase 0), and a
  // rule file that contributes nothing while the CLI reports clean is the exact
  // lie ADR-009 and ADR-010 exist to make impossible. Plan 0165's engine copy
  // reverted source AND these tests in one motion, so the fail-open landed green
  // — which is why the divergence is stated here rather than assumed.
  it('throws on a non-rule-builder value in the default-export array', async () => {
    const file = path.join(tmpDir, 'rules-mixed.mjs')
    fs.writeFileSync(file, `export default [{ violations: () => [] }, 'not-a-builder'];\n`)
    await expect(loadRuleFiles([file])).rejects.toThrow(/entry \[1\] is not a rule builder/)
  })

  it('names the file and index of the offending entry', async () => {
    const file = path.join(tmpDir, 'rules-void-preset.mjs')
    // `undefined` in the array simulates a void preset call, e.g. `somePreset(p)`
    fs.writeFileSync(file, `export default [{ violations: () => [] }, undefined];\n`)
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
    fs.writeFileSync(file1, `export default [{ violations: () => [] }];\n`)
    fs.writeFileSync(
      file2,
      `export default [{ violations: () => [] }, { violations: () => [] }];\n`,
    )
    const result = await loadRuleFiles([file1, file2])
    expect(result).toHaveLength(3)
  })

  it('resolves relative paths', async () => {
    const file = path.join(tmpDir, 'rules-relative.mjs')
    fs.writeFileSync(file, `export default [{ violations: () => [] }];\n`)
    // Pass the absolute path — loadRuleFiles calls path.resolve internally
    const result = await loadRuleFiles([file])
    expect(result).toHaveLength(1)
  })
})
