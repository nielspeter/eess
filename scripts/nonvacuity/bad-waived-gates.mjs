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

/** Sabotage by ADDING a file, run `fn`, always remove it. */
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
if (!docs.out.includes(SENTINEL)) {
  vacuous(
    `check:surface (exit ${docs.status}) never named ${SENTINEL} — it did not see the ` +
      `undocumented export this fixture added to the kernel root`,
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

console.error(
  `${NAME}: OK — integrity (phantom dep + stale output), surface and examples each red on ` +
    `their own subject`,
)
process.exit(1)
