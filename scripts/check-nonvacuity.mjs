#!/usr/bin/env node
/**
 * NON-VACUITY HARNESS (plan 0060 Phase 6).
 *
 * A dogfood gate that passes because it inspects nothing (green-but-empty) is
 * worse than no gate: it manufactures false confidence. This harness proves the
 * opposite — that every gate actually FAILS when fed deliberately-violating
 * input. Each gate below is run against a hand-crafted bad input and asserted to
 * exit 1 (and, where possible, to name the specific rule that fired).
 *
 * Gate → violating input → rule that must fire:
 *   arch          packages/core/src/__nonvacuity_probe__.ts imports the raw
 *                 `typescript` compiler API → eess/adr002-no-raw-typescript.
 *   internal arch packages/core/src/__nonvacuity_probe_catch__.ts has a silent
 *                 `catch {}` → eess/no-silent-catch. (This gate has in-flight
 *                 violations from other agents; the clean direction is reported
 *                 informationally, not asserted.)
 *   baseline      packages/core/src/__nonvacuity_probe_eval__.ts has a function
 *                 calling `eval()` → preset/recommended/no-eval (the shipped
 *                 `recommended` preset run against our source by check:baseline).
 *   diagram       scripts/nonvacuity/bad-diagram.mmd has a class with no
 *                 <<kernel>> stereotype → diagram/kernel-stereotype.
 *   crossval      scripts/nonvacuity/ghost-diagram.mmd declares a class absent
 *                 from the kernel code → crossval/diagram-completeness.
 *   corpus/adr    scripts/nonvacuity/bad-adr/adr/999-bad.md declares tier 9 →
 *                 adr/valid-tiers.
 *   corpus/links  scripts/nonvacuity/bad-links/broken.md links a missing file →
 *                 the links().should().resolve() check.
 *
 * The three probe files are ephemeral: created just before their run, deleted in a
 * finally block, and swept at startup so a prior crash can never leave one in
 * packages/core/src. Everything else is a committed fixture under
 * scripts/nonvacuity/. Uses only node builtins + the workspace packages.
 *
 * Run: `node scripts/check-nonvacuity.mjs`. Exits 0 iff every gate failed on its
 * violating input. Not yet wired into package.json/CI (that lands in Phase 6).
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const EESS_TS = join(repoRoot, 'node_modules', '.bin', 'eess-ts')
const EESS_MERMAID = join(repoRoot, 'node_modules', '.bin', 'eess-mermaid')

const PROBE_ARCH = join(repoRoot, 'packages', 'core', 'src', '__nonvacuity_probe__.ts')
const PROBE_CATCH = join(repoRoot, 'packages', 'core', 'src', '__nonvacuity_probe_catch__.ts')
const PROBE_EVAL = join(repoRoot, 'packages', 'core', 'src', '__nonvacuity_probe_eval__.ts')

/** Run a command from the repo root and capture combined stdout+stderr + exit code. */
function sh(cmd, args) {
  // Force deterministic terminal-format output from the child CLIs: under
  // GitHub Actions, `--format auto` switches to `::error` annotations whose
  // text differs from the terminal renderer (e.g. it never contains the
  // literal "silent catch" phrase gateInternalArch greps for), so this
  // meta-check failed in CI while passing locally. The gates assert on output
  // substrings, so the child format must not vary by environment.
  const env = { ...process.env }
  delete env.GITHUB_ACTIONS
  delete env.CI
  const r = spawnSync(cmd, args, { cwd: repoRoot, encoding: 'utf8', env })
  if (r.error) return { code: 2, out: String(r.error.message) }
  // status is null when the process was killed by a signal — treat as harness error.
  return { code: r.status ?? 2, out: (r.stdout ?? '') + (r.stderr ?? '') }
}

/** Write a probe file, run `fn`, and always delete the probe afterward. */
function withProbe(path, contents, fn) {
  try {
    writeFileSync(path, contents)
    return fn()
  } finally {
    rmSync(path, { force: true })
  }
}

// Sweep any leftover probes before doing anything — they must never survive.
rmSync(PROBE_ARCH, { force: true })
rmSync(PROBE_CATCH, { force: true })
rmSync(PROBE_EVAL, { force: true })

// --- Gate: arch (root cross-package rules) ---
function gateArch() {
  const bad = withProbe(
    PROBE_ARCH,
    "import ts from 'typescript'\nexport const k = ts.SyntaxKind.ClassDeclaration\n",
    () => sh(EESS_TS, ['check', 'arch.rules.ts']),
  )
  const ok = bad.code === 1 && bad.out.includes('__nonvacuity_probe__')
  // Clean direction is a bonus proof that the gate is not always-red (informational).
  const clean = sh(EESS_TS, ['check', 'arch.rules.ts'])
  const cleanNote = clean.code === 0 ? 'clean → green' : `clean → exit ${clean.code} (in-flight)`
  return { ok, detail: `bad → exit ${bad.code} (eess/adr002-no-raw-typescript) · ${cleanNote}` }
}

// --- Gate: internal arch (intra-package rules) ---
function gateInternalArch() {
  const bad = withProbe(
    PROBE_CATCH,
    "export function probe() {\n  try {\n    JSON.parse('x')\n  } catch {}\n}\n",
    () => sh(EESS_TS, ['check', 'arch.internal.rules.ts']),
  )
  // Exit 1 alone is weak here (in-flight violations exist), so require the probe
  // itself to be named AND the silent-catch rule to have fired on it.
  const probeCaught =
    bad.out.includes('__nonvacuity_probe_catch__') && bad.out.includes('silent catch')
  const ok = bad.code === 1 && probeCaught
  const clean = sh(EESS_TS, ['check', 'arch.internal.rules.ts'])
  const cleanNote =
    clean.code === 0
      ? 'clean → green (both directions proven)'
      : 'clean → in-flight (other agents still fixing violations)'
  return { ok, detail: `bad → exit ${bad.code} (eess/no-silent-catch on probe) · ${cleanNote}` }
}

// --- Gate: baseline (the shipped `recommended` preset via check:baseline) ---
function gateBaseline() {
  const bad = withProbe(PROBE_EVAL, "export function probe() {\n  return eval('1 + 1')\n}\n", () =>
    sh(process.execPath, [join('scripts', 'check-baseline.mjs')]),
  )
  const ok = bad.code === 1 && bad.out.includes('__nonvacuity_probe_eval__')
  // Clean direction is a bonus proof the gate is not always-red (informational).
  const clean = sh(process.execPath, [join('scripts', 'check-baseline.mjs')])
  const cleanNote = clean.code === 0 ? 'clean → green' : `clean → exit ${clean.code}`
  return {
    ok,
    detail: `bad → exit ${bad.code} (preset/recommended/no-eval on probe) · ${cleanNote}`,
  }
}

// --- Gate: diagram (eess-mermaid) ---
function gateDiagram() {
  const r = sh(EESS_MERMAID, ['check', 'scripts/nonvacuity/bad-diagram.rules.ts'])
  const ok = r.code === 1 && /violation/i.test(r.out)
  return { ok, detail: `exit ${r.code} (diagram/kernel-stereotype)` }
}

// --- Gate: spec (eess-ts running a cross-dialect spec↔code correspondence) ---
function gateSpec() {
  // --format json so the ruleId is literally present (terminal format prints the
  // rule description, not the id).
  const r = sh(EESS_TS, ['check', 'scripts/nonvacuity/bad-spec.rules.ts', '--format', 'json'])
  const ok = r.code === 1 && r.out.includes('spec/nonvacuity-probe')
  return { ok, detail: `exit ${r.code} (spec/nonvacuity-probe)` }
}

// --- Node-script gates (crossval / adr / links): exit 1 = expected violation ---
function gateNode(script, ruleNote) {
  const r = sh(process.execPath, [join('scripts', 'nonvacuity', script)])
  // The fixture scripts exit 1 only on the intended violation (2 = unexpected
  // error, 0 = vacuous), so require exactly 1.
  return { ok: r.code === 1, detail: `exit ${r.code} (${ruleNote})` }
}

const gates = [
  ['arch (root rules)', gateArch],
  ['internal arch', gateInternalArch],
  ['baseline', gateBaseline],
  ['diagram', gateDiagram],
  ['spec', gateSpec],
  ['crossval', () => gateNode('bad-crossval.mjs', 'crossval/diagram-completeness')],
  ['corpus/adr', () => gateNode('bad-adr.mjs', 'adr/valid-tiers')],
  ['corpus/links', () => gateNode('bad-links.mjs', 'links resolve check')],
  ['corpus/pointers', () => gateNode('bad-pointers.mjs', 'live pointers resolve check')],
]

let allOk = true
for (const [name, run] of gates) {
  let res
  try {
    res = run()
  } catch (err) {
    res = { ok: false, detail: `harness error: ${err.message}` }
  }
  if (!res.ok) allOk = false
  const status = res.ok
    ? 'OK (fails on violating input)'
    : 'FAILED (did not fail on violating input)'
  console.log(`nonvacuity: ${name} — ${status} · ${res.detail}`)
}

console.log(
  allOk
    ? '\nnonvacuity: all gates fail on violating input — no gate is vacuous.'
    : '\nnonvacuity: at least one gate did NOT fail on violating input — see above.',
)
process.exit(allOk ? 0 : 1)
