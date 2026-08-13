/**
 * Bug 0086's review round — `check-corpus.mjs`'s directory-link routing
 * (which corpus region gets `resolveDirectories`) was a hand-maintained
 * classification with no automated proof, and it defaulted to the **loose**
 * profile for anything not explicitly recognised as the `docs/` site — the
 * exact false-green direction this fix exists to prevent. Demonstrated live
 * by two independent reviewers: mutating the site profile to add
 * `resolveDirectories`, and adding a new root without updating the
 * classifier, both passed `check:corpus` and `check:nonvacuity` silently.
 *
 * Fixed by inverting the polarity. `REPO_NATIVE_ROOTS` is the explicit
 * allowlist for the loose (`resolveDirectories: true`) profile; anything not
 * on it — including any future root nobody remembered to classify — gets the
 * strict, site-safe profile by default. A real directory link in an
 * unclassified new root now reads as a false **red** (annoying, safe) rather
 * than a silent false green. `unclassifiedRoots` goes further: it refuses to
 * let a genuinely unclassified root run at all, rather than trusting the
 * default silently.
 */

/** Roots whose links resolve real directories (GitHub/GitLab-rendered, not a
 * static site) — an explicit opt-in list, not a computed complement. */
export const REPO_NATIVE_ROOTS = ['work/', 'adr/']

/** @param {string} relPath */
export function isRepoNativeLink(relPath) {
  return REPO_NATIVE_ROOTS.some((root) => relPath.startsWith(root))
}

/**
 * Every glob in `roots` must be explicitly classified as either `siteRoots`
 * or `REPO_NATIVE_ROOTS` — an unclassified root is the exact gap this
 * module's review round found, one level up from a single link.
 *
 * @param {readonly string[]} roots - e.g. `ROOTS` from `check-corpus.mjs`
 * @param {readonly string[]} siteRoots - e.g. `['docs/']`
 * @returns {string[]} top-level segments claimed by neither list
 */
export function unclassifiedRoots(roots, siteRoots) {
  const topSegment = (glob) => `${glob.split('/')[0]}/`
  const seen = new Set()
  const out = []
  for (const glob of roots) {
    const seg = topSegment(glob)
    if (seen.has(seg)) continue
    seen.add(seg)
    if (!siteRoots.includes(seg) && !REPO_NATIVE_ROOTS.includes(seg)) out.push(seg)
  }
  return out
}

/**
 * The routing above only governs which profile's *violations* get counted
 * for which region — it cannot protect against the site's own resolve()
 * options being mutated to add `resolveDirectories` directly, which would
 * make the site profile itself resolve a directory link no gate downstream
 * would ever see as a violation to route. Demonstrated live in review: that
 * one-line edit passed `check:corpus` and `check:nonvacuity` silently, since
 * the routing logic never runs on a link that resolved cleanly in the first
 * place.
 *
 * @param {{ resolveDirectories?: boolean }} siteOpts
 * @returns {boolean} true iff the site profile is safe (no directory
 *   resolution leaking into it)
 */
export function siteOptsAreSafe(siteOpts) {
  return siteOpts.resolveDirectories !== true
}
