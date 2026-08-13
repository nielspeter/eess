#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — `scripts/lib/corpus-link-routing.mjs` must fail
 * closed, not open, on the three regressions independently demonstrated
 * during bug 0086's review round:
 *
 *   1. A `ROOTS` entry nobody classified as site or repo-native must be
 *      REJECTED by `unclassifiedRoots`, not silently defaulted either way.
 *   2. `isRepoNativeLink` must be a true allowlist: `docs/` and any
 *      unrecognised root read `false` (the strict, resolveDirectories-off
 *      profile) — only the explicit `REPO_NATIVE_ROOTS` entries read `true`.
 *   3. `siteOptsAreSafe` must reject `resolveDirectories: true` leaking
 *      directly into the site profile's own options — a mutation the routing
 *      in (1)/(2) cannot catch, since it never runs on a link the site
 *      profile itself already resolved.
 *
 * All three were proven false-green under the previous design by two
 * reviewers independently: mutating the site profile to add
 * `resolveDirectories`, and adding a new `ROOTS` entry without updating the
 * classifier — neither was caught by `check:corpus` or `check:nonvacuity`.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = all three correctly rejected/classified — OK
 *   0 = the gate is vacuous (accepted an unclassified root, classified
 *       something as repo-native that isn't explicitly on the allowlist, or
 *       accepted a site profile with resolveDirectories set)
 *   2 = unexpected error, or the fixture's own premise broke
 */
import {
  isRepoNativeLink,
  siteOptsAreSafe,
  unclassifiedRoots,
  REPO_NATIVE_ROOTS,
} from '../lib/corpus-link-routing.mjs'

let failures = []

// Direction 1 — a genuinely unclassified root must be flagged.
const roots1 = ['docs/**', 'work/**', 'mystery/**']
const found1 = unclassifiedRoots(roots1, ['docs/'])
if (!found1.includes('mystery/')) {
  failures.push(`unclassifiedRoots(${JSON.stringify(roots1)}) did not flag 'mystery/' — found: ${JSON.stringify(found1)}`)
}
// The clean direction — every real root here is classified, so the check
// must not cry wolf on the corpus this repo actually runs.
const roots2 = ['work/plans/**', 'work/proposals/**', 'work/bugs/**', 'adr/**', 'docs/**']
const found2 = unclassifiedRoots(roots2, ['docs/'])
if (found2.length > 0) {
  failures.push(`unclassifiedRoots on the real ROOTS shape found ${JSON.stringify(found2)} — fixture premise broken`)
}

// Direction 2 — isRepoNativeLink is an allowlist: only REPO_NATIVE_ROOTS
// reads true; docs/ and an unrecognised root both read false (safe default).
if (isRepoNativeLink('docs/guide/page.md') !== false) {
  failures.push(`isRepoNativeLink('docs/guide/page.md') !== false — site profile leaked into the loose default`)
}
if (isRepoNativeLink('mystery/page.md') !== false) {
  failures.push(`isRepoNativeLink('mystery/page.md') !== false — an unrecognised root defaulted to the loose profile, the exact bug 0086's review round found`)
}
if (isRepoNativeLink('work/bugs/fixed/0121.md') !== true) {
  failures.push(`isRepoNativeLink('work/bugs/fixed/0121.md') !== true — a real repo-native root was not recognised`)
}
if (!REPO_NATIVE_ROOTS.includes('work/') || !REPO_NATIVE_ROOTS.includes('adr/')) {
  failures.push(`REPO_NATIVE_ROOTS missing an expected entry — found: ${JSON.stringify(REPO_NATIVE_ROOTS)}`)
}

// Direction 3 — the site profile itself must be rejected the moment
// resolveDirectories appears on it, independent of any routing logic.
if (siteOptsAreSafe({ tryExtensions: ['.md'], resolveDirectories: true }) !== false) {
  failures.push(
    'siteOptsAreSafe({ resolveDirectories: true }) !== false — a directory-resolving site ' +
      "profile was accepted, the exact mutation that made check-corpus.mjs's own routing " +
      'fix insufficient on its own',
  )
}
if (siteOptsAreSafe({ tryExtensions: ['.md'], tryIndex: 'index.md', rootDir: 'docs' }) !== true) {
  failures.push('siteOptsAreSafe(the real SITE_OPTS shape) !== true — fixture premise broken')
}

if (failures.length > 0) {
  console.error(`bad-corpus-link-routing: ${failures.length} check(s) failed:`)
  for (const f of failures) console.error(`  x ${f}`)
  process.exit(0)
}

console.error(
  'bad-corpus-link-routing: corpus/link-routing-fails-closed — unclassified root rejected, ' +
    'unrecognised root defaults to the strict profile, and a directory-resolving site profile ' +
    'is rejected outright',
)
process.exit(1)
