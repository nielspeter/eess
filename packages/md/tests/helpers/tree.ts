import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll } from 'vitest'

const made: string[] = []

// Each test file that uses `tree()` removes what it made.
afterAll(() => {
  for (const root of made.splice(0)) rmSync(root, { recursive: true, force: true })
})

function isList(
  files: readonly string[] | Readonly<Record<string, string>>,
): files is readonly string[] {
  return Array.isArray(files)
}

/**
 * A throwaway repository holding exactly `files` (repository-relative paths),
 * each a one-heading Markdown page unless given content. Returns its root.
 */
export function tree(files: readonly string[] | Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), 'eess-md-tree-'))
  made.push(root)
  const entries: [string, string][] = isList(files)
    ? files.map((f): [string, string] => [f, `# ${f}\n`])
    : Object.entries(files)
  for (const [rel, content] of entries) {
    const abs = join(root, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }
  return root
}
