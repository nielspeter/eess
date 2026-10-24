/**
 * Plan 0541: the base `check:corpus` judges this repository's unlinked record mentions against,
 * and the count of them there.
 *
 * There is no ledger. Each census key is judged against what the same rule finds in the base's own
 * tree, so nothing can be "not judged": a PR that deletes, renames or re-points a ledger has nothing
 * to delete. The base reads no environment variable but the test seam: not `EESS_RELEASE_BASE`, not
 * `GITHUB_BASE_REF`. Either would let a one-line change name a base that forgives the PR's own
 * additions and still exit 0 (the plan's round-2 review, measured on a simulated PR merge ref).
 *
 * Resolution, in order:
 *  - the seam, `EESS_RECORD_MENTION_BASE=<tree-ish>`: the caller reds every run that sets it;
 *  - `HEAD` with two parents (GitHub's PR checkout merges the PR into its target): its first parent,
 *    which is the target's tip and the merge base;
 *  - otherwise the merge base of `HEAD` with `origin/main`, else `main`. When that is `HEAD` itself
 *    (a push to `main`, or a local `main`), `HEAD` if the working tree differs from it under the
 *    roots, and its first parent if not, so a commit pushed straight to `main` is judged.
 * A base that cannot be resolved is a hard error (`BaseResolutionError`), never a pass, as
 * `check:release` does for its own base.
 *
 * The base's files are written out through a temporary `GIT_INDEX_FILE` (`read-tree`, then
 * `checkout-index`), not `git archive`, which applies the base's `.gitattributes`: measured,
 * `export-subst` rewrote `$Format:%s$` into a commit subject, which can be a mention, and
 * `export-ignore` would empty a root.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** The only variable the base reads. */
export const RECORD_MENTION_BASE_SEAM = 'EESS_RECORD_MENTION_BASE'

/** The base cannot be resolved at all: a hard error, as `check:release` stops on its own. */
export class BaseResolutionError extends Error {}

function git(cwd, args, env) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
    ...(env === undefined ? {} : { env }),
  }).trim()
}

function tryGit(cwd, args) {
  try {
    return git(cwd, args)
  } catch {
    return undefined
  }
}

/**
 * The base to judge against: `{ treeish, commit?, how }`. `roots` are the corpus's root folders
 * (`work`, `adr`, `docs`); only the dirtiness test reads them.
 */
export function resolveRecordMentionBase({ cwd, roots, env = process.env }) {
  const seam = env[RECORD_MENTION_BASE_SEAM]
  if (seam !== undefined && seam !== '')
    return { treeish: seam, how: `${RECORD_MENTION_BASE_SEAM} (the test seam)` }

  const line = tryGit(cwd, ['rev-list', '--parents', '-n', '1', 'HEAD'])
  if (line === undefined || line === '')
    throw new BaseResolutionError(
      'HEAD does not resolve to a commit, so there is no base to judge against.',
    )
  const [head = '', ...parents] = line.split(' ')
  if (parents.length >= 2) {
    const [first = ''] = parents
    return { treeish: first, commit: first, how: 'the first parent of the merge commit HEAD' }
  }

  const target = ['origin/main', 'main'].find(
    (ref) => tryGit(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]) !== undefined,
  )
  if (target === undefined)
    throw new BaseResolutionError(
      'neither origin/main nor main resolves, so there is no merge base to judge against.',
    )
  const mergeBase = tryGit(cwd, ['merge-base', 'HEAD', target])
  if (mergeBase === undefined || mergeBase === '')
    throw new BaseResolutionError(
      `HEAD and ${target} have no merge base. A shallow clone has none: CI checks out with ` +
        '`fetch-depth: 0` for this reason.',
    )
  if (mergeBase !== head)
    return { treeish: mergeBase, commit: mergeBase, how: `the merge base with ${target}` }

  const dirty = git(cwd, ['status', '--porcelain', '--untracked-files=all', '--', ...roots]) !== ''
  if (dirty)
    return {
      treeish: head,
      commit: head,
      how: `HEAD, the merge base with ${target}, since the working tree differs from it`,
    }
  const [first] = parents
  if (first === undefined)
    throw new BaseResolutionError(
      `HEAD is the merge base with ${target}, the working tree matches it, and it has no parent to judge it against.`,
    )
  return {
    treeish: first,
    commit: first,
    how: `HEAD's first parent, since HEAD is the merge base with ${target} and the working tree matches it`,
  }
}

/**
 * Write the base's files under `roots` to a temporary directory and hand it to `count`, which runs
 * the rule there: `count(dir, presentRoots)` returns `{ counts, examined }`. Returns that, or
 * `{ failure }` naming the cause when the base cannot be read or counted (a tree-ish that does not
 * resolve, no root present, a corpus that throws, nothing examined). The caller turns a failure
 * into one unsuppressable configuration finding, never into "raised" findings with the wrong
 * remedy (ADR-016 rules 1 and 4, ADR-009 rule 2). The directory is always removed.
 */
export function countAtBase({ cwd, treeish, roots, count }) {
  let scratch
  try {
    const top = git(cwd, ['rev-parse', '--show-toplevel'])
    const tree = tryGit(top, ['rev-parse', '--verify', '--quiet', `${treeish}^{tree}`])
    if (tree === undefined) return { failure: `${treeish} does not name a tree` }
    // `ls-tree` reads paths against the current directory, so it runs at the top level.
    const present = roots.filter((r) => git(top, ['ls-tree', '--name-only', tree, '--', r]) !== '')
    if (present.length === 0) return { failure: `none of ${roots.join(', ')} exists at ${treeish}` }

    scratch = mkdtempSync(join(tmpdir(), 'eess-record-mention-base-'))
    const env = { ...process.env, GIT_INDEX_FILE: join(scratch, 'index') }
    const dir = join(scratch, 'tree')
    git(top, ['read-tree', tree], env)
    const paths = git(top, ['ls-files', '-z', '--', ...present], env)
    execFileSync('git', ['checkout-index', `--prefix=${dir}/`, '-z', '--stdin'], {
      cwd: top,
      env,
      input: paths,
      stdio: ['pipe', 'ignore', 'pipe'],
    })

    const result = count(dir, present)
    if (result.examined === 0) return { failure: `the rule examined no mention at ${treeish}` }
    return result
  } catch (e) {
    return { failure: e instanceof Error ? e.message.split('\n')[0] : String(e) }
  } finally {
    if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true })
  }
}
