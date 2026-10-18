/**
 * The fixture helper for document-shape examples (plan 0458).
 *
 * Each example keeps its documents under `fixtures/<name>/clean/` and one
 * `fixtures/<name>/violating-<judgement>/` per judgement it states. This resolves those folders.
 *
 * It honours one test-only variable, `EESS_EXAMPLE_SWAP=<from>=<to>`, which this repository's
 * `check:nonvacuity` sets to prove each fixture is load-bearing: a request for `<from>` returns
 * `<to>`. Nothing is written, moved or deleted, so a killed run leaves nothing behind.
 *
 * Outside this repository, pass the fixture's path yourself; a copied example needs no helper.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
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

/** The folder's files as `{ relPath: text }`, for an example on a text corpus. */
export function fixtureFiles(name: string, kind: FixtureKind): Record<string, string> {
  const dir = fixture(name, kind)
  const out: Record<string, string> = {}
  const walk = (d: string): void => {
    for (const entry of readdirSync(d)) {
      const path = join(d, entry)
      if (statSync(path).isDirectory()) walk(path)
      else out[relative(dir, path).split('\\').join('/')] = readFileSync(path, 'utf8')
    }
  }
  walk(dir)
  return out
}
