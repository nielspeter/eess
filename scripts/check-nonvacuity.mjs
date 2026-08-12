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
 *   release       scripts/nonvacuity/bad-release.mjs drives the release gate's
 *                 pure core with a changed-but-undeclared package and a
 *                 changeset naming a package that does not exist →
 *                 release/changed-package-needs-changeset +
 *                 release/changeset-names-real-package. Synthetic inputs, no git:
 *                 the diff half is the impure shell in check-release.mjs, and its
 *                 failure mode is a hard error on an unresolvable base ref rather
 *                 than a silent green.
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
 * The fixture must also PRINT that identifier — `gateNode`'s second argument is
 * asserted against the output, not just displayed (bug 0110), so a fixture that
 * exits 1 for some other reason cannot answer for the gate it is listed under.
 *
 * `harness self-check` and `gate coverage` are instruments, not measurements.
 * The first feeds gateNode four bad stubs — three that crash without printing a
 * sentinel, one that runs cleanly and exits 1 for the WRONG rule — and requires
 * every one to be REJECTED (liveness and identity, proven separately). The
 * second asserts that every `check:*` in package.json has a gate row or a stated
 * waiver, so deleting a row can no longer be a silent, green change. Both are
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
import { writeFileSync, rmSync, readFileSync, readdirSync, existsSync } from 'node:fs'
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
  if (r.error) return { code: 2, out: String(r.error.message), stdout: '', stderr: '' }
  // status is null when the process was killed by a signal — treat as harness error.
  const stdout = r.stdout ?? ''
  const stderr = r.stderr ?? ''
  // `out` is the merged view (for prose assertions); stdout is kept separate so a
  // gate can JSON.parse it — the CLIs put machine output on stdout and their
  // scan summaries on stderr (bug 0110).
  return { code: r.status ?? 2, out: stdout + stderr, stdout, stderr }
}

/**
 * Violations from a CLI run with `--format json`.
 *
 * `eess-ts check --format json` emits ONE pretty-printed document per failing
 * rule, concatenated — a JSON *stream*, not a document, so `JSON.parse` on the
 * whole of stdout throws as soon as two rules fail. Accumulate lines and parse
 * at each top-level `}`. Returns [] when nothing parses, which fails the
 * caller's assertion — the safe direction.
 */
function violationsOf(r) {
  const out = []
  let buf = ''
  for (const line of (r.stdout ?? '').split('\n')) {
    if (buf === '' && line.trim() === '') continue
    buf += buf === '' ? line : '\n' + line
    if (line === '}') {
      try {
        const doc = JSON.parse(buf)
        out.push(...(Array.isArray(doc) ? doc : (doc?.violations ?? [])))
        buf = ''
      } catch {
        // not a complete document yet — keep accumulating
      }
    }
  }
  return out
}

/** True when ONE violation carries both the rule and (optionally) the file. */
function firedOn(r, ruleId, fileFragment) {
  return violationsOf(r).some(
    (v) =>
      v?.ruleId === ruleId &&
      (fileFragment === undefined || String(v?.file ?? '').includes(fileFragment)),
  )
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
  // ONE violation must carry both the probe file and the rule. Two independent
  // substrings anywhere in the output could come from different findings — an
  // unrelated ADR-002 violation elsewhere would have satisfied the old check
  // (bug 0110).
  const ok = bad.code === 1 && firedOn(bad, 'eess/adr002-no-raw-typescript', '__nonvacuity_probe__')
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
    () => sh(EESS_TS, ['check', 'arch.internal.rules.ts', '--format', 'json']),
  )
  // Exit 1 alone is weak here (in-flight violations exist), so require the rule
  // to have fired ON THE PROBE — one record with both. Was a grep for the rule's
  // rendered description, which any rewording would have broken (bug 0110).
  const ok = bad.code === 1 && firedOn(bad, 'eess/no-silent-catch', '__nonvacuity_probe_catch__')
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
    sh(process.execPath, [join('scripts', 'check-baseline.mjs'), '--format', 'json']),
  )
  // One record carrying both the probe file and the rule id. This used to assert
  // the rule's rendered *description* ("call to 'eval'") because check-baseline
  // had no --format flag; it now has one (bug 0110), so no gate keys on prose.
  const ok =
    bad.code === 1 && firedOn(bad, 'preset/recommended/no-eval', '__nonvacuity_probe_eval__')
  // Clean direction is a bonus proof the gate is not always-red, and it is
  // DELIBERATELY informational: `cleanNote` never enters `ok`, so a genuine
  // `recommended` violation in packages/*/src leaves this row green. That is
  // correct division of labour and stated rather than discovered (bug 0129) —
  // this row's job is "the gate can fail", and catching a real violation is
  // `check:baseline`'s own, which runs in CI as of 0129's fix.
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
  const ok = r.code === 1 && firedOn(r, 'diagram/kernel-stereotype')
  return { ok, detail: `exit ${r.code} (diagram/kernel-stereotype)` }
}

// --- Gate: spec (eess-ts running a cross-dialect spec↔code correspondence) ---
function gateSpec() {
  // --format json so the ruleId is literally present (terminal format prints the
  // rule description, not the id).
  const r = sh(EESS_TS, ['check', 'scripts/nonvacuity/bad-spec.rules.ts', '--format', 'json'])
  const ok = r.code === 1 && firedOn(r, 'spec/nonvacuity-probe')
  return { ok, detail: `exit ${r.code} (spec/nonvacuity-probe)` }
}

// --- Node-script gates (crossval / adr / links / review-harness): exit 1 = expected violation ---
function gateNode(script, mustSay) {
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
  if (r.code !== 1) {
    return { ok: false, code: r.code, detail: `exit ${r.code} (${mustSay})` }
  }
  // ...and it must name the rule the gate claims. Proving the fixture RAN is not
  // proving the RIGHT rule fired: where a preset bundles several checks, any of
  // them satisfies "it exited 1", so the named rule could be deleted with the
  // gate still green (bug 0110). `mustSay` used to be display-only.
  if (!r.out.includes(mustSay)) {
    return {
      ok: false,
      code: r.code,
      detail: `exit 1 but never named "${mustSay}" — the fixture failed for some other reason`,
    }
  }
  return { ok: true, code: r.code, detail: `exit ${r.code} (${mustSay})` }
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
// A stub that runs perfectly, prints its sentinel and exits 1 — but for a
// different rule than the gate names. It must be rejected too: liveness is not
// identity (bug 0110). This one exits 1 on purpose, so it is asserted separately
// from the three crash stubs above.
const SELFTEST_WRONG_RULE =
  "console.error('__selftest_crash__: detected something, but not what was asked')\nprocess.exit(1)\n"
function gateHarnessSelfCheck() {
  const bad = []
  // Liveness: three crash modes, each exiting 1 without ever printing a sentinel.
  for (const [label, source] of SELFTEST_STUBS) {
    const res = withProbe(SELFTEST, source, () =>
      gateNode('__selftest_crash__.mjs', 'self-check stub'),
    )
    if (res.ok !== false || res.code !== 1) {
      bad.push(`${label} → ok=${String(res.ok)} exit=${String(res.code)}`)
    }
  }
  // Identity: a stub that runs, speaks and exits 1 — for the wrong rule.
  const wrong = withProbe(SELFTEST, SELFTEST_WRONG_RULE, () =>
    gateNode('__selftest_crash__.mjs', 'the/rule-that-was-asked-for'),
  )
  if (wrong.ok !== false || wrong.code !== 1) {
    bad.push(`wrong rule → ok=${String(wrong.ok)} exit=${String(wrong.code)}`)
  }
  const modes = SELFTEST_STUBS.length + 1
  return {
    ok: bad.length === 0,
    status:
      bad.length === 0
        ? 'OK (rejects a crashed or mis-firing fixture)'
        : 'FAILED (accepted a crashed or mis-firing fixture)',
    detail:
      bad.length === 0
        ? `all ${modes} modes rejected — 3 crashes with no sentinel, 1 exiting 1 for the wrong rule`
        : `ACCEPTED a bad stub — the gateNode assertions are broken (bugs 0109/0110): ${bad.join(' · ')}`,
  }
}
rmSync(SELFTEST, { force: true })

const gates = [
  ['harness self-check', gateHarnessSelfCheck],
  ['gate coverage', () => gateCoverage()],
  ['ci runs the chain', gateCiRunsValidate],
  ['arch (root rules)', gateArch],
  ['internal arch', gateInternalArch],
  ['baseline', gateBaseline],
  ['diagram', gateDiagram],
  ['spec', gateSpec],
  ['crossval', () => gateNode('bad-crossval.mjs', 'crossval/diagram-completeness')],
  ['crossval/gherkin-ts', () => gateNode('bad-gherkin-ts.mjs', 'crossval/scenario-tests-resolve')],
  ['crossval/md-ts', () => gateNode('bad-md-ts.mjs', 'crossval/adr-citations-resolve')],
  ['corpus/adr', () => gateNode('bad-adr.mjs', 'adr/valid-tiers')],
  // Three rows, one per rule the fixture must make fire. The fixture exits 0
  // unless ALL three do, so any one of them going quiet reddens all three rows —
  // and the gate list NAMES what is proven, instead of one row standing in for a
  // preset with three findings (bug 0110's lesson, applied to its own waiver).
  ['corpus/ledger/box', () => gateNode('bad-ledger.mjs', 'ledger/silent-open-box')],
  ['corpus/ledger/placement', () => gateNode('bad-ledger.mjs', 'ledger/state-folder-mismatch')],
  ['corpus/ledger/state', () => gateNode('bad-ledger.mjs', 'ledger/unknown-state')],
  ['corpus/links', () => gateNode('bad-links.mjs', 'nonvacuity/broken-links')],
  ['corpus/pointers', () => gateNode('bad-pointers.mjs', 'nonvacuity/pointers-resolve')],
  // One row per release rule, asserting rule AND element as an exact set:
  // neutering the changed-package correspondence still emits its rule id (for the
  // ghost declaration instead of the undeclared package), so a rule-name
  // assertion passes a gate that no longer checks anything.
  //
  // Plus a fourth row for the impure SHELL, which the pure fixture cannot see.
  // Measured while fixing 0106: the core caught 11 of 11 mutations and the shell
  // 0 of 7 — including deleting its `process.exit(1)`, leaving a gate that
  // reports every violation and fails no build.
  [
    'release/needs-changeset',
    () => gateNode('bad-release.mjs', 'release/changed-package-needs-changeset'),
  ],
  [
    'release/names-real-package',
    () => gateNode('bad-release.mjs', 'release/changeset-names-real-package'),
  ],
  ['release/unparseable', () => gateNode('bad-release.mjs', 'release/unparseable-changeset')],
  [
    'release/gate-fails-the-build',
    () => gateNode('bad-release-e2e.mjs', 'release/changed-package-needs-changeset'),
  ],
  ['review-harness', () => gateNode('bad-review-harness.mjs', 'foreign-project token')],
  ['work/numbers', () => gateNode('bad-numbers.mjs', 'duplicate number across lanes')],
]

// --- Coverage: every check:* in the validate chain has a gate, or a stated waiver ---
// The gate list is hand-maintained, so deleting a row was a silent, green change
// — the same class as a vacuous gate, one level up (bug 0110). Waivers are
// explicit and must say why.
const NO_GATE_NEEDED = {
  'check:fast': 'an alias — runs corpus + spec + arch, each gated on its own',
  'check:nonvacuity': 'this harness',
  'check:integrity': 'no-gate-yet — npm workspace guardrails, see 0110',
  'check:examples': 'no-gate-yet — tsc over examples/, see 0110',
  'check:docs-code': 'no-gate-yet — doc fences compile, see 0110',
}
// A check:* script may run several presets, and one gate row proves only the one
// preset its fixture violates. Mapping a script to a single row therefore
// over-claims: `check:crossval` ran five presets against one row and printed
// "every check:* accounted for" while the ADR↔test direction — the subject of
// bug 0104 — could be emptied and stay green. So the value is a LIST, and it is
// the list a reader can audit against the script. Bug 0112 tracks the three
// presets still uncovered.
const GATE_FOR = {
  // `eess-ts check arch.rules.ts arch.internal.rules.ts` — two rule files, two rows.
  'check:arch': ['arch (root rules)', 'internal arch'],
  'check:baseline': ['baseline'],
  'check:diagram': ['diagram'],
  'check:spec': ['spec'],
  'check:crossval': ['crossval', 'crossval/gherkin-ts', 'crossval/md-ts'],
  'check:corpus': ['corpus/adr', 'corpus/links', 'corpus/pointers'],
  'check:review-harness': ['review-harness'],
  'check:numbers': ['work/numbers'],
  'check:ledger': ['corpus/ledger/box', 'corpus/ledger/placement', 'corpus/ledger/state'],
  'check:release': [
    'release/needs-changeset',
    'release/names-real-package',
    'release/unparseable',
    'release/gate-fails-the-build',
  ],
}
// Rows that measure the harness itself rather than a check:* script. They are
// excluded from the count for the reason stated at the run loop below.
const INSTRUMENTS = new Set(['harness self-check', 'gate coverage', 'ci runs the chain'])

// --- Coverage: every `validate` step runs in a merge-blocking workflow ---
// `validate` and `.github/workflows/` are two hand-maintained lists of the same
// thing and nothing bound them, so four gates were added to the chain in PRs
// whose CI was green because the workflow was not part of the change (bug 0129).
//
// Note which list is authoritative here, because `gateCoverage()` above reads
// the other one: for the claim "this gate blocks a merge" the workflow is the
// source of truth, and `package.json` is precisely the list a gate can be absent
// from while still looking accounted for.
//
// Every failure to LOOK is reported as a failure, never as "nothing found"
// (bug 0120): no workflow directory, no PR-triggered workflow and an unreadable
// `validate` chain each fail loudly rather than passing over an empty set.
const WORKFLOWS = join(repoRoot, '.github', 'workflows')

function validateChain() {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
  return String(pkg.scripts?.validate ?? '')
    .split('&&')
    .map((s) => s.trim())
    .filter((s) => s.startsWith('npm run '))
    .map((s) => s.slice('npm run '.length).trim())
}

// The verdict, as ONE function taking its inputs — so the controls below drive
// the same code the gate does. A control holding its own copy of this logic
// would pass while the gate was reverted, which is the defect bug 0127 is about
// and the shape ts-archunit's vacuity matrix found in its own expiry gate.
function ciChainCoverage(chain, workflowDir) {
  const fail = (why) => ({
    ok: false,
    status: 'FAILED (cannot prove CI runs the chain)',
    detail: why,
  })

  if (chain.length === 0) return fail('the validate chain is empty or unreadable')

  if (!existsSync(workflowDir)) return fail(`${workflowDir} does not exist`)
  const files = readdirSync(workflowDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
  if (files.length === 0) return fail('no workflow files')

  // A workflow counts only if it is triggered by `pull_request` — a tag- or
  // dispatch-triggered one runs after the merge it was supposed to block.
  // The trigger is read from the `on:` block alone, not from the file at large,
  // so the words "pull_request" in a step name or comment cannot vote.
  const merging = []
  for (const f of files) {
    const src = readFileSync(join(workflowDir, f), 'utf8')
    const lines = src.split('\n')
    const start = lines.findIndex((l) => /^on:/.test(l))
    if (start === -1) continue
    let end = lines.length
    for (let i = start + 1; i < lines.length; i++) {
      if (/^\S/.test(lines[i])) {
        end = i
        break
      }
    }
    if (!/pull_request/.test(lines.slice(start, end).join('\n'))) continue
    merging.push({
      file: f,
      runs: new Set([...src.matchAll(/npm run ([\w:@/-]+)/g)].map((m) => m[1])),
    })
  }
  if (merging.length === 0) return fail('no workflow is triggered by pull_request')

  // A workflow running `validate` itself covers every step by construction.
  if (merging.some((w) => w.runs.has('validate'))) {
    return {
      ok: true,
      status: 'OK (a PR workflow runs the whole chain)',
      detail: `${chain.length} validate steps covered by npm run validate`,
    }
  }

  const covered = new Set(merging.flatMap((w) => [...w.runs]))
  const missing = chain.filter((step) => !covered.has(step))
  return {
    ok: missing.length === 0,
    status:
      missing.length === 0
        ? 'OK (every validate step blocks a merge)'
        : 'FAILED (a validate step runs in no merge-blocking workflow)',
    detail:
      missing.length === 0
        ? `${chain.length} validate steps across ${merging.length} PR workflow(s), 0 unrun`
        : `${missing.length} of ${chain.length} run in no PR workflow: ${missing.join(', ')}`,
  }
}

function gateCiRunsValidate() {
  const chain = validateChain()
  // Controls, driving `ciChainCoverage` itself: prove the instrument can report
  // a failure to LOOK rather than passing over an empty set (bug 0120). Without
  // these, a version that returned `{ ok: true }` on a missing directory would
  // be green here forever — a gate that cannot fail, inside the harness whose
  // whole subject is gates that cannot fail.
  const controls = [
    ['no workflow directory', ciChainCoverage(chain, join(repoRoot, '__no_such_workflows__'))],
    ['empty validate chain', ciChainCoverage([], WORKFLOWS)],
  ]
  const blind = controls.filter(([, r]) => r.ok !== false).map(([label]) => label)
  if (blind.length > 0) {
    return {
      ok: false,
      status: 'FAILED (the instrument cannot report a failure to look)',
      detail: `these should have failed and did not: ${blind.join(' · ')}`,
    }
  }
  return ciChainCoverage(chain, WORKFLOWS)
}
function gateCoverage() {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
  const checks = Object.keys(pkg.scripts ?? {}).filter((k) => k.startsWith('check:'))
  const names = new Set(gates.map(([n]) => n))
  const problems = []
  for (const c of checks) {
    if (NO_GATE_NEEDED[c] !== undefined) continue
    const g = GATE_FOR[c]
    if (g === undefined) problems.push(`${c} has no gate and no waiver`)
    else if (g.length === 0) problems.push(`${c} maps to an empty gate list`)
    else
      for (const one of g) {
        if (!names.has(one)) problems.push(`${c} maps to gate "${one}", which is not in the list`)
      }
  }
  // Every gate row must be claimed by some check:*, or the list has grown a row
  // nothing runs — the same silent drift one level over.
  const claimed = new Set(Object.values(GATE_FOR).flat())
  for (const [n] of gates) {
    if (typeof n === 'string' && !claimed.has(n) && !INSTRUMENTS.has(n)) {
      problems.push(`gate "${n}" is in the list but no check:* claims it`)
    }
  }
  const waived = Object.keys(NO_GATE_NEEDED).filter((k) => checks.includes(k)).length
  return {
    ok: problems.length === 0,
    status:
      problems.length === 0
        ? 'OK (every check:* accounted for)'
        : 'FAILED (a check:* is unaccounted for)',
    detail:
      problems.length === 0
        ? `${checks.length} check:* scripts — ${Object.keys(GATE_FOR).length} gated by ` +
          `${Object.values(GATE_FOR).flat().length} fixtures, ${waived} waived`
        : problems.join(' · '),
  }
}

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
