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
import { resolve } from 'node:path'
import { corpus, docs, links, matchTableRows, pointers } from '@nielspeter/eess-md'
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

// An OWNER is any record that can declare `**Implements:** proposal NNN` — plans
// or bugs. Product review of plan 0216: proposal 004's ruling is `Docs-only` and
// its remaining ask is owned by a bug, so restricting owners to the plan lane
// would have been wrong. Widening the owner set also widens the two
// Implements-VALIDATION rules below: a bug that could satisfy the promotion rule
// with a malformed or dangling declaration, and be told nothing, would be a
// fail-open introduced by the widening itself.
const isOwnerDoc = (d) => isPlanDoc(d) || d.relPath.startsWith('work/bugs/')

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

// The accepted-proposal->plan rule is live-only, so its denominator drains as
// proposals promote: 005 is the only accepted one today, and freezing
// `promoted/` would take this to 0 while still printing a green summary. Devops
// review found it has never had the zero-guard the board rule just gained.
// Zero accepted proposals is legitimate (a lane can have none reviewed yet), so
// this fires only when there are proposals AND none is accepted AND at least one
// carries a parseable Ruling — i.e. the corpus says reviews happened and this
// rule still examined nothing.
const anyRulingParses = liveDocs.some(
  (d) => isProposalDoc(d) && !hasUnparseableRuling(d.text) && operativeRuling(d.text) !== null,
)
const acceptedDenominatorViolations =
  acceptedProposalCount === 0 && anyRulingParses
    ? [
        {
          rule: 'correspondence',
          ruleId: 'corpus/accepted-proposal-denominator-empty',
          element: 'work/proposals',
          file: resolve(c.root, 'work/proposals/PROPOSALS.md'),
          line: 1,
          message:
            'the accepted-proposal -> plan rule examined 0 proposals, though the lane has ' +
            'reviewed proposals with parseable Rulings',
          suggestion:
            'a live accepted proposal is what this rule exists to bind — if every accepted ' +
            'proposal is now frozen or promoted out of scope, widen the selector rather than ' +
            'letting it pass on an empty set.',
          codeFrame: undefined,
        },
      ]
    : []

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
  (d) => isOwnerDoc(d) && hasUnparseableImplements(d.text),
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
  if (!isOwnerDoc(d)) return false
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

// The board's `Ruling` column is a hand-kept COPY of the operative
// `**Ruling:**` in the proposal file, and nothing compared them until plan 0216.
//
// Built as a real two-sided join — `matchTableRows` + `matchSelections`, the
// same shape `spec.rules.ts` uses for the README package table and the ADR
// index — and NOT as a hand-rolled `forEach`. Review measured exactly what the
// one-sided first version let through, all four exit 0:
//   - a board row DELETED outright                     -> nothing noticed
//   - a row losing its number while its Ruling drifted -> silently skipped
//   - a decoy `Item`+`Ruling` table above the board    -> real board never read
//   - two files claiming one proposal number           -> a Map kept the last
// `leftUnmatched` / `rightUnmatched` / `leftAmbiguous` answer all four.
//
// `matchTableRows` defaults to `mode: 'all'`, so a second table carrying both
// columns contributes its rows rather than shadowing the board.
const boardDoc = allDocs.find((d) => /work\/proposals\/PROPOSALS\.md$/.test(d.relPath))
// Non-vacuity probe artifacts still take part in the join — a probe that plants
// a proposal AND a board row must be able to produce a real drift finding, which
// is how `corpus/proposal-board-ruling-drift` is covered. What they are exempt
// from is the REQUIREMENT to appear on the board (`rightUnmatched`, below):
// they are transient scaffolding under a reserved, `.gitignore`d prefix, written
// and deleted inside one harness run, and demanding a board row for one would
// force every probe that plants a proposal to edit the board too. Measured when
// this rule first landed: it broke three unrelated fixtures exactly that way.
//
// The first attempt at this exemption dropped probes from the join entirely and
// broke two of the new fixtures instead — a carve-out one level too wide. Kept
// as narrow as it can be: one arm of one rule.
const isProbeArtifact = (d) => /__nonvacuity_probe/.test(d.relPath)
const boardProposalDocs = allDocs.filter(isProposalDoc)

/** Display form - the number as the corpus writes it: `006`, not `6`. */
const pad3 = (n) => String(n).padStart(3, '0')

// An element that cannot be keyed gets a NAMESPACED SENTINEL, never `''`: two
// unkeyable elements sharing an empty key would match each other into a false
// pair, which is the failure this rule exists to report. `#` cannot appear in a
// numeric key, so the namespaces are disjoint by construction.
const boardRowEls = (
  boardDoc
    ? matchTableRows(boardDoc, {
        section: /^Board$/,
        columns: { item: /^Item$/, ruling: /^Ruling$/ },
      })
    : []
).map((row, i) => {
  const lead = /^(\d+)\b/.exec(String(row.get('item') ?? '').trim())?.[1]
  const num = lead === undefined ? null : String(Number(lead))
  return { row, num, key: num ?? `#row-${i}` }
})

const boardMatch = matchSelections(boardRowEls, boardProposalDocs, {
  leftKey: (e) => e.key,
  rightKey: (d) => proposalNumberFromPath(d.relPath) ?? `#doc-${d.relPath}`,
})

const boardRulingViolations = []
const boardRowsTotal = boardRowEls.length
const boardRowsExamined = boardMatch.pairs.length

const boardConfigFinding = (ruleId, line, message, suggestion) => ({
  rule: 'proposal-ruling',
  ruleId,
  element: boardDoc?.relPath ?? 'work/proposals/PROPOSALS.md',
  file: boardDoc?.file ?? resolve(c.root, 'work/proposals/PROPOSALS.md'),
  line,
  message,
  suggestion,
  codeFrame: undefined,
})

// ADR-010, at three levels. Each is a way for this rule to examine nothing, and
// the first version guarded only the middle one - enforcement and product
// review both measured the OUTER case printing a green "board agrees with each
// file" over zero rows.
if (!boardDoc) {
  boardRulingViolations.push(
    boardConfigFinding(
      'corpus/proposal-board-missing',
      1,
      'work/proposals/PROPOSALS.md was not found, so the board-vs-file Ruling check examined nothing',
      'restore the board, or update the path this check looks for in scripts/check-corpus.mjs - ' +
        'a board this rule cannot find is not a board it passes.',
    ),
  )
} else if (boardRowsTotal === 0) {
  boardRulingViolations.push(
    boardConfigFinding(
      'corpus/proposal-board-unreadable',
      1,
      `${boardDoc.relPath} has no "## Board" table with both "Item" and "Ruling" columns`,
      'restore the board table headers, or update the section/column names this check looks ' +
        'for in scripts/check-corpus.mjs.',
    ),
  )
} else if (boardRowsExamined === 0) {
  boardRulingViolations.push(
    boardConfigFinding(
      'corpus/proposal-board-examined-nothing',
      boardRowEls[0]?.row.line ?? 1,
      `${boardDoc.relPath}'s board table has ${boardRowsTotal} row(s) and this check matched none of them to a proposal`,
      'each board row Item cell must open with the proposal number (e.g. "006 - ..."), and ' +
        'that proposal must exist under work/proposals/.',
    ),
  )
}

// A row naming no real proposal. Previously `if (!doc) return` - a silent
// per-row exclusion, the class this file elsewhere turns into findings.
for (const e of boardMatch.leftUnmatched) {
  boardRulingViolations.push({
    rule: 'correspondence',
    ruleId: 'corpus/proposal-board-row-unresolved',
    element: e.num === null ? `row ${e.row.line}` : `proposal ${pad3(e.num)}`,
    file: e.row.doc.file,
    line: e.row.line,
    message:
      e.num === null
        ? 'board row does not open with a proposal number, so nothing verifies it'
        : `board row names proposal ${pad3(e.num)}, which does not exist under work/proposals/`,
    suggestion:
      'open the Item cell with the proposal number (e.g. "006 - ..."), fix the number, or ' +
      'remove the row.',
    codeFrame: undefined,
  })
}

// A proposal with no board row - the missing right side. Measured: deleting
// 006's row entirely left the build green.
for (const d of boardMatch.rightUnmatched.filter((d) => !isProbeArtifact(d))) {
  const n = proposalNumberFromPath(d.relPath)
  boardRulingViolations.push({
    rule: 'correspondence',
    ruleId: 'corpus/proposal-missing-from-board',
    element: `proposal ${n === null ? d.relPath : pad3(n)}`,
    file: d.file,
    line: 1,
    message: `${d.relPath} has no row on the PROPOSALS.md board`,
    suggestion: `add a board row whose Item cell opens with ${n === null ? 'the proposal number' : pad3(n)}.`,
    codeFrame: undefined,
  })
}

// Two files claiming one number - what a botched `git mv` into promoted/ makes.
for (const e of boardMatch.leftAmbiguous) {
  boardRulingViolations.push({
    rule: 'correspondence',
    ruleId: 'corpus/proposal-number-duplicated',
    element: `proposal ${pad3(e.num ?? '?')}`,
    file: e.row.doc.file,
    line: e.row.line,
    message: `board row for proposal ${pad3(e.num ?? '?')} matches more than one proposal file`,
    suggestion: 'one number, one file - renumber or delete the duplicate under work/proposals/.',
    codeFrame: undefined,
  })
}

// `-`, an em/en dash and an empty cell all mean "no ruling recorded". Backticks
// are stripped because mdast leaves them in the cell text (emphasis it already
// strips); no substring matching, so `Split and sequence - 3 plans` still reds.
const boardRulingCell = (cell) => {
  const v = String(cell ?? '')
    .replace(/[`*_]/g, '')
    .trim()
  return v === '' || v === '—' || v === '-' || v === '–' ? null : v
}

for (const { left: e, right: doc } of boardMatch.pairs) {
  // A Ruling the FILE spells wrongly is already reported against the file by
  // `corpus/proposal-ruling-unparseable`, whose Fix is the correct one. Left
  // unsuppressed, this rule tells the author to blank the board cell for a
  // proposal that WAS reviewed - a spelling drift reported as an absent field.
  if (hasUnparseableRuling(doc.text)) continue
  const onBoard = boardRulingCell(e.row.get('ruling'))
  const inFile = operativeRuling(doc.text)
  if (onBoard === inFile) continue
  boardRulingViolations.push({
    rule: 'correspondence',
    ruleId: 'corpus/proposal-board-ruling-drift',
    element: `proposal ${pad3(e.num ?? '?')}`,
    file: e.row.doc.file,
    line: e.row.line,
    message:
      `PROPOSALS.md board says proposal ${pad3(e.num ?? '?')}'s Ruling is ` +
      `${onBoard === null ? '(none)' : `"${onBoard}"`} but ` +
      `${doc.relPath} says ${inFile === null ? '(none)' : `"${inFile}"`}`,
    suggestion:
      'the file is the source of truth - copy its operative Ruling (the LAST ' +
      '"**Ruling: <verdict>**" line in the file) into this board cell.',
    codeFrame: undefined,
  })
}

// ---- The `Promoted` obligation (plan 0216, second review round) -------------
//
// The plan asserted promotion carried its own enforcement: "`Promoted` is only
// writable when you can name the plans it became, and `check:corpus` already
// verifies those resolve. No second rule is owed."
//
// Three reviewers falsified that independently. The inherited linkage keys on
// the RULING (`ACCEPTED_RULINGS` = Ship as-is / Ship with changes), never on the
// STATE - so `Split and sequence`, `Rewrite needed`, `Docs-only` and `Reject`
// were all promotable while naming nothing, and `Split and sequence` is 006's,
// the very next promotion. Measured: a `Promoted` proposal naming no owner at
// all passed both gates green. A second rule was owed; these are it.

/** The header's State token, e.g. `Draft` / `Promoted` / `Declined`. */
const stateToken = (text) =>
  /^\s*(?:[-*+]\s+)?\*\*State:\*\*\s*([A-Za-z'’-]+)/m.exec(text)?.[1] ?? null

/** The line the State token sits on, so findings point at the claim itself. */
const stateLine = (doc) => {
  const idx = doc.text.search(/^\s*(?:[-*+]\s+)?\*\*State:\*\*/m)
  return idx < 0 ? 1 : doc.text.slice(0, idx).split('\n').length
}

// An owner is any record declaring `**Implements:** proposal NNN` - plans OR
// bugs. Product review: 004's ruling is `Docs-only` and its remaining ask is
// owned by bug 0134, so restricting owners to the plan lane would be wrong.
// allDocs, not liveDocs: a plan in `completed/` still owns what it built.
const ownersByProposal = new Map()
for (const d of allDocs.filter(isOwnerDoc)) {
  const n = declaredImplements(d.text)
  if (n === null) continue
  const list = ownersByProposal.get(n)
  if (list) list.push(d)
  else ownersByProposal.set(n, [d])
}

// A ruling that means "not dispatched". `Rewrite needed` says the material is
// worth keeping but the shape is wrong; `Reject` says the premise did not hold.
// Neither is a thing plans can own, so neither can be promoted - it would move
// live work out of the lane. Enforcement review measured the cost of leaving
// this to convention: promoting 001 fires 29 `ledger/silent-open-box` findings
// against Acceptance Criteria, and the pressure at that point is to bulk-
// annotate for green. `Declined` is the token for those.
const UNPROMOTABLE_RULINGS = new Set(['Rewrite needed', 'Reject'])

const promotedProposals = liveDocs.filter(
  (d) => isProposalDoc(d) && stateToken(d.text) === 'Promoted',
)
const promotedViolations = []

for (const d of promotedProposals) {
  const n = proposalNumberFromPath(d.relPath)
  const label = `proposal ${n === null ? d.relPath : pad3(n)}`
  const line = stateLine(d)

  // 1. Named nothing.
  if (n === null || (ownersByProposal.get(n) ?? []).length === 0) {
    promotedViolations.push({
      rule: 'correspondence',
      ruleId: 'corpus/promoted-proposal-names-no-owner',
      element: label,
      file: d.file,
      line,
      message: `${d.relPath} is State: Promoted but no plan or bug declares "**Implements:** proposal ${n === null ? 'NNN' : n}"`,
      suggestion:
        'a terminal token names its successor - add "**Implements:** proposal ' +
        `${n === null ? 'NNN' : n}" to the record that owns the work, or set State: Draft.`,
      codeFrame: undefined,
    })
  }

  // 2. Promoted on a ruling that means "not dispatched".
  const ruling = operativeRuling(d.text)
  if (ruling !== null && UNPROMOTABLE_RULINGS.has(ruling)) {
    promotedViolations.push({
      rule: 'proposal-ruling',
      ruleId: 'corpus/promoted-proposal-not-dispatchable',
      element: label,
      file: d.file,
      line,
      message: `${d.relPath} is State: Promoted but its operative Ruling is "${ruling}", which is live work, not a dispatch`,
      suggestion:
        'keep it State: Draft while the ruling stands, or use State: Declined if it will ' +
        'not be done. Promotion is for asks that plans or bugs now own.',
      codeFrame: undefined,
    })
  }

  // 3. Promoted with asks still Held. `honestyAtClose` reads GFM task boxes and
  // a disposition table is a TABLE, so closing a proposal with every ask still
  // Held produced zero findings - measured on 006, which carries three.
  const heldRows = matchTableRows(d, { columns: { disposition: /^disposition$/i } }).filter(
    (r) =>
      String(r.get('disposition') ?? '')
        .replace(/[`*_]/g, '')
        .trim() === 'Held',
  )
  for (const r of heldRows) {
    promotedViolations.push({
      rule: 'correspondence',
      ruleId: 'corpus/promoted-proposal-has-held-asks',
      element: label,
      file: d.file,
      line: r.line,
      message: `${d.relPath} is State: Promoted but this disposition row is still "Held" - a live ask leaving the lane`,
      suggestion:
        'dispatch the ask (name its owner and mark it Accepted), Reject it with a reason, ' +
        'or keep the proposal State: Draft until every row is disposed.',
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
    ...promotedViolations,
    ...acceptedDenominatorViolations,
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
  boardRulingViolations.length +
  promotedViolations.length +
  acceptedDenominatorViolations.length
const proposalLinkageOk = proposalPlanFindingCount === 0
// The affirmative clause is gated on rows ACTUALLY EXAMINED, not on the finding
// count. Enforcement review measured the old form printing
// "board agrees with each file" beside `0 board row(s)` - a green claim over an
// empty denominator, which is the sentence ADR-010 exists to forbid.
const boardExaminedAll = boardRowsExamined > 0 && boardRowsExamined === boardRowsTotal
line(
  'proposals',
  `${proposalDocsCount} total · ${acceptedProposalCount} accepted · ` +
    `${boardRowsExamined} of ${boardRowsTotal} board row(s) examined · ` +
    `${promotedProposals.length} promoted · ` +
    `${
      proposalLinkageOk && boardExaminedAll
        ? '✓ every accepted proposal has a plan, every Ruling/Implements parses, board agrees with each file'
        : `✗ ${proposalPlanFindingCount} finding(s)`
    }`,
)

const problems = [
  ...broken,
  ...stale,
  ...proposalPlanViolations,
  ...boardRulingViolations,
  ...promotedViolations,
  ...acceptedDenominatorViolations,
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
