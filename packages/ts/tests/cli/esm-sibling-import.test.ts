import { describe, it, expect, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Bug 0223: a rule file that imports a sibling module must load under
 * `"type": "module"`.
 *
 * TypeScript MANDATES the `.js` specifier for a relative import under
 * `nodenext`/ESM, and Node does not perform the `.js` → `.ts` substitution that
 * implies. So Node's native loader reports `ERR_MODULE_NOT_FOUND` — not a
 * `SyntaxError` — and the loader's jiti fallback, which only recognises a module
 * FORMAT refusal, never sees it. The whole shape is excluded: a TypeScript ESM
 * project could use the CLI only while every rule fitted in one file.
 *
 * Reported inbound by an agent in a consuming project. These drive the BUILT CLI
 * in a temp project, which is the path that consumer actually walked.
 */

const BIN = path.resolve(import.meta.dirname, '../../dist/cli/bin.js')
const tmpDirs: string[] = []

/** A `"type": "module"` project whose rule file imports a sibling as `./sibling.js`. */
function esmProjectWithSibling(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-esm-sibling-'))
  tmpDirs.push(dir)
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'demo', type: 'module' }, null, 2),
  )
  fs.writeFileSync(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: { module: 'nodenext', moduleResolution: 'nodenext', strict: true },
      include: ['src'],
    }),
  )
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'src', 'a.ts'),
    'export class Thing {\n  run(): void {\n    return\n  }\n}\n',
  )
  // The shared `project()` instance a second rule file would reach for — the
  // reason anyone splits a rule file in the first place.
  fs.writeFileSync(
    path.join(dir, 'sibling.ts'),
    "import { project } from '@nielspeter/eess-ts'\n\nexport const p = project('tsconfig.json')\n",
  )
  // `./sibling.js` is what TypeScript requires here. The file on disk is .ts.
  fs.writeFileSync(
    path.join(dir, 'arch.rules.ts'),
    "import { classes } from '@nielspeter/eess-ts'\nimport { p } from './sibling.js'\n\n" +
      "export default [classes(p).that().resideInFolder('src').should().beExported()]\n",
  )
  const scope = path.join(dir, 'node_modules', '@nielspeter')
  fs.mkdirSync(scope, { recursive: true })
  fs.symlinkSync(path.resolve(import.meta.dirname, '../..'), path.join(scope, 'eess-ts'))
  return dir
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop()
    if (dir !== undefined) fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('a rule file importing a sibling under "type": "module" (bug 0223)', () => {
  it('check evaluates the rule rather than refusing the file', () => {
    const dir = esmProjectWithSibling()
    const r = spawnSync(process.execPath, [BIN, 'check', 'arch.rules.ts'], {
      cwd: dir,
      encoding: 'utf8',
    })
    const out = `${r.stdout}${r.stderr}`
    expect(out).not.toContain('could not be evaluated')
    expect(out).not.toContain('ERR_MODULE_NOT_FOUND')
    // The rule is satisfiable, so the run is green — the point is that it RAN.
    expect(out).toMatch(/1 rule across/)
    expect(r.status).toBe(0)
  })

  it('doctor diagnoses the file rather than reporting it unloadable', () => {
    const dir = esmProjectWithSibling()
    const r = spawnSync(process.execPath, [BIN, 'doctor', 'arch.rules.ts'], {
      cwd: dir,
      encoding: 'utf8',
    })
    const out = `${r.stdout}${r.stderr}`
    expect(out).not.toContain('could not be loaded')
    expect(out).not.toContain('Cannot find module')
  })

  it('explain reports a message rather than an unhandled stack', () => {
    const dir = esmProjectWithSibling()
    const r = spawnSync(process.execPath, [BIN, 'explain', 'arch.rules.ts'], {
      cwd: dir,
      encoding: 'utf8',
    })
    const out = `${r.stdout}${r.stderr}`
    expect(out).not.toContain('ERR_MODULE_NOT_FOUND')
    expect(out).not.toMatch(/^\s+at .+:\d+:\d+/m)
  })
})

describe('the single-registry invariant the fix must not reopen (plan 0165, bug 0029)', () => {
  /**
   * The rejected fix for 0223 was to widen the jiti fallback to cover
   * `ERR_MODULE_NOT_FOUND`. It works, and it puts the rule file in a SECOND
   * module registry — which is what plan 0165 paid to avoid. So the property
   * under test is not "the output looks right", it is **which loader resolved
   * the specifier**, and that needs a discriminator.
   *
   * A TypeScript `enum` is one. Node's type stripping is erasable-syntax only
   * and refuses it; jiti transpiles it happily. Putting the enum in the SIBLING
   * means the file is only reached after the `.js` → `.ts` substitution, so this
   * probes the repaired path itself rather than the entry file.
   *
   * Measured both ways before being written: with the shipped fix the enum is
   * refused, and with the jiti fallback widened the same project reports
   * `1 rule across` — the rule file loaded, through the wrong loader.
   *
   * An earlier version of this test asserted a configuration finding appeared
   * once rather than twice. It passed under BOTH implementations, because
   * `dedupeConfigFindings` in the kernel now collapses duplicates by content
   * hash — so it proved nothing. That is recorded in bug 0223 rather than
   * quietly dropped.
   */
  it('resolves the sibling with Node, not by falling back to a transpiler', () => {
    const dir = esmProjectWithSibling()
    fs.writeFileSync(
      path.join(dir, 'sibling.ts'),
      "import { project } from '@nielspeter/eess-ts'\n" +
        "enum Lane {\n  Src = 'src',\n}\n" +
        "export const p = project('tsconfig.json')\n" +
        'export const lane: string = Lane.Src\n',
    )
    fs.writeFileSync(
      path.join(dir, 'arch.rules.ts'),
      "import { classes } from '@nielspeter/eess-ts'\nimport { p, lane } from './sibling.js'\n\n" +
        'export default [classes(p).that().resideInFolder(lane).should().beExported()]\n',
    )
    const r = spawnSync(process.execPath, [BIN, 'check', 'arch.rules.ts'], {
      cwd: dir,
      encoding: 'utf8',
    })
    const out = `${r.stdout}${r.stderr}`
    // Node reached the sibling and refused its enum. A transpiling fallback
    // would have accepted it and reported `1 rule across` instead.
    expect(out).toContain('enum is not supported in strip-only mode')
    expect(out).not.toMatch(/1 rule across/)
  })
})

describe('a specifier that names nothing at all', () => {
  it('still fails, and is not retried into a different error', () => {
    // The fix must not turn a real typo into a second, differently-worded
    // failure. `./typo.js` has no `.ts` beside it, so the predicate says no and
    // nothing is registered or retried.
    const dir = esmProjectWithSibling()
    fs.writeFileSync(
      path.join(dir, 'arch.rules.ts'),
      "import { classes } from '@nielspeter/eess-ts'\nimport { p } from './typo.js'\n\n" +
        "export default [classes(p).that().resideInFolder('src').should().beExported()]\n",
    )
    const r = spawnSync(process.execPath, [BIN, 'check', 'arch.rules.ts'], {
      cwd: dir,
      encoding: 'utf8',
    })
    const out = `${r.stdout}${r.stderr}`
    expect(out).toContain('typo.js')
    expect(r.status).not.toBe(0)
  })

  it('a real .js beside a .ts of the same name still wins', () => {
    // The hook rewrites only when the emitted path is ABSENT. A project that
    // ships both must keep getting the .js it asked for.
    const dir = esmProjectWithSibling()
    fs.writeFileSync(path.join(dir, 'shadow.ts'), 'export const which = "ts"\n')
    fs.writeFileSync(path.join(dir, 'shadow.js'), 'export const which = "js"\n')
    fs.writeFileSync(
      path.join(dir, 'arch.rules.ts'),
      "import { classes } from '@nielspeter/eess-ts'\nimport { p } from './sibling.js'\n" +
        "import { which } from './shadow.js'\n\n" +
        "if (which !== 'js') throw new Error(`resolved to the ${which} file`)\n" +
        "export default [classes(p).that().resideInFolder('src').should().beExported()]\n",
    )
    const r = spawnSync(process.execPath, [BIN, 'check', 'arch.rules.ts'], {
      cwd: dir,
      encoding: 'utf8',
    })
    const out = `${r.stdout}${r.stderr}`
    expect(out).not.toContain('resolved to the ts file')
    expect(r.status).toBe(0)
  })
})

describe("doctor's load-failure remedy (bug 0223)", () => {
  /**
   * The message that misdirected the reporter. It offered "if this file imports
   * a test runner" for a file importing none, the reporter read it as the
   * diagnosis, and concluded in writing that doctor refuses any file importing
   * vitest. It does not. A remedy the reader cannot act on is worse than none,
   * so the sentence is now gated on the file actually importing one.
   */
  it('does not name a test runner for a file that imports none', () => {
    const dir = esmProjectWithSibling()
    fs.writeFileSync(path.join(dir, 'arch.rules.ts'), 'throw new Error("boom")\n')
    const r = spawnSync(process.execPath, [BIN, 'doctor', 'arch.rules.ts'], {
      cwd: dir,
      encoding: 'utf8',
    })
    const out = `${r.stdout}${r.stderr}`
    expect(out).toContain('could not be loaded')
    expect(out).not.toMatch(/test runner|vitest|jest/i)
  })

  it('still names one for a file that does import it', () => {
    // The other half, so the gate above cannot pass by saying nothing ever.
    const dir = esmProjectWithSibling()
    fs.writeFileSync(
      path.join(dir, 'arch.rules.ts'),
      "import { describe } from 'vitest'\nvoid describe\nthrow new Error('boom')\n",
    )
    const r = spawnSync(process.execPath, [BIN, 'doctor', 'arch.rules.ts'], {
      cwd: dir,
      encoding: 'utf8',
    })
    const out = `${r.stdout}${r.stderr}`
    expect(out).toContain('could not be loaded')
    expect(out).toContain('imports a test runner')
  })
})
