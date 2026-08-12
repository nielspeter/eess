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
 * This is the repo's first **Diff-mode** gate. Every other `check:*` asks the
 * Drift question — do current spec and current code agree — and needs only the
 * tree. This one asks what changed since a base ref (docs/manifesto.md, "Drift
 * and Diff"). That is why it resolves a base explicitly and fails hard when it
 * cannot: a Diff gate with no diff is not a pass, it is a gate that did not run.
 *
 * The rules themselves are ordinary correspondences and live in
 * `release-gate.mjs`, pure and fixture-driven; this script is the impure shell —
 * read the workspace, read `.changeset/`, ask git what changed, report. Same
 * shape as check-ledger.mjs over `honestyAtClose` + `ledgerStats`.
 *
 * Run: `npm run check:release`. Exits non-zero on any finding, and on an
 * unresolvable base ref. `--format json|github` for machine-readable output.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { reportViolations } from '@nielspeter/eess'
import { packagesTouchedBy, releaseViolations } from './release-gate.mjs'

const t0 = Date.now()
const elapsed = () => {
  const ms = Date.now() - t0
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

/** Resolve a ref to a sha, or undefined when it does not exist here. */
function revParse(ref) {
  try {
    return git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`) || undefined
  } catch {
    return undefined // `--quiet` exits 1 for an unknown ref; that is the answer, not an error
  }
}

// --- the workspace: ground truth for both correspondences -------------------

const workspacePackages = readdirSync('packages', { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join('packages', e.name, 'package.json')))
  .map((e) => {
    const dir = `packages/${e.name}`
    const { name } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    return { name, dir }
  })

// --- the declarations: `.changeset/*.md` frontmatter ------------------------

// `'@scope/pkg': minor` — quoted or bare, as `changeset add` and hand-edits both
// produce. The bump vocabulary is closed, so a malformed line is not silently
// read as a declaration.
const DECLARATION = /^\s*['"]?([^'":\s]+)['"]?\s*:\s*(patch|minor|major)\s*$/

function readChangesets() {
  const declarations = []
  const blanketWaivers = []
  if (!existsSync('.changeset')) return { declarations, blanketWaivers, files: [] }
  const files = readdirSync('.changeset')
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .sort()
    .map((f) => `.changeset/${f}`)

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n')
    if (lines[0]?.trim() !== '---') continue // not a changeset; changesets ignores it too
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
    if (end < 0) continue
    let found = 0
    for (let i = 1; i < end; i++) {
      const m = DECLARATION.exec(lines[i])
      if (m) {
        declarations.push({ pkg: m[1], bump: m[2], file, line: i + 1 })
        found++
      }
    }
    // `changeset add --empty` writes exactly `---\n---` — the author declaring
    // "this ships nothing". Honoured as a blanket waiver (see release-gate.mjs),
    // and named in the summary below so it is countable rather than silent.
    if (found === 0) blanketWaivers.push(file)
  }
  return { declarations, blanketWaivers, files }
}

const { declarations, blanketWaivers, files: changesetFiles } = readChangesets()

// --- the diff side: what changed since the base -----------------------------

// In order: an explicit override, the PR's target branch, the default remote
// branch, the local default branch. Required, not optional — `ci.yml` checks out
// at depth 1 by default, where `origin/main` does not exist, and a Diff gate
// that quietly degrades to "nothing changed" is precisely bug 0119's shape.
const candidates = [
  process.env.EESS_RELEASE_BASE,
  process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : undefined,
  'origin/main',
  'main',
].filter((r) => r !== undefined && r !== '')

const baseRef = candidates.find((r) => revParse(r) !== undefined)
if (baseRef === undefined) {
  console.error('')
  console.error('check:release · FAILED — no base ref resolves')
  console.error(`  tried: ${candidates.join(', ')}`)
  console.error('')
  console.error('  This gate compares against a base commit, so it cannot run without one.')
  console.error('  In CI: `actions/checkout` needs `fetch-depth: 0` (the default depth of 1')
  console.error('  leaves no `origin/main`). Locally: set EESS_RELEASE_BASE=<ref>.')
  console.error('')
  process.exit(1)
}

const mergeBase = git('merge-base', baseRef, 'HEAD')
// Diff the merge-base against the WORKING TREE, not against HEAD: locally the
// changeset is often still uncommitted alongside the change it declares, and a
// gate that only sees committed work would demand one that is already there.
const changedFiles = [
  ...git('diff', '--name-only', mergeBase).split('\n'),
  ...git('ls-files', '--others', '--exclude-standard').split('\n'),
].filter((f) => f !== '')

const changedPackages = packagesTouchedBy(changedFiles, workspacePackages)

const { violations, stats } = releaseViolations({
  declarations,
  changedPackages,
  workspacePackages,
  blanketWaivers,
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
line(
  'changed',
  stats.changed === 0
    ? '0 packages — nothing to declare'
    : `${stats.changed} package(s) · ${stats.changedDeclared} declared`,
)
line('changesets', `${changesetFiles.length} pending · ${stats.declarations} declaration(s)`)
if (stats.waived) line('waiver', `blanket (empty changeset): ${stats.blanketWaivers.join(', ')}`)

if (violations.length > 0) {
  line('findings', `✗ ${violations.length}`)
  console.error('')
  for (const v of violations)
    console.error(
      `    ${v.file}:${v.line}  ${v.ruleId}\n      ${v.message.split('\n').join('\n      ')}`,
    )
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
