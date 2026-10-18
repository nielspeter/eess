import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

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
