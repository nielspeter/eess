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
    // A POSITIVE, because the three negatives above also hold for a `doctor`
    // that does nothing. An enforcement review gutted the command to return
    // immediately with no output and exit 0, and this case stayed green — a
    // pass constructed from silence, which is what ADR-010 forbids.
    expect(out).toContain('No rules that cannot enforce anything')
    expect(r.status).toBe(0)
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
    // The same silence problem: assert `explain` actually explained. Its default
    // format is JSON on stdout, and the rule it describes is the one the sibling
    // supplied the project for — so this also proves the sibling's value reached
    // the rule, not merely that the module loaded.
    // Parsed rather than grepped, so malformed output fails here instead of
    // passing a substring match. Read through a guard rather than
    // `expect.stringContaining`, which is typed `any` and so barred by ADR-005.
    const explained: unknown = JSON.parse(r.stdout)
    const rules =
      typeof explained === 'object' &&
      explained !== null &&
      'rules' in explained &&
      Array.isArray(explained.rules)
        ? explained.rules
        : []
    expect(rules).toHaveLength(1)
    expect(JSON.stringify(rules[0])).toContain('reside in folder matching')
    expect(JSON.stringify(rules[0])).toContain('src')
  })
})

describe('a load failure still says which file and why (bug 0223)', () => {
  /**
   * The original `explain` case in this file used a project whose sibling
   * RESOLVES, so after the fix it proved only that a working project works. A
   * product review measured the class the bug record actually describes — a
   * specifier naming nothing, which is the ordinary typo — and found `explain`
   * alone answering with ten frames of Node internals while `check` and
   * `doctor` both reported a message.
   *
   * It failed closed throughout: the exit code is 1 either way. What was missing
   * is any statement of which file failed and why.
   */
  it('explain names the file and the reason, with no Node stack', () => {
    const dir = esmProjectWithSibling()
    fs.writeFileSync(
      path.join(dir, 'arch.rules.ts'),
      "import { classes } from '@nielspeter/eess-ts'\nimport { p } from './typo.js'\n\n" +
        "export default [classes(p).that().resideInFolder('src').should().beExported()]\n",
    )
    const r = spawnSync(process.execPath, [BIN, 'explain', 'arch.rules.ts'], {
      cwd: dir,
      encoding: 'utf8',
    })
    const out = `${r.stdout}${r.stderr}`
    expect(out).toContain('could not be loaded')
    expect(out).toContain('typo.js')
    expect(out).not.toMatch(/^\s+at .+:\d+:\d+/m)
    expect(r.status).toBe(1)
  })

  it('check and doctor still do the same, so explain is not special-cased', () => {
    // The three commands answer one class of failure; asserting only the one
    // that was broken would let the other two regress silently.
    const dir = esmProjectWithSibling()
    fs.writeFileSync(
      path.join(dir, 'arch.rules.ts'),
      "import { classes } from '@nielspeter/eess-ts'\nimport { p } from './typo.js'\n\n" +
        "export default [classes(p).that().resideInFolder('src').should().beExported()]\n",
    )
    for (const command of ['check', 'doctor']) {
      const r = spawnSync(process.execPath, [BIN, command, 'arch.rules.ts'], {
        cwd: dir,
        encoding: 'utf8',
      })
      const out = `${r.stdout}${r.stderr}`
      expect(out, command).toContain('typo.js')
      expect(out, command).not.toMatch(/^\s+at .+:\d+:\d+/m)
    }
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
   * once rather than twice. It passed under BOTH implementations, so it proved
   * nothing. The reason is NOT established: this docblock first blamed
   * `dedupeConfigFindings`, which a method review disproved — it keys on
   * `(file, id, element)` rather than on content, and runs over one in-process
   * array, so it cannot collapse two writes from two registries whatever it
   * keys on. The hazard itself did not reproduce when the jiti branch was
   * forced. Recorded in bug 0223 rather than replaced with a second guess.
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
    // …and says the true thing about it. An architecture review caught the first
    // repair asserting "which doctor cannot load", which the bug record's own
    // control table measures as FALSE: a rule file that imports vitest without
    // calling it diagnoses fine. Gating a confident wrong cause is the same
    // misdirection 0223 was filed for, narrowed rather than removed.
    expect(out).toContain('Importing one is fine')
  })

  it('sees a dynamic import, which the first enumerator did not', () => {
    // `getImportDeclarations()` is the shape core/module-edges.ts records as
    // defective (ts-archunit bug 0022) — static imports only. The replacement
    // reads `getImportStringLiterals()`, the one definition that file owns.
    const dir = esmProjectWithSibling()
    fs.writeFileSync(
      path.join(dir, 'arch.rules.ts'),
      "const v = await import('vitest')\nvoid v\nthrow new Error('boom')\n",
    )
    const r = spawnSync(process.execPath, [BIN, 'doctor', 'arch.rules.ts'], {
      cwd: dir,
      encoding: 'utf8',
    })
    expect(`${r.stdout}${r.stderr}`).toContain('imports a test runner')
  })
})

describe('watch mode re-reads an edited sibling (bug 0223, architecture review)', () => {
  /**
   * The Critical this fix shipped with before review. `importFresh` busts Node's
   * module cache by appending `?t=<now>` to the ENTRY url only; a statically
   * imported sibling keys on its own url, which carries no query, so it was
   * evaluated once and reused for the session. The shape this release exists to
   * enable — shared globs, a shared `project()` — is exactly the shape that went
   * stale, and it went stale GREEN: the re-run reported a pass computed from the
   * code you had just replaced.
   *
   * Driven through the loader rather than the watch loop, because the defect is
   * in resolution, not in the file watcher.
   */
  it('a second fresh load sees the edited sibling, not the first one', () => {
    const dir = esmProjectWithSibling()
    const entry = path.join(dir, 'entry.ts')
    fs.writeFileSync(path.join(dir, 'shared.ts'), 'export const globs = "v1"\n')
    fs.writeFileSync(entry, "export { globs } from './shared.js'\n")

    const probe = `
      import { importRuleModule } from ${JSON.stringify(path.resolve(import.meta.dirname, '../../dist/cli/import-rule-module.js'))}
      import { writeFileSync } from 'node:fs'
      const first = await importRuleModule(${JSON.stringify(entry)}, true)
      writeFileSync(${JSON.stringify(path.join(dir, 'shared.ts'))}, 'export const globs = "v2"\\n')
      const second = await importRuleModule(${JSON.stringify(entry)}, true)
      console.log(JSON.stringify({ first: first.globs, second: second.globs }))
    `
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', probe], {
      cwd: dir,
      encoding: 'utf8',
    })
    expect(r.stderr).not.toContain('ERR_MODULE_NOT_FOUND')
    const seen: unknown = JSON.parse(r.stdout.trim())
    expect(seen).toEqual({ first: 'v1', second: 'v2' })
  })
})
