import { describe, it, expect, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Bug 0074: the CLI must load its (ESM-syntax) config in a CJS-default
 * consumer project. Node's raw dynamic import() decides a .ts file's
 * module-ness from the consumer's package.json `type` field, so the config
 * has to load through jiti like rule files do. This drives the BUILT CLI in a
 * temp project — the exact path a fresh `npm init -y` user hits.
 */

const BIN = path.resolve(import.meta.dirname, '../../dist/cli/bin.js')
const tmpDirs: string[] = []

function cjsProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-cjs-'))
  tmpDirs.push(dir)
  // Explicit "type": "commonjs" — what modern `npm init -y` writes. This
  // disables Node's module-syntax detection, so a raw import() parses the
  // ESM-syntax .ts config as CJS and crashes (bug 0074's actual trigger).
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'demo', type: 'commonjs' }, null, 2),
  )
  // The config exactly as `eess-ts init` scaffolds it: with the import line —
  // that import is what Node's CJS parse chokes on in a type-less project.
  fs.writeFileSync(
    path.join(dir, 'eess-ts.config.ts'),
    "import { defineConfig } from '@nielspeter/eess-ts'\n\nexport default defineConfig({ rules: ['arch.rules.ts'] })\n",
  )
  // Minimal ESM-syntax rule file (empty rule set keeps the run self-contained).
  fs.writeFileSync(path.join(dir, 'arch.rules.ts'), 'export default []\n')
  // Simulate `npm install -D @nielspeter/eess-ts` with a symlink to the workspace package.
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

describe('config loading in a CJS-default project (bug 0074)', () => {
  it('check loads the ESM-syntax config without crashing', () => {
    const dir = cjsProject()
    const r = spawnSync(process.execPath, [BIN, 'check'], { cwd: dir, encoding: 'utf8' })
    const out = (r.stdout ?? '') + (r.stderr ?? '')
    expect(out).not.toContain('Cannot use import statement')
    expect(r.status).toBe(0)
  })
})
