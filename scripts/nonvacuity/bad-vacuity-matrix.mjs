#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — the vacuity matrix itself (plan 0088 Phase 4a) must
 * fail the build on a genuinely fail-open, unratcheted export.
 *
 * Every real export the matrix probes is provably non-vacuous, so there is no
 * committed violating input in the real export surface to point at. This runs
 * a mutated COPY of the real script against the real, unmodified
 * @nielspeter/eess-ts build — the same "real script, different real state"
 * pattern bad-release-e2e.mjs uses with a throwaway git repo.
 *
 * **The mutation INJECTS a synthetic fail-open probe** rather than stripping
 * the ratchet. It used to do the latter, relying on `schemaFromSDL()` being a
 * genuinely fail-open export with a KNOWN_FAIL_OPEN entry — and bug 0155
 * fixed that export, so the ratchet emptied and stripping it stopped producing
 * any violating input at all. The harness caught its own fixture going
 * vacuous, which is exactly what it is for. An injected probe cannot rot the
 * same way: it does not depend on any real export staying broken.
 *
 * The mutated copy lives inside scripts/nonvacuity/ (not /tmp) so Node's
 * ancestor-walk module resolution still finds this repo's node_modules;
 * VACUITY_TSCONFIG_OVERRIDE points it back at the real, co-located fixture.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = the mutated matrix correctly reported the unratcheted fail-open — OK
 *   0 = it didn't — the matrix's own fail-open detection is vacuous
 *   2 = unexpected error (module load, missing file, …) — treated as fail
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..', '..')
const realScript = join(repoRoot, 'scripts', 'vacuity-matrix.mjs')
const mutatedScript = join(__dirname, '.bad-vacuity-matrix-mutated.mjs')
const realTsconfig = join(
  repoRoot,
  'packages/ts/tests/fixtures/vacuity/tsconfig.json',
)
// The non-empty corpus the assertion-less probe needs (bug 0155). Same reason
// as above: the mutated copy runs from scripts/nonvacuity/, so its own
// repoRoot-relative default would resolve to the wrong path.
const realNonEmptyTsconfig = join(
  repoRoot,
  'packages/ts/tests/fixtures/vacuity-nonempty/tsconfig.json',
)

const source = readFileSync(realScript, 'utf8')
const marker = 'const KNOWN_FAIL_OPEN = ['
const startIdx = source.indexOf(marker)
if (startIdx === -1) {
  console.error('bad-vacuity-matrix: could not find "const KNOWN_FAIL_OPEN = [" in the real script — refusing to mutate blind')
  process.exit(2)
}
// Find the matching closing bracket for this array literal.
let depth = 0
let endIdx = -1
for (let i = startIdx + marker.length - 1; i < source.length; i++) {
  if (source[i] === '[') depth++
  else if (source[i] === ']') {
    depth--
    if (depth === 0) {
      endIdx = i
      break
    }
  }
}
if (endIdx === -1) {
  console.error('bad-vacuity-matrix: could not find the closing "]" for KNOWN_FAIL_OPEN — refusing to mutate blind')
  process.exit(2)
}

const ratchetEmptied =
  source.slice(0, startIdx) + 'const KNOWN_FAIL_OPEN = []' + source.slice(endIdx + 1)

// A builder that reports nothing and carries no ratchet entry — the shape the
// matrix exists to catch. Injected into BUILDER_PROBES, which is declared
// BEFORE KnownFailOpen in the real script, so this must run over the whole
// text rather than the tail.
const probeMarker = 'const BUILDER_PROBES = {'
const mutated = ratchetEmptied.replace(
  probeMarker,
  probeMarker + "\n  '__synthetic_fail_open__()': () => ({ check: () => {} }),",
)

// ASSERT THE PATCH APPLIED. A mutation that silently no-ops turns this fixture
// into a green that proves nothing — the exact failure it exists to detect,
// one level up. (Measured: an earlier version replaced over the wrong half of
// the file and injected nothing, and reported only "exited 0, expected 1".)
if (!mutated.includes('__synthetic_fail_open__')) {
  console.error(
    'bad-vacuity-matrix: the synthetic fail-open probe was NOT injected — ' +
      `marker ${JSON.stringify(probeMarker)} not found. Refusing to report a verdict.`,
  )
  process.exit(2)
}

// process.exit() bypasses pending `finally` blocks in Node — compute the
// verdict first, clean up the mutated file, THEN exit exactly once.
let exitCode

try {
  writeFileSync(mutatedScript, mutated)

  const r = spawnSync(process.execPath, [mutatedScript], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      VACUITY_TSCONFIG_OVERRIDE: realTsconfig,
      VACUITY_NONEMPTY_TSCONFIG_OVERRIDE: realNonEmptyTsconfig,
    },
  })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`

  const SENTINEL = 'vacuity-matrix:'
  if (r.error !== undefined) {
    console.error(`bad-vacuity-matrix: unexpected error — ${r.error.message}`)
    exitCode = 2
  } else if (!out.includes(SENTINEL)) {
    console.error(`bad-vacuity-matrix: mutated matrix never printed its "${SENTINEL}" sentinel (exit ${String(r.status)})`)
    console.error(out.trim().split('\n').slice(0, 10).join('\n'))
    exitCode = 2
  } else if (r.status !== 1) {
    console.error(`bad-vacuity-matrix: mutated matrix exited ${String(r.status)}, expected 1 (a fail-open with no ratchet entry must fail the build)`)
    exitCode = 0
    // Naming the specific export, not just "something failed" (bug 0110's own
    // lesson) — schemaFromSDL() is a real, currently-ratcheted fail-open, so
    // stripping the ratchet must name exactly it.
  } else if (!out.includes('__synthetic_fail_open__() (builder) is fail-open with no KNOWN_FAIL_OPEN entry')) {
    console.error('bad-vacuity-matrix: matrix exited 1 but never named schemaFromSDL() as the unratcheted fail-open')
    console.error(out.trim().split('\n').slice(-10).join('\n'))
    exitCode = 0
  } else {
    // gateNode's `mustSay` check reads THIS fixture's own stdout/stderr, not
    // the inner mutated matrix's — relay the exact finding line, not just a
    // summary, or the outer gate can never confirm which export it named.
    const namedLine = out
      .split('\n')
      .find((l) => l.includes('__synthetic_fail_open__() (builder) is fail-open with no KNOWN_FAIL_OPEN entry'))
    console.error('bad-vacuity-matrix: OK — stripping KNOWN_FAIL_OPEN correctly turned a known-debt export into a build-failing finding, naming it')
    console.error(namedLine)
    exitCode = 1
  }
} finally {
  if (existsSync(mutatedScript)) rmSync(mutatedScript)
}

process.exit(exitCode)
