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
 * rather than a report. `bad-release.mjs` now spawns this script against a
 * throwaway git repo and asserts it exits 1, so that line is covered.
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
// merge-base === HEAD means there is nothing between the base and here: every
// `push` to main is this shape. The diff half genuinely did not run, and saying
// "nothing to declare" would be the same sentence a real empty diff prints
// (bug 0120's lesson — "found nothing" and "could not look" must not collide).
const noDiff = mergeBase === headSha

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
  if (!existsSync('.changeset')) return { declarations, waiverCandidates, unparseable, files: [] }
  const files = readdirSync('.changeset')
    .filter(isChangeset)
    .sort()
    .map((f) => `.changeset/${f}`)
  for (const file of files) {
    const r = declarationsIn(readFileSync(file, 'utf8'), file)
    if (r.error !== undefined) unparseable.push({ file, error: r.error })
    else if (r.empty) waiverCandidates.push(file)
    else declarations.push(...r.declarations)
  }
  return { declarations, waiverCandidates, unparseable, files }
}

const {
  declarations,
  waiverCandidates,
  unparseable,
  files: changesetFiles,
} = readPendingChangesets()

// --- the diff side ----------------------------------------------------------

// `--no-renames`: with rename detection on, `git mv packages/md/src/x.ts docs/`
// reports only the destination, so a module leaving a published package's
// surface is invisible to the ownership test. The source path is the half that
// matters here.
const changedFiles = noDiff
  ? []
  : [
      ...lines(git('diff', '--name-only', '--no-renames', mergeBase)),
      ...lines(git('ls-files', '--others', '--exclude-standard')),
    ]

// A release commit consumes its changesets: `changeset version` DELETES them and
// rewrites packages/*/package.json + CHANGELOG.md. Reading only `.changeset/`
// therefore sees bumped packages with zero declarations and reddens the release
// it exists to enable — `npm run release` is `validate && changeset publish`, so
// it could never reach the publish. The consumed files ARE the declarations for
// that commit, so read them back out of the base ref.
const consumed = noDiff
  ? []
  : lines(git('diff', '--name-only', '--diff-filter=D', mergeBase, '--', '.changeset')).filter(
      (f) => isChangeset(f.replace('.changeset/', '')),
    )
for (const file of consumed) {
  try {
    const r = declarationsIn(git('show', `${mergeBase}:${file}`), file)
    declarations.push(...r.declarations)
  } catch {
    continue // unreadable at the base — nothing to credit, and never a waiver
  }
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
  line('changed', 'base is HEAD — the changed-package rule did not run')
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
