#!/usr/bin/env node
/**
 * Dogfood: every Mermaid block in this repository's tracked Markdown parses with Mermaid's own
 * parser (plan 0427, proposal 006 Ask C). The production consumer of eess-mermaid's
 * `mermaidParser()` (plan 0413) and eess-md's `codeBlocks().should().parse()` (plan 0412).
 *
 * Scope is what git tracks, not a glob over the disk: `**` skips dot directories (`.claude/`,
 * `.changeset/`), and a walk of the disk reads gitignored notes CI never sees, so the two would
 * check different files. An allowlist of folders would be bug 0210's selector class.
 *
 * The exclusions are the trees of blocks broken on purpose. Each must still cover at least one
 * Mermaid block (ADR-018): one that covers none is a finding, never a quiet no-op.
 *
 * Run: `npm run check:mermaid-parses` (`--format json` for a machine-readable stream). Exits
 * non-zero on any finding.
 */
import { execFileSync } from 'node:child_process'
import picomatch from 'picomatch'
import { codeBlocks, corpus, parseCodeBlocks } from '@nielspeter/eess-md'
import { tagIsLanguage } from '@nielspeter/eess-md/internal'
import { mermaidParser } from '@nielspeter/eess-mermaid'

const started = performance.now()
const elapsed = () => `${Math.round(performance.now() - started)} ms`

const EXCLUSIONS = [
  'packages/crossvalidate/tests/fixtures/**',
  'packages/md/tests/fixtures/**',
  'scripts/nonvacuity/**',
]

const fmtArg = process.argv.indexOf('--format')
const format = fmtArg >= 0 ? process.argv[fmtArg + 1] : undefined

const tracked = execFileSync('git', ['ls-files', '-z', '--', '*.md'], { encoding: 'utf8' })
  .split('\0')
  .filter((f) => f !== '')
// Each tracked path becomes a root glob, so a name the glob reads as a pattern would select
// something else. Refuse it rather than check the wrong file.
const unsafe = tracked.filter((f) => /[*?[\]{}()!+@\\]/.test(f))
if (unsafe.length > 0) {
  console.error(
    `✗ check:mermaid-parses — ${String(unsafe.length)} tracked Markdown path(s) contain glob ` +
      `characters and cannot be selected exactly: ${unsafe.join(', ')}\n` +
      '  Fix: rename the file, or teach this gate to select it without a glob.',
  )
  process.exit(1)
}

// The exclusions are measured on the same population, before they are applied.
const all = corpus({ roots: tracked })
const staleExclusions = EXCLUSIONS.map((glob) => {
  const inGlob = picomatch(glob)
  const blocks = all
    .documents()
    .filter((d) => inGlob(d.relPath))
    .reduce((n, d) => n + d.codeBlocks.filter((b) => tagIsLanguage(b.lang, 'mermaid')).length, 0)
  return { glob, blocks }
}).filter((e) => e.blocks === 0)

const c = corpus({ roots: tracked, ignore: EXCLUSIONS })
const parsed = await parseCodeBlocks(c, { language: 'mermaid', parser: mermaidParser() })

let failed = false
for (const e of staleExclusions) {
  failed = true
  console.error(
    `✗ check:mermaid-parses — the exclusion '${e.glob}' covers no Mermaid block (ADR-018)\n` +
      `  Fix: remove '${e.glob}' from EXCLUSIONS in scripts/check-mermaid-parses.mjs; nothing ` +
      'under it is broken on purpose any more.',
  )
}
try {
  // `check()` owns the reporting (ADR-008) and refuses a run that examined no block (ADR-014).
  codeBlocks(parsed)
    .should()
    .parse()
    .rule({ id: 'eess/mermaid-blocks-parse' })
    .because('a Mermaid block that does not parse renders as an error box, not a diagram')
    .check(format === undefined ? {} : { format })
} catch (error) {
  failed = true
  if (format === undefined) console.error(error instanceof Error ? error.message : String(error))
}

if (failed) {
  console.error(`✗ check:mermaid-parses — ${parsed.summary()} (${elapsed()})`)
  process.exit(1)
}
console.error(
  `✓ mermaid parses — ${parsed.summary()}, across ${String(c.documents().length)} tracked ` +
    `documents · ${String(EXCLUSIONS.length)} exclusions, each covering a block (${elapsed()})`,
)
