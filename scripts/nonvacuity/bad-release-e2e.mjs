#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — the release gate's impure SHELL, end to end (bug 0106).
 *
 * `bad-release.mjs` drives the pure core with synthetic data. That is the easy
 * half, and the first version of this gate stopped there while its record
 * claimed the shell was covered by one stated limit. Review measured it: the
 * pure core caught 11 of 11 mutations, the shell **0 of 7** — including deleting
 * the `process.exit(1)` on the last line of `check-release.mjs`, the single
 * statement that makes it a gate rather than a report.
 *
 * So this fixture runs the REAL script against throwaway git repositories and
 * asserts its exit code and what it named. Each scenario below corresponds to a
 * mutation that survives the pure fixture alone: an unscoped waiver, rename
 * detection hiding a package, `core.quotepath` hiding a package, reading only
 * the head tree so a deletion vanishes, dropping the consumed-changeset credit
 * that keeps release commits green, and losing the exit code itself.
 *
 * It is a separate file from `bad-release.mjs` for cost: `gateNode` spawns a
 * fixture once per gate row, and the three rule rows do not each need nine git
 * repositories built.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = every scenario behaved as expected (the gate fails builds it must) — OK
 *   0 = a scenario did not — the shell is vacuous somewhere
 *   2 = unexpected THROW only, never a behavioural result
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'check-release.mjs')

/** A behavioural expectation failed → the shell is vacuous (exit 0). */
function vacuous(msg) {
  console.error(`bad-release-e2e: ${msg}`)
  process.exit(0)
}
/** Only a genuine throw is exit 2. */
function threw(where, err) {
  console.error(`bad-release-e2e: unexpected error ${where} — ${String(err)}`)
  process.exit(2)
}

// The shell is where git and fs live, and a single scenario proves only the one
// path it walks. Each case below builds a throwaway repo, runs the real script,
// and asserts the exit code and what it named. Every one of them corresponds to
// a mutation that survived the pure-core fixture alone.
const tmpDirs = []
function scenario(build) {
  const dir = mkdtempSync(join(tmpdir(), 'bad-release-'))
  tmpDirs.push(dir)
  const g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
  const write = (p, s) => {
    mkdirSync(join(dir, dirname(p)), { recursive: true })
    writeFileSync(join(dir, p), s)
  }
  const pkg = (name, version = '1.0.0') => JSON.stringify({ name, version })
  g('init', '-q', '-b', 'main')
  g('config', 'user.email', 'fixture@example.invalid')
  g('config', 'user.name', 'fixture')
  write('packages/alpha/package.json', pkg('@fixture/alpha'))
  write('packages/beta/package.json', pkg('@fixture/beta'))
  write('packages/alpha/src/index.ts', 'export const a = 1\n')
  write('packages/beta/src/index.ts', 'export const b = 1\n')
  write('.changeset/config.json', '{}')
  g('add', '-A')
  g('commit', '-qm', 'base')
  build({ dir, g, write, pkg })
  const r = spawnSync('node', [SCRIPT], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, EESS_RELEASE_BASE: 'main' },
  })
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

const branch = ({ g }) => g('checkout', '-q', '-b', 'feature')

const E2E = [
  [
    'an UNCOMMITTED change is seen even when the base is HEAD',
    ({ write }) => {
      // No branch, no commit: merge-base === HEAD. An earlier version
      // short-circuited on that and reported `0 changed` while the package sat
      // modified in the working tree — a false negative in the shape of every
      // local run before the first commit, which is exactly when the reminder
      // is wanted. Found by running the gate on its own branch.
      write('packages/alpha/src/index.ts', 'export const a = 2\n')
    },
    1,
    ['release/changed-package-needs-changeset', '@fixture/alpha'],
  ],
  [
    'a clean tree with the base at HEAD says it had nothing to read',
    () => {},
    0,
    ['nothing to read'],
  ],
  [
    'a dirty tree at base HEAD does not claim it had nothing to read',
    ({ write }) => {
      // The `&& changedFiles.length === 0` conjunct is what separates "could not
      // look" from "found nothing" (bug 0120). Without it the gate prints
      // `base is HEAD and the tree is clean — nothing to read` directly above
      // `findings ✗ 1`. Three reviewers killed that mutation independently and
      // no existing scenario could see it: the first asserts only that the
      // finding fires, the second runs on a clean tree where both forms agree.
      write('packages/alpha/src/index.ts', 'export const a = 2\n')
    },
    1,
    ['1 package(s)'],
    ['nothing to read'],
  ],
  [
    'a changeset added on THIS branch and then consumed still counts',
    ({ dir, g, write, pkg }) => {
      // `--diff-filter=D` against the merge base cannot see a changeset that
      // never existed there. Before this was read from HEAD too, the gate
      // accused its own package while the declaration sat one commit back.
      branch({ g })
      write('.changeset/a.md', "---\n'@fixture/alpha': minor\n---\n\nnote\n")
      g('add', '-A')
      g('commit', '-qm', 'changeset on the branch')
      rmSync(join(dir, '.changeset/a.md'))
      write('packages/alpha/package.json', pkg('@fixture/alpha', '1.1.0'))
      g('add', '-A')
      g('commit', '-qm', 'version packages')
    },
    0,
    ['consumed by this diff'],
  ],
  [
    'a changeset committed on this branch and consumed UNCOMMITTED still counts',
    ({ dir, g, write, pkg }) => {
      // RELEASING.md runs `npm run validate` BEFORE committing the version bump,
      // so the deletion is usually still in the working tree. When the changeset
      // also entered on this branch it exists at neither endpoint of a
      // merge-base diff — only in HEAD. Dropping that lookup survived every
      // other scenario here.
      branch({ g })
      write('.changeset/a.md', "---\n'@fixture/alpha': minor\n---\n\nnote\n")
      g('add', '-A')
      g('commit', '-qm', 'changeset on the branch')
      rmSync(join(dir, '.changeset/a.md'))
      write('packages/alpha/package.json', pkg('@fixture/alpha', '1.1.0'))
      // deliberately NOT committed
    },
    0,
    ['consumed by this diff'],
  ],
  [
    'a changed, undeclared package fails the build',
    ({ g, write }) => {
      branch({ g })
      write('packages/alpha/src/index.ts', 'export const a = 2\n')
      g('add', '-A')
      g('commit', '-qm', 'change')
    },
    1,
    ['release/changed-package-needs-changeset', '@fixture/alpha'],
  ],
  [
    'an empty changeset from an EARLIER commit does not waive',
    ({ g, write }) => {
      write('.changeset/empty.md', '---\n---\n')
      g('add', '-A')
      g('commit', '-qm', 'empty on main')
      branch({ g })
      write('packages/alpha/src/index.ts', 'export const a = 2\n')
      g('add', '-A')
      g('commit', '-qm', 'change')
    },
    1,
    ['release/changed-package-needs-changeset'],
  ],
  [
    'an empty changeset IN this diff waives, and says what it left unchecked',
    ({ g, write }) => {
      branch({ g })
      write('packages/alpha/src/index.ts', 'export const a = 2\n')
      write('.changeset/empty.md', '---\n---\n')
      g('add', '-A')
      g('commit', '-qm', 'change + empty')
    },
    0,
    ['not checked: @fixture/alpha'],
  ],
  [
    'a file renamed out of a package is still a change to it',
    ({ g }) => {
      branch({ g })
      g('mv', 'packages/alpha/src/index.ts', 'packages/beta/src/moved.ts')
      g('commit', '-qm', 'move across packages')
    },
    1,
    ['@fixture/alpha'],
  ],
  [
    'a non-ASCII path does not hide its package',
    ({ g, write }) => {
      branch({ g })
      write('packages/alpha/src/café.ts', 'export const c = 1\n')
      g('add', '-A')
      g('commit', '-qm', 'unicode')
    },
    1,
    ['@fixture/alpha'],
  ],
  [
    'deleting a package is a change to it',
    ({ dir, g }) => {
      branch({ g })
      rmSync(join(dir, 'packages/beta'), { recursive: true })
      g('add', '-A')
      g('commit', '-qm', 'delete beta')
    },
    1,
    ['@fixture/beta'],
  ],
  [
    'a release commit, whose changesets it just consumed, passes',
    ({ dir, g, write, pkg }) => {
      write('.changeset/a.md', "---\n'@fixture/alpha': minor\n---\n\nnote\n")
      g('add', '-A')
      g('commit', '-qm', 'changeset on main')
      branch({ g })
      rmSync(join(dir, '.changeset/a.md'))
      write('packages/alpha/package.json', pkg('@fixture/alpha', '1.1.0'))
      write('packages/alpha/CHANGELOG.md', '# @fixture/alpha\n\n## 1.1.0\n')
      g('add', '-A')
      g('commit', '-qm', 'version packages')
    },
    0,
    ['consumed by this diff'],
  ],
  [
    'a release commit bumping a package no changeset named still fails',
    ({ dir, g, write, pkg }) => {
      write('.changeset/a.md', "---\n'@fixture/alpha': minor\n---\n\nnote\n")
      g('add', '-A')
      g('commit', '-qm', 'changeset on main')
      branch({ g })
      rmSync(join(dir, '.changeset/a.md'))
      write('packages/alpha/package.json', pkg('@fixture/alpha', '1.1.0'))
      write('packages/beta/package.json', pkg('@fixture/beta', '9.9.9'))
      g('add', '-A')
      g('commit', '-qm', 'version, plus an undeclared bump')
    },
    1,
    ['@fixture/beta'],
  ],
  [
    'an unreadable changeset is a finding, never a waiver',
    ({ g, write }) => {
      branch({ g })
      write('packages/alpha/src/index.ts', 'export const a = 2\n')
      write('.changeset/bad.md', 'no frontmatter here\n')
      g('add', '-A')
      g('commit', '-qm', 'change + garbage changeset')
    },
    1,
    ['release/unparseable-changeset'],
  ],
]

try {
  for (const [name, build, wantCode, wantSaid, wantUnsaid = []] of E2E) {
    const { code, out } = scenario(build)
    if (code !== wantCode)
      vacuous(
        `end to end — "${name}": the real script exited ${code}, expected ${wantCode}.\n` +
          `  ${out.split('\n').filter((l) => l.trim()).slice(-4).join('\n  ')}`,
      )
    for (const said of wantSaid) {
      if (!out.includes(said))
        vacuous(`end to end — "${name}": exited ${code} but never said "${said}"`)
    }
    for (const unsaid of wantUnsaid) {
      if (out.includes(unsaid))
        vacuous(
          `end to end — "${name}": said "${unsaid}", which contradicts the finding it reported`,
        )
    }
  }
} catch (err) {
  threw('in the end-to-end stage', err)
} finally {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true })
}

console.error(
  `bad-release-e2e: ${E2E.length} end-to-end runs of the real script exited as expected — ` +
    `a changed, undeclared package makes it exit 1 naming release/changed-package-needs-changeset, ` +
    `and release/unparseable-changeset fires on a changeset the parser rejects`,
)
process.exit(1)
