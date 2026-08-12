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
 *   spec          scripts/nonvacuity/bad-spec.rules.ts → spec/nonvacuity-probe.
 *   crossval      scripts/nonvacuity/ghost-diagram.mmd declares a class absent
 *                 from the kernel code → crossval/diagram-completeness, in the
 *                 diagram→code direction specifically.
 *   crossval/gk   the gherkin-ts `red` fixture project cites scenarios absent
 *                 from the feature set → crossval/scenario-tests-resolve.
 *   corpus/adr    scripts/nonvacuity/bad-adr/adr/999-bad.md declares tier 9 →
 *                 adr/valid-tiers.
 *   corpus/links  scripts/nonvacuity/bad-links/broken.md links a missing file →
 *                 the links().should().resolve() check.
 *   corpus/ptr    scripts/nonvacuity/bad-pointers/ cites a line that does not
 *                 exist → the pointers().should().resolve() check.
 *   review-harness  scripts/nonvacuity/bad-review-harness/ carries foreign-project
 *                 tokens → check-review-harness.mjs.
 *   work/numbers  scripts/nonvacuity/bad-numbers/ claims one number in two lanes
 *                 → kit/scripts/next-number.mjs --check.
 *
 * THE FIXTURE CONTRACT (bug 0109). A node fixture must print its own
 * `bad-<name>:` sentinel on EVERY exit path, and exit 1 only for the specific
 * violation its gate is named for — 2 for any unexpected error, 0 when it found
 * nothing. `gateNode` disbelieves an exit code that arrives without the
 * sentinel, because node also exits 1 on an unhandled throw, a syntax error and
 * a failed module resolution; and a top-level import resolves before the
 * fixture's own try/catch, so only the harness can prove the fixture ran. Where
 * a preset bundles several checks, "it threw" is not enough either: assert the
 * violation's `ruleId` (and, for a two-directional check, its direction), or the
 * gate stays green when the rule it names is deleted.
 *
 * `harness self-check` is the instrument, not a measurement: it feeds gateNode
 * three deliberately-crashing stubs and requires each to be REJECTED. It is
 * excluded from the gate count so the denominator stays honest.
 *
 * The four probe files are ephemeral: created just before their run, deleted in a
 * finally block, and swept at startup so a prior crash can never leave one in
 * packages/core/src or scripts/nonvacuity/. Everything else is a committed
 * fixture under scripts/nonvacuity/. Uses only node builtins + the workspace
 * packages.
 *
 * Run: `node scripts/check-nonvacuity.mjs` (`npm run check:nonvacuity`, and in
 * the `validate` chain). Exits 0 iff every gate failed on its violating input.
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
    () => sh(EESS_TS, ['check', 'arch.rules.ts', '--format', 'json']),
  )
  // Require the ruleId too, not just the probe filename: a crash whose message
  // mentions the file would otherwise read as the rule firing (bug 0109).
  const ok =
    bad.code === 1 &&
    bad.out.includes('__nonvacuity_probe__') &&
    bad.out.includes('eess/adr002-no-raw-typescript')
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
  // The rule as well as the probe filename — see gateArch (bug 0109).
  // check-baseline.mjs renders terminal format, which prints the rule's
  // description rather than its id, so assert on the description's own phrase.
  const ok =
    bad.code === 1 &&
    bad.out.includes('__nonvacuity_probe_eval__') &&
    bad.out.includes("call to 'eval'")
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
  // --format json so the ruleId is literally present: `/violation/i` matched any
  // output containing the word, and never checked which rule fired (bug 0109).
  const r = sh(EESS_MERMAID, [
    'check',
    'scripts/nonvacuity/bad-diagram.rules.ts',
    '--format',
    'json',
  ])
  const ok = r.code === 1 && r.out.includes('diagram/kernel-stereotype')
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

// --- Node-script gates (crossval / adr / links / review-harness): exit 1 = expected violation ---
function gateNode(script, ruleNote) {
  const r = sh(process.execPath, [join('scripts', 'nonvacuity', script)])
  // Exit 1 is NOT sufficient on its own (bug 0109): node also exits 1 on an
  // unhandled throw, a syntax error, and a failed module resolution — and a
  // top-level import is resolved before the fixture's own try/catch can run, so
  // no amount of care inside the fixture closes that hole. Require the
  // fixture's own sentinel (`bad-<name>:`, which every fixture prints) as proof
  // it actually reached its reporting path.
  const sentinel = `${script.replace(/\.mjs$/, '')}:`
  const spoke = r.out.includes(sentinel)
  if (!spoke) {
    return {
      ok: false,
      code: r.code,
      detail: `exit ${r.code} but no "${sentinel}" output — the fixture never printed its sentinel`,
    }
  }
  // The fixture scripts exit 1 only on the intended violation (2 = unexpected
  // error, 0 = vacuous), so require exactly 1.
  return { ok: r.code === 1, code: r.code, detail: `exit ${r.code} (${ruleNote})` }
}

// --- Harness self-check: a crashed fixture must NOT read as a detected violation ---
// The harness proves every gate; this proves the harness.
//
// Each stub below dies a *different* way, and all three exit 1 without printing a
// sentinel — the exact three modes bug 0109 names. `gateNode` must reject every
// one. Rejection alone is not enough to assert: a stub that exits 0 is also
// rejected, so an emptied stub would "pass" while proving nothing (that was this
// self-check's own first defect, found in review). The stub must be shown to have
// really crashed — `code === 1` — *and* been rejected. That makes the stub
// contents load-bearing: empty one and this goes red.
const SELFTEST = join(repoRoot, 'scripts', 'nonvacuity', '__selftest_crash__.mjs')
const SELFTEST_STUBS = [
  // Relative, so no published-package name can ever accidentally satisfy it.
  ['unresolvable import', "import x from './__selftest_absent__.mjs'\nconsole.log(x)\n"],
  ['syntax error', 'const = = =\n'],
  ['top-level throw', "throw new Error('selftest')\n"],
]
function gateHarnessSelfCheck() {
  const bad = []
  for (const [label, source] of SELFTEST_STUBS) {
    const res = withProbe(SELFTEST, source, () =>
      gateNode('__selftest_crash__.mjs', 'self-check stub'),
    )
    if (res.ok !== false || res.code !== 1) {
      bad.push(`${label} → ok=${String(res.ok)} exit=${String(res.code)}`)
    }
  }
  return {
    ok: bad.length === 0,
    status:
      bad.length === 0 ? 'OK (rejects a crashed fixture)' : 'FAILED (accepted a crashed fixture)',
    detail:
      bad.length === 0
        ? `all ${SELFTEST_STUBS.length} crash modes rejected — each exited 1 with no sentinel`
        : `ACCEPTED a crashing stub — the sentinel check is broken (bug 0109): ${bad.join(' · ')}`,
  }
}
rmSync(SELFTEST, { force: true })

const gates = [
  ['harness self-check', gateHarnessSelfCheck],
  ['arch (root rules)', gateArch],
  ['internal arch', gateInternalArch],
  ['baseline', gateBaseline],
  ['diagram', gateDiagram],
  ['spec', gateSpec],
  ['crossval', () => gateNode('bad-crossval.mjs', 'crossval/diagram-completeness')],
  ['crossval/gherkin-ts', () => gateNode('bad-gherkin-ts.mjs', 'crossval/scenario-tests-resolve')],
  ['corpus/adr', () => gateNode('bad-adr.mjs', 'adr/valid-tiers')],
  ['corpus/links', () => gateNode('bad-links.mjs', 'links resolve check')],
  ['corpus/pointers', () => gateNode('bad-pointers.mjs', 'live pointers resolve check')],
  [
    'review-harness',
    () => gateNode('bad-review-harness.mjs', 'foreign-project drift in .claude review harness'),
  ],
  ['work/numbers', () => gateNode('bad-numbers.mjs', 'one number claimed by two lanes')],
]

let allOk = true
// The self-check is the instrument, not a measurement: it does not "fail on
// violating input", it rejects a crashed fixture. Counting it among the gates
// would inflate the denominator — the exact over-claim this harness exists to
// prevent — so it carries its own status wording and is excluded from the count.
let gateCount = 0
for (const [name, run] of gates) {
  let res
  try {
    res = run()
  } catch (err) {
    res = { ok: false, detail: `harness error: ${err.message}` }
  }
  if (!res.ok) allOk = false
  if (res.status === undefined) gateCount++
  const status =
    res.status ??
    (res.ok ? 'OK (fails on violating input)' : 'FAILED (did not fail on violating input)')
  console.log(`nonvacuity: ${name} — ${status} · ${res.detail}`)
}

console.log(
  allOk
    ? `\nnonvacuity: ${gateCount} gates each failed on their violating input — none is silently green.`
    : '\nnonvacuity: at least one gate did NOT fail on violating input — see above.',
)
process.exit(allOk ? 0 : 1)
