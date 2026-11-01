#!/usr/bin/env node
/**
 * Dogfood: validate this repo's own engineering-corpus markdown with eess-md.
 *
 * The corpus (`work/**`, `adr/**`, `docs/**` — the whole of `work/`, not a list
 * of its lanes, so a directory added tomorrow is covered by default; bug 0249)
 * must stay honest:
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
 * Terminal folders that hold records — `completed/`, `fixed/`, plus
 * `work/spikes/` — are frozen: their links are still gated, their pointers are
 * not examined at all (bug 0253; the constant is `FROZEN` below, and what may
 * legitimately go in it is enforced by `scripts/lib/frozen-scope.mjs`, not by
 * this sentence). Exits non-zero on a live violation. Run:
 * `npm run check:corpus`.
 */
import { join, posix, relative, resolve, sep } from 'node:path'
import {
  and,
  areInTitleLinks,
  areLinked,
  areLive,
  corpus,
  correspondence,
  docs,
  fields,
  predicateHaveField,
  inDocuments,
  links,
  longestOf,
  matchTableRows,
  mentions,
  not,
  or,
  pointers,
  resideInFile,
  resideInFolder,
  rows,
  sections,
  vocabulary,
} from '@nielspeter/eess-md'
import { adrEnforcement } from '@nielspeter/eess-md/rules/adr'
import {
  collectResult,
  definePredicate,
  finishPreset,
  mergeCollectResults,
  parseExclusionComments,
  reportViolations,
} from '@nielspeter/eess'
import { matchSelections } from '@nielspeter/eess/internal'
import { isRepoNativeLink, siteOptsAreSafe, unclassifiedRoots } from './lib/corpus-link-routing.mjs'
import {
  declaredImplements,
  declaredImplementsLine,
  hasUnparseableImplements,
  hasUnparseableRuling,
  isAccepted,
  operativeRuling,
  PROPOSAL_DONE_FOLDERS,
  rulingsObliging,
  operativeRulingLine,
  proposalNumberFromPath,
} from './lib/proposal-ruling.mjs'
import { nonTerminalFreezes, frozenScopeRefusal } from './lib/frozen-scope.mjs'
import { laneDirectories } from './lib/lane-coverage.mjs'
// Extracted so the labels can be tested — they have been wrong twice in place.
import { pointerSummary } from './lib/pointer-classes.mjs'
import { LANES } from './lib/ledger-lanes.mjs'
import {
  LEFT_OUT,
  LEFT_OUT_REASON,
  RECORD_MENTION,
  SKIPPED_AFTER_TS_ARCHUNIT,
  TS_ARCHUNIT_LAST,
  leftOutFaults,
  mentionKey,
  notLeftOut,
  recordMentions,
  recordsOf,
} from './lib/record-mention.mjs'
import { recordKeyOfPath } from './lib/record-key.mjs'

// `fixed/` is the bugs lane's own done-folder (bug 0086) — frozen alongside
// the others so bug history is not held to today's code (its pointers are not
// examined; its links still are — see bug 0253 for why "reported" was wrong).
// `work/**`, not three lane globs (bug 0249).
//
// The lane list was written when three lanes were all `work/` held, and the
// corpus grew past it silently: seven documents sat outside every root,
// **including `work/README.md` — the corpus's own one-screen map**. Measured
// before the change: the gate's summary was byte-identical with and without
// them.
//
// A whole-directory root makes the default COVERED rather than uncovered, so the
// next directory someone adds is checked without anyone remembering to add it
// here. That is the fail-closed direction, and it is why this is not four more
// globs.
//
// No classification decision was required and none should be inferred: `work/`
// is already in `REPO_NATIVE_ROOTS`, so every glob under it inherits the
// repo-native profile. An earlier draft of 0249 claimed `unclassifiedRoots()`
// would refuse an unclassified addition and that strict was the likely answer —
// both measured false. Strict is the VitePress-site profile; prescribing it here
// would make `work/` the only region where a real directory link reds.
const ROOTS = ['work/**', 'adr/**', 'docs/**']
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

// `work/spikes/**` joins the terminal folders (bug 0249). The whole lane, not
// "concluded spikes" — the qualifier this comment used to carry was held by
// nothing, since the glob cannot see conclusion, and bug 0256 found the gap.
//
// It turns out the qualifier was also unnecessary. **A spike is terminal from
// its first commit**: it is one document saying what was measured, against what,
// on what date. There is no in-flight state in which the record exists but is
// not yet a report, so there is nothing for "concluded" to exclude.
//
// **The freeze is prospective, and saying so is the whole point.** An earlier
// version of this comment justified it by claiming spikes cite code this repo
// does not own. Measured: `work/spikes/` contains **zero** `path:line` pointers
// (648 corpus-wide, none in a spike), so the freeze suppresses nothing today —
// deleting this glob entry would change no violations. That is the same shape as
// the "concluded" qualifier it replaced: a justification the corpus does not
// bear out.
//
// What it is actually for is visible in spike 0001's own landing note, which
// records rewriting its single `path:line` citation into prose **so this
// mechanism would not catch it**. The population is empty because it was emptied
// by hand. And the hazard it was defusing was real: that citation pointed into
// another project's source and would have SUFFIX-MATCHED a local file, so the
// gate would have blessed it against the wrong one — bug 0254's hazard exactly.
// Freezing dissolves that for this lane, because a frozen document's pointers
// are not examined at all; the trap is unchanged for live documents (see the
// sanction comment below).
//
// So the freeze exists so the next spike need not hand-defuse anything: a dated
// report about something this build does not own cannot be held to today's line
// numbers without demanding the record be edited to stay green, which is the
// opposite of what a dated measurement is for.
//
// (Spike 0002 names a commit, `b4084c9`; spike 0001 names versions, 0.57.0 and
// 0.58.0. An earlier version of this comment said both named a commit.)
//
// See `docs/working-method.md`'s lane list for what a spike is.
//
// **Measured while adding this, and it corrects the contract's own wording.**
// `work/README.md` and the summary line both said frozen folders' drift is
// "reported, never gated". The pointer rule selects `.areLive()`, so a frozen
// document's pointers are not examined at all — nothing is reported. Gated is
// right; reported was never true. The summary now says what happens, and the
// gap is filed as bug 0253. Spike 0001's
// conclusion is dated 2026-08-08 against ts-archunit 0.58.0 and cites upstream
// paths; gating those as live pointers would demand it be kept current, which
// is the opposite of what a terminal record is for.
//
// `corpus()` refuses a frozen glob that marks no loaded document (bug 0499).
// No record under `work/` sits in a `wont-do/` or `archived/` folder yet, so those
// two are declared in `EMPTY_FROZEN` rather than removed: removed, the first
// record filed there would be read as live, and no rule over the frozen documents
// would see it. The declaration expires: once a record lands there, `corpus()`
// refuses until the glob is dropped from `EMPTY_FROZEN`.
const FROZEN = [
  '**/completed/**',
  '**/wont-do/**',
  '**/fixed/**',
  '**/archived/**',
  'work/spikes/**',
]
const EMPTY_FROZEN = ['**/wont-do/**', '**/archived/**']

// `frozen` is this gate's only subtraction, and until bug 0249's review nothing
// checked what it took. Appending `'work/**'` here drops live pointers from 463
// to 18 and still exits 0 — and the `work/`-rooted broken-link probe does not
// notice, because a frozen document's links are still gated. Same refuse-to-run
// shape as `unclassifiedRoots` above, and for the same reason: a corpus gate
// that silently examines 4% of what it claims is worse than one that will not
// start. See scripts/lib/frozen-scope.mjs.
const overBroadFreezes = nonTerminalFreezes(FROZEN)
if (overBroadFreezes.length > 0) {
  console.error(frozenScopeRefusal(overBroadFreezes))
  process.exit(1)
}

const c = corpus({
  roots: ROOTS,
  frozen: FROZEN,
  expectEmptyFrozen: EMPTY_FROZEN,
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

// Plan 0406 — an ADR that declares `**Extends:** [ADR-NNN](…)` is answered by a
// link back from the ADR it extends (an `**Extended by:**` line). Its own corpus
// over adr/ only, so plan 0405's declaration scan reads the ADRs and nothing else.
// No `.expectEmpty()`: a corpus whose every `Extends` label is gone examines zero
// and fails.
//
// What it cannot see, stated rather than implied (ADR-016 rule 7):
//  - a label written without its colon, `**Extends** [ADR-x](…)`, is not a label
//    to the grammar, so it is neither read nor reported (bug 0408). ADR-018 is
//    written that way; it is out of this rule because it is Proposed (plan 0406
//    keeps it out until ruled), and its colon-less line could not be read anyway;
//  - the declaration scan reports a label that differs in case or spacing, not
//    one spelt differently (`**Extend:**`);
//  - the reverse direction: an `**Extended by:**` line with no `**Extends:**`
//    behind it is not checked, and any link back answers, not only that line.
const extendsRule = links(corpus({ roots: ['adr/**'] }))
  .that()
  .areLabelled('Extends')
  .and()
  .haveLiveTargets()
  .should()
  .beLinkedBack()
  .rule({
    id: 'corpus/adr-extends-linked-back',
    because:
      'an ADR that extends another must be linked back by it, or the extended one reads as complete',
  })
const extendsViolations = extendsRule.violations()

// Plan 0468, dogfooding `fields()`: every live plan and bug writes its State in its lane's own
// words. The words are the lanes `check:ledger` reads (`./lib/ledger-lanes.mjs`), and the label
// grammar is the one the ledger reads (`packages/md/src/model/label.ts`): the two gates share both,
// though each keeps its own reader (the ledger's is bug 0444's). `longestOf` cuts the value at the
// state (`Draft — written …` is `Draft`); a state that is not a lane word stays whole and is
// reported. Whole documents, not the header region: the State line sits under a `## Status` section
// here. A State written in a shape the rule does not read (a `## State:` heading, a blockquote) is
// reported by `fields()` itself. One rule and one id per lane, so a finding names its lane.
const foldApostrophe = (v) => v.trim().replace(/’/g, "'")
// A lane's live records, from eess-md's public document predicates (plan 0457): not frozen, in the
// lane's folder, outside its done folders, and not one of its board files. The three rules below
// read it, lifted onto a record's State lines by `inDocuments` where the elements are lines.
const liveRecordIn = (lane) =>
  and(
    areLive(),
    resideInFolder(lane.roots[0]),
    not(or(...lane.doneFolders.map((f) => resideInFolder(`**${f}**`)))),
    not(or(...lane.boardFiles.map((b) => resideInFile(`**/${b}`)))),
  )
// Literal ids, so `check:nonvacuity`'s rule-id coverage reads both from this source.
const STATE_RULE_IDS = {
  plans: 'corpus/state-in-vocabulary-plans',
  bugs: 'corpus/state-in-vocabulary-bugs',
}
const stateRules = LANES.filter((lane) => lane.name === 'plans' || lane.name === 'bugs').map(
  (lane) => {
    const words = [...lane.states]
    const rule = fields(c, { label: 'State', forms: ['bold'], value: longestOf(words) })
      .that()
      .satisfy(inDocuments(liveRecordIn(lane)))
      .should()
      .resolveAgainst(vocabulary(c, { terms: words, normalize: foldApostrophe }))
      .rule({
        id: STATE_RULE_IDS[lane.name],
        because: `a ${lane.name} record's State is read by the ledger only in the lane's own words`,
        suggestion: `write the State as one of: ${words.join(', ')}`,
      })
    return { lane: lane.name, result: rule.violations() }
  },
)
// Plan 0469, dogfooding `haveField`: every live plan and bug HAS a State, in the bold form. The rule
// above checks the words of the States it finds; this one reds a record that carries none, which
// `honestyAtClose` counts but never refuses (bug 0444). One State per record, or it is a conflict.
// Plan 0505: read inside the record's `## Status` section, where every live record writes it (229
// of 229 on 2026-10-19), so a State written anywhere else is reported rather than read.
const statePresentRule = docs(c)
  .that()
  .satisfy(
    or(...LANES.filter((lane) => lane.name === 'plans' || lane.name === 'bugs').map(liveRecordIn)),
  )
  .should()
  .haveField({ label: 'State', forms: ['bold'], region: { section: 'Status' } })
  .rule({
    id: 'corpus/state-present',
    because: 'a record with no State is counted by the ledger and never refused (bug 0444)',
    suggestion: "write the record's State as `- **State:** <word>` under its `## Status` section",
  })
const statePresent = statePresentRule.violations()

// Plan 0486, dogfooding `predicateHaveField` in selector position (ADR-021): no plan or bug whose State is a
// closing word sits in a live folder, since the close ritual moves it. One rule over both lanes, as
// `or()` of `and()`s, so a record whose State cannot be read (given twice, empty, in a form this rule
// does not read) is undecided and reported on this rule's id rather than dropped, through the
// kernel's three-valued combinators. A State outside the vocabulary is decided false here: the
// per-lane `corpus/state-in-vocabulary-*` rules above report it.
const closingStateIn = (lane) =>
  predicateHaveField({
    label: 'State',
    forms: ['bold'],
    value: longestOf([...lane.states]),
    oneOf: new RegExp(`^(${lane.terminalStates.join('|')})$`),
  })
const closedLiveRule = docs(c)
  .that()
  .satisfy(
    or(
      ...LANES.filter((lane) => lane.name === 'plans' || lane.name === 'bugs').map((lane) =>
        and(liveRecordIn(lane), closingStateIn(lane)),
      ),
    ),
  )
  .should()
  .notExist()
  .rule({
    id: 'corpus/closed-records-sit-in-done-folders',
    because: "a closed record left in a live folder reads as open work (the close ritual's move)",
    suggestion: "move the record to its lane's done folder, or correct its State",
  })
const closedLive = closedLiveRule.violations()

// Plan 0459, dogfooding `beUniqueBy` (proposal 017, block 13): no record number under `work/` is
// claimed twice. A directory-form record (`work/spikes/0001-…/README.md`) is keyed by its folder.
// The digits are read as written, so `066` and `0066` stay distinct: one sequence per number width.
// `check:numbers` (the kit's script, which may not depend on eess) states the same judgement; the
// double gate is deliberate. Not filtered by `isProbeArtifact`, or its non-vacuity probe would be
// invisible to it.
const recordNumber = (d) => /(?:^|\/)(\d{3,4})-[^/]*(?:\/README)?\.md$/.exec(d.relPath)?.[1] ?? ''
const recordNumbers = docs(c)
  .that()
  .resideInFolder('work/**')
  .and()
  .satisfy({ description: 'are numbered records', test: (d) => recordNumber(d) !== '' })
  .should()
  .beUniqueBy(recordNumber, 'record number')
  .rule({
    id: 'corpus/record-number-unique',
    because: 'a number names one record; two records under one number make a citation ambiguous',
    suggestion: 'renumber the newer record with `npm run next-number`',
  })
  .violations()

// Plan 0556, dogfooding `agreeWithPath` (proposal 017, block 16): each record's number agrees in its
// file name and in its title, one rule per lane, compared as exact strings. Selected by lane folder
// less its board, so a misnamed record is a finding (its path holds no number), never dropped. A
// numbered folder's files are read by the folder's number (the leftmost numbered segment, so a numbered
// file inside a numbered folder would be read by the folder's; none exists). Two forms of one record each are read on
// purpose: bug 0144's number followed by a parenthesis (the bugs pattern's word boundary), and spike
// 0001's `CONCLUSION.md` titled with a dash, which is pinned as left out of the mention rule and so
// not retitled. Not filtered by `isProbeArtifact`, or its non-vacuity probes would be invisible to it.
const recordPathPattern = (digits) =>
  new RegExp(String.raw`(?:^|\/)(?<value>\d{${String(digits)}})-[^/]*(?:\/[^/]+)?\.md$`)
const NUMBER_IN_TITLE_LANES = [
  { lane: 'adr', folder: 'adr/**', board: undefined, digits: 3, title: /^ADR-(?<value>\d{3}):/ },
  {
    lane: 'bugs',
    folder: 'work/bugs/**',
    board: 'work/bugs/BUGS.md',
    digits: 4,
    title: /^Bug (?<value>\d{4})\b/,
  },
  {
    lane: 'plans',
    folder: 'work/plans/**',
    board: 'work/plans/ROADMAP.md',
    digits: 4,
    title: /^Plan (?<value>\d{4}):/,
  },
  {
    lane: 'spikes',
    folder: 'work/spikes/**',
    board: undefined,
    digits: 4,
    title: /^Spike (?<value>\d{4})(?::| —)/,
  },
  {
    lane: 'proposals',
    folder: 'work/proposals/**',
    board: 'work/proposals/PROPOSALS.md',
    digits: 3,
    title: /^Proposal (?<value>\d{3})\b/,
  },
]
const numberInTitle = NUMBER_IN_TITLE_LANES.map((l) => {
  const lane = docs(c).that().resideInFolder(l.folder)
  const selected = l.board === undefined ? lane : lane.and().satisfy(not(resideInFile(l.board)))
  return {
    lane: l.lane,
    result: selected
      .should()
      .agreeWithPath({ path: recordPathPattern(l.digits), title: l.title })
      .rule({
        id: 'corpus/record-number-in-title',
        because:
          'a record names its number twice, in its file name and in its title, and the two drift',
        suggestion: "rename the file or correct the title, so both carry the record's number",
      })
      .violations(),
  }
})
// The lanes above are a hand-written list, so a numbered record that none of them selects is a
// finding, one per record: a lane dropped from the list, or a lane added without a rule, is red, not
// a smaller count on the summary line. ADRs are read by their own number, as the adr lane reads them.
const inATitleLane = or(...NUMBER_IN_TITLE_LANES.map((l) => resideInFolder(l.folder)))
const outsideTitleLanes = docs(c)
  .that()
  .satisfy({
    description: 'are numbered records',
    test: (d) => recordNumber(d) !== '' || /^adr\/\d{3}-[^/]*\.md$/.test(d.relPath),
  })
  .and()
  .satisfy(not(inATitleLane))
  .should()
  .notExist()
  .rule({
    id: 'corpus/record-number-in-title-lanes',
    because: 'a numbered record in no title lane is never judged by corpus/record-number-in-title',
    suggestion:
      "add the record's lane to NUMBER_IN_TITLE_LANES in scripts/check-corpus.mjs, with the lane's title pattern",
  })
  .violations()
const numberInTitleFindings = [...numberInTitle.flatMap((r) => [...r.result]), ...outsideTitleLanes]

// Plan 0495, dogfooding `agreeWithFolder` (proposal 017, block 5): a lane's done folders hold only
// its done values, folder → value, one rule per lane. The selection is the done folders, so a closed
// record in a live folder stays `corpus/closed-records-sit-in-done-folders`' and neither rule reports
// the other's fact. The live words are a `'rest'` group, so an open State in a done folder says
// "belongs outside" (F2), a word in no group is a misspelling (F3), and a record with no State is F4.
// The done folders that do not exist (`work/plans/wont-do/`, `work/plans/archived/`) get no group:
// F7 would refuse a glob that matches nothing, so `Won't-do` is a value in no group here until the
// lane first files there. `work/proposals/rejected/` got its group with its first record, proposal
// 018, on 2026-10-21.
// Proposals read the header region: two keep their original submission's State further down.
// Literal ids, so `check:nonvacuity`'s rule-id coverage reads them from this source.
const DONE_FOLDER_RULES = [
  {
    id: 'corpus/done-folders-hold-done-values-plans',
    lane: 'plans',
    select: 'work/plans/completed/**',
    region: undefined,
    groups: [
      { values: ['Draft', 'Ready', 'Open'], folders: 'rest' },
      { values: ['Done'], folders: ['work/plans/completed/**'] },
    ],
  },
  {
    id: 'corpus/done-folders-hold-done-values-bugs',
    lane: 'bugs',
    select: 'work/bugs/{fixed,rejected}/**',
    region: undefined,
    groups: [
      { values: ['Draft', 'Ready', 'Parked'], folders: 'rest' },
      { values: ['Fixed'], folders: ['work/bugs/fixed/**'] },
      { values: ['Rejected'], folders: ['work/bugs/rejected/**'] },
    ],
  },
  {
    id: 'corpus/done-folders-hold-done-values-proposals',
    lane: 'proposals',
    select: 'work/proposals/{promoted,rejected}/**',
    region: 'header',
    groups: [
      { values: ['Draft'], folders: 'rest' },
      { values: ['Promoted'], folders: ['work/proposals/promoted/**'] },
      { values: ['Rejected'], folders: ['work/proposals/rejected/**'] },
    ],
  },
]
const doneFolderResults = DONE_FOLDER_RULES.map((r) => {
  const words = [...LANES.find((lane) => lane.name === r.lane).states]
  return docs(c)
    .that()
    .resideInFolder(r.select)
    .should()
    .agreeWithFolder({
      field: {
        label: 'State',
        forms: ['bold'],
        value: longestOf(words),
        ...(r.region === undefined ? {} : { region: r.region }),
      },
      groups: r.groups,
      direction: 'right-to-left', // folder → value
      normalize: foldApostrophe,
    })
    .rule({
      id: r.id,
      because: `a ${r.lane} record in a done folder reads as closed, so its State must say so`,
      suggestion: 'move the record to the folder its State belongs in, or correct its State',
    })
    .violations()
})
const doneFolderViolations = doneFolderResults.flatMap((r) => [...r])
const stateResults = stateRules.map((r) => r.result)
const stateViolations = stateResults.flatMap((r) => [...r])

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
// proposals promote: freezing `promoted/`, or every accepted proposal being
// dispatched, would take this to 0 while still printing a green summary. Devops
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
const UNPROMOTABLE_RULINGS = rulingsObliging('unfinished')

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

// ---- Plan 0218: a proposal states its acceptance criteria ------------------
//
// `PROPOSALS.md`'s template requires, per capability, the break class — the
// specific corruption that must produce a violation — and how non-vacuity is
// kept. Nothing checked it, and proposal 006 shipped without the section at all,
// which its own review recorded as a defect it committed.
//
// EVERY proposal, with no exclusions. An earlier version of this rule exempted
// terminal records and those ruled `Rewrite needed`/`Reject`, on arguments that
// were reasonable in isolation — closed history should not be rewritten; a
// document the review already found deficient should not be re-audited. Measured
// with the exemptions removed, they were shielding three real records (003, 004,
// 005), which is grandfathering by another name. All three were made to comply
// instead, which is how `adrEnforcement` was adopted: zero exemptions, and all
// ten ADRs carry their table because someone wrote them.
//
// Depth matters: proposal 005 carried four `### Acceptance criteria (…)` headings inside
// superseded appendices, and a name-only rule would be satisfied by a heading at any level. Plan
// 0496 gave `haveSection` a `depth`, so the rule is eess-md's own, not a hand check of
// `d.sections`. Its name is the sentence-case string, not a case-insensitive pattern: a heading in
// title case (`## Acceptance Criteria`) is named in the rule's finding as a near miss, once, and a
// `### Acceptance criteria` in a proposal is named with its depth.
const isLiveProposal = {
  description: 'are live proposals',
  test: (d) => !d.frozen && isProposalDoc(d),
}
const criteriaRule = docs(c)
  .that()
  .satisfy(isLiveProposal)
  .should()
  .haveSection('Acceptance criteria', { depth: 2 })
  .rule({
    id: 'corpus/proposal-states-no-acceptance-criteria',
    because:
      'a capability with no stated break class is unfalsifiable, and this lane requires the ' +
      'section per capability; corpus/proposal-acceptance-criteria-empty reads what is under it.',
    suggestion:
      'add a "## Acceptance criteria" section stating, per capability, the break class — ' +
      'the specific corruption that must produce a violation — and how non-vacuity is kept.',
  })
const criteriaViolations = criteriaRule.violations()
// PR #252's enforcement review: the heading alone was all the rule above proved, so an empty section
// passed. Plan 0522's `haveContent()` reads under it, in the same live proposals.
const criteriaContentRule = sections(c)
  .that()
  .areNamed('Acceptance criteria')
  .and()
  .areAtDepth(2)
  .and()
  .satisfy(inDocuments(isLiveProposal))
  .should()
  .haveContent()
  .rule({
    id: 'corpus/proposal-acceptance-criteria-empty',
    because:
      'an empty acceptance-criteria section states no break class, so it satisfies the convention in name only',
    suggestion:
      'state, per capability, the break class and how non-vacuity is kept, under the heading',
  })
const criteriaContentViolations = criteriaContentRule.violations()

// No zero-guard here, and that is a consequence of removing the exclusions
// rather than an omission. The rule's selection IS `liveDocs.filter(isProposalDoc)`,
// so "zero subjects while proposals exist" is unreachable by construction — the
// earlier version's guard was only satisfiable because the exclusions could
// narrow a non-empty lane to nothing. A guard that cannot fire is worth less
// than no guard (ADR-009), so it was deleted with them.
//
// The ADR-010 evidence is the denominator instead: the summary prints
// `N criteria-checked`, the receipt's `examined`, and N is every live proposal. A zero there means the
// selector or the roots are broken, which is visible rather than guarded.

// ---- Plan 0218: a ruling that names a remedy names an owner ----------------
//
// `Docs-only` says "the capability ships; write the docs" — it names a remedy
// and creates no owner, so the remedy evaporates. Measured: proposal 004 was
// ruled `Docs-only` on 2026-08-13 and ten days later none of the documentation
// existed, with every gate green and the proposal's header reading as settled.
// Bug 0219 fixed that instance; this is the recurrence.
const NAMES_A_REMEDY = rulingsObliging('needs-an-owner')
const docsOnlyProposals = allDocs.filter(
  (d) => isProposalDoc(d) && NAMES_A_REMEDY.has(operativeRuling(d.text)),
)
const docsOnlyOwnerViolations = docsOnlyProposals.flatMap((d) => {
  const n = proposalNumberFromPath(d.relPath)
  if (n !== null && (ownersByProposal.get(n) ?? []).length > 0) return []
  return [
    {
      rule: 'correspondence',
      ruleId: 'corpus/docs-only-ruling-names-no-owner',
      element: `proposal ${n === null ? d.relPath : pad3(n)}`,
      file: d.file,
      line: operativeRulingLine(d.text),
      message:
        `${d.relPath} is ruled "Docs-only", which names a remedy, but no plan or bug ` +
        `declares "**Implements:** proposal ${n === null ? 'NNN' : n}" to own it`,
      because:
        'a ruling that names a remedy and no owner is a remedy nothing tracks — measured on ' +
        'proposal 004, whose documentation went ten days unwritten with every gate green',
      suggestion: 'file the plan or bug that does the work and declare it there.',
      codeFrame: undefined,
    },
  ]
})

// ─── work/README.md's Lanes table ↔ the real directories under work/ ─────────
//
// Bug 0108: the repo's own one-screen map listed ONE lane and called the rest
// cargo-cult while four existed. That is a markdown table making a checkable
// claim about directories — the case `rows()` + a correspondence exist for, and
// the pattern `spec.rules.ts` already uses for the README packages table and the
// CLAUDE.md ADR index. The map was the least-gated document in a corpus whose
// thesis is that specs are checked, and it IS a spec.
//
// **Ground truth is every top-level directory**, not "every directory that looks
// like a lane". A cleverer test was available — `check-ledger.mjs` decides
// lane-ness by whether a directory carries `State:`-shaped records — and it is
// the wrong one here: `work/spikes/` carries none (a spike concludes, it does not
// close; bug 0256), so that test would exempt the very lane whose absence from
// this map was the last thing anyone noticed. A directory the map does not
// mention is exactly the gap, whatever is in it.
//
// `section:` is load-bearing, not decoration. `rows()` draws from every table
// that matches, so without it ANY table carrying a `Lane` column contributes —
// review measured an emptied Lanes table plus a decoy table elsewhere printing
// "the map lists every lane" over zero real rows, exit 0. That is the identical
// hole the board rule above (`section: /^Board$/`) records being measured and
// closed; this rule reproduced it and now carries the same guard, plus a
// fixture that reds on exactly that sabotage.
//
// The corpus is scoped to the one document that carries the map: lane-ness is a
// claim this file makes, not a shape any document may assert. (Since plan 0457
// a `rows()` rule can also be scoped per document, with
// `inDocuments(resideInFile('work/README.md'))`; this rule keeps its own corpus.)
const laneDirs = laneDirectories(join(c.root, 'work'))
const lanesCorpus = corpus({ roots: ['work/README.md'] })

/** "`plans/`" → "plans". The parser hands the cell over with its link stripped. */
const laneName = (cell) =>
  String(cell ?? '')
    .replace(/`/g, '')
    .replace(/\/+$/, '')
    .trim()

const laneRowSelection = rows(lanesCorpus, {
  section: /^Lanes$/,
  columns: { lane: /^Lane$/ },
}).select({
  label: 'Lanes table row',
  identify: (r) => ({ name: laneName(r.get('lane')), file: r.doc.relPath, line: r.line }),
})
const laneRows = laneRowSelection.elements
// A directory has no line of its own to report; point at the table it is
// missing from, not at the document's first line.
const laneTableLine = laneRows[0]?.line ?? 1

const lanesMatchDirectories = correspondence({
  left: laneRowSelection,
  right: {
    elements: laneDirs,
    label: 'work/ lane directory',
    identify: (d) => ({ name: d, file: 'work/README.md', line: laneTableLine }),
  },
  keyBy: { left: (r) => laneName(r.get('lane')), right: (d) => d },
  suggest: {
    left: (info) => `remove the row, or create work/${info.name}/ if the lane is real`,
    right: (info) =>
      `add a row for \`${info.name}/\` naming its board and its terminal subfolders, ` +
      `or remove work/${info.name}/ if it is not a lane`,
  },
})
  .should()
  .beComplete({ direction: 'both' })
  .because(
    'work/README.md is the map a fresh agent reads first: a lane missing from it is a ' +
      'lane nobody is told about, and a row naming nothing sends a reader to a ' +
      'directory that does not exist',
  )
  .rule({ id: 'corpus/lanes-match-directories' })

const lanesDoc = allDocs.find((d) => d.relPath === 'work/README.md')

// The rung the two-sided join cannot express (ADR-010, and the same ladder the
// board rule carries). Zero rows makes EVERY directory unmatched, so the
// correspondence would report N "add a row" findings against a table that
// already has them — a remedy that cannot work, and which duplicates every row
// if followed. Name the instrument, not the subject.
const laneViolations =
  laneRows.length === 0 && laneDirs.length > 0
    ? [
        {
          rule: 'correspondence',
          ruleId: 'corpus/lane-table-unreadable',
          element: 'work/README.md',
          file: lanesDoc?.file ?? resolve(c.root, 'work/README.md'),
          line: 1,
          message:
            lanesDoc === undefined
              ? `work/README.md is not in the corpus, so none of the ${laneDirs.length} ` +
                'directories under work/ was checked against the map — the map is the ' +
                'document, and it is gone'
              : 'the Lanes table matched no rows: no table under a `## Lanes` heading has a ' +
                `\`Lane\` column, so none of the ${laneDirs.length} directories under work/ ` +
                'was checked against the map',
          suggestion:
            lanesDoc === undefined
              ? 'restore work/README.md, or — if the map genuinely moved — repoint this rule ' +
                'and `ROOTS` at its new home together.'
              : 'restore the `## Lanes` heading and the `Lane` column header — the lane rows ' +
                'themselves may be intact; this rule could not see them to check.',
          codeFrame: undefined,
        },
      ]
    : lanesMatchDirectories.violations()

// Plan 0541: this repository's record mentions are gated. A mention of a bug, plan, spike,
// proposal or ADR by number is a link (plan 0539's `mentions().beLinked()`), over every root,
// frozen documents included: a done folder is frozen, and leaving it out would turn every close
// into a paydown. Plan 0542 brought the corpus to zero, so every unlinked mention is red, whatever
// any base holds (its Phase 9). A record naming itself is not a mention (`./lib/record-key.mjs`).
// The pattern, ts-archunit's range and the seven fold-era records left out are
// `./lib/record-mention.mjs`'s.
//
// What this does not catch, by design: an invisible character inside a mention (bug 0543); a number
// in ts-archunit's range written right after `ts-archunit` or `ts-archunit's`, which is that
// project's own numbering and never linked (the summary counts them; a number past the range is
// read like any other); and any mention in the eight files of the seven fold-era records left out,
// which are pinned by hash so that an edit to one is red.
const RECORD_MENTION_RULE = 'corpus/record-mention-is-a-link'
const recordMentionRule = (corp) =>
  recordMentions(corp).should().beLinked().rule({
    id: RECORD_MENTION_RULE,
    because: 'a record named by number is one click from what it names only when it is a link',
  })

const posixRel = (root, file) => relative(root, file).split(sep).join('/')

// The records a mention can name, eess's own (plan 0542, Decision 1), each with its file. Two
// records with one key (`338-` and `0338-`, or two in `adr/`, which `corpus/record-number-unique`
// and `check:numbers` do not reach) are a finding below, and neither is offered as a remedy: a
// mention of that number names neither.
const recordList = recordsOf(c.fileIndex)
const recordsByKey = new Map()
for (const r of recordList) recordsByKey.set(r.key, [...(recordsByKey.get(r.key) ?? []), r.target])
const recordTargets = new Map(
  [...recordsByKey].filter(([, ts]) => ts.length === 1).map(([key, [target]]) => [key, target]),
)
const sharedKeys = [...recordsByKey].filter(([, ts]) => ts.length > 1)
/** The relative link from a document to a record's file, as the fix writes one. */
function hrefTo(fromRel, target) {
  const href = posix.relative(posix.dirname(fromRel), target)
  return href.startsWith('.') ? href : `./${href}`
}
/** When two records share a mention's key, the remedy that says so; else `undefined`. */
function sharedKeyRemedy(m) {
  const shared = recordsByKey.get(mentionKey(m))
  return shared !== undefined && shared.length > 1
    ? `Two records share this number (${shared.join(' and ')}): give each its own number, then link the one it names.`
    : undefined
}

// `beLinked()`'s two findings for a mention outside a link, told apart from every other finding by
// rule id. Any other finding of the rule (an unread mention, ADR-021; the vacuity finding, ADR-010;
// a configuration finding) keeps its own remedy.
const MENTION_TEXT = /^"([^"]+)" is (?:not a link|in inline code, not a link)$/
const QUOTED =
  'A quoted example goes in a fenced code block, which is not read; a mention takes no waiver here.'

/**
 * The remedy for one unlinked mention, chosen by its cause (plan 0542, Phase 9): a number naming no
 * eess record, one naming an eess record past ts-archunit's range, or one inside that range, where
 * the writer must say which project's record it is.
 */
function mentionRemedy(text, fromRel, inCode) {
  RECORD_MENTION.lastIndex = 0
  const m = RECORD_MENTION.exec(text)
  if (m === null) return `Link it to the record it names. ${QUOTED}`
  const kind = m.groups.kind.toLowerCase()
  const inRange = Number(m.groups.n) <= TS_ARCHUNIT_LAST[kind]
  const shared = sharedKeyRemedy(m)
  if (shared !== undefined) return `${shared} ${QUOTED}`
  const target = recordTargets.get(mentionKey(m))
  const tsForm = `ts-archunit ${text}` // straight apostrophe for the possessive: ts-archunit's
  if (target === undefined)
    return inRange
      ? `No eess record has this number. If it is ts-archunit's record, write it as "${tsForm}" ` +
          `(or "ts-archunit's ${text}", with a straight apostrophe), which is never linked; if not, ` +
          `correct the number. ${QUOTED}`
      : `No eess record has this number, and ts-archunit's numbering never reached it: correct ` +
          `the number. ${QUOTED}`
  const link = `[${text}](${hrefTo(fromRel, target)})`
  const linkIt = inCode ? `Take it out of the code span and link it: ${link}.` : `Link it: ${link}.`
  return inRange
    ? `${linkIt} If it means ts-archunit's record of that number instead, write ` +
        `"${tsForm}", which takes the mention out of every check. ${QUOTED}`
    : `${linkIt} ts-archunit's numbering never reached this number, so it is eess's ` +
        `record, and writing "ts-archunit" before it does not skip it. ${QUOTED}`
}

const mentionViolations = recordMentionRule(c).violations()
const recordMentionFindings = []
let unlinkedMentions = 0
for (const v of mentionViolations) {
  const text = v.ruleId === RECORD_MENTION_RULE ? MENTION_TEXT.exec(v.message)?.[1] : undefined
  if (text === undefined) {
    recordMentionFindings.push(v)
    continue
  }
  unlinkedMentions += 1
  recordMentionFindings.push({
    ...v,
    suggestion: mentionRemedy(text, posixRel(c.root, v.file), v.message.includes('in inline code')),
    bypassFilters: true,
  })
}

const configFinding = (ruleId, file, line, message, suggestion) => ({
  rule: 'record-mention',
  ruleId,
  element: posixRel(c.root, file) || '.',
  file,
  line,
  message,
  suggestion,
  bypassFilters: true,
  codeFrame: undefined,
})

// No waiver for either rule here (the mention rule and the target join below): under this script
// nothing discloses what a waiver suppressed (bug 0537). Read through the kernel's own directive
// parser, so every form counts.
const RECORD_TARGET_RULE = 'corpus/record-mention-target'
for (const d of allDocs) {
  for (const x of parseExclusionComments(d.text, d.file).exclusions) {
    if (x.ruleId !== RECORD_MENTION_RULE && x.ruleId !== RECORD_TARGET_RULE) continue
    recordMentionFindings.push(
      configFinding(
        'corpus/record-mention-waiver',
        d.file,
        x.line,
        `${d.relPath}:${String(x.line)} waives ${x.ruleId}, which takes no waiver here.`,
        'Remove the directive. Link the mention, or move a quoted example into a fenced code block.',
      ),
    )
  }
}
for (const [key, targets] of sharedKeys) {
  recordMentionFindings.push(
    configFinding(
      'corpus/record-mention-key-shared',
      join(c.root, targets[0]),
      1,
      `${targets.join(' and ')} are both the record ${key}, so a mention of it names neither, and the link a remedy would give is a guess.`,
      'Give each record its own number; a number is compared as a number, so 338 and 0338 are one.',
    ),
  )
}
// Plan 0542, Decision 3: a left-out file is left out because it is not edited again, so a file that
// is gone or changed since it was pinned is red. The exemption cannot outlive its premise, and a
// mention added to one cannot hide there.
const leftOut = leftOutFaults(c.root)
for (const { path, cause } of leftOut) {
  recordMentionFindings.push(
    configFinding(
      'corpus/record-mention-left-out',
      join(c.root, path),
      1,
      cause === 'missing'
        ? `the record-mention rule leaves out ${path}, which names no file (left out as ${LEFT_OUT_REASON}).`
        : `the record-mention rule leaves out ${path}, whose text changed since it was pinned: it is left out as ${LEFT_OUT_REASON}.`,
      cause === 'missing'
        ? 'If the record moved, update its path in LEFT_OUT (scripts/lib/record-mention.mjs) and in its pinning test; if it was removed, remove the entry from both.'
        : 'Revert the edit (a link repaired after a move does not unpin the file: destinations are not hashed); or, if the record is to change, take it off LEFT_OUT and its pinning test, so its mentions are judged like any other. A deliberate edit that adds no record mention may instead update the hash, with a dated comment at the entry and, in the PR, the record-mention count before and after.',
    ),
  )
}

// Plan 0542, Phase 9: a linked mention opens the record it names. Plan 0549's join, over eess's own
// records (Decision 1) and the same mentions the rule above reads (a record naming itself and the
// left-out files excluded): `beComplete` reds a mention naming no record where its link points,
// `preserveRelations` one whose link opens another record. A link to this repository on GitHub is
// read as the file it names; any other URL is no record of eess's. A board row whose link text is its
// target's whole title is not judged (`areInTitleLinks`): it quotes another record because the
// title does.
//
// What it cannot see: a link to a record whose number ts-archunit also used, written to the wrong
// project's record before plan 0542's lanes judged theirs (bug 0553); and a mention written after
// `ts-archunit` in ts-archunit's range, which the pattern skips.
const OWN_URL = /^https:\/\/github\.com\/nielspeter\/eess\/(?:blob|tree)\/[^/]+\/([^#?]*)/i
const TITLE_LINK = areInTitleLinks({
  linkPrefix: /^\d{4} — /,
  titlePrefix: /^(Plan|Bug) \d{4}: /,
})
/** A URL-encoded path, decoded; as written when it does not decode, so one bad link aborts nothing. */
function decoded(path) {
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}
/**
 * Where a mention's link points: `local` and a repository path, `elsewhere` and its URL, or `none`
 * for a mention outside a link (the join selects none, but a selection that did must not throw).
 */
function pointsAt(m) {
  const link = m.link
  if (link === undefined) return { source: 'none', at: '' }
  const target = link.target
  switch (target.kind) {
    case 'external': {
      const own = OWN_URL.exec(link.url)?.[1]
      return own === undefined
        ? { source: 'elsewhere', at: link.url }
        : { source: 'local', at: decoded(own) }
    }
    case 'self':
      return { source: 'local', at: m.doc.relPath }
    case 'missing':
      return { source: 'local', at: target.tried[0] ?? link.url }
    default:
      return { source: 'local', at: target.path }
  }
}
const namedMention = (m) => `${m.doc.relPath}:${String(m.line)} "${m.text}"`
const judgedLinks = recordMentions(c)
  .and()
  .satisfy(areLinked())
  .and()
  .satisfy(not(TITLE_LINK))
  .select({
    label: 'linked record mention',
    identify: (m) => ({ name: namedMention(m), file: m.doc.file, line: m.line }),
  })
const judgedByName = new Map(judgedLinks.elements.map((m) => [namedMention(m), m]))
// Every linked mention, to say how many the title-link exemption took out of the join.
const linkedMentionCount = recordMentions(c)
  .and()
  .satisfy(areLinked())
  .select({ label: 'linked record mention', ...anon }).elements.length
/**
 * The remedy for a linked mention the join reds, chosen by cause as `mentionRemedy` chooses: where
 * the link opens, whether any eess record has the number, and whether it is inside ts-archunit's
 * range, where the mention may mean ts-archunit's record and is then written unlinked.
 */
function targetRemedy(name) {
  const m = judgedByName.get(name)
  if (m === undefined) return 'Link it to the record it names.'
  const shared = sharedKeyRemedy(m)
  if (shared !== undefined) return shared
  const kind = m.groups.kind.toLowerCase()
  const inRange = Number(m.groups.n) <= TS_ARCHUNIT_LAST[kind]
  const target = recordTargets.get(mentionKey(m))
  const opens = pointsAt(m)
  const where =
    opens.source === 'elsewhere'
      ? `It opens ${opens.at}, which is no eess record.`
      : `It opens ${opens.at}.`
  const tsArchunit = `write "ts-archunit ${m.text}" as text, outside the link, which takes it out of every check`
  if (target === undefined)
    return inRange
      ? `${where} No eess record has this number: if it is ts-archunit's record, ${tsArchunit}; if not, correct the number.`
      : `${where} No eess record has this number, and ts-archunit's numbering never reached it: correct the number, or remove the link.`
  const link = `[${m.text}](${hrefTo(m.doc.relPath, target)})`
  return (
    `${where} Link it to the record it names: ${link}.` +
    (inRange
      ? ` If it means ts-archunit's record of that number instead, ${tsArchunit}.`
      : " ts-archunit's numbering never reached this number, so it is eess's record.") +
    " If the link's text quotes the target's title, write the title whole, or move the mention out of the link."
  )
}
const targetViolations = correspondence({
  left: judgedLinks,
  right: { elements: recordList, label: 'record', identify: (r) => ({ name: r.key }) },
  keyBy: { left: (m) => `${pointsAt(m).source}|${mentionKey(m)}`, right: (r) => `local|${r.key}` },
  suggest: {
    // Link the record the mention names; a title is never what is wrong.
    left: (info) => targetRemedy(info.name),
  },
})
  .should()
  .beComplete({ direction: 'left-to-right' })
  .andShould()
  .preserveRelations({
    left: (m) => [pointsAt(m).at],
    right: (r) => [r.target],
    direction: 'left-to-right',
  })
  .expectNonEmpty()
  .rule({
    id: RECORD_TARGET_RULE,
    because: 'a link that names one record and opens another sends its reader to the wrong place',
  })
  .violations()
// `preserveRelations` takes no suggestion, so a crossed link gets the remedy here.
const targetFindings = targetViolations.map((v) => ({
  ...v,
  suggestion: v.suggestion ?? targetRemedy(v.element),
  bypassFilters: true,
}))

// The records the list leaves out, not its files: spike 0001 is two documents, and the fold audit
// is a record of its own though no numbered one.
const leftOutRecords = new Set(LEFT_OUT.map((e) => recordKeyOfPath(e.path) ?? e.path)).size

// What the lookbehind skips is counted, so a mention written after `ts-archunit` is visible even
// though no rule judges it (plan 0542, Phase 1).
const skippedAfterTsArchunit = mentions(c, { pattern: SKIPPED_AFTER_TS_ARCHUNIT })
  .that()
  .satisfy(notLeftOut)
  .select({ label: 'skipped mention', ...anon }).elements.length

const proposalDocsCount = liveDocs.filter(isProposalDoc).length
const planDocsCount = liveDocs.filter(isPlanDoc).length

// **One receipt, built once, used by BOTH exits.**
//
// Each member carries the denominator ITS OWN check ran over — never a shared
// count, and never the corpus size. `mergeCollectResults` is fail-closed per
// member, so a check that goes quiet is named rather than absorbed by the
// others; bundling several under one number would put them back where a summed
// total had them, which is the whole thing plan 0235 exists to remove.
//
// The `--format json` branch used to be built here from a bare array and exit
// before any of this ran. Under ADR-014 that array reached `reportViolations`
// with no evidence, so on a CLEAN corpus the machine-readable path emitted a
// fabricated finding with `"examined": 0` and then threw. Every fixture missed
// it: they assert exit 1 on violating input, and an uncaught throw exits 1 too.
const receipt = mergeCollectResults([
  collectResult(broken, { examined: linksChecked }),
  collectResult(stale, { examined: pointersChecked }),
  collectResult(adrViolations, { examined: adrDocs.length }),
  collectResult([...extendsViolations], { examined: extendsViolations.examined }),
  collectResult(proposalPlanViolations, { examined: acceptedProposalCount }),
  collectResult(boardRulingViolations, { examined: boardRowsExamined }),
  collectResult(promotedViolations, { examined: promotedProposals.length }),
  collectResult(acceptedDenominatorViolations, { examined: proposalDocsCount }),
  collectResult([...criteriaViolations], { examined: criteriaViolations.examined }),
  collectResult([...criteriaContentViolations], { examined: criteriaContentViolations.examined }),
  collectResult(docsOnlyOwnerViolations, { examined: docsOnlyProposals.length }),
  collectResult(unparseableRulingViolations, { examined: proposalDocsCount }),
  collectResult(unparseableImplementsViolations, { examined: planDocsCount }),
  collectResult(danglingImplementsViolations, { examined: planDocsCount }),
  collectResult(laneViolations, { examined: laneRows.length }),
  // Plan 0541: the mentions the rule examined, its own denominator.
  collectResult(recordMentionFindings, { examined: mentionViolations.examined }),
  // Plan 0542, Phase 9: the links the target join judged, its own denominator.
  collectResult(targetFindings, { examined: targetViolations.examined }),
  ...stateResults.map((r) => collectResult([...r], { examined: r.examined })),
  collectResult([...statePresent], { examined: statePresent.examined }),
  // Its own receipt (ADR-010): zero examined over `.notExist()` is a declaration, and an undecided
  // record is a finding, so nothing is borrowed from `state-present`.
  closedLive,
  // Its own receipt: one value per numbered record (ADR-010).
  recordNumbers,
  // Plan 0556: one member per lane, each its own selection.
  ...numberInTitle.map((r) => r.result),
  outsideTitleLanes,
  ...doneFolderResults,
])

// ADR-008: this script owns its reporting on the terminal path, so the gate runs
// under `report: 'return'` there. The machine-readable path DOES emit, because
// that is what `--format json` is for.
// --format json/github — emit all violations machine-readable, then exit (plan 0070).
const fmtArg = process.argv.indexOf('--format')
const format = fmtArg >= 0 ? process.argv[fmtArg + 1] : undefined
if (format === 'json' || format === 'github') {
  const emitted = finishPreset(receipt, { report: 'return' })
  reportViolations(emitted, { format })
  process.exit(emitted.length > 0 ? 1 : 0)
}

// ---------- report ----------

const line = (label, detail) => console.error(`  ${label.padEnd(10)}${detail}`)

console.error('')
console.error('check:corpus · corpus integrity')
line('roots', ROOTS.join(', '))
console.error('')
line(
  'documents',
  `${liveDocs.length} live · ${frozenCount} frozen (history — broken links still fail; pointers unchecked)`,
)
line(
  'links',
  `${linksChecked} internal · ${broken.length === 0 ? '✓ all resolve' : `✗ ${broken.length} broken`}`,
)
line(
  'pointers',
  // Split by what the violation actually says. Calling a *broken* pointer
  // "stale" sends the reader to check a line number in a file that does not
  // exist — review hit exactly that confusion on this change. The two are
  // different repairs: broken needs the path fixed, stale needs the line.
  `${pointersChecked} live · ${pointerSummary(stale.map((v) => v.message))}`,
)
line(
  'ADRs',
  `${adrDocs.length} enforced · ${adrError ? '✗ invalid' : '✓ tables + citations resolve'}`,
)
line(
  'states',
  `${stateRules.map((r) => `${String(r.result.examined)} ${r.lane}`).join(' · ')} State line(s) in ${String(statePresent.examined)} record(s) · ${
    stateViolations.length === 0 && statePresent.length === 0
      ? "✓ each in its lane's words"
      : `✗ ${stateViolations.length + statePresent.length} finding(s)`
  }`,
)
line(
  'closed',
  `${String(closedLive.examined)} closed record(s) in a live folder, of ${String(statePresent.examined)} live record(s) · ${String(closedLive.undecided ?? 0)} undecided cause(s) · ${
    closedLive.length === 0
      ? '✓ every closed record sits in a done folder'
      : `✗ ${closedLive.length} finding(s)`
  }`,
)
line(
  'numbers',
  `${String(recordNumbers.examined)} record number(s), one per numbered record under work/ · ${
    recordNumbers.length === 0
      ? '✓ no number claimed twice'
      : `✗ ${recordNumbers.length} finding(s)`
  }`,
)
line(
  'titles',
  `${numberInTitle.map((r) => `${String(r.result.examined)} ${r.lane}`).join(' · ')} record(s) · ${
    numberInTitleFindings.length === 0
      ? "✓ each record's number agrees in its file name and its title"
      : `✗ ${numberInTitleFindings.length} finding(s)`
  }`,
)
line(
  'done',
  `${doneFolderResults.map((r, i) => `${String(r.examined)} ${DONE_FOLDER_RULES[i].lane}`).join(' · ')} record(s) in done folders · ${
    doneFolderViolations.length === 0
      ? "✓ each holds its folder's value"
      : `✗ ${doneFolderViolations.length} finding(s)`
  }`,
)
line(
  'extends',
  `${extendsViolations.examined} ADR Extends link(s) · ${
    extendsViolations.length === 0
      ? '✓ each answered by the ADR it extends'
      : `✗ ${extendsViolations.length} finding(s)`
  }`,
)
line(
  'lanes',
  `${laneRows.length} row(s) · ${laneDirs.length} directories · ${
    laneViolations.length === 0
      ? '✓ the map lists every lane'
      : `✗ ${laneViolations.length} finding(s)`
  }`,
)

const proposalPlanFindingCount =
  proposalPlanViolations.length +
  unparseableRulingViolations.length +
  unparseableImplementsViolations.length +
  danglingImplementsViolations.length +
  boardRulingViolations.length +
  promotedViolations.length +
  acceptedDenominatorViolations.length +
  criteriaViolations.length +
  criteriaContentViolations.length +
  docsOnlyOwnerViolations.length
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
    `${promotedProposals.length} promoted · ${criteriaViolations.examined} criteria-checked · ${criteriaContentViolations.examined} content-checked · ` +
    `${docsOnlyProposals.length} docs-only · ` +
    `${
      proposalLinkageOk && boardExaminedAll
        ? '✓ every accepted proposal has a plan, every Ruling/Implements parses, board agrees with each file'
        : `✗ ${proposalPlanFindingCount} finding(s)`
    }`,
)

// What the rule read, what it skipped and what it leaves out, so a green run says how much it judged
// (plan 0542, Phase 9).
line(
  'mentions',
  `${String(mentionViolations.examined)} record mention(s) examined · ${String(unlinkedMentions)} unlinked · ` +
    `${String(skippedAfterTsArchunit)} skipped after ts-archunit · ` +
    `${String(leftOutRecords)} fold-era records left out (${String(LEFT_OUT.length)} documents, ${String(LEFT_OUT.length - leftOut.length)} as pinned) · ` +
    `${String(judgedLinks.elements.length)} link(s) to a record judged by their target, ` +
    `${String(linkedMentionCount - judgedLinks.elements.length)} title link(s) not judged · ${
      recordMentionFindings.length + targetFindings.length === 0
        ? '✓ every record mention is a link to the record it names'
        : `✗ ${recordMentionFindings.length + targetFindings.length} finding(s)`
    }`,
)

const problems = [
  ...recordMentionFindings,
  ...targetFindings,
  ...statePresent,
  ...closedLive,
  ...recordNumbers,
  ...numberInTitleFindings,
  ...doneFolderViolations,
  ...stateViolations,
  ...broken,
  ...stale,
  ...proposalPlanViolations,
  ...boardRulingViolations,
  ...promotedViolations,
  ...acceptedDenominatorViolations,
  ...criteriaViolations,
  ...criteriaContentViolations,
  ...docsOnlyOwnerViolations,
  ...unparseableRulingViolations,
  ...unparseableImplementsViolations,
  ...danglingImplementsViolations,
  ...laneViolations,
  ...extendsViolations,
]
if (problems.length > 0) {
  console.error('')
  console.error(`  ${problems.length} violation(s):`)
  for (const v of problems) {
    // A finding about the repository itself (the base, the seam) has no file of its own.
    console.error(`    ${relTo(v.file) || '(repository)'}:${v.line}  ${v.message.split('\n')[0]}`)
    if (v.suggestion) console.error(`      Fix: ${v.suggestion}`)
  }
}
if (adrError) {
  console.error('')
  console.error('  ADR enforcement failed:')
  for (const v of adrViolations)
    console.error(`    ${relTo(v.file)}:${v.line}  ${v.message.split('\n')[0]}`)
}

// The same receipt the machine-readable path used, so the two exits cannot
// disagree about what was examined.
const verdict = finishPreset(receipt, { report: 'return' })
const emitterFindings = verdict.filter(
  (v) => typeof v.ruleId === 'string' && v.ruleId.startsWith('emitter/'),
)
if (emitterFindings.length > 0) {
  console.error('')
  console.error('  evidence:')
  for (const v of emitterFindings) console.error(`    ${v.ruleId ?? ''}  ${v.message}`)
}

const totalChecked = verdict.examined
const failed = problems.length > 0 || adrError || emitterFindings.length > 0
// Emitter findings count toward the number below. Without this the line read
// `✗ corpus integrity — 0 violation(s)` beside a red exit — the summary
// contradicting the verdict. Found by an architect review of plan 0263 Phase 1,
// which fixed the same line in the two gates that copied this file and left the
// original: plan 0188's own headline hazard, in the three scripts it names.
console.error('')
if (!failed) {
  console.error(
    `  ✓ corpus integrity — ${totalChecked} checks across ${liveDocs.length} documents, 0 violations (${elapsed()})`,
  )
} else {
  const n = problems.length + (adrError ? 1 : 0) + emitterFindings.length
  console.error(
    `  ✗ corpus integrity — ${n} violation(s) across ${totalChecked} checks (${elapsed()})`,
  )
}
console.error('')

if (failed) process.exit(1)
