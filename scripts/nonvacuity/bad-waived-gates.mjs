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
const run = (script) =>
  spawnSync('npm', ['run', '--silent', script], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, CI: undefined, GITHUB_ACTIONS: undefined },
  }).status

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

// 2. check:docs-code — an export on the public surface that no page mentions.
const docs = withSabotage(
  'packages/gherkin/src/index.ts',
  (t) => `${t}\nexport const __nonvacuityUndocumentedSymbol__ = 1\n`,
  () => run('check:docs-code'),
)
if (docs === 0) {
  vacuous(`check:docs-code exited ${docs} with an export documented nowhere`)
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

console.error(`${NAME}: OK — integrity, docs-code and examples each red on their own subject`)
process.exit(1)
