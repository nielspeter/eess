/**
 * The one place that resolves the base commit a gate compares against.
 *
 * Two consumers read it and they must never disagree:
 *
 *  - `scripts/check-release.mjs`, behind `npm run check:release`;
 *  - `scripts/check-corpus.mjs`, for the diff-gated proposal rules (plan 0218).
 *
 * Extracted rather than copied, for the reason `scripts/lib/kernel-surface.mjs`
 * records about its own pair: a second copy synced by hand is a copy that
 * drifts, and the drift here would be silent — two gates measuring different
 * diffs while both print green.
 *
 * The resolution order is a promise, not a hint. `EESS_RELEASE_BASE` wins; then
 * the PR's own target (`GITHUB_BASE_REF`); then `origin/main`; then `main`. If
 * an explicit override does not resolve, that is an error rather than a
 * fallback — falling back would silently measure a different diff than the one
 * that was asked for.
 */
import { execFileSync } from 'node:child_process'

// `core.quotepath=false` so a non-ASCII path arrives as itself rather than
// `"packages/md/src/caf\303\251.ts"`, which no prefix test would match and which
// review found silently hid the owning package.
export const git = (...args) =>
  execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()

/** Resolve a ref to a sha, or undefined when it does not exist here. */
export function revParse(ref) {
  try {
    return git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`) || undefined
  } catch {
    return undefined // `--quiet` exits 1 for an unknown ref; that is the answer, not an error
  }
}

/**
 * Resolve the base ref and merge base.
 *
 * Returns `{ ok: true, baseRef, mergeBase, headSha, baseIsHead }`, or
 * `{ ok: false, headline, detail }` describing why not. **It never throws and
 * never guesses** — a caller that cannot run without a base ref fails loudly
 * with `headline`/`detail`; a caller for which the diff is one rule among many
 * reports a configuration finding and keeps going. Neither may treat an
 * unresolved base as "nothing changed".
 */
export function resolveBaseRef(env = process.env) {
  const override = env.EESS_RELEASE_BASE
  if (override !== undefined && override !== '' && revParse(override) === undefined) {
    return {
      ok: false,
      headline: `EESS_RELEASE_BASE='${override}' does not resolve`,
      detail: [
        'The override was set explicitly, so falling back to another base would',
        'silently measure a different diff than the one you asked for.',
      ],
    }
  }

  const candidates = [
    override,
    env.GITHUB_BASE_REF ? `origin/${env.GITHUB_BASE_REF}` : undefined,
    'origin/main',
    'main',
  ].filter((r) => r !== undefined && r !== '')

  const baseRef = candidates.find((r) => revParse(r) !== undefined)
  if (baseRef === undefined) {
    return {
      ok: false,
      headline: 'no base ref resolves',
      detail: [
        `tried: ${candidates.join(', ')}`,
        '',
        'This check compares against a base commit, so it cannot run without one.',
        'In CI: `actions/checkout` needs `fetch-depth: 0` (the default depth of 1',
        'leaves no `origin/main`). Locally: set EESS_RELEASE_BASE=<ref>.',
      ],
    }
  }

  let mergeBase
  try {
    mergeBase = git('merge-base', baseRef, 'HEAD')
  } catch {
    return {
      ok: false,
      headline: `no merge base between '${baseRef}' and HEAD`,
      detail: ['Unrelated histories, or a partial fetch. In CI use `fetch-depth: 0`.'],
    }
  }

  const headSha = git('rev-parse', 'HEAD')
  return { ok: true, baseRef, mergeBase, headSha, baseIsHead: mergeBase === headSha }
}

/**
 * Repo-relative paths ADDED since the merge base, matching `prefix`.
 *
 * The union of two things, because either alone is a half-answer:
 *
 *  - additions COMMITTED between the merge base and HEAD — what CI sees on a
 *    pull request, and the only half that matters there;
 *  - files present in the working tree and not yet tracked — what a local
 *    `npm run validate` sees BEFORE you commit, which is when a missing section
 *    is cheapest to add.
 *
 * `--others` is deliberately NOT passed `--exclude-standard`: callers filter by
 * `prefix`, and inside a corpus directory the ignored files are the non-vacuity
 * harness's own probes, which a caller must be able to see in order to fixture
 * this at all. Outside that prefix nothing is returned, so `node_modules` and
 * `dist` never arrive here.
 */
export function addedSince(mergeBase, prefix) {
  const committed = git('diff', '--name-status', '--diff-filter=A', mergeBase, 'HEAD', '--', prefix)
    .split('\n')
    .filter((l) => l !== '')
    .map((l) => l.split('\t')[1])
  // SCOPED to `prefix` as a pathspec, not filtered afterwards. Unscoped,
  // `--others` walks every untracked file in the repo — measured 16,204 here,
  // almost all of them `node_modules` — on every single run of this gate, which
  // took the non-vacuity harness from seconds to minutes before it was caught.
  const untracked = git('ls-files', '--others', '--', prefix).split('\n')
  return [...new Set([...committed, ...untracked])].filter(
    (p) => p !== undefined && p !== '' && p.startsWith(prefix),
  )
}
