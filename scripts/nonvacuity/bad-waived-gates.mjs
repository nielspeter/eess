#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — the three gates that carried a `'no-gate-yet'` waiver.
 *
 * `NO_GATE_NEEDED` in `check-nonvacuity.mjs` let a `check:*` script be counted as
 * "accounted for" without any fixture proving it fails. Measured: replacing
 * `scripts/check-docs-code.mjs` with a four-line script that always exits 0 left
 * the harness reporting `gate coverage — OK` and `no fixture is silently green`.
 * A gate deleted outright, and the meta-gate green.
 *
 * A waiver that says "not yet" is a permission slip, and this repo's whole
 * argument is that a check which cannot fail is worth less than no check. So the
 * three waivers are gone and this proves each of the three reds on a real
 * violation of its own stated subject:
 *
 *   check:integrity  — a phantom dependency (imported, not declared)
 *   check:docs-code  — a public export documented nowhere
 *   check:examples   — an example that does not compile
 *
 * It has since grown past those three, because `check:integrity` runs several
 * checks behind one `GATE_FOR` row and each new one is invisible to
 * `gateCoverage()` until a scenario here trips it: stale build output (4) and a
 * source file carrying raw NUL bytes (6).
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = every scenario behaved as expected (the gate fails builds it must) — OK
 *   0 = a scenario did not — that gate is vacuous
 *   2 = unexpected THROW only, never a behavioural result
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const NAME = 'bad-waived-gates'

function vacuous(msg) {
  console.error(`${NAME}: ${msg}`)
  process.exit(0)
}

// NON-ZERO, not `=== 1`. A gate's contract is "fails the build"; the specific
// code is the tool's business — `tsc` exits 2 on compile errors, which an
// earlier version of this fixture read as the gate not failing.
const spawn = (script) =>
  spawnSync('npm', ['run', '--silent', script], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, CI: undefined, GITHUB_ACTIONS: undefined },
  })

const run = (script) => spawn(script).status

/** Status AND output — needed when exit code alone cannot attribute the failure. */
const runCapture = (script) => {
  const r = spawn(script)
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

/** Sabotage a real file, run `fn`, always restore. */
function withSabotage(relPath, rewrite, fn) {
  const path = join(REPO, relPath)
  const original = readFileSync(path, 'utf8')
  try {
    const next = rewrite(original)
    if (next === original) {
      throw new Error(`sabotage of ${relPath} changed nothing — the pattern no longer matches`)
    }
    writeFileSync(path, next)
    return fn()
  } finally {
    writeFileSync(path, original)
  }
}

/**
 * Sabotage by ADDING a file, run `fn`, always remove it.
 *
 * `contents` may be a string or a Buffer — scenario 6 plants raw bytes, which a
 * string literal in this file could not express without making THIS file binary.
 */
function withAddedFile(relPath, contents, fn) {
  const path = join(REPO, relPath)
  try {
    writeFileSync(path, contents)
    return fn()
  } finally {
    rmSync(path, { force: true })
  }
}

// 1. check:integrity — a phantom dependency is an import a package does not declare.
const integrity = withSabotage(
  'packages/md/src/corpus.ts',
  (t) => `import { Project } from 'ts-morph'\nvoid Project\n${t}`,
  () => run('check:integrity'),
)
if (integrity === 0) {
  vacuous(`check:integrity exited ${integrity} with a phantom \`ts-morph\` import in eess-md`)
}

// 2. check:surface — an undocumented symbol on the KERNEL ROOT.
//
// Three things here are deliberate, and the first two were WRONG in the first
// version of this fixture — found in review, and each hid the other.
//
// The SUBJECT is the kernel root. `check:surface` blocks on ADR-011 clause 1's
// population only; the dialect surfaces are a reported census. This probe used to
// sabotage `packages/gherkin/src/index.ts` and run `check:docs-code`, which owned
// the surface block at the time — it owns only fence compilation now, so the old
// probe tested a gate that no longer asks the question.
//
// The PAYLOAD is a braced export. `exportsOf` parses
// `/^export\s+(type\s+)?\{([^}]+)\}/gm` (`scripts/lib/public-surface.mjs`), so a
// declaration-form `export const X = 1` is invisible to the very gate this probe
// exists to trip. Measured: with that payload the gate's `missing` set did not
// change at all.
//
// The ASSERTION reads the output, not the exit code. This gate carries a real,
// documented backlog and can be red for its own reasons, so an exit-code probe
// cannot tell "the gate saw my symbol" from "the gate was red anyway" — a pass
// constructed from a default (ADR-010), inside the harness written to refuse
// them. Naming the symbol is immune to the baseline, and it is what `firedOn`
// does for the rule-id-bearing gates.
const SENTINEL = '__nonvacuityUndocumentedSymbol__'
const docs = withSabotage(
  'packages/core/src/index.ts',
  (t) => `${t}\nconst ${SENTINEL} = 1\nexport { ${SENTINEL} }\n`,
  () => runCapture('check:surface'),
)
// Both halves, deliberately. Naming the symbol proves DETECTION and is immune to
// an unrelated red; a non-zero exit proves BLOCKING. Review measured that the
// name-only form left `process.exit(1)` in `scripts/check-surface.mjs`
// unguarded — delete that one line and the gate still printed the symbol, still
// exited 0, and this fixture stayed green. The excuse for dropping the exit code
// ("it cannot tell detection from an unrelated red") does not apply to the
// population this gate blocks on: the kernel root is clean, so exit 0 is the
// baseline and any non-zero is this fixture's doing.
if (!docs.out.includes(SENTINEL) || docs.status === 0) {
  vacuous(
    `check:surface exited ${docs.status} and ${docs.out.includes(SENTINEL) ? 'named' : 'never named'} ` +
      `${SENTINEL} — it must both SEE the undocumented kernel-root export and FAIL on it`,
  )
}

// 3. check:examples — an example that does not typecheck.
//
// The probe is `*.test.ts` deliberately: `examples/tsconfig.json` has
// `"include": ["*.test.ts"]`, so a plain `.ts` file in that directory is
// typechecked by nothing. Measured while writing this fixture — a file with
// `const broken: number = "not a number"` passed the gate. That hole is bug
// 0222; this fixture proves the gate reds INSIDE its declared scope, which is
// the most it can honestly claim while the scope is wrong.
const examples = withAddedFile(
  'examples/__nonvacuity_probe__.test.ts',
  'export const broken: number = "not a number"\n',
  () => run('check:examples'),
)
if (examples === 0) {
  vacuous(`check:examples exited ${examples} with an example that does not compile`)
}

// 4. check:integrity, second check — a package that builds without cleaning dist.
//
// `check:integrity` runs THREE checks (phantom deps, local linking, stale build
// output). Scenario 1 covers the first, so `GATE_FOR` marked the whole script
// accounted for while the newest of the three had no probe at all — the exact
// one-row-per-multi-check-script trap `GATE_FOR`'s own comment warns about.
//
// Removing `prebuild` is the regression that matters: `tsc` overwrites but never
// deletes, so a package without it leaves the `.js`/`.d.ts` of every deleted
// source file in the tarball forever, and `dist/` is gitignored so nothing shows
// it. Asserting the package NAME appears keeps this honest if the gate ever reds
// for one of its other two checks.
const stale = withSabotage(
  'packages/gherkin/package.json',
  (t) => {
    const next = t.replace(/\s*"prebuild": "rm -rf dist",\n/, '\n')
    if (next === t) throw new Error('gherkin package.json has no prebuild to remove')
    return next
  },
  () => runCapture('check:integrity'),
)
if (!stale.out.includes('@nielspeter/eess-gherkin')) {
  vacuous(
    `check:integrity (exit ${stale.status}) never named @nielspeter/eess-gherkin after its ` +
      `prebuild clean was removed`,
  )
}

// 5. check:docs-code — a documentation fence that does not compile.
//
// Scenario 2 used to be this gate's only fixture. Retargeting it to
// `check:surface` (which took the public-surface half of the script) left
// `check:docs-code` with NO probe at all, while `GATE_FOR` still recorded it as
// covered — so deleting the whole script would have left the meta-gate printing
// `gate coverage — OK`. That is verbatim the state whose measurement justified
// abolishing the `no-gate-yet` waivers, restored by the fix for a different
// finding. Found in review.
const fence = withSabotage(
  'docs/getting-started.md',
  (t) => {
    // The anchor has to sit inside a fence the gate actually COMPILES, and most
    // are not: a fence is checked only if it imports AND calls an entry function
    // (`project`/`workspace`/`corpus`/`features`) — 51 qualify, 306 are fragments
    // skipped by design. The first attempt at this fixture sabotaged a fence in
    // `docs/custom-rules.md`, which imports `definePredicate` and is therefore a
    // fragment; the gate exited 0 and the obvious reading was "the gate is
    // fail-open". It is not. The probe was aimed at a fence nothing checks, which
    // is its own lesson about writing sabotage against a filtered population.
    const at = t.indexOf("\nimport { project } from '@nielspeter/eess-ts'")
    if (at === -1) throw new Error('docs/getting-started.md: anchor import line not found')
    const after = t.indexOf('\n', at + 1) + 1
    return `${t.slice(0, after)}const __nonvacuityBrokenFence__: number = 'not a number'\n${t.slice(after)}`
  },
  () => run('check:docs-code'),
)
if (fence === 0) {
  vacuous(`check:docs-code exited ${fence} with a documentation fence that does not typecheck`)
}

// 6. check:integrity, third check — a source file that stopped being text.
//
// The same one-row-per-multi-check-script trap as scenario 4, one check later:
// `check:integrity` now runs FOUR checks and `GATE_FOR` still maps the script to
// a single row, so a new check inside it is invisible to `gateCoverage()` by
// construction. That is not a hypothetical — it is how the NUL-byte class stayed
// live for six weeks after being filed TWICE (bugs 0099 and 0144): both records
// described it correctly and neither left anything that could fail.
//
// The probe writes a `Buffer`, so the file on disk gets a genuine `0x00` byte —
// the thing under test is the byte, not a string that renders like one. This
// fixture's OWN source uses the `\x00` escape to build it, which is the point:
// the escape keeps THIS file text (the correct form) while the Buffer plants the
// raw byte in the probe (the defect). Writing a raw byte here instead would make
// the fixture itself unsearchable — and the guard it tests would then red on it.
//
// Asserting the file NAME appears keeps it honest against the gate's other three
// checks, per scenario 4's lesson.
const NUL_PROBE = 'packages/core/src/__nonvacuity_nul_probe__.ts'
const nul = withAddedFile(
  NUL_PROBE,
  Buffer.from('export const sep = `a\x00b`\n', 'utf8'),
  () => runCapture('check:integrity'),
)
if (!nul.out.includes('__nonvacuity_nul_probe__') || nul.status === 0) {
  vacuous(
    `check:integrity exited ${nul.status} and ${nul.out.includes('__nonvacuity_nul_probe__') ? 'named' : 'never named'} ` +
      `the raw-NUL probe — it must both SEE a source file that grep skips and FAIL on it`,
  )
}

console.error(
  `${NAME}: OK — integrity (phantom dep + stale output + raw NUL), surface, docs-code and ` +
    `examples each red on their own subject`,
)
process.exit(1)
