#!/usr/bin/env node
/**
 * Dogfood: every changed package declares a release (bug 0106).
 *
 * `packages/crossvalidate/src/gherkin-ts.ts` reached `main` with tests, an
 * `exports` entry and a README section, and no changeset. Under Changesets a
 * package's `version` legitimately stays at the last *released* value until
 * `changeset version` runs, so the source looked released while being
 * unreachable from any published version — an adopter's first `import` failed
 * with ERR_PACKAGE_PATH_NOT_EXPORTED. Nothing said so, because nothing asked.
 *
 * This gate reads a base ref, which no other `check:*` does. The rules are
 * ordinary correspondences and live in `release-gate.mjs`, pure and
 * fixture-driven; this file is the impure shell — read the workspace, read
 * `.changeset/`, ask git what changed, report. Same shape as check-ledger.mjs
 * over `honestyAtClose` + `ledgerStats`.
 *
 * THE SHELL IS FIXTURED TOO. Review measured the first version: the pure core
 * caught 11 of 11 mutations and the shell caught 0 of 7 — including deleting the
 * `process.exit(1)` on the last line, the one statement that makes this a gate
 * rather than a report. `bad-release-e2e.mjs` spawns this script against
 * fourteen throwaway git repositories and asserts its exit code and what it
 * named, so that line — and the diff, waiver and consumed-changeset paths around
 * it — are covered.
 *
 * Run: `npm run check:release`. Exits non-zero on any finding, and on an
 * unresolvable base ref. `--format json|github` for machine-readable output.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { reportViolations } from '@nielspeter/eess'
import { packagesTouchedBy, declarationsIn, releaseViolations } from './release-gate.mjs'

const t0 = Date.now()
const elapsed = () => {
  const ms = Date.now() - t0
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

// `core.quotepath=false` so a non-ASCII path arrives as itself rather than
// `"packages/md/src/caf\303\251.ts"`, which no prefix test would ever match and
// which review found silently hid the owning package.
const git = (...args) =>
  execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()

const lines = (s) => s.split('\n').filter((l) => l !== '')

/** Resolve a ref to a sha, or undefined when it does not exist here. */
function revParse(ref) {
  try {
    return git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`) || undefined
  } catch {
    return undefined // `--quiet` exits 1 for an unknown ref; that is the answer, not an error
  }
}

function die(headline, detail) {
  console.error('')
  console.error(`check:release · FAILED — ${headline}`)
  for (const d of detail) console.error(`  ${d}`)
  console.error('')
  process.exit(1)
}

// --- the base ref -----------------------------------------------------------

// An explicit override is a promise, not a hint: if EESS_RELEASE_BASE is set and
// does not resolve, fail rather than quietly measuring a different base.
const override = process.env.EESS_RELEASE_BASE
if (override !== undefined && override !== '' && revParse(override) === undefined) {
  die(`EESS_RELEASE_BASE='${override}' does not resolve`, [
    'The override was set explicitly, so falling back to another base would',
    'silently measure a different diff than the one you asked for.',
  ])
}

const candidates = [
  override,
  process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : undefined,
  'origin/main',
  'main',
].filter((r) => r !== undefined && r !== '')

const baseRef = candidates.find((r) => revParse(r) !== undefined)
if (baseRef === undefined) {
  die('no base ref resolves', [
    `tried: ${candidates.join(', ')}`,
    '',
    'This gate compares against a base commit, so it cannot run without one.',
    'In CI: `actions/checkout` needs `fetch-depth: 0` (the default depth of 1',
    'leaves no `origin/main`). Locally: set EESS_RELEASE_BASE=<ref>.',
  ])
}

let mergeBase
try {
  mergeBase = git('merge-base', baseRef, 'HEAD')
} catch {
  die(`no merge base between '${baseRef}' and HEAD`, [
    'Unrelated histories, or a partial fetch. In CI use `fetch-depth: 0`.',
  ])
}
const headSha = git('rev-parse', 'HEAD')
const baseIsHead = mergeBase === headSha

// --- the workspace: base ∪ head --------------------------------------------

// Reading only the current tree makes a DELETED package invisible: its files
// have no owner, so removing a published package — the most breaking change the
// workspace admits — reports as no change at all, with the denominator quietly
// shrinking. Union the base ref's packages so a deletion is still attributable.
function packagesInTree() {
  if (!existsSync('packages')) return []
  return readdirSync('packages', { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join('packages', e.name, 'package.json')))
    .map((e) => {
      const dir = `packages/${e.name}`
      const { name } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
      return { name, dir }
    })
    .filter((p) => typeof p.name === 'string')
}

function packagesAt(ref) {
  let listed
  try {
    listed = lines(git('ls-tree', '-r', '--name-only', ref, '--', 'packages'))
  } catch {
    return []
  }
  const out = []
  for (const path of listed) {
    if (!/^packages\/[^/]+\/package\.json$/.test(path)) continue
    try {
      const { name } = JSON.parse(git('show', `${ref}:${path}`))
      if (typeof name === 'string') out.push({ name, dir: path.replace(/\/package\.json$/, '') })
    } catch {
      continue // unreadable at the base — the head copy, if any, still counts
    }
  }
  return out
}

const byName = new Map()
for (const p of [...packagesAt(mergeBase), ...packagesInTree()]) byName.set(p.name, p)
const workspacePackages = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))

// --- the declarations -------------------------------------------------------

const isChangeset = (f) => f.endsWith('.md') && !/(^|\/)readme\.md$/i.test(f)

function readPendingChangesets() {
  const declarations = []
  const waiverCandidates = []
  const unparseable = []
  const breakingFiles = []
  if (!existsSync('.changeset'))
    return { declarations, waiverCandidates, unparseable, breakingFiles, files: [] }
  const files = readdirSync('.changeset')
    .filter(isChangeset)
    .sort()
    .map((f) => `.changeset/${f}`)
  for (const file of files) {
    const r = declarationsIn(readFileSync(file, 'utf8'), file)
    if (r.error !== undefined) unparseable.push({ file, error: r.error })
    else if (r.empty) {
      waiverCandidates.push(file)
      // An empty changeset that declares a break is collected too, and fails.
      // It is not "no bump to be wrong": `--empty` sets `waived`, which suppresses
      // release/changed-package-needs-changeset for EVERY changed package. So the
      // loudest possible break marker, in this one file shape, turns off the
      // strongest rule in the gate. Fail closed (ADR-009).
      if (r.breakingMarker !== undefined) breakingFiles.push({ file, marker: r.breakingMarker })
    } else {
      declarations.push(...r.declarations)
      if (r.breakingMarker !== undefined) breakingFiles.push({ file, marker: r.breakingMarker })
    }
  }
  return { declarations, waiverCandidates, unparseable, breakingFiles, files }
}

const {
  declarations,
  waiverCandidates,
  unparseable,
  breakingFiles,
  files: changesetFiles,
} = readPendingChangesets()

// --- the diff side ----------------------------------------------------------

// `--no-renames`: with rename detection on, `git mv packages/md/src/x.ts docs/`
// reports only the destination, so a module leaving a published package's
// surface is invisible to the ownership test. The source path is the half that
// matters here.
// Always computed, even when merge-base is HEAD. `git diff <mergeBase>` compares
// against the WORKING TREE, so it still sees uncommitted work — which is the
// shape of every local run on a fresh branch, and precisely when the reminder is
// wanted. An earlier version short-circuited on `merge-base === HEAD` and
// reported `0 changed` while `packages/core/src` sat modified in the tree: a
// false negative in the gate, found by running it on its own branch.
const changedFiles = [
  ...lines(git('diff', '--name-only', '--no-renames', mergeBase)),
  ...lines(git('ls-files', '--others', '--exclude-standard')),
]

// Only now is "the changed-package rule had nothing to read" true: the base is
// HEAD *and* the tree is clean. Saying "nothing to declare" in that case would
// be the same sentence a real empty diff prints — bug 0120's lesson, that
// "found nothing" and "could not look" must not collide.
const noDiff = baseIsHead && changedFiles.length === 0

// A release commit consumes its changesets: `changeset version` DELETES them and
// rewrites packages/*/package.json + CHANGELOG.md. Reading only `.changeset/`
// therefore sees bumped packages with zero declarations and reddens the release
// it exists to enable — `npm run release` is `validate && changeset publish`, so
// it could never reach the publish. The consumed files ARE the declarations for
// that commit, so read them back out of the base ref.
// A changeset is "consumed" when `changeset version` applies and deletes it. The
// deletion can show up three ways, and the gate has to find the content in all
// three or it accuses its own package of being undeclared:
//
//   1. present at the merge base, gone now      — the ordinary release commit
//   2. present in HEAD, deleted in the tree     — the documented preflight, where
//      RELEASING.md runs `npm run validate` before committing the bump
//   3. added AND consumed by commits on this branch — invisible to a diff against
//      either endpoint, because it exists at neither
//
// Case 3 was found by a fixture written for case 1: the gate reported
// `@nielspeter/eess` undeclared while its changeset sat one commit back.
//
// KNOWN, AND BOUNDED: a hand `rm` of a changeset is indistinguishable from
// `changeset version` consuming it, so an abandoned changeset is credited too.
// Requiring a committed deletion would red the documented preflight — bug 0106's
// first blocker. It is local-only: once pushed, the changeset never existed
// relative to `origin/main`, nothing is credited, and CI reds.
const consumedPaths = new Set()
const addDeleted = (...args) => {
  try {
    for (const f of lines(git(...args)))
      if (isChangeset(f.replace('.changeset/', ''))) consumedPaths.add(f)
  } catch {
    /* no such range in a shallow or fresh repo — nothing to credit */
  }
}
addDeleted('diff', '--name-only', '--diff-filter=D', mergeBase, '--', '.changeset')
addDeleted('diff', '--name-only', '--diff-filter=D', headSha, '--', '.changeset')
addDeleted(
  // `--full-history`: this is a RANGE query through `headSha`, which is a
  // merge commit under GitHub Actions' default `pull_request` checkout
  // (base + PR branch, not the PR branch's own tip). Default path-limited
  // history simplification can still lose a commit whose path is absent
  // from both of a merge's parents (added and deleted entirely on one
  // side) even with a defined range — measured directly: this exact call,
  // unchanged, found 0 of 3 real consumed changesets against a genuine
  // GitHub PR merge ref in a small repro, though it happened to find all 3
  // against this repo's own deeper history. Both shapes are real; only one
  // is safe to depend on.
  'log',
  '--full-history',
  '--diff-filter=D',
  '--name-only',
  '--pretty=format:',
  `${mergeBase}..${headSha}`,
  '--',
  '.changeset',
)

/** The file's content at the last ref that still had it. */
function consumedContent(file) {
  for (const ref of [headSha, mergeBase]) {
    try {
      return git('show', `${ref}:${file}`)
    } catch {
      /* not present at that ref — try the next */
    }
  }
  try {
    // `--full-history`: HEAD is a merge commit under GitHub Actions' default
    // `pull_request` checkout (base + PR branch, not the PR branch's own
    // tip). Default path-limited history simplification can silently follow
    // only one parent when a path is absent from BOTH — exactly this case,
    // a changeset created and deleted entirely on the PR-branch side — and
    // never surface the commit that touched it, even though it is a real
    // ancestor. Without this flag: green locally (HEAD is the branch tip),
    // red in CI (HEAD is the merge preview) — verified against a real
    // GitHub PR merge ref before adding it.
    const lastTouch = git('rev-list', '-1', '--full-history', headSha, '--', file)
    if (lastTouch) return git('show', `${lastTouch}^:${file}`)
  } catch {
    /* deleted in the root commit, or unreadable — nothing to credit */
  }
  return undefined
}

const consumed = [...consumedPaths]
for (const file of consumed) {
  const text = consumedContent(file)
  if (text === undefined) continue
  const r = declarationsIn(text, file)
  declarations.push(...r.declarations)
  // **The consumed path carries the breaking marker too.** Dropping it made the
  // release-time flow blind, which is the flow `RELEASING.md` documents: a
  // changeset authored at step 1 and consumed by `version-packages` at step 2
  // never meets a PR-time `check:release`, and step 4's `npm run validate` is the
  // only gate it sees. Measured before this line existed — a `**Breaking`/patch
  // changeset fired at PR time and reported `examined 0 of 0` after consumption.
  //
  // Firing on a consumed changeset is correct, not a false positive: the declared
  // bump is the one `changeset version` has ALREADY written, so a break declared
  // as a patch means the version on disk is wrong and the publish must be blocked
  // while that is still possible.
  if (r.breakingMarker !== undefined) breakingFiles.push({ file, marker: r.breakingMarker })
}

// A waiver counts only when it is in THIS diff. Scanning `.changeset/` alone let
// an `--empty` merged by an earlier PR silence the gate for every later PR until
// the next `changeset version` — invisibly, and never in the silenced PR's diff.
const waivers = waiverCandidates.filter((f) => changedFiles.includes(f))

const changedPackages = packagesTouchedBy(changedFiles, workspacePackages)

const { violations, stats } = releaseViolations({
  declarations,
  changedPackages,
  workspacePackages,
  waivers,
  unparseable,
  // NOT scoped to the diff, unlike `waivers`. A breaking changeset merged by an
  // earlier PR is still pending until `changeset version` runs, so it is still
  // about to ship on the wrong bump — the window this gate exists to close.
  breakingFiles,
})

// --- report -----------------------------------------------------------------

const fmtArg = process.argv.indexOf('--format')
const format = fmtArg >= 0 ? process.argv[fmtArg + 1] : undefined
if (format === 'json' || format === 'github') {
  reportViolations(violations, { format })
  process.exit(violations.length > 0 ? 1 : 0)
}

const line = (label, detail) => console.error(`  ${label.padEnd(12)}${detail}`)

console.error('')
console.error('check:release · every changed package declares a release')
line('base', `${baseRef} (merge-base ${mergeBase.slice(0, 8)})`)
if (noDiff) {
  line('changed', 'base is HEAD and the tree is clean — nothing to read')
} else {
  line(
    'changed',
    stats.changed === 0
      ? '0 packages — nothing to declare'
      : `${stats.changed} package(s) · ${stats.changedDeclared} declared`,
  )
}
line(
  'changesets',
  `${changesetFiles.length} pending · ${stats.declarations} declaration(s)` +
    (consumed.length > 0 ? ` · ${consumed.length} consumed by this diff` : ''),
)
if (stats.waived)
  line(
    'waiver',
    `empty changeset in this diff: ${stats.waivers.join(', ')}` +
      (stats.unchecked.length > 0 ? ` — not checked: ${stats.unchecked.join(', ')}` : ''),
  )

if (violations.length > 0) {
  line('findings', `✗ ${violations.length}`)
  console.error('')
  for (const v of violations) {
    console.error(`    ${v.file}:${v.line}  ${v.ruleId}`)
    for (const l of v.message.split('\n')) console.error(`      ${l}`)
    if (v.because) console.error(`      Why: ${v.because}`)
  }
} else if (stats.waived) {
  line('findings', `— waived; ${stats.unchecked.length} changed package(s) not checked`)
} else if (noDiff) {
  line('findings', '✓ every declaration names a real package (changed-package rule not run)')
} else {
  line('findings', '✓ every changed package is declared, every declaration is real')
}

// The breaking rule's own denominator, ALWAYS printed — including on a red run,
// where "which finding" and "out of how many examined" are different questions.
// The count comes from `stats`, i.e. from what the rule itself saw: sourcing it
// from the shell's own `breakingFiles` let the two disagree, and a severed
// argument then printed a ✓ over a rule that examined nothing.
const brokeCount = violations.filter((v) => v.ruleId === 'release/breaking-needs-minor').length
// Pending PLUS consumed: the rule reads both, so a denominator counting only the
// pending files reports "5 of 9" while one of the 5 is not among the 9.
const changesetsRead = changesetFiles.length + consumed.length
line(
  'breaking',
  stats.breakingExamined === 0
    ? `no pending changeset declares a break — rule examined 0 of ${String(changesetsRead)}`
    : brokeCount === 0
      ? `✓ ${String(stats.breakingExamined)} of ${String(changesetsRead)} changeset(s) declare a break, each bumping past patch` +
        (stats.breakingLoose === 0
          ? ''
          : ` — ${String(stats.breakingLoose)} checked loosely (several packages, no owner named, so only "at least one" could be asked)`)
      : `✗ ${String(brokeCount)} of ${String(stats.breakingExamined)} breaking changeset(s) bump only patch/none`,
)

console.error('')
if (violations.length === 0) {
  console.error(
    `  ✓ release readiness — ${stats.changed} changed of ${stats.workspace} workspace ` +
      `package(s), ${stats.declarations} declaration(s) across ${changesetFiles.length} ` +
      `changeset(s), 0 findings (${elapsed()})`,
  )
} else {
  console.error(
    `  ✗ release readiness — ${violations.length} finding(s) across ${stats.changed} ` +
      `changed package(s) (${elapsed()})`,
  )
}
console.error('')

if (violations.length > 0) process.exit(1)
