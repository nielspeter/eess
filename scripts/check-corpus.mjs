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
import { definePredicate, matchSelections, reportViolations } from '@nielspeter/eess'
import { isRepoNativeLink, siteOptsAreSafe, unclassifiedRoots } from './lib/corpus-link-routing.mjs'
import {
  declaredImplements,
  declaredImplementsLine,
  hasUnparseableImplements,
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
// three.
//
// Built directly on `matchSelections` (not `correspondence().beComplete()`):
// a proposal split across two plans is normal practice in this repo (0100
// split from 0088; 0089/0101 sequenced) and must NOT be a violation —
// `beComplete()` reports `leftAmbiguous` as a finding, which branch review
// found reddens the build with no `Fix:` line and a rule id that says
// "uncited" for a proposal cited twice. Only `leftUnmatched` — a proposal
// with NO implementing plan at all — is the real corruption; multiplicity is
// legal and unreported.
const isProposalDoc = (d) =>
  d.relPath.startsWith('work/proposals/') && !/PROPOSALS\.md$/.test(d.relPath)
const isPlanDoc = (d) => d.relPath.startsWith('work/plans/')

// Left (proposals) is live-only: an archived/frozen proposal is history, not
// a claim that still needs a plan. Right (plans) is NOT filtered — a plan
// under `work/plans/completed/` still implements the proposal it declares.
// The two checks below must agree on this basis (branch review found the
// first version didn't, making the summary denominators incoherent).
const isAcceptedProposal = definePredicate(
  'is an accepted live proposal',
  (d) => !d.frozen && isProposalDoc(d) && isAccepted(operativeRuling(d.text)),
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
  (d) => isPlanDoc(d) && declaredImplements(d.text) !== null,
)
const implementingPlanSelection = docs(c)
  .that()
  .satisfy(declaresImplements)
  .select({
    label: 'implementing plan',
    identify: (d) => ({ name: d.relPath, file: d.file, line: declaredImplementsLine(d.text) }),
  })

const proposalPlanMatch = matchSelections(
  proposalSelection.elements,
  implementingPlanSelection.elements,
  {
    leftKey: (d) => proposalNumberFromPath(d.relPath) ?? '',
    rightKey: (d) => declaredImplements(d.text) ?? '',
  },
)
const proposalPlanViolations = proposalPlanMatch.leftUnmatched.map((d) => {
  const info = proposalSelection.identify(d)
  return {
    rule: 'correspondence',
    ruleId: 'corpus/accepted-proposal-uncited',
    element: info.name,
    file: info.file,
    line: info.line,
    message: `accepted proposal "${info.name}" has no matching implementing plan`,
    suggestion:
      `add "**Implements:** proposal ${info.name}" to the plan header that builds it, ` +
      'or file one.',
    codeFrame: undefined,
  }
})

const acceptedProposalCount = proposalSelection.elements.length

// A proposal that has a `**Ruling:`-shaped line but it doesn't parse to the
// closed vocabulary is a real finding, not silently "not accepted" —
// distinct from "never reviewed" (Draft, no Ruling line at all), which is
// not a violation. Built directly rather than through the RuleBuilder
// condition machinery: this is a flag-every-match check with no
// baseline/exclusion needs, and a plain ArchViolation is the kernel's whole
// contract (packages/core/src/violation.ts).
const unparseableRulingDocs = liveDocs.filter(
  (d) => isProposalDoc(d) && hasUnparseableRuling(d.text),
)
const unparseableRulingViolations = unparseableRulingDocs.map((d) => ({
  rule: 'proposal-ruling',
  ruleId: 'corpus/proposal-ruling-unparseable',
  element: d.relPath,
  file: d.file,
  line: operativeRulingLine(d.text),
  message: `${d.relPath} has a "**Ruling:**" line that does not match the closed vocabulary`,
  suggestion:
    'write exactly "**Ruling: <verdict>**" with one of Ship as-is / Ship with changes / ' +
    'Split and sequence / Rewrite needed / Docs-only / Reject.',
  codeFrame: undefined,
}))

// The symmetric case on the plan side: a line that looks like an Implements
// declaration but doesn't parse is a finding, not a silent "no plan cites
// this" — branch review found the first version applied this discipline to
// Ruling only, leaving the field this plan itself invented unenforced.
const unparseableImplementsDocs = liveDocs.filter(
  (d) => isPlanDoc(d) && hasUnparseableImplements(d.text),
)
const unparseableImplementsViolations = unparseableImplementsDocs.map((d) => ({
  rule: 'proposal-ruling',
  ruleId: 'corpus/plan-implements-unparseable',
  element: d.relPath,
  file: d.file,
  line: declaredImplementsLine(d.text),
  message:
    `${d.relPath} has an "**Implements:**" declaration that does not resolve to exactly ` +
    'one proposal number (missing, malformed, or more than one)',
  suggestion:
    'write exactly one "**Implements:** proposal NNN" line (bare number or a markdown ' +
    'link) — a plan declares at most one proposal; if it builds two, file two plans.',
  codeFrame: undefined,
}))

// A plan's **Implements:** naming a proposal number that doesn't correspond
// to any real proposal file is a dangling reference — the same class this
// gate's link/pointer checks exist for, applied to the reference type this
// plan introduces. Deliberately independent of Ruling/acceptance: a plan may
// legitimately implement a proposal that isn't accepted yet (0142 itself did,
// briefly, while Draft) — only existence is checked here.
// allDocs, not liveDocs: existence isn't a liveness question — an archived
// proposal still exists (branch review, architect + devops independently:
// the first version used liveDocs, so a plan citing an archived proposal
// was told to "file the missing proposal" for one that plainly exists).
const allProposalNumbers = new Set(
  allDocs.filter(isProposalDoc).map((d) => proposalNumberFromPath(d.relPath)),
)
const danglingImplementsDocs = liveDocs.filter((d) => {
  if (!isPlanDoc(d)) return false
  const n = declaredImplements(d.text)
  return n !== null && !allProposalNumbers.has(n)
})
const danglingImplementsViolations = danglingImplementsDocs.map((d) => {
  const n = declaredImplements(d.text)
  return {
    rule: 'correspondence',
    ruleId: 'corpus/plan-implements-unresolved',
    element: d.relPath,
    file: d.file,
    line: declaredImplementsLine(d.text),
    message: `${d.relPath} declares "**Implements:** proposal ${n}" but no proposal ${n} exists`,
    suggestion: 'fix the proposal number, or file the missing proposal.',
    codeFrame: undefined,
  }
})

// The board's `Ruling` column is a hand-maintained COPY of the operative
// `**Ruling:**` in the proposal file, and nothing compared the two until plan
// 0216. Measured: proposal 006's row carried `—` while its file said
// `Split and sequence`, so the board reported a reviewed proposal as unreviewed.
// The drift also runs the other way — a second `## Review` section changes the
// operative Ruling and the board keeps the old verdict, which is worse, because
// a stale verdict reads as current.
//
// Keyed on the proposal NUMBER that opens each row's Item cell, so reordering
// the board is not a violation and a proposal that moves into `promoted/` keeps
// matching. NOT keyed on the cell's link target: `MdTable` rows are *rendered*
// cell text, so the link markup is already stripped by the time this sees it —
// the first version of this rule regexed for `](…)`, matched nothing, and
// passed green over all six rows. The denominator below is what caught it.
const boardDoc = allDocs.find((d) => /work\/proposals\/PROPOSALS\.md$/.test(d.relPath))
const proposalByNumber = new Map(
  allDocs.filter(isProposalDoc).map((d) => [proposalNumberFromPath(d.relPath), d]),
)
// `—`, `-`, `–` and an empty cell all mean "no ruling recorded". Emphasis and
// code fences are stripped first: the cell is prose in a table, so `**Reject**`
// and `Reject` are the same claim and must not read as drift.
const boardRulingCell = (cell) => {
  const v = String(cell ?? '')
    .replace(/[`*_]/g, '')
    .trim()
  return v === '' || v === '—' || v === '-' || v === '–' ? null : v
}
const boardTable = boardDoc?.tables.find(
  (t) => t.header.includes('Item') && t.header.includes('Ruling'),
)
const boardRulingViolations = []
let boardRowsChecked = 0
if (boardDoc && !boardTable) {
  // ADR-010: a rule that examines nothing must say so as a finding, not pass.
  // The board table is found by its header, so a renamed column silently
  // disables this check — exactly the failure class this gate exists for.
  boardRulingViolations.push({
    rule: 'proposal-ruling',
    ruleId: 'corpus/proposal-board-unreadable',
    element: boardDoc.relPath,
    file: boardDoc.file,
    line: 1,
    message: `${boardDoc.relPath} has no board table with both "Item" and "Ruling" columns`,
    suggestion:
      'restore the board table headers, or update the header names this check looks for ' +
      'in scripts/check-corpus.mjs — a board this rule cannot read is not a board it passes.',
    codeFrame: undefined,
  })
} else if (boardDoc && boardTable) {
  const itemIdx = boardTable.header.indexOf('Item')
  const rulingIdx = boardTable.header.indexOf('Ruling')
  boardTable.rows.forEach((row, i) => {
    const lead = /^(\d+)\b/.exec(String(row[itemIdx] ?? '').trim())?.[1]
    const num = lead === undefined ? null : String(Number(lead))
    const doc = num === null ? undefined : proposalByNumber.get(num)
    if (!doc) return
    boardRowsChecked += 1
    const onBoard = boardRulingCell(row[rulingIdx])
    const inFile = operativeRuling(doc.text)
    if (onBoard === inFile) return
    boardRulingViolations.push({
      rule: 'correspondence',
      ruleId: 'corpus/proposal-board-ruling-drift',
      element: `proposal ${num}`,
      file: boardDoc.file,
      line: boardTable.rowLines[i] ?? boardTable.line,
      message:
        `PROPOSALS.md board says proposal ${num}'s Ruling is ` +
        `${onBoard === null ? '(none)' : `"${onBoard}"`} but ` +
        `${doc.relPath} says ${inFile === null ? '(none)' : `"${inFile}"`}`,
      suggestion:
        'the file is the source of truth — copy its operative Ruling (the LAST ' +
        '"**Ruling: <verdict>**" line in the file) into this board cell.',
      codeFrame: undefined,
    })
  })
  // ADR-010: a pass is constructed from evidence. A board table this rule can
  // read but whose every row it skips is the same no-op as no rule at all — and
  // it is not hypothetical: see the comment above.
  if (boardRowsChecked === 0) {
    boardRulingViolations.push({
      rule: 'proposal-ruling',
      ruleId: 'corpus/proposal-board-examined-nothing',
      element: boardDoc.relPath,
      file: boardDoc.file,
      line: boardTable.line,
      message: `${boardDoc.relPath}'s board table has ${boardTable.rows.length} row(s) and this check matched none of them to a proposal`,
      suggestion:
        'each board row\'s Item cell must open with the proposal number (e.g. "006 — …"), ' +
        'and that proposal must exist under work/proposals/.',
      codeFrame: undefined,
    })
  }
}

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
    ...unparseableImplementsViolations,
    ...danglingImplementsViolations,
    ...boardRulingViolations,
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
const planDocsCount = liveDocs.filter(isPlanDoc).length
const proposalPlanFindingCount =
  proposalPlanViolations.length +
  unparseableRulingViolations.length +
  unparseableImplementsViolations.length +
  danglingImplementsViolations.length +
  boardRulingViolations.length
const proposalLinkageOk = proposalPlanFindingCount === 0
line(
  'proposals',
  `${proposalDocsCount} total · ${acceptedProposalCount} accepted · ${boardRowsChecked} board row(s) · ` +
    `${proposalLinkageOk ? '✓ every accepted proposal has a plan, every Ruling/Implements parses, board agrees with each file' : `✗ ${proposalPlanFindingCount} finding(s)`}`,
)

const problems = [
  ...broken,
  ...stale,
  ...proposalPlanViolations,
  ...boardRulingViolations,
  ...unparseableRulingViolations,
  ...unparseableImplementsViolations,
  ...danglingImplementsViolations,
]
if (problems.length > 0) {
  console.error('')
  console.error(`  ${problems.length} violation(s):`)
  for (const v of problems) {
    console.error(`    ${relTo(v.file)}:${v.line}  ${v.message.split('\n')[0]}`)
    if (v.suggestion) console.error(`      Fix: ${v.suggestion}`)
  }
}
if (adrError) {
  console.error('')
  console.error('  ADR enforcement failed:')
  for (const v of adrViolations)
    console.error(`    ${relTo(v.file)}:${v.line}  ${v.message.split('\n')[0]}`)
}

const totalChecked =
  linksChecked + pointersChecked + adrDocs.length + proposalDocsCount + planDocsCount
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
