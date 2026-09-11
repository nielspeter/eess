import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

/**
 * Bug 0223's `eess-mermaid` half.
 *
 * A testing review ran a sabotage matrix over the fix and found that deleting
 * this package's entire share of the change — the retry branch in
 * `import-config.ts` — left the whole suite green, while the changeset bumped
 * `@nielspeter/eess-mermaid` on the strength of it. The path worked; nothing
 * watched it.
 *
 * The config is the file that splits here: `eess-mermaid.config.ts` reaching for
 * a shared glob list or a shared root, written as `./shared.js` because that is
 * what TypeScript requires under nodenext.
 *
 * **Driven through a real Node subprocess, and that is not incidental.** The
 * first version of this file called `importConfigModule` in-process and passed
 * with the fix DELETED — vitest resolves modules through Vite, which performs
 * the `.js` → `.ts` substitution itself, so the defect was invisible from
 * inside the runner. A test of a Node resolution behaviour has to run under
 * Node's resolver.
 */

const tmpDirs: string[] = []

function esmProjectWithSharedConfig(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-mmd-sibling-'))
  tmpDirs.push(dir)
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'demo', type: 'module' }, null, 2),
  )
  fs.writeFileSync(path.join(dir, 'shared.ts'), "export const rules = ['mermaid.rules.ts']\n")
  fs.writeFileSync(
    path.join(dir, 'eess-mermaid.config.ts'),
    "import { rules } from './shared.js'\n\nexport default { rules }\n",
  )
  return dir
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop()
    if (dir !== undefined) fs.rmSync(dir, { recursive: true, force: true })
  }
})

/** Load the project's config through the built loader, under Node's own resolver. */
function loadConfigUnderNode(dir: string): { stdout: string; stderr: string; status: number } {
  const loader = path.resolve(import.meta.dirname, '../../dist/cli/import-config.js')
  const probe = `
    import { importConfigModule } from ${JSON.stringify(loader)}
    import { pathToFileURL } from 'node:url'
    const mod = await importConfigModule(
      pathToFileURL(${JSON.stringify(path.join(dir, 'eess-mermaid.config.ts'))}).href,
    )
    console.log(JSON.stringify(mod.default))
  `
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', probe], {
    cwd: dir,
    encoding: 'utf8',
  })
  return { stdout: r.stdout, stderr: r.stderr, status: r.status ?? -1 }
}

describe('a config importing a sibling under "type": "module" (bug 0223)', () => {
  it('loads, and the sibling value reaches the config', () => {
    const dir = esmProjectWithSharedConfig()
    const r = loadConfigUnderNode(dir)
    expect(r.stderr).not.toContain('ERR_MODULE_NOT_FOUND')
    expect(JSON.parse(r.stdout.trim())).toEqual({ rules: ['mermaid.rules.ts'] })
  })

  it('a specifier naming nothing still fails', () => {
    // The narrowness, not just the capability: a typo must stay a typo rather
    // than being retried into a different error.
    const dir = esmProjectWithSharedConfig()
    fs.writeFileSync(
      path.join(dir, 'eess-mermaid.config.ts'),
      "import { rules } from './typo.js'\n\nexport default { rules }\n",
    )
    const r = loadConfigUnderNode(dir)
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('typo.js')
  })
})
