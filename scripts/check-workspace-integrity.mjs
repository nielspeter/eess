#!/usr/bin/env node
/**
 * Workspace integrity guardrails for the eess monorepo (plan 0051, Phase 1).
 *
 * FIVE checks, emitting six finding classes. The first two are npm-workspace
 * failure modes, which is what this script was created for; the rest are
 * workspace-wide invariants that need the same per-package walk and would
 * otherwise each need their own script.
 *
 * This count has now drifted twice. The header once said "two" and listed four,
 * review called it out, and the sentence recording that correction then survived
 * unchanged while a fifth check and a sixth finding class were added under it —
 * so the note about the drift became an instance of it. If you add a check here,
 * the number is the first thing to change.
 *
 *  1. Phantom dependencies — hoisting lets a package `import` a package that only
 *     a sibling declares; it works in the workspace but breaks on a standalone
 *     install from the registry. Each package's `src/` may import only: node
 *     builtins, its own name, and packages it declares in
 *     dependencies/peerDependencies/optionalDependencies. This also enforces the
 *     kernel-purity guarantee for free: `@nielspeter/eess` declares no deps, so
 *     any bare import there (ts-morph, picomatch, a dialect) fails.
 *
 *  2. Broken local linking — a bare version range (not the `workspace:*`
 *     protocol npm 11.x supports) can silently install the published kernel
 *     instead of linking the local one. Every `@nielspeter/eess*` package must
 *     resolve to a symlink into `packages/`, not a real directory from the
 *     registry.
 *
 *  3. Stale build output — `tsc -p` overwrites but never deletes, so a removed
 *     source file leaves its `.js`/`.d.ts` in the gitignored `dist/` forever.
 *     Every package must clean `dist` before it builds.
 *
 *  4. Source that stopped being text, in either of two ways — one raw `0x00`
 *     byte makes grep, rg and `git diff` treat a source file as binary and skip
 *     it SILENTLY (bug 0099 / bug 0144, the same defect found twice because
 *     neither filing left a guard behind); and a file that is not valid UTF-8
 *     makes grep exit 1 with NO output at all, which is quieter still (bug 0247).
 *     Either way a survey reads "not found" where the answer is.
 *
 *  5. A leftover non-vacuity probe — a file a killed fixture left behind, which
 *     `.gitignore` hides from `git status`, named here rather than reported as a
 *     defect by whichever gate trips over it (bug 0231).
 *
 * Exits non-zero on any violation. Zero dependencies — node builtins only.
 * Run: `npm run check:integrity`.
 */

import { builtinModules } from 'node:module'
import { readFileSync, readdirSync, statSync, lstatSync, readlinkSync } from 'node:fs'
import { basename, join } from 'node:path'
import { invalidUtf8At } from './lib/source-text.mjs'

const ROOT = process.cwd()
const BUILTINS = new Set(builtinModules)
const WORKSPACE_PKGS = [
  '@nielspeter/eess',
  '@nielspeter/eess-ts',
  '@nielspeter/eess-mermaid',
  '@nielspeter/eess-md',
  '@nielspeter/eess-gherkin',
  '@nielspeter/eess-crossvalidate',
]

const problems = []

// ---------- helpers ----------

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'))
}

/**
 * Every file under `dir`, regardless of extension — the population for checks
 * that care about a file's BYTES rather than its role in the compile. Kept
 * separate from `walkTs` because widening that one would change what the
 * phantom-dep check reads.
 */
function walkAny(dir, acc) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walkAny(p, acc)
    else if (e.isFile()) acc.push(p)
  }
}

function walkTs(dir, acc) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walkTs(p, acc)
    else if (e.name.endsWith('.ts')) acc.push(p)
  }
}

// The npm package a bare specifier belongs to: '@scope/name/sub' -> '@scope/name',
// 'pkg/sub' -> 'pkg'.
function packageOf(spec) {
  const parts = spec.split('/')
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

const FROM_RE = /(?:\bfrom\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]/g

// Strip block and line comments so JSDoc `@example import ... from '...'` snippets
// (this codebase documents its own API heavily) aren't mistaken for real imports.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

// A syntactically valid npm package specifier. Filters out string/template noise
// like `${importPath}`, `DomainError`, or escaped example strings that the regex
// would otherwise pick up from a codebase whose job is analyzing import strings.
const VALID_PKG_RE = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(?:\/.+)?$/

// Drop `import type …`/`export type …` statements: they are erased at runtime,
// so they can never cause a runtime standalone-install failure — which is the
// only thing the phantom-dep check guards. (A value import of a devDep — the
// jiti bug — is NOT stripped and is still caught.) This also lets a package use
// ambient `@types/*` modules (e.g. `import type { Root } from 'mdast'`) without
// a false positive.
function stripTypeOnlyImports(src) {
  return src.replace(/\b(?:import|export)\s+type\b[\s\S]*?from\s*['"][^'"]+['"]/g, '')
}

function importSpecifiers(file) {
  const src = stripTypeOnlyImports(stripComments(readFileSync(file, 'utf8')))
  const out = new Set()
  for (const m of src.matchAll(FROM_RE)) out.add(m[1])
  return out
}

// ---------- 1. phantom dependencies ----------

const packagesDir = join(ROOT, 'packages')
const pkgDirs = readdirSync(packagesDir).filter((d) => statSync(join(packagesDir, d)).isDirectory())

for (const dir of pkgDirs) {
  const pkgRoot = join(packagesDir, dir)
  let pkg
  try {
    pkg = readJson(join(pkgRoot, 'package.json'))
  } catch {
    continue
  }
  const declared = new Set([
    pkg.name,
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
  ])

  const files = []
  walkTs(join(pkgRoot, 'src'), files)
  for (const file of files) {
    for (const spec of importSpecifiers(file)) {
      if (spec.startsWith('.') || spec.startsWith('/')) continue // relative
      const bare = spec.startsWith('node:') ? spec.slice(5) : spec
      if (BUILTINS.has(bare)) continue // node builtin
      if (!VALID_PKG_RE.test(spec)) continue // not a real package specifier (string noise)
      const owner = packageOf(spec)
      if (!declared.has(owner)) {
        problems.push(
          `phantom dep: ${pkg.name} src imports "${spec}" but "${owner}" is not in its package.json ` +
            `(${file.replace(ROOT + '/', '')})`,
        )
      }
    }
  }
}

// ---------- 2. local linking ----------

for (const name of WORKSPACE_PKGS) {
  const modPath = join(ROOT, 'node_modules', name)
  let st
  try {
    st = lstatSync(modPath)
  } catch {
    problems.push(`local linking: ${name} is not installed in node_modules`)
    continue
  }
  if (!st.isSymbolicLink()) {
    problems.push(
      `local linking: ${name} is a real directory, not a workspace symlink — ` +
        `it was likely installed from the registry instead of linked locally`,
    )
    continue
  }
  const target = readlinkSync(modPath)
  if (!target.includes('packages/')) {
    problems.push(`local linking: ${name} symlinks to "${target}", expected a packages/ path`)
  }
}

// ---------- 3. the build cleans its own output ----------

// `tsc -p` OVERWRITES; it never removes. So a source file that is deleted or
// moved leaves its `.js`/`.d.ts` behind in `dist/` forever, and `dist/` is
// gitignored, so nothing ever shows it. Measured when this check was written:
// 36 orphaned `.d.ts` across the workspace, the oldest four months of them from
// plan 0165's engine copy whose `src/` counterparts no longer exist.
//
// That is not a cosmetic leftover. `dist/` is what a consumer installs and what
// any `.d.ts`-based measurement reads — a survey of "which kernel symbols reach
// a dialect's public type surface" was run against it during this branch and
// answered from files whose source had been deleted, which is exactly the shape
// of fake evidence this repo exists to refuse.
//
// The fix is structural rather than detective: every package removes `dist`
// before it builds, so the class cannot occur. This check does not look for
// stale files — after the fix there would never be any, and a check that cannot
// fail is worth less than no check (ADR-009). It checks the MECHANISM is wired,
// which is the thing that can actually regress: a package added later, with no
// `prebuild`, silently reopens the hole.

// The FIRST version of this pattern was `\brm\b[^&|]*\bdist\b|…`, and review
// measured it accepting three commands that do not clean:
//
//   "rm -rf dist-tmp"                         — `\bdist\b` matches before the `-`
//   "tsc -p tsconfig.build.json && rm -rf dist" — cleans AFTER the build, publishing nothing
//   "echo \"remember to rm the dist\""          — prose
//
// It also accepted `scripts.clean`, which nothing in this repo invokes. So the
// check that exists to satisfy ADR-009 was itself fail-open: it asserted a
// substring, while its own comment claimed it asserted a mechanism.
//
// This form requires the WHOLE `prebuild` command to be a removal of exactly
// `dist`. Anchored, so a suffix is not a match; `prebuild` only, because that is
// the slot npm runs before `build`; and no `&&`, because a removal sequenced
// after anything else is not a pre-build clean.
const CLEANS_DIST =
  /^(?:rm\s+-rf?\s+\.?\/?dist|rimraf\s+\.?\/?dist|node\s+-e\s+["'][^"']*rmSync\(\s*["']\.?\/?dist["'][^"']*["'])\s*$/

for (const dir of pkgDirs) {
  const pkgPath = join(packagesDir, dir, 'package.json')
  let parsed
  try {
    parsed = readJson(pkgPath)
  } catch {
    continue
  }
  const scripts = parsed.scripts ?? {}
  if (!scripts.build) continue
  const prebuild = scripts.prebuild
  const cleans = typeof prebuild === 'string' && CLEANS_DIST.test(prebuild.trim())
  if (!cleans) {
    problems.push(
      `stale build output: ${parsed.name} builds but never removes dist/ first — ` +
        `add "prebuild": "rm -rf dist" so a deleted source file cannot leave its ` +
        `.js/.d.ts behind (tsc overwrites, it never deletes)`,
    )
  }
}

// ---------- 4. source text stays text ----------

// A single raw `0x00` byte anywhere in a source file makes every tool that
// classifies by content treat the whole file as binary. `grep` and `rg` then
// exclude it from a search SILENTLY — no warning, no error, no exit code — so a
// sweep over the package returns "not found" for a symbol that is plainly
// defined there. `git diff` degrades the same way: `Bin 5912 -> 5983 bytes`
// instead of a reviewable patch.
//
// This is not hypothetical and it is not cheap. `packages/crossvalidate/src/
// md-gherkin.ts` carried two of them for months, written as a composite-key
// separator — the IDEA was sound (a `U+0000` cannot collide with a path or a
// title); only the ENCODING was wrong, a raw byte where the two-character `\0`
// escape produces an identical runtime string. Nothing could catch it: the file
// is valid UTF-8, `tsc` and ts-morph read it fine, and its tests passed.
//
// What it cost: it was filed TWICE, two days apart, by two reviewers who each
// re-derived it from scratch (bugs 0099 and 0144) — the second never knew the
// first existed. Before that it produced a live false negative that went into a
// filed bug report as evidence, because a grep sweep of the package silently
// skipped the one file that held the answer. This repo's whole survey
// discipline — the `review-proposal` skill's Step 2 ("grep `packages/*/src`,
// always"), every reviewer persona's instructions — assumes grep sees every
// source file. For that file, for months, it did not.
//
// Neither bug shipped a guard. 0144 closed with "Red test written first: n/a",
// and 0099's guard box is the one this closes. So the class stayed open with
// two records saying it was understood: exactly the state ADR-009 calls worse
// than no check, because the record reads as coverage.
//
// Scope is every file under `packages/*/src/**` — the population the survey discipline
// names and both incidents hit. It is deliberately NOT the whole repo — but the
// reason written here was measured and found false, so it is corrected rather
// than repeated. It used to say the fixtures under `scripts/nonvacuity/` "carry
// deliberately corrupt payloads, and a guard that reds on its own test data
// teaches people to disable it". Enforcement review of bug 0247 scanned the
// entire repo: ZERO files carry a NUL or invalid UTF-8, `scripts/nonvacuity/`
// included — the fixtures plant their payloads through `Buffer.from(...)` INTO
// `packages/core/src`, and say so in their own comments, precisely so they stay
// greppable.
//
// So the narrow scope costs no findings today and is not protecting what the old
// comment claimed. What it does leave uncovered is real and worth naming: about
// 1,360 text files — `packages/*/tests` (790), `work/` (204, the record corpus
// every reviewer greps), `scripts/` (79, these gates), and the root `*.rules.ts`
// files. A latin-1 byte in any of them is exactly as invisible to grep and has no
// guard at all. Widening is a decision with consequences (a future fixture may
// legitimately need a bad byte), so it is filed as bug 0248 rather than taken
// here.

// `walkTs` filters to `.ts`, which is right for the phantom-dep check (only a
// compiled module can carry a runtime import) and WRONG here. Review measured
// it: `packages/mermaid/src/parser/grammar/*.langium` are source text living
// inside the very glob this check advertises, and a raw NUL planted in one left
// the gate green AND the denominator unmoved — the file was never counted, so
// nothing looked missing. Text tooling does not care about extensions, so
// neither does this walk. `.tsx`/`.mts`/`.cts` are covered by the same change
// rather than by a list that needs extending.
const sourceScanned = []
let packagesWalked = 0
for (const dir of pkgDirs) {
  const files = []
  walkAny(join(packagesDir, dir, 'src'), files)
  // Per-package, not per-run. The first version summed across every package and
  // compared the TOTAL to zero, so one package's `src` being renamed or moved
  // dropped its files silently while the headline count stayed healthy — the
  // exact shape bug 0131 round 3 found one lane over. Measured in review:
  // making gherkin contribute zero files left the gate at exit 0 printing
  // "243 source files free of raw NUL bytes", with a `data`-classified file
  // inside a package it claimed to have scanned.
  if (files.length === 0) {
    problems.push(
      `source text: ${dir} contributed 0 files under packages/${dir}/src — this ` +
        `check cannot speak for that package, so its pass is not evidence about it`,
    )
    continue
  }
  packagesWalked += 1
  for (const file of files) {
    sourceScanned.push(file)
    // Read as a Buffer, not utf8: the point is the raw byte, and a decode step
    // is one more place for the thing being measured to be normalised away.
    const buf = readFileSync(file)

    // Two `if`s over ONE buffer, not two loops over one list. An earlier version
    // of this change split them and justified it by "a reader given both
    // findings for one byte would fix the wrong one" — which is impossible. A
    // raw NUL is VALID UTF-8 (`U+0000` encodes as `0x00`), so no single byte can
    // produce both findings, and nothing suppressed either anyway. Architecture
    // review caught the comment asserting a mechanism that was not there, which
    // is the failure this file's own history is about (bugs 0099/0144, above).
    //
    // It also read every file twice. This reads each one once, and an early
    // `continue` on the NUL branch would have skipped the UTF-8 check for every
    // clean file — the shape that made the split look necessary.
    const first = buf.indexOf(0)
    if (first !== -1) {
      let count = 0
      for (let i = first; i !== -1; i = buf.indexOf(0, i + 1)) count += 1
      const line = buf.subarray(0, first).toString('utf8').split('\n').length
      problems.push(
        `source text: ${file.replace(ROOT + '/', '')} contains ${count} raw NUL ` +
          `byte(s) (first at line ${line}), so grep/rg skip this file silently and ` +
          `git diff renders it as binary — replace the raw byte with an escape its ` +
          `own syntax provides (in TS/JS, the two-character "\\0"; the runtime ` +
          `string is identical)`,
      )
    }

    // A tension worth naming, because the obvious fix is wrong (enforcement
    // review of bug 0247). A leftover `__nonvacuity_probe*` file now trips this
    // scan BEFORE the leftover-probe check below names it, so a reader gets
    // "re-encode as UTF-8" above "delete it" — the inverse of bug 0231's stated
    // purpose, which is that a leftover is named for what it is rather than
    // reported as a genuine defect by whichever rule it trips.
    //
    // Skipping probe-prefixed files here would fix the reading order and break
    // both `integrity/source-text` scenarios, whose probes carry that exact
    // prefix and rely on this scan seeing them. Left as-is deliberately: the
    // finding is correct, only its position is unhelpful, and re-ordering the
    // gate's checks is bug 0231's design to revisit rather than this one's.

    // The other way a file stops being text, and the quieter one.
    const bad = invalidUtf8At(buf)
    if (bad !== -1) {
      const badLine = buf.subarray(0, bad).toString('utf8').split('\n').length
      const byte = `0x${buf[bad].toString(16).padStart(2, '0')}`
      problems.push(
        `source text: ${file.replace(ROOT + '/', '')} is not valid UTF-8 — first ` +
          `invalid sequence starts at byte ${byte}, offset ${bad} (line ${badLine}). ` +
          `grep skips a file like this with NO output, NO warning and exit 1, and ` +
          `git diff renders it as binary — so a search that missed it reads exactly ` +
          `like a search that found nothing in it. Quieter than a NUL, which at ` +
          `least announces itself. (ripgrep is the exception: it decodes lossily ` +
          `and still finds matches, so "rg found it" is not evidence the file is ` +
          `fine.) Re-encode as UTF-8, or write the character as an escape its own ` +
          `syntax provides`,
      )
    }
  }
}

// Run-level backstop beneath the per-package one above: if `pkgDirs` itself
// came back empty there are no per-package findings to raise, and the loop would
// complete having examined nothing at all (ADR-010: a pass is constructed from
// evidence, never from a default).
if (packagesWalked === 0) {
  problems.push(
    `source text: 0 packages walked under packages/ — the check examined ` +
      `nothing, so its pass is not evidence of anything`,
  )
}

// ---------- leftover non-vacuity probes ----------

// Bug 0231. `scripts/nonvacuity/` plants real files inside the populations the
// gates declare — it has to, or the probe would not be in the set under test.
// Each one is removed by a `finally`, by SIGINT/SIGTERM/SIGHUP handlers, and by
// a startup sweep; all three were measured, and `SIGKILL` defeats all three.
//
// What makes a survivor expensive is not that it survives. It is that
// `.gitignore` carries `**/__nonvacuity_probe*` — correctly, so a probe cannot
// be committed by accident — which also means `git status` shows a clean tree
// while `check:arch` and `check:guardrails` red on a file the reader cannot
// find. The recovery path (the startup sweep) sits behind `check:nonvacuity`,
// the slowest gate in the repo, so the fast loop never reaches it.
//
// This check exists so the leftover is named by a gate that can say what it is,
// instead of being reported as a genuine defect by whichever rule it trips.
// Matching is by basename PREFIX, the same shape as the `.gitignore` rule, so a
// probe added later is covered without editing a list here.
const PROBE_PREFIX = '__nonvacuity_probe'
const probeRoots = [
  ...pkgDirs.map((d) => join(packagesDir, d, 'src')),
  join(ROOT, 'docs'),
  join(ROOT, 'work'),
  join(ROOT, 'examples'),
  join(ROOT, 'scripts', 'nonvacuity'),
]
let probeRootsWalked = 0
/**
 * Every path under `dir` — files AND directories.
 *
 * Separate from `walkAny`, which is shared with the source-text scan and
 * `readFileSync`s everything it returns (handing it a directory throws EISDIR —
 * measured, when the first version of this fix changed the shared helper).
 *
 * Directories matter here because a probe may put the prefix on its FOLDER
 * rather than its file — `work/__nonvacuity_probe_nested__/pointer.md`,
 * `work/__nonvacuity_probe_inert_excl__/table.md`. Those escaped this sweep
 * entirely while `.gitignore` hid them from `git status`: bug 0231's blind spot,
 * reopened by the fixtures that adopted `withProbeDir`. Measured before the fix:
 * two such directories present, `check:integrity` exit 0.
 */
function walkPaths(dir, acc) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const p = join(dir, e.name)
    acc.push(p)
    if (e.isDirectory()) walkPaths(p, acc)
  }
}

for (const root of probeRoots) {
  const files = []
  walkPaths(root, files)
  // A root that does not exist contributes nothing and is not a finding: the
  // list is deliberately wider than any single checkout needs, so that a probe
  // planted somewhere new is caught rather than requiring this list to have
  // predicted it. Only the roots that EXIST count toward the denominator.
  if (files.length === 0) continue
  probeRootsWalked += 1
  for (const file of files) {
    if (!basename(file).startsWith(PROBE_PREFIX)) continue
    problems.push(
      `non-vacuity probe present: ${file.replace(ROOT + '/', '')} — a fixture under ` +
        `scripts/nonvacuity/ plants this file and removes it again. Either a ` +
        `\`check:nonvacuity\` run is IN FLIGHT, in which case wait for it and do NOT ` +
        `delete the file (the run needs it) — or one was killed before its cleanup ran, ` +
        `in which case delete it. It is gitignored (\`**/${PROBE_PREFIX}*\`), so ` +
        `\`git status\` will not show it either way, and until it is gone other gates ` +
        `will report it as a defect in your own code`,
    )
  }
}

// ---------- report ----------

if (problems.length > 0) {
  console.error(`\nWorkspace integrity: ${problems.length} problem(s)\n`)
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error('')
  process.exit(1)
}
console.error(
  `Workspace integrity: OK — ${pkgDirs.length} packages, no phantom deps, ` +
    `all @nielspeter/eess* locally linked, every build cleans its dist/, ` +
    `${sourceScanned.length} source files across ${packagesWalked} packages valid UTF-8 and free of raw NUL bytes, ` +
    `${probeRootsWalked} probe roots free of leftover fixtures.`,
)
