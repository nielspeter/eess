#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — the corpus gate's DIFF-GATED rule, committed arm (plan 0218).
 *
 * `addedSince` has three arms: committed additions, the index, and untracked
 * files. The in-harness probes plant an UNTRACKED file, so they ride the third
 * arm only. Review measured the consequence: delete the committed arm entirely
 * and `corpus/new-proposal-criteria` stays green — while the committed arm is
 * the ONLY one that runs on a pull request, which is the only place this rule
 * ever fires in anger.
 *
 * The same review found a live bypass in that unproven arm: without
 * `--no-renames`, a `git mv` to a new proposal number arrives as `R`, and
 * `--diff-filter=A` reports nothing. Scenario 2 below pins that.
 *
 * This runs the REAL `check-corpus.mjs` against a throwaway git WORKTREE of this
 * repository rather than a synthetic repo, because the gate reads the whole
 * corpus (plans, ADRs, docs) and a bare fixture repo would fail for unrelated
 * reasons. Module resolution follows the script's path, so the worktree needs no
 * `node_modules`; `corpus()` follows `process.cwd()`, so it reads the worktree.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = every scenario behaved as expected (the gate fails builds it must) — OK
 *   0 = a scenario did not — the committed arm is vacuous
 *   2 = unexpected THROW only, never a behavioural result
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')
const SCRIPT = join(REPO, 'scripts', 'check-corpus.mjs')

const NAME = 'bad-corpus-diff-e2e'
function vacuous(msg) {
  console.error(`${NAME}: ${msg}`)
  process.exit(0)
}

const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

const NO_CRITERIA = '# Proposal 997 — e2e probe\n\n**State:** Draft — probe.\n'
const WITH_CRITERIA =
  '# Proposal 997 — e2e probe\n\n**State:** Draft — probe.\n\n' +
  '## Acceptance criteria\n\nBreak class: the probe.\n'

/** Commit `content` as a new proposal in a throwaway worktree; return the gate's JSON run. */
function runWithCommittedProposal(content, { rename } = {}) {
  const wt = mkdtempSync(join(tmpdir(), 'eess-corpus-diff-'))
  rmSync(wt, { recursive: true, force: true })
  git(REPO, 'worktree', 'add', '--quiet', '--detach', wt, 'HEAD')
  try {
    const base = git(wt, 'rev-parse', 'HEAD')
    if (rename) {
      // A `git mv` to a NEW proposal number. With rename detection on this is
      // reported `R` and `--diff-filter=A` sees nothing at all.
      git(wt, 'mv', 'work/proposals/003-future-dialect-candidates.md', 'work/proposals/997-e2e.md')
      writeFileSync(join(wt, 'work/proposals/997-e2e.md'), content)
    } else {
      writeFileSync(join(wt, 'work/proposals/997-e2e.md'), content)
    }
    git(wt, 'add', '-A')
    git(wt, '-c', 'user.email=probe@eess', '-c', 'user.name=probe', 'commit', '--quiet', '-m', 'probe')
    const r = spawnSync(process.execPath, [SCRIPT, '--format', 'json'], {
      cwd: wt,
      encoding: 'utf8',
      env: { ...process.env, EESS_RELEASE_BASE: base },
    })
    let ids = []
    try {
      const doc = JSON.parse(r.stdout ?? '[]')
      ids = (Array.isArray(doc) ? doc : (doc?.violations ?? [])).map((v) => v?.ruleId)
    } catch {
      /* a non-JSON stdout is itself a failure; ids stays empty */
    }
    return { code: r.status, ids }
  } finally {
    git(REPO, 'worktree', 'remove', '--force', wt)
  }
}

const RULE = 'corpus/new-proposal-states-no-acceptance-criteria'

// 1. A committed new proposal with no acceptance criteria must red. This is the
//    arm CI runs, and deleting it from `addedSince` must break this fixture.
const plain = runWithCommittedProposal(NO_CRITERIA)
if (plain.code !== 1 || !plain.ids.includes(RULE)) {
  vacuous(
    `a COMMITTED new proposal without acceptance criteria did not red: exit ${plain.code}, ` +
      `rules [${[...new Set(plain.ids)].join(', ')}]`,
  )
}

// 2. The same, arriving as a RENAME. Without `--no-renames` git reports `R` and
//    `--diff-filter=A` yields nothing, so the rule never sees a brand-new
//    proposal number. Two reviewers measured this independently.
const renamed = runWithCommittedProposal(NO_CRITERIA, { rename: true })
if (renamed.code !== 1 || !renamed.ids.includes(RULE)) {
  vacuous(
    `a new proposal number arriving as a RENAME did not red: exit ${renamed.code}, ` +
      `rules [${[...new Set(renamed.ids)].join(', ')}] — is --no-renames still passed?`,
  )
}

// 3. Control: the same committed addition WITH the section must not fire this
//    rule. Without this the fixture would pass against a rule that always reds.
const ok = runWithCommittedProposal(WITH_CRITERIA)
if (ok.ids.includes(RULE)) {
  vacuous('a committed new proposal WITH acceptance criteria still fired the rule')
}

console.error(`${NAME}: OK — committed arm reds (plain + rename), and is quiet when satisfied`)
process.exit(1)
