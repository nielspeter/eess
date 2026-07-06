#!/usr/bin/env node
/**
 * Dogfood: validate this repo's own engineering-corpus markdown with eess-md.
 *
 * The corpus (work/plans, adr/, docs/) must stay honest:
 *  - internal cross-links resolve (safety net for doc moves);
 *  - live code pointers ground in real code (frozen folders are historical);
 *  - every ADR declares valid EESS enforcement (tier table, citations resolve)
 *    via the adrEnforcement preset — the executable-ADR model applied to us
 *    (plan 0060 Phase 3; the AST-grounded citation check is check:crossval).
 *
 * Always reports what it scanned (documents, per-check counts, elapsed time) so
 * a fast green is provably non-vacuous, not a silent no-op.
 *
 * `**‍/completed/**`, `**‍/wont-do/**`, `**‍/archived/**` are frozen (historical).
 * Exits non-zero on a live violation. Run: `npm run check:corpus`.
 */
import { corpus, links, pointers } from '@nielspeter/eess-md'
import { adrEnforcement } from '@nielspeter/eess-md/rules/adr'

const ROOTS = ['work/plans/**', 'adr/**', 'docs/**']
const t0 = Date.now()
const elapsed = () => {
  const ms = Date.now() - t0
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

const c = corpus({
  roots: ROOTS,
  frozen: ['**/completed/**', '**/wont-do/**', '**/archived/**'],
})

const allDocs = c.documents()
const liveDocs = allDocs.filter((d) => !d.frozen)
const frozenCount = allDocs.length - liveDocs.length
const adrDocs = liveDocs.filter(
  (d) => d.relPath.startsWith('adr/') && !/readme\.md$/i.test(d.relPath),
)
const anon = { identify: () => ({ name: '' }) }

// Static-site resolution for the docs/ guide: extensionless links
// (./page → page.md, ./dir/ → dir/index.md) and site-absolute links
// (/page → docs/page.md — the site's content root is docs/, not the repo root).
const linkRule = links(c)
  .that()
  .areInternal()
  .should()
  .resolve({ tryExtensions: ['.md'], tryIndex: 'index.md', rootDir: 'docs' })
  .rule({ id: 'corpus/broken-links' })
const linksChecked = linkRule.select({ label: 'link', ...anon }).elements.length
const broken = linkRule.violations()

// Live code pointers must ground in the repo (frozen folders are historical).
// Illustrative pointers in prose are sanctioned inline via
// <!-- eess-exclude corpus/pointers-resolve: reason --> (greppable).
const pointerRule = pointers(c)
  .that()
  .areLive()
  .should()
  .resolve()
  .rule({ id: 'corpus/pointers-resolve' })
const pointersChecked = pointerRule.select({ label: 'pointer', ...anon }).elements.length
const stale = pointerRule.violations()

// dir MUST be set: the preset default is 'docs/adr/**'; ours live at /adr.
let adrError
try {
  adrEnforcement(c, { dir: 'adr/**' })
} catch (err) {
  adrError = err
}

// ---------- report ----------

const relTo = (file) =>
  file.startsWith(c.root) ? file.slice(c.root.length).replace(/^[/\\]/, '') : file
const line = (label, detail) => console.error(`  ${label.padEnd(10)}${detail}`)

console.error('')
console.error('check:corpus · corpus integrity')
line('roots', ROOTS.join(', '))
console.error('')
line(
  'documents',
  `${liveDocs.length} live · ${frozenCount} frozen (history — reported, never gated)`,
)
line(
  'links',
  `${linksChecked} internal · ${broken.length === 0 ? '✓ all resolve' : `✗ ${broken.length} broken`}`,
)
line(
  'pointers',
  `${pointersChecked} live · ${stale.length === 0 ? '✓ all ground in code' : `✗ ${stale.length} stale`}`,
)
line(
  'ADRs',
  `${adrDocs.length} enforced · ${adrError ? '✗ invalid' : '✓ tables + citations resolve'}`,
)

const problems = [...broken, ...stale]
if (problems.length > 0) {
  console.error('')
  console.error(`  ${problems.length} violation(s):`)
  for (const v of problems)
    console.error(`    ${relTo(v.file)}:${v.line}  ${v.message.split('\n')[0]}`)
}
if (adrError) {
  console.error('')
  console.error('  ADR enforcement failed:')
  console.error(
    adrError.message
      .split('\n')
      .map((l) => `    ${l}`)
      .join('\n'),
  )
}

const totalChecked = linksChecked + pointersChecked + adrDocs.length
const failed = problems.length > 0 || adrError !== undefined
console.error('')
if (!failed) {
  console.error(
    `  ✓ corpus integrity — ${totalChecked} checks across ${liveDocs.length} documents, 0 violations (${elapsed()})`,
  )
} else {
  const n = problems.length + (adrError ? 1 : 0)
  console.error(
    `  ✗ corpus integrity — ${n} violation(s) across ${totalChecked} checks (${elapsed()})`,
  )
}
console.error('')

if (failed) process.exit(1)
