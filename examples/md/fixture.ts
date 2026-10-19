/**
 * The fixture helper for document-shape examples (plan 0458).
 *
 * Each example keeps its documents under `fixtures/<name>/clean/` and one
 * `fixtures/<name>/violating-<judgement>/` per judgement it states. This resolves those folders. It
 * hands an example a path, and the documents' text only as a map for `corpusFromText` (plan 0455),
 * which is that block's input. (An example could still read text through eess-md's model readers;
 * review holds that.)
 *
 * It honours one test-only variable, `EESS_EXAMPLE_SWAP=<from>=<to>`, which this repository's
 * `check:nonvacuity` sets to prove each fixture is load-bearing: a request for `<from>` returns
 * `<to>`. Nothing is written, moved or deleted, so a killed run leaves nothing behind.
 *
 * Outside this repository, pass the fixture's path yourself; a copied example needs no helper.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export type FixtureKind = 'clean' | `violating-${string}`

const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

function swapped(kind: FixtureKind): FixtureKind {
  const swap = process.env['EESS_EXAMPLE_SWAP']
  if (swap === undefined || swap === '') return kind
  const [from, to] = swap.split('=')
  if (from === kind && to !== undefined && (to === 'clean' || to.startsWith('violating-'))) {
    return to === 'clean' ? 'clean' : `violating-${to.slice('violating-'.length)}`
  }
  return kind
}

/** The folder an example reads for `kind`, after any swap. */
export function fixture(name: string, kind: FixtureKind): string {
  return join(root, name, swapped(kind))
}

/**
 * Every file in the folder for `kind`, after any swap, as repo-relative POSIX path → text: the input
 * `corpusFromText` takes (plan 0455).
 */
export function fixtureFiles(name: string, kind: FixtureKind): Record<string, string> {
  const dir = fixture(name, kind)
  const files: Record<string, string> = {}
  for (const e of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!e.isFile()) continue
    const abs = join(e.parentPath, e.name)
    files[relative(dir, abs).split(sep).join('/')] = readFileSync(abs, 'utf8')
  }
  return files
}
