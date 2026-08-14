#!/usr/bin/env node
/**
 * Dogfood: validate this repo's own engineering-corpus markdown with eess-md.
 *
 * The corpus (work/plans, work/proposals, work/bugs, adr/, docs/) must stay
 * honest:
 *  - internal cross-links resolve (safety net for doc moves) — including a
 *    link to a directory that exists (bug 0086), everywhere except docs/,
 *    where a bare directory is not a page the VitePress site would serve;
 *  - live code pointers ground in real code (frozen folders are historical);
 *  - every ADR declares valid EESS enforcement (tier table, citations resolve)
 *    via the adrEnforcement preset — the executable-ADR model applied to us
 *    (plan 0060 Phase 3; the AST-grounded citation check is check:crossval).
 *
 * Always reports what it scanned (documents, per-check counts, elapsed time) so
 * a fast green is provably non-vacuous, not a silent no-op.
 *
 * `**‍/completed/**`, `**‍/wont-do/**`, `**‍/fixed/**`, `**‍/archived/**` are
 * frozen (historical). Exits non-zero on a live violation. Run:
 * `npm run check:corpus`.
 */
import { corpus, docs, links, pointers } from '@nielspeter/eess-md'
import { adrEnforcement } from '@nielspeter/eess-md/rules/adr'
import { correspondence, definePredicate, reportViolations } from '@nielspeter/eess'
import { isRepoNativeLink, siteOptsAreSafe, unclassifiedRoots } from './lib/corpus-link-routing.mjs'
import {
  declaredImplements,
  declaredImplementsLine,
  hasUnparseableRuling,
  isAccepted,
  operativeRuling,
  operativeRulingLine,
  proposalNumberFromPath,
} from './lib/proposal-ruling.mjs'

// `fixed/` is the bugs lane's own done-folder (bug 0086) — frozen alongside
// the others so bug history is reported, not gated against today's code.
const ROOTS = ['work/plans/**', 'work/proposals/**', 'work/bugs/**', 'adr/**', 'docs/**']
const SITE_ROOTS = ['docs/']

// Every root must be explicitly classified for link-resolution routing (see
// lib/corpus-link-routing.mjs) — a new root nobody classified is exactly the
// gap bug 0086's review round found: it silently fell into the loose
// (resolveDirectories) profile by default, a false green waiting to happen.
// Refuse to run rather than guess.
const unclassified = unclassifiedRoots(ROOTS, SITE_ROOTS)
if (unclassified.length > 0) {
  console.error(
    `check:corpus: ${unclassified.join(', ')} in ROOTS but not classified as site or ` +
      `repo-native — add it to SITE_ROOTS here or REPO_NATIVE_ROOTS in ` +
      `scripts/lib/corpus-link-routing.mjs before this gate can run.`,
  )
  process.exit(1)
}

const t0 = Date.now()
const elapsed = () => {
  const ms = Date.now() - t0
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

const c = corpus({
  roots: ROOTS,
  frozen: ['**/completed/**', '**/wont-do/**', '**/fixed/**', '**/archived/**'],
})
const relTo = (file) =>
  file.startsWith(c.root) ? file.slice(c.root.length).replace(/^[/\\]/, '') : file

const allDocs = c.documents()
const liveDocs = allDocs.filter((d) => !d.frozen)
const frozenCount = allDocs.length - liveDocs.length
const adrDocs = liveDocs.filter(
  (d) => d.relPath.startsWith('adr/') && !/readme\.md$/i.test(d.relPath),
)
const anon = { identify: () => ({ name: '' }) }

// Two resolution profiles, routed by which root a link's own document lives
// in — a single shared options object would be wrong in one direction or the
// other, not just imprecise:
//
// - docs/ is the VitePress guide: extensionless links (./page → page.md,
//   ./dir/ → dir/index.md) and site-absolute links (/page → docs/page.md,
//   the site's content root, not the repo root). `resolveDirectories` must
//   stay OFF here — a bare directory with no index is not a page VitePress
//   would actually serve, so resolving it would be a false green over a
//   genuinely dead link (bug 0086's own caveat).
// - `REPO_NATIVE_ROOTS` (lib/corpus-link-routing.mjs) is repo-hosted markdown
//   rendered by GitHub: a link to a directory that exists
//   (`work/bugs/fixed/`, `work/plans/completed/`) is real and GitHub renders
//   it as the listing — `resolveDirectories: true` closes exactly that gap
//   (bug 0086). No `rootDir`: site-absolute-link semantics don't apply
//   outside the site.
//
// The routing itself is `isRepoNativeLink` — an explicit allowlist, not
// `!isSiteDoc`. An earlier version used the site as the named case and
// everything else as the default, which meant a link in any *future*
// unclassified root silently got the loose profile — the false-green
// direction this whole fix exists to prevent, found live by review (bug
// 0086's own record). `unclassifiedRoots` above closes the gap that let a
// new root go unrouted at all; this closes which profile is the *default*
// for a root that is routed.
const SITE_OPTS = { tryExtensions: ['.md'], tryIndex: 'index.md', rootDir: 'docs' }
const REPO_OPTS = { tryExtensions: ['.md'], tryIndex: 'index.md', resolveDirectories: true }
if (!siteOptsAreSafe(SITE_OPTS)) {
  console.error(
    'check:corpus: SITE_OPTS.resolveDirectories is true — the VitePress site would resolve a ' +
      'bare directory with no index as if it were a real page, which is a false green, not a ' +
      'convenience (bug 0086). Remove it, or move the affected root to REPO_NATIVE_ROOTS in ' +
      'scripts/lib/corpus-link-routing.mjs if it genuinely is repo-hosted.',
  )
  process.exit(1)
}

const linkRule = links(c).that().areInternal().should().resolve(SITE_OPTS).rule({
  id: 'corpus/broken-links',
})
const repoLinkRule = links(c).that().areInternal().should().resolve(REPO_OPTS).rule({
  id: 'corpus/broken-links',
})
// The element set (which links count as "internal") is options-independent,
// so either rule's .select() reports the same total — the split only changes
// which options apply to which link's resolution, not how many are checked.
const linksChecked = linkRule.select({ label: 'link', ...anon }).elements.length
const broken = [
  ...linkRule.violations().filter((v) => !isRepoNativeLink(relTo(v.file))),
  ...repoLinkRule.violations().filter((v) => isRepoNativeLink(relTo(v.file))),
]

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
// report: 'return' — the preset emits nothing; this script owns reporting
// (no double render — plan 0070 / ADR-008).
const adrViolations = adrEnforcement(c, { dir: 'adr/**', report: 'return' })
const adrError = adrViolations.length > 0

// Proposal → plan linkage (bug 0141 / plan 0142): an accepted proposal
// (Ruling: Ship as-is / Ship with changes) must have at least one plan that
// DECLARES it implements that proposal — a plan's own **Implements:** header
// line, never a textual mention. Bug 0141 found the only three real
// citations in this corpus today mention a proposal while explicitly
// excluding it from scope or citing it as a re-check dependency, never
// implementing it — a substring/prose match would have gone green on all
// three. `keyBy` (not `matchBy`): each side now yields exactly one key
// (the proposal number), so this is an O(n+m) indexed join, not a predicate
// scan.
const isProposalDoc = (d) =>
  d.relPath.startsWith('work/proposals/') && !/PROPOSALS\.md$/.test(d.relPath)

const isAcceptedProposal = definePredicate(
  'is an accepted proposal',
  (d) => isProposalDoc(d) && isAccepted(operativeRuling(d.text)),
)
const proposalSelection = docs(c)
  .that()
  .satisfy(isAcceptedProposal)
  .select({
    label: 'accepted proposal',
    identify: (d) => ({
      name: proposalNumberFromPath(d.relPath) ?? d.relPath,
      file: d.file,
      line: operativeRulingLine(d.text),
    }),
  })

const declaresImplements = definePredicate(
  'declares an Implements back-reference',
  (d) => d.relPath.startsWith('work/plans/') && declaredImplements(d.text) !== null,
)
const implementingPlanSelection = docs(c)
  .that()
  .satisfy(declaresImplements)
  .select({
    label: 'implementing plan',
    identify: (d) => ({ name: d.relPath, file: d.file, line: declaredImplementsLine(d.text) }),
  })

const proposalPlanViolations = correspondence({
  left: proposalSelection,
  right: implementingPlanSelection,
  keyBy: {
    left: (d) => proposalNumberFromPath(d.relPath) ?? '',
    right: (d) => declaredImplements(d.text) ?? '',
  },
  suggest: {
    left: (info) =>
      `Fix: add "**Implements:** proposal ${info.name}" to the plan header that builds it, or file one.`,
  },
})
  .should()
  .beComplete({ direction: 'left-to-right' })
  .rule({ id: 'corpus/accepted-proposal-uncited' })
  .violations()

const acceptedProposalCount = proposalSelection.elements.length

// A proposal that HAS been reviewed (a `## Review —` section exists) but
// whose Ruling doesn't parse to the closed vocabulary is a real finding, not
// silently "not accepted" — distinct from "never reviewed" (Draft, no
// Review section yet), which is not a violation. Built directly rather than
// through the RuleBuilder condition machinery: this is a flag-every-match
// check with no baseline/exclusion needs, and a plain ArchViolation is the
// kernel's whole contract (packages/core/src/violation.ts).
const unparseableRulingDocs = liveDocs.filter(
  (d) => isProposalDoc(d) && hasUnparseableRuling(d.text),
)
const unparseableRulingViolations = unparseableRulingDocs.map((d) => ({
  rule: 'proposal-ruling',
  ruleId: 'corpus/proposal-ruling-unparseable',
  element: d.relPath,
  file: d.file,
  line: operativeRulingLine(d.text),
  message:
    `${d.relPath} has a "## Review —" section but its "**Ruling:**" line does not match the ` +
    'closed vocabulary — currently silent, not "not accepted". Fix: write exactly ' +
    '"**Ruling: <verdict>**" with one of Ship as-is / Ship with changes / Split and sequence / ' +
    'Rewrite needed / Docs-only / Reject.',
  codeFrame: undefined,
}))

// --format json/github — emit all violations machine-readable, then exit (plan 0070).
const fmtArg = process.argv.indexOf('--format')
const format = fmtArg >= 0 ? process.argv[fmtArg + 1] : undefined
if (format === 'json' || format === 'github') {
  const all = [
    ...broken,
    ...stale,
    ...adrViolations,
    ...proposalPlanViolations,
    ...unparseableRulingViolations,
  ]
  reportViolations(all, { format })
  process.exit(all.length > 0 ? 1 : 0)
}

// ---------- report ----------

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
const proposalDocsCount = liveDocs.filter(isProposalDoc).length
const proposalLinkageOk =
  proposalPlanViolations.length === 0 && unparseableRulingViolations.length === 0
line(
  'proposals',
  `${proposalDocsCount} total · ${acceptedProposalCount} accepted · ` +
    `${proposalLinkageOk ? '✓ every accepted proposal has a plan, every Ruling parses' : `✗ ${proposalPlanViolations.length + unparseableRulingViolations.length} finding(s)`}`,
)

const problems = [...broken, ...stale, ...proposalPlanViolations, ...unparseableRulingViolations]
if (problems.length > 0) {
  console.error('')
  console.error(`  ${problems.length} violation(s):`)
  for (const v of problems)
    console.error(`    ${relTo(v.file)}:${v.line}  ${v.message.split('\n')[0]}`)
}
if (adrError) {
  console.error('')
  console.error('  ADR enforcement failed:')
  for (const v of adrViolations)
    console.error(`    ${relTo(v.file)}:${v.line}  ${v.message.split('\n')[0]}`)
}

const totalChecked = linksChecked + pointersChecked + adrDocs.length + proposalDocsCount
const failed = problems.length > 0 || adrError
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
