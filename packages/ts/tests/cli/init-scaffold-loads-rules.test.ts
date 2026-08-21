/**
 * **`eess-ts init` must scaffold a rule file that actually loads rules.**
 *
 * This is the check that was missing, and its absence cost a Critical.
 *
 * A rule file spreads its presets into `export default [...]`, so it needs the
 * BUILDERS. When the preset default was corrected to enforce (PR #72 review),
 * `init`'s template was not updated with it — so the spread splatted violations
 * into the array, the CLI loaded **zero rules**, and the documented three-command
 * onboarding produced:
 *
 * ```
 * ✗ eess-ts — 0 rules across 1 file · 2 violations      exit 0
 * ```
 *
 * Zero rules is the alarm value the summary line exists to surface, emitted by
 * the tool's own scaffold. Nothing caught it:
 *
 * - `tsc --noEmit` passes — spreading the wrong array type is not a type error;
 * - `init.test.ts` asserts the template's SHAPE (imports, option keys, that it
 *   parses), never that it loads;
 * - and the bulk edit that added `report: 'builders'` to preset call sites
 *   touched `init.test.ts` too, adapting those assertions to the new default
 *   instead of catching that the template needed the same edit. The tests were
 *   made to agree with the change.
 *
 * So this file asserts the one property none of that covers: **run the generated
 * template and count the rules.** Found by an adopter review that packed the
 * tarball and walked the quickstart — the only method that would have.
 */
import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { runInit } from '../../src/cli/commands/init.js'
import { loadRuleFiles } from '../../src/cli/load-rules.js'

const tmpDirs: string[] = []
afterEach(() => {
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

// Scaffolded INSIDE the workspace, not in os.tmpdir(): the generated rule file
// imports `@nielspeter/eess-ts/presets` by package name, and Node resolves that
// by walking up for `node_modules`. From /var/folders it cannot, and the test
// fails on resolution instead of on the property under test.
const GENERATED = path.resolve(import.meta.dirname, '../__generated__')

function scaffold(preset?: string): string {
  fs.mkdirSync(GENERATED, { recursive: true })
  const dir = fs.mkdtempSync(path.join(GENERATED, `init-${String(process.pid)}-`))
  tmpDirs.push(dir)
  fs.writeFileSync(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { strict: true }, include: ['src'] }),
  )
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'src', 'a.ts'), 'export class Thing {\n  run(): void {}\n}\n')
  const cwd = process.cwd()
  process.chdir(dir)
  try {
    const code = runInit(preset === undefined ? {} : { preset })
    expect(code).toBe(0)
  } finally {
    process.chdir(cwd)
  }
  return dir
}

describe('the scaffolded rule file loads rules', () => {
  it('the default scaffold yields a NON-ZERO rule count', async () => {
    const dir = scaffold()
    const rules = await loadRuleFiles([path.join(dir, 'arch.rules.ts')], { fresh: true })
    // The defect produced exactly 0 here while every shape assertion stayed green.
    expect(rules.length).toBeGreaterThan(0)
  })

  it('every scaffolded rule is a builder, not a violation that got spread in', async () => {
    const dir = scaffold()
    const rules = await loadRuleFiles([path.join(dir, 'arch.rules.ts')], { fresh: true })
    // The precise shape of the bug: `...recommended(p)` splatting ArchViolation
    // objects into the array. Those have no `violations` method.
    for (const rule of rules) {
      expect(typeof rule.violations).toBe('function')
    }
  })

  it.each(['layered', 'strict-boundaries', 'data-layer'])(
    'the %s shape scaffold also yields rules',
    async (preset) => {
      const dir = scaffold(preset)
      const rules = await loadRuleFiles([path.join(dir, 'arch.rules.ts')], { fresh: true })
      expect(rules.length).toBeGreaterThan(0)
    },
  )

  it('VACUITY: the loader really would report zero for a rule-less file', async () => {
    // Guards every row above: if `loadRuleFiles` returned a non-empty list for
    // anything, `toBeGreaterThan(0)` would be satisfied by nothing.
    fs.mkdirSync(GENERATED, { recursive: true })
    const dir = fs.mkdtempSync(path.join(GENERATED, `init-${String(process.pid)}-empty-`))
    tmpDirs.push(dir)
    const file = path.join(dir, 'empty.rules.ts')
    fs.writeFileSync(file, 'export default []\n')
    const rules = await loadRuleFiles([file], { fresh: true })
    expect(rules).toHaveLength(0)
  })
})
