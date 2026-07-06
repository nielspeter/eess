#!/usr/bin/env node
/**
 * Dogfood: validate this repo's own engineering-corpus markdown with eess-md.
 *
 * The corpus (work/plans, adr/, docs/) must stay honest:
 *  - internal cross-links resolve (safety net for doc moves);
 *  - every ADR declares valid EESS enforcement (tier table, citations resolve)
 *    via the adrEnforcement preset — the executable-ADR model applied to us
 *    (plan 0060 Phase 3; the AST-grounded citation check is check:crossval).
 *
 * `**‍/completed/**`, `**‍/fixed/**`, `**‍/wont-do/**` are frozen (historical).
 * Exits non-zero on a live violation. Run: `npm run check:corpus`.
 */
import { corpus, links, pointers } from '@nielspeter/eess-md'
import { adrEnforcement } from '@nielspeter/eess-md/rules/adr'

const c = corpus({
  roots: ['work/plans/**', 'adr/**', 'docs/**'],
  frozen: ['**/completed/**', '**/wont-do/**', '**/archived/**'],
})

let failed = false

// Static-site resolution for the docs/ guide: extensionless links
// (./page → page.md, ./dir/ → dir/index.md) and site-absolute links
// (/page → docs/page.md — the site's content root is docs/, not the repo root).
const broken = links(c)
  .that()
  .areInternal()
  .should()
  .resolve({ tryExtensions: ['.md'], tryIndex: 'index.md', rootDir: 'docs' })
  .rule({ id: 'corpus/broken-links' })
  .violations()

console.error(
  `Corpus links: ${c.documents().length} docs scanned · ${broken.length} broken internal link(s)`,
)
if (broken.length > 0) {
  failed = true
  for (const v of broken) console.error(`  ✗ ${v.message}`)
}

// Live code pointers must ground in the repo (frozen folders are historical).
// Illustrative pointers in prose are sanctioned inline via
// <!-- eess-exclude corpus/pointers-resolve: reason --> (greppable).
const stale = pointers(c)
  .that()
  .areLive()
  .should()
  .resolve()
  .rule({ id: 'corpus/pointers-resolve' })
  .violations()

console.error(`Corpus pointers: ${stale.length} unresolved live code pointer(s)`)
if (stale.length > 0) {
  failed = true
  for (const v of stale) console.error(`  ✗ ${v.message}`)
}

// dir MUST be set: the preset default is 'docs/adr/**'; ours live at /adr.
try {
  adrEnforcement(c, { dir: 'adr/**' })
  console.error('ADR enforcement: all ADRs declare valid tier tables, citations resolve')
} catch (err) {
  failed = true
  console.error('ADR enforcement: FAILED')
  console.error(err.message)
}

if (failed) process.exit(1)
