#!/usr/bin/env node
/**
 * Report the class and method size distribution the metric rules measure.
 *
 * `arch.internal.rules.ts` records the end-state sizes of the classes its
 * thresholds forced apart. Those numbers were once written by hand from a
 * throwaway script and went stale within three commits — the headline entry
 * read 145 while the class was at 150, zero headroom against its own bar. This
 * is the instrument that produced them, kept so the claim is re-checkable
 * rather than re-typed.
 *
 * Uses the SAME `linesOfCode` the rules use, over the same workspace and the
 * same `GENERATED` exclusion, so what it prints is what the gate measures.
 *
 * Usage:
 *   node scripts/measure-class-sizes.mjs            # everything over threshold
 *   node scripts/measure-class-sizes.mjs --all      # the full distribution
 *   node scripts/measure-class-sizes.mjs ClassName  # one class, with methods
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { workspace } from '../packages/ts/dist/index.js'
import { linesOfCode } from '../packages/ts/dist/helpers/complexity.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Kept in step with `arch.internal.rules.ts` by hand — this is an instrument,
// not a gate, so a drift here misreports rather than passes something bad.
const CLASS_MAX = 150
const METHOD_MAX = 30
const GENERATED = /\/parser\/generated\//

const project = workspace(
  [
    'packages/core',
    'packages/ts',
    'packages/mermaid',
    'packages/md',
    'packages/gherkin',
    'packages/crossvalidate',
  ].map((p) => path.join(repoRoot, p, 'tsconfig.build.json')),
)

const classes = project
  .getSourceFiles()
  .filter((sf) => sf.getFilePath().includes('/src/') && !GENERATED.test(sf.getFilePath()))
  .flatMap((sf) => sf.getClasses())

const named = process.argv.slice(2).find((a) => !a.startsWith('-'))
const all = process.argv.includes('--all')

const where = (c) => c.getSourceFile().getFilePath().split('/packages/')[1] ?? ''

if (named !== undefined) {
  const found = classes.filter((c) => c.getName() === named)
  if (found.length === 0) {
    console.error(`no class named ${named}`)
    process.exit(1)
  }
  for (const c of found) {
    console.log(`${c.getName()}  ${linesOfCode(c)} code lines, ${c.getMethods().length} methods`)
    console.log(`  (${where(c)})`)
    for (const m of c.getMethods().sort((a, b) => linesOfCode(b) - linesOfCode(a))) {
      console.log(`   ${String(linesOfCode(m)).padStart(4)}  ${m.getName()}`)
    }
  }
  process.exit(0)
}

const ranked = classes
  .map((c) => ({ name: c.getName() ?? '(anonymous)', loc: linesOfCode(c), at: where(c) }))
  .sort((a, b) => b.loc - a.loc)

const shown = all ? ranked : ranked.filter((r) => r.loc > CLASS_MAX)
console.log(`CLASSES (max ${CLASS_MAX}) — ${shown.length} shown of ${ranked.length} measured`)
for (const r of shown) console.log(`   ${String(r.loc).padStart(4)}  ${r.name}  (${r.at})`)

const methods = classes
  .flatMap((c) => c.getMethods().map((m) => ({ owner: c.getName(), m })))
  .map((r) => ({ name: `${r.owner}.${r.m.getName()}`, loc: linesOfCode(r.m) }))
  .sort((a, b) => b.loc - a.loc)

const shownM = all ? methods.slice(0, 20) : methods.filter((r) => r.loc > METHOD_MAX)
console.log(`\nMETHODS (max ${METHOD_MAX}) — ${shownM.length} shown of ${methods.length} measured`)
for (const r of shownM) console.log(`   ${String(r.loc).padStart(4)}  ${r.name}`)
